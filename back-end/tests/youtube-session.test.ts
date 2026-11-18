import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, chmod, rm, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { Connection } from "mongoose";
import { DelayedError, type Job } from "bullmq";
import { connectDatabase } from "../src/config/database.js";
import { parseEnv, type Env } from "../src/config/env.js";
import { createYoutubeSessionMonitor, YoutubeSessionPaused, youtubeResumeDelay } from "../src/services/youtube-session.js";
import { YoutubeImportError } from "../src/services/youtube-importer.js";
import { createCreditService } from "../src/modules/credits/credit-service.js";
import { createVideoModel } from "../src/modules/videos/video.model.js";
import type { UploadService } from "../src/modules/uploads/upload-service.js";
import { importVideo } from "../src/jobs/import-video.js";
import { processingQuote } from "@clipvelto/credit-plans";

let database: MongoMemoryReplSet;
let connection: Connection;
let directory: string;
let env: Env;
let messages: { to: string; subject: string; text: string }[];
let monitor: ReturnType<typeof createYoutubeSessionMonitor>;
let VideoModel: ReturnType<typeof createVideoModel>;
const cookie = "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tsynthetic-session";
const mailer = {
  send() {},
  async deliver(message: typeof messages[number]) { messages.push(message); },
  async drain() {},
};
before(async () => {
  directory = await mkdtemp(join(tmpdir(), "clipvelto-session-tests-"));
  database = await MongoMemoryReplSet.create({ binary: { version: "8.2.6" }, replSet: { count: 1 } });
  connection = await connectDatabase(database.getUri("youtube-session-tests"));
  VideoModel = createVideoModel(connection);
  await VideoModel.init();
  env = parseEnv({ NODE_ENV: "test", MONGODB_URI: database.getUri("youtube-session-tests"),
    BETTER_AUTH_SECRET: "session-monitor-test-secret-at-least-32-characters", YOUTUBE_COOKIES_FILE: join(directory, "cookies.txt"),
    CONTACT_TO_EMAIL: "owner@example.com", YOUTUBE_ALERT_TO_EMAIL: "alerts@example.com", UPLOAD_QUEUE_PREFIX: "youtube-session-tests" });
});
beforeEach(async () => {
  await connection.collection("youtube_session_incidents").deleteMany({});
  await VideoModel.deleteMany({});
  await writeFile(env.YOUTUBE_COOKIES_FILE!, cookie, { mode: 0o600 });
  await chmod(env.YOUTUBE_COOKIES_FILE!, 0o600);
  messages = [];
  monitor = createYoutubeSessionMonitor(connection, env, mailer);
});
after(async () => {
  await monitor?.close();
  await connection?.close();
  await database?.stop();
  if (directory) await rm(directory, { recursive: true, force: true });
});
const botFailure = () => new YoutubeImportError({ code: "BOT_CHECK" }, 1024);

test("API and worker share the pause and send one alert without session values", async () => {
  const other = createYoutubeSessionMonitor(connection, env, mailer);
  await Promise.all([
    assert.rejects(monitor.run(async () => { throw botFailure(); }), YoutubeSessionPaused),
    assert.rejects(other.run(async () => { throw botFailure(); }), YoutubeSessionPaused),
  ]);
  let attempted = false;
  await assert.rejects(other.run(async () => { attempted = true; }), YoutubeSessionPaused);
  assert.equal(attempted, false);
  await Promise.all([monitor.notify(), other.notify()]);
  await other.notify();
  assert.equal(messages.length, 1);
  assert.equal(messages[0]!.to, "alerts@example.com");
  assert.ok(!JSON.stringify(messages).includes("synthetic-session"));
  const incident = await connection.collection("youtube_session_incidents").findOne({});
  assert.ok(!JSON.stringify(incident).includes("synthetic-session"));
  await other.close();
});

test("unavailable individual videos do not pause the service", async () => {
  await assert.rejects(monitor.run(async () => { throw new YoutubeImportError({ code: "UNAVAILABLE" }, 1024); }), YoutubeImportError);
  await monitor.assertAvailable();
  await monitor.notify();
  assert.equal(messages.length, 0);
});

test("an explicit expired-session signal pauses imports before anonymous fallback", async () => {
  await assert.rejects(monitor.run(async () => { throw new YoutubeImportError({ code: "SESSION_EXPIRED" }, 1024); }), YoutubeSessionPaused);
  await assert.rejects(monitor.assertAvailable(), YoutubeSessionPaused);
  await monitor.notify();
  assert.equal(messages.length, 1);
});

test("a replaced export allows retry; a stale success cannot clear a new challenge", async () => {
  let finish!: () => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const pending = monitor.run(async () => { started(); await new Promise<void>((resolve) => { finish = resolve; }); });
  await ready;
  await writeFile(env.YOUTUBE_COOKIES_FILE!, cookie + "-replacement");
  await assert.rejects(monitor.run(async () => { throw botFailure(); }), YoutubeSessionPaused);
  finish();
  await pending;
  await assert.rejects(monitor.assertAvailable(), YoutubeSessionPaused);
  await writeFile(env.YOUTUBE_COOKIES_FILE!, cookie + "-renewed");
  assert.equal(await monitor.run(async () => "recovered"), "recovered");
  assert.equal((await connection.collection("youtube_session_incidents").findOne({}))?.blocked, false);
  await monitor.notify();
  assert.equal(messages.length, 0);
});

test("unreadable or unsafe session files pause imports, and failed alert delivery retries", async () => {
  await chmod(env.YOUTUBE_COOKIES_FILE!, 0o644);
  await assert.rejects(monitor.assertAvailable(), YoutubeSessionPaused);
  let attempts = 0;
  const failing = createYoutubeSessionMonitor(connection, env, { ...mailer, async deliver() { attempts++; throw new Error("SMTP unavailable"); } });
  await failing.notify();
  await failing.notify();
  assert.equal(attempts, 1);
  await connection.collection("youtube_session_incidents").updateMany({}, { $set: { nextAlertAt: new Date(0) } });
  await monitor.notify();
  assert.equal(messages.length, 1);
  await failing.close();
});

test("paused queued jobs release only their owner's credits and remain resumable", async () => {
  const credits = createCreditService(connection);
  await credits.init();
  const video = await VideoModel.create({ userId: "session-owner", title: "Session test", originalFilename: "test.mp4",
    sourceProvider: "youtube", youtubeId: "abcdefghijk", status: "import_queued", validationGeneration: 1, expectedSize: 1 });
  await credits.reserveWork(video.userId, String(video._id), 600);
  await credits.summary("other-owner");
  const uploads = { youtube: monitor, creditsFor: () => credits, assertProcessingMode() {}, envForUser: async () => env,
    Quota: { async updateOne() { return { modifiedCount: 1 }; } },
    storage: { async putFile() {}, async head() { return { ETag: "fixture" }; }, async remove() {} },
  } as unknown as UploadService;
  let delayedUntil = 0;
  const job = { data: { videoId: String(video._id), generation: 1 }, async moveToDelayed(until: number, token: string) {
    delayedUntil = until; assert.equal(token, "worker-lock");
  } } as unknown as Job<{ videoId: string; generation: number }>;
  const since = Date.now();
  const importer = async () => { throw botFailure(); };
  await assert.rejects(importVideo(job, { ...env, YOUTUBE_ENABLED: true }, uploads, VideoModel, new AbortController().signal, importer, "worker-lock"), DelayedError);
  assert.ok(delayedUntil >= since + youtubeResumeDelay);
  assert.equal((await credits.summary(video.userId)).reserved, 0);
  assert.equal((await credits.summary(video.userId)).available, 15);
  assert.equal((await credits.summary("other-owner")).available, 15);
  const saved = await VideoModel.findById(video._id);
  assert.equal(saved?.status, "import_queued");
  assert.equal(saved?.importFailureCode, "SESSION_PAUSED");
  assert.equal(saved?.validationRunId, undefined);
  await writeFile(env.YOUTUBE_COOKIES_FILE!, cookie + "-renewed");
  let resumed = 0;
  const recovered = async (_env: Env, _id: string, temp: string) => {
    resumed++;
    const path = join(temp, "source.mp4");
    await copyFile(new URL("./fixtures/spoken-video.mp4", import.meta.url), path);
    return { path, title: "Recovered fixture", live: false };
  };
  await importVideo(job, { ...env, YOUTUBE_ENABLED: true }, uploads, VideoModel, new AbortController().signal, recovered, "worker-lock");
  assert.equal(resumed, 1);
  const ready = await VideoModel.findById(video._id);
  assert.equal(ready?.status, "ready");
  const quote = processingQuote(ready!.durationSeconds!, ready!.expectedSize!);
  const balance = await credits.summary(video.userId);
  assert.equal(balance.reserved, quote.credits);
  assert.equal(balance.used, 0);
  assert.equal(balance.available, 15 - quote.credits);
  assert.equal((await credits.summary("other-owner")).available, 15);
});
