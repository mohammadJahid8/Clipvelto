import { before, after, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Server } from "node:http";
import type { Connection } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { startLocalUploadServices } from "../scripts/local-upload-services.js";
import { createApp } from "../src/app.js";
import { parseEnv, type Env } from "../src/config/env.js";
import { connectDatabase } from "../src/config/database.js";
import { startUploadWorker } from "../src/jobs/upload-worker.js";
import { probeVideo } from "../src/jobs/probe-video.js";
import { createUploadService } from "../src/modules/uploads/upload-service.js";
import { createVideoModel } from "../src/modules/videos/video.model.js";
import { z } from "zod";
import { transcribeLocal } from "../src/services/local-transcriber.js";
import { transcribe as transcribeConfigured } from "../src/services/transcriber.js";
import { TranscriptionProviderError } from "../src/services/transcription-error.js";
import { importYoutube } from "../src/services/youtube-importer.js";
import { selectHighlights } from "../src/services/highlight-selector.js";
import { renderClip } from "../src/services/clip-renderer.js";
import { youtubeVideoId } from "../src/modules/imports/youtube-url.js";
import { maximumProcessingSeconds, maximumObjectBytes } from "../src/modules/uploads/processing-limits.js";
import {
  transcriptSchema,
  transcriptText,
  type Transcript,
} from "../src/modules/transcription/transcript.js";

const origin = "http://localhost:3000";
const password = "a long upload testing passphrase";
const sessionSchema = z.object({
  videoId: z.string(),
  uploadUrl: z.string(),
  headers: z.record(z.string(), z.string()),
});
let database: MongoMemoryReplSet;
let services: Awaited<ReturnType<typeof startLocalUploadServices>>;
let directory: string;
let connection: Connection;
let server: Server;
let instance: Awaited<ReturnType<typeof createApp>>;
let worker: Awaited<ReturnType<typeof startUploadWorker>> | null;
let env: Env;
let url: string;
let cookie: string;
let userId: string;
const fixture = await readFile(
  new URL("./fixtures/short-video.webm", import.meta.url),
);

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "clipvelto-uploads-"));
  database = await MongoMemoryReplSet.create({
    binary: { version: "8.2.2" },
    replSet: { count: 1 },
  });
  services = await startLocalUploadServices(join(directory, "services"));
});
beforeEach(async () => {
  env = parseEnv({
    NODE_ENV: "test",
    MONGODB_URI: database.getUri(`uploads-${randomUUID()}`),
    BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
    BETTER_AUTH_URL: origin,
    MAIL_DIRECTORY: join(directory, "mail"),
    UPLOADS_ENABLED: "true",
    REDIS_URL: services.redisUrl,
    STORAGE_ENDPOINT: services.endpoint,
    STORAGE_REGION: "us-east-1",
    STORAGE_BUCKET: services.bucket,
    STORAGE_ACCESS_KEY_ID: "S3RVER",
    STORAGE_SECRET_ACCESS_KEY: "S3RVER",
    STORAGE_FORCE_PATH_STYLE: "true",
    UPLOAD_QUEUE_PREFIX: `test-${randomUUID()}`,
    FFMPEG_PATH: process.env.FFMPEG_PATH,
    FFPROBE_PATH: process.env.FFPROBE_PATH,
  });
  connection = await connectDatabase(env.MONGODB_URI);
  instance = await createApp(connection, env, {
    verifyTrialChallenge: async (_env, token) => token.startsWith("valid-"),
  });
  await instance.uploads!.queue.waitUntilReady();
  server = await new Promise<Server>((resolve) => {
    const active = instance.app.listen(0, "127.0.0.1", () => resolve(active));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  url = `http://127.0.0.1:${address.port}`;
  const account = await verifiedAccount();
  cookie = account.cookie;
  userId = account.userId;
  worker = null;
});
afterEach(async () => {
  await worker?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await instance.mailer.drain();
  await instance.uploads!.close();
  await connection.dropDatabase();
  await connection.close();
});
after(async () => {
  await services?.close();
  await database?.stop();
  if (directory) await rm(directory, { recursive: true, force: true });
});

function request(
  path: string,
  body?: unknown,
  customCookie = cookie,
  method = body === undefined ? "GET" : "POST",
  requestOrigin = origin,
) {
  if (
    (path === "/uploads" || path === "/imports/youtube") &&
    body &&
    typeof body === "object"
  )
    body = { renderOptions: { aspectRatio: "9:16", captions: true }, ...body };
  return fetch(`${url}/api/v1${path}`, {
    method,
    headers: {
      origin: requestOrigin,
      cookie: customCookie,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
}
async function verifiedAccount() {
  const email = `${randomUUID()}@example.test`;
  const authRequest = (path: string, body?: unknown) =>
    fetch(`${url}/api/auth${path}`, {
      method: body ? "POST" : "GET",
      headers: { origin, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
  const signup = await authRequest("/sign-up/email", {
    name: "Upload Creator",
    email,
    password,
  });
  assert.equal(signup.status, 200);
  const userId = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await signup.json()).user.id;
  assert.equal((await authRequest("/email-otp/send-verification-otp", { email, type: "email-verification" })).status, 200);
  await instance.mailer.drain();
  let otp = "";
  for (const filename of (await readdir(env.MAIL_DIRECTORY)).sort()) {
    const mail = JSON.parse(await readFile(join(env.MAIL_DIRECTORY, filename), "utf8")) as { to: string; text: string };
    if (mail.to === email) otp = mail.text.match(/\b\d{6}\b/u)?.[0] ?? "";
  }
  assert.ok(otp);
  assert.equal((await authRequest("/email-otp/verify-email", { email, otp })).status, 200);
  const login = await authRequest("/sign-in/email", { email, password });
  assert.equal(login.status, 200);
  return {
    userId,
    cookie: login.headers
      .getSetCookie()
      .map((item) => item.split(";", 1)[0])
      .join("; "),
  };
}
async function initialize(body: Record<string, unknown> = {}) {
  const response = await request("/uploads", {
    filename: "my-video.webm",
    contentType: "video/webm",
    sizeBytes: fixture.length,
    ownsRights: true,
    ...body,
  });
  assert.equal(response.status, 201, await response.clone().text());
  return sessionSchema.parse(await response.json());
}
async function put(
  session: z.infer<typeof sessionSchema>,
  bytes: Buffer = fixture,
) {
  const response = await fetch(session.uploadUrl, {
    method: "PUT",
    headers: session.headers,
    body: new Uint8Array(bytes),
  });
  assert.equal(response.status, 200, await response.clone().text());
}
async function startWorker(
  transcribe?: typeof transcribeConfigured,
  importer?: typeof importYoutube,
  selector?: typeof selectHighlights,
  renderer?: typeof renderClip,
) {
  worker = await startUploadWorker(
    connection,
    env,
    instance.uploads!,
    instance.VideoModel,
    transcribe,
    importer,
    selector,
    renderer,
  );
}
async function waitForVideo(id: string, status: string) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const video = await instance.VideoModel.findById(id);
    if (video?.status === status) return video;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  const video = await instance.VideoModel.findById(id);
  assert.fail(
    `Expected ${status}, received ${video?.status}: ${video?.statusMessage}`,
  );
}

for (const source of ["device", "youtube", "admin-youtube"] as const) {
  test(`automatic ${source} upload creates clips without a second action`, async () => {
    env.TRANSCRIPTION_ENABLED = true;
    env.CLIPS_ENABLED = true;
    env.YOUTUBE_ENABLED = true;
    env.ANTHROPIC_API_KEY = "isolated-test-key";
    const admin = source === "admin-youtube";
    if (admin) {
      await instance.uploads!.credits.account(userId);
      await instance.uploads!.credits.Account.updateOne({ _id: userId }, { $set: { role: "admin" } });
      const config = await (await request("/uploads/config")).json();
      assert.equal(config.importMaxSeconds, maximumProcessingSeconds);
      assert.equal(config.maxBytes, maximumObjectBytes);
    }
    const path = new URL("./fixtures/spoken-video.mp4", import.meta.url);
    const bytes = await readFile(path);
    let transcriptions = 0;
    let selections = 0;
    let id: string;
    if (source === "device") {
      const upload = await initialize({ filename: "spoken-video.mp4", contentType: "video/mp4", sizeBytes: bytes.length });
      await put(upload, bytes);
      const completions = await Promise.all([
        request(`/videos/${upload.videoId}/complete`, {}),
        request(`/videos/${upload.videoId}/complete`, {}),
      ]);
      assert.ok(completions.every(response => response.status === 202));
      id = upload.videoId;
    } else {
      const response = await request("/imports/youtube", {
        url: "https://youtu.be/5B1FGk3CMyg", captureSeconds: 60, ownsRights: true,
      });
      assert.equal(response.status, 202);
      id = (await response.json()).video.id;
    }
    await startWorker(async (activeEnv) => {
      assert.ok(activeEnv.TRANSCRIPTION_MAX_SECONDS >= 3 && activeEnv.TRANSCRIPTION_MAX_SECONDS < 60);
      transcriptions++;
      return { model: "small", language: "en", segments: [{ start: 0, end: 3,
        text: "A useful idea worth sharing.", words: [{ start: 0, end: 3, word: "A useful idea worth sharing." }] }] };
    }, async (activeEnv, _id, directory) => {
      assert.equal(activeEnv.UPLOAD_MAX_BYTES, maximumObjectBytes);
      assert.equal(activeEnv.TRANSCRIPTION_MAX_SECONDS, maximumProcessingSeconds);
      const output = join(directory, "source.mp4");
      await copyFile(path, output);
      return { title: "Authorized test recording", live: false, path: output };
    }, async () => {
      selections++;
      return [{ title: "A useful idea", start: 0, end: 3 }];
    });
    const deadline = Date.now() + 30000;
    let video;
    while (Date.now() < deadline) {
      video = await instance.VideoModel.findById(id);
      if (video?.clipStatus === "completed") break;
      if (video?.status === "failed" || video?.clipStatus === "failed")
        assert.fail(video.clipMessage ?? video.statusMessage ?? "Processing failed");
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(video?.clipStatus, "completed");
    assert.equal(transcriptions, 1);
    assert.equal(selections, 1);
    assert.equal(video.clips.length, 1);
    const charged = await instance.credits.summary(userId);
    assert.equal(charged.available, admin ? null : 14);
    assert.equal(charged.reserved, 0);
    assert.equal(charged.used, admin ? 0 : 1);
    await worker!.maintain();
    const balance = await instance.uploads!.credits.summary(userId);
    assert.equal(balance.reserved, 0);
    assert.equal(balance.used, admin ? 0 : Math.max(60, Math.ceil(video.durationSeconds!)) / 60);
    const download = await request(`/videos/${id}/clips/0/download`);
    assert.equal(download.status, 302);
    assert.equal((await fetch(download.headers.get("location")!)).status, 200);
    assert.equal((await request(`/videos/${id}/clips/0/download`, undefined, "")).status, 401);
  });
}

test("real signed upload, queue delivery, metadata checks, and idempotent completion", async () => {
  const upload = await initialize();
  assert.match(
    new URL(upload.uploadUrl).searchParams.get("X-Amz-SignedHeaders")!,
    /content-length/,
  );
  assert.match(
    new URL(upload.uploadUrl).searchParams.get("X-Amz-SignedHeaders")!,
    /content-type/,
  );
  await put(upload);
  assert.equal(
    (await request(`/videos/${upload.videoId}/complete`, {})).status,
    202,
  );
  assert.equal(
    (await request(`/videos/${upload.videoId}/complete`, {})).status,
    202,
  );
  await startWorker();
  const video = await waitForVideo(upload.videoId, "ready");
  assert.ok(video.durationSeconds! > 0);
  assert.equal(video.width, 160);
  assert.equal(video.height, 90);
  assert.equal(video.container, "WebM");
  assert.match(video.sha256!, /^[a-f0-9]{64}$/);
  const response = await request(`/videos/${upload.videoId}`);
  const body = await response.text();
  assert.ok(
    !body.includes("stagingKey") &&
      !body.includes("sourceKey") &&
      !body.includes("uploadUrl"),
  );
  assert.equal(
    (await instance.uploads!.queue.getJobs(["completed"])).length,
    1,
  );
  const quota = await instance.uploads!.Quota.findById(userId);
  assert.equal(quota?.videos, 1);
  assert.equal(quota.bytes, fixture.length);
});

test("storage rejects unsigned requests, tampered types, paths, and signatures", async () => {
  const upload = await initialize();
  const address = new URL(upload.uploadUrl);
  address.search = "";
  assert.equal(
    (await fetch(address, { method: "PUT", body: new Uint8Array(fixture) }))
      .status,
    403,
  );
  assert.equal(
    (
      await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4" },
        body: new Uint8Array(fixture),
      })
    ).status,
    403,
  );
  const changed = new URL(upload.uploadUrl);
  changed.pathname += "-other";
  assert.equal(
    (
      await fetch(changed, {
        method: "PUT",
        headers: upload.headers,
        body: new Uint8Array(fixture),
      })
    ).status,
    403,
  );
  await put(upload);
  assert.equal((await fetch(address)).status, 403);
});

test("uploads require a verified owner, rights confirmation, valid limits, and a trusted origin", async () => {
  assert.equal((await request("/uploads", {}, "")).status, 401);
  for (const body of [
    { ownsRights: false },
    { sizeBytes: maximumObjectBytes + 1 },
    { filename: "../private.webm" },
    { filename: "fake.exe" },
    { contentType: "text/plain" },
    { userId: "another-user" },
  ]) {
    assert.equal(
      (
        await request("/uploads", {
          filename: "video.webm",
          contentType: "video/webm",
          sizeBytes: fixture.length,
          ownsRights: true,
          ...body,
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (await request("/uploads", {}, cookie, "POST", "https://untrusted.example"))
      .status,
    403,
  );
  const upload = await initialize();
  const other = await verifiedAccount();
  for (const [path, body, method] of [
    [`/videos/${upload.videoId}`, undefined, "GET"],
    [`/videos/${upload.videoId}/complete`, {}, "POST"],
    [`/videos/${upload.videoId}`, undefined, "DELETE"],
  ] as const)
    assert.equal((await request(path, body, other.cookie, method)).status, 404);
});

test("size mismatches and missing objects never enqueue work", async () => {
  const upload = await initialize();
  assert.equal(
    (await request(`/videos/${upload.videoId}/complete`, {})).status,
    409,
  );
  assert.equal(
    (
      await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: upload.headers,
        body: new Uint8Array(Buffer.from("short")),
      })
    ).status,
    403,
  );
  assert.equal(
    (await instance.uploads!.queue.getJobs(["waiting", "active"])).length,
    0,
  );
});

test("disguised non-video files are rejected by the actual metadata worker", async () => {
  const bytes = Buffer.from(
    "This is not a video, regardless of its extension and declared content type.",
  );
  const upload = await initialize({ sizeBytes: bytes.length });
  await put(upload, bytes);
  await request(`/videos/${upload.videoId}/complete`, {});
  await startWorker();
  const video = await waitForVideo(upload.videoId, "failed");
  assert.equal(video.failureKind, "invalid");
  assert.match(video.statusMessage!, /video|readable/i);
});

test("legacy duration settings do not override funded imports and real format checks", async () => {
  env.UPLOAD_MAX_SECONDS = 0.5;
  const upload = await initialize();
  await put(upload);
  await request(`/videos/${upload.videoId}/complete`, {});
  await startWorker();
  const video = await waitForVideo(upload.videoId, "ready");
  assert.ok(video.durationSeconds! > 0.5);
  await assert.rejects(
    probeVideo(
      new URL("./fixtures/short-video.webm", import.meta.url).pathname,
      "video/mp4",
      7200,
    ),
    /doesn’t match/,
  );
});

test("credit reservations are atomic under concurrent upload initiation", async () => {
  await instance.credits.account(userId);
  await instance.credits.Account.updateOne({ _id: userId }, { $set: { availableSeconds: 60 } });
  const body = {
    filename: "video.webm",
    contentType: "video/webm",
    sizeBytes: fixture.length,
    ownsRights: true,
  };
  const results = await Promise.all([
    request("/uploads", body),
    request("/uploads", body),
  ]);
  assert.deepEqual(
    results.map((response) => response.status).sort(),
    [201, 402],
  );
  assert.equal(await instance.VideoModel.countDocuments({ userId }), 1);
  const quota = await instance.uploads!.Quota.findById(userId);
  assert.equal(quota?.bytes, fixture.length);
  assert.equal(quota.videos, 1);
});

test("cancelled and expired uploads release quota only after storage cleanup", async () => {
  const upload = await initialize();
  await put(upload);
  assert.equal(
    (await request(`/videos/${upload.videoId}`, undefined, cookie, "DELETE"))
      .status,
    202,
  );
  assert.equal(
    (await request(`/videos/${upload.videoId}/complete`, {})).status,
    404,
  );
  assert.equal((await instance.uploads!.Quota.findById(userId))?.videos, 1);
  await instance.VideoModel.updateOne(
    { _id: upload.videoId },
    { $set: { uploadExpiresAt: new Date(0) } },
  );
  await startWorker();
  assert.equal(await instance.VideoModel.findById(upload.videoId), null);
  assert.equal((await instance.uploads!.Quota.findById(userId))?.videos, 0);
  await worker!.maintain();
  assert.equal((await instance.uploads!.Quota.findById(userId))?.bytes, 0);
});

test("replaying a staging upload cannot overwrite the checked source video", async () => {
  const upload = await initialize();
  await put(upload);
  await request(`/videos/${upload.videoId}/complete`, {});
  await startWorker();
  const video = await waitForVideo(upload.videoId, "ready");
  await put(upload, Buffer.alloc(fixture.length));
  assert.equal(
    (await request(`/videos/${upload.videoId}/complete`, {})).status,
    202,
  );
  const source = await instance.uploads!.storage.get(
    video.sourceKey!,
    video.sourceEtag!,
  );
  assert.deepEqual(
    Buffer.from(await source.Body!.transformToByteArray()),
    fixture,
  );
});

test("queued uploads recover after the API queue producer becomes unavailable", async () => {
  const upload = await initialize();
  await put(upload);
  await instance.uploads!.queue.close();
  assert.equal(
    (await request(`/videos/${upload.videoId}/complete`, {})).status,
    202,
  );
  assert.equal(
    (await instance.VideoModel.findById(upload.videoId))?.status,
    "queued",
  );
  const recoveryConnection = await connectDatabase(env.MONGODB_URI);
  const RecoveryVideos = createVideoModel(recoveryConnection);
  const recoveryUploads = await createUploadService(
    recoveryConnection,
    env,
    RecoveryVideos,
  );
  const recoveryWorker = await startUploadWorker(
    recoveryConnection,
    env,
    recoveryUploads,
    RecoveryVideos,
  );
  try {
    await waitForVideo(upload.videoId, "ready");
  } finally {
    await recoveryWorker.close();
    await recoveryUploads.close();
    await recoveryConnection.close();
  }
});

test("stale validating records are safely rescheduled with a new generation", async () => {
  const upload = await initialize();
  await put(upload);
  await request(`/videos/${upload.videoId}/complete`, {});
  await instance.uploads!.queue.pause();
  await instance.VideoModel.updateOne(
    { _id: upload.videoId },
    {
      $set: {
        status: "validating",
        validationRunId: "interrupted",
        updatedAt: new Date(0),
      },
    },
    { timestamps: false },
  );
  await startWorker();
  await instance.uploads!.queue.resume();
  const video = await waitForVideo(upload.videoId, "ready");
  assert.equal(video.validationGeneration, 1);
});

const sampleTranscript: Transcript = {
  model: "small",
  language: "en",
  segments: [
    {
      start: 0.1,
      end: 0.9,
      text: "A useful idea.",
      words: [
        { start: 0.1, end: 0.3, word: "A" },
        { start: 0.3, end: 0.6, word: " useful" },
        { start: 0.6, end: 0.9, word: " idea." },
      ],
    },
  ],
};
async function readyVideo() {
  const upload = await initialize();
  await put(upload);
  await request(`/videos/${upload.videoId}/complete`, {});
  await startWorker(async () => sampleTranscript);
  await waitForVideo(upload.videoId, "ready");
  await worker!.close();
  worker = null;
  return upload.videoId;
}
async function waitForTranscript(id: string, status: string) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const video = await instance.VideoModel.findById(id).select("+transcript");
    if (video?.transcriptionStatus === status) return video;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Transcript did not reach ${status}`);
}

test("transcription is gated, requires a checked source, owner, and trusted origin", async () => {
  const id = await readyVideo();
  assert.equal((await request(`/videos/${id}/transcribe`, {})).status, 503);
  env.TRANSCRIPTION_ENABLED = true;
  assert.equal((await request(`/videos/${id}/transcribe`, {}, "")).status, 401);
  const other = await verifiedAccount();
  assert.equal(
    (await request(`/videos/${id}/transcribe`, {}, other.cookie)).status,
    404,
  );
  assert.equal(
    (await request(`/videos/${id}/transcript`, undefined, other.cookie)).status,
    404,
  );
  assert.equal(
    (
      await request(
        `/videos/${id}/transcribe`,
        {},
        cookie,
        "POST",
        "https://untrusted.example",
      )
    ).status,
    403,
  );
  const pending = await initialize();
  assert.equal(
    (await request(`/videos/${pending.videoId}/transcribe`, {})).status,
    409,
  );
  env.TRANSCRIPTION_MAX_SECONDS = 1;
  assert.equal((await request(`/videos/${id}/transcribe`, {})).status, 400);
  assert.equal((await request(`/videos/${id}/transcript`)).status, 409);
});

test("transcription requests are atomic, queued once, private, and export timestamped subtitles", async () => {
  const id = await readyVideo();
  env.TRANSCRIPTION_ENABLED = true;
  const results = await Promise.all(
    Array.from({ length: 4 }, () => request(`/videos/${id}/transcribe`, {})),
  );
  assert.ok(results.every((response) => response.status === 202));
  assert.equal(
    (await instance.VideoModel.findById(id))?.transcriptionGeneration,
    1,
  );
  let calls = 0;
  await startWorker(async () => {
    calls++;
    return sampleTranscript;
  });
  const video = await waitForTranscript(id, "completed");
  assert.equal(video.status, "ready");
  assert.equal(calls, 1);
  const result = await request(`/videos/${id}/transcript`);
  assert.deepEqual(
    ((await result.json()) as { transcript: Transcript }).transcript,
    sampleTranscript,
  );
  assert.equal(result.headers.get("cache-control"), "no-store");
  const srt = await request(`/videos/${id}/transcript?format=srt`);
  assert.match(
    srt.headers.get("content-disposition")!,
    /attachment; filename="transcript-/,
  );
  assert.equal(
    await srt.text(),
    "1\n00:00:00,100 --> 00:00:00,900\nA useful idea.\n",
  );
  assert.equal(
    await (await request(`/videos/${id}/transcript?format=txt`)).text(),
    "A useful idea.\n",
  );
  assert.equal(
    (await request(`/videos/${id}/transcript?format=invalid`)).status,
    400,
  );
  assert.ok(
    !(await (await request("/videos")).text()).includes("A useful idea."),
  );
  assert.ok(
    !(await (await request(`/videos/${id}`)).text()).includes("A useful idea."),
  );
  assert.equal((await request(`/videos/${id}/transcribe`, {})).status, 200);
  assert.equal(calls, 1);
  assert.equal(await instance.uploads!.queue.getGlobalConcurrency(), 1);
});

test("a failed transcription preserves the source and can be retried", async () => {
  const id = await readyVideo();
  env.TRANSCRIPTION_ENABLED = true;
  await request(`/videos/${id}/transcribe`, {});
  await startWorker(async () => {
    throw new Error("Private decoder details must not leak");
  });
  const failed = await waitForTranscript(id, "failed");
  assert.equal(failed.status, "ready");
  assert.ok(failed.sourceKey);
  assert.ok(!failed.transcriptionMessage?.includes("Private decoder"));
  assert.ok(
    !(await instance.VideoModel.findById(id).select("+transcript"))?.transcript,
  );
  await worker!.close();
  worker = null;
  await request(`/videos/${id}/transcribe`, {});
  await startWorker(async () => sampleTranscript);
  assert.equal(
    (await waitForTranscript(id, "completed")).transcriptionGeneration,
    2,
  );
});

test("reconciliation recovers missed transcription delivery and fails stale runs safely", async () => {
  const id = await readyVideo();
  env.TRANSCRIPTION_ENABLED = true;
  await instance.VideoModel.updateOne(
    { _id: id },
    { $set: { transcriptionStatus: "queued", transcriptionGeneration: 1 } },
  );
  await startWorker(async () => sampleTranscript);
  await waitForTranscript(id, "completed");
  await instance.VideoModel.updateOne(
    { _id: id },
    {
      $set: {
        transcriptionStatus: "processing",
        transcriptionRunId: "stale",
        transcriptionHeartbeatAt: new Date(0),
      },
    },
  );
  await worker!.maintain();
  assert.equal(
    (await instance.VideoModel.findById(id))?.transcriptionStatus,
    "failed",
  );
});

test("removing a video during transcription cannot resurrect it or save its transcript", async () => {
  const id = await readyVideo();
  env.TRANSCRIPTION_ENABLED = true;
  let entered!: () => void;
  let finish!: () => void;
  const enteredPromise = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const finishPromise = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await request(`/videos/${id}/transcribe`, {});
  await startWorker(async () => {
    entered();
    await finishPromise;
    return sampleTranscript;
  });
  await enteredPromise;
  assert.equal(
    (await request(`/videos/${id}`, undefined, cookie, "DELETE")).status,
    202,
  );
  finish();
  await worker!.close();
  worker = null;
  const video = await instance.VideoModel.findById(id).select("+transcript");
  assert.equal(video?.status, "deleting");
  assert.ok(!video.transcript);
  assert.equal((await request(`/videos/${id}/transcript`)).status, 404);
});

test("transcript validation rejects invalid timestamps and formats SRT hour boundaries", () => {
  assert.equal(
    transcriptSchema.safeParse({
      ...sampleTranscript,
      segments: [{ ...sampleTranscript.segments[0], start: 3, end: 1 }],
    }).success,
    false,
  );
  assert.equal(
    transcriptSchema.safeParse({ ...sampleTranscript, segments: [] }).success,
    false,
  );
  assert.equal(
    transcriptSchema.safeParse({ ...sampleTranscript, emptyReason: "no_audio" })
      .success,
    false,
  );
  assert.match(
    transcriptText(
      {
        ...sampleTranscript,
        segments: [
          { start: 3599.9998, end: 3601, text: "Hello\nworld", words: [] },
        ],
      },
      "srt",
    ),
    /01:00:00,000 --> 01:00:01,000\nHello world/,
  );
});

test(
  "real local CPU model transcribes a spoken video with word timestamps",
  { skip: process.env.RUN_LOCAL_TRANSCRIPTION_TESTS !== "1" },
  async () => {
    const bytes = await readFile(
      new URL("./fixtures/spoken-video.webm", import.meta.url),
    );
    const upload = await initialize({
      filename: "spoken-video.webm",
      sizeBytes: bytes.length,
    });
    await put(upload, bytes);
    await request(`/videos/${upload.videoId}/complete`, {});
    env.TRANSCRIPTION_ENABLED = true;
    await startWorker();
    await waitForVideo(upload.videoId, "ready");
    assert.equal(
      (await request(`/videos/${upload.videoId}/transcribe`, {})).status,
      202,
    );
    const video = await waitForTranscript(upload.videoId, "completed");
    assert.equal(video.transcript?.language, "en");
    assert.match(
      video.transcript.segments.map((segment) => segment.text).join(" "),
      /short recording/i,
    );
    assert.ok(
      video.transcript.segments.flatMap((segment) => segment.words).length > 10,
    );
    assert.equal(video.transcript.model, "small");
  },
);

test("YouTube URL validation rejects arbitrary hosts, credentials, playlists, and malformed IDs", () => {
  for (const value of [
    "https://youtu.be/YE7VzlLtp-4",
    "https://www.youtube.com/watch?v=YE7VzlLtp-4",
    "https://youtube.com/live/YE7VzlLtp-4",
  ])
    assert.equal(youtubeVideoId(value), "YE7VzlLtp-4");
  for (const value of [
    "http://youtube.com/watch?v=YE7VzlLtp-4",
    "https://youtube.com.evil.test/watch?v=YE7VzlLtp-4",
    "https://127.0.0.1/watch?v=YE7VzlLtp-4",
    "https://user:pass@youtube.com/watch?v=YE7VzlLtp-4",
    "https://youtube.com/watch?v=YE7VzlLtp-4&list=PL123",
    "https://youtube.com/@channel",
    "https://youtu.be/short",
  ])
    assert.throws(() => youtubeVideoId(value));
});

test("YouTube imports reserve quota, enforce ownership and rights, and recover a failed job", async () => {
  assert.equal(
    (
      await request("/imports/youtube", {
        url: "https://youtu.be/YE7VzlLtp-4",
        ownsRights: true,
      })
    ).status,
    503,
  );
  env.YOUTUBE_ENABLED = true;
  assert.equal(
    (
      await request("/imports/youtube", {
        url: "https://127.0.0.1/",
        ownsRights: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/imports/youtube", {
        url: "https://youtu.be/YE7VzlLtp-4",
        ownsRights: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/imports/youtube", {
        url: "https://youtu.be/YE7VzlLtp-4",
        ownsRights: true,
        captureSeconds: 3600,
      })
    ).status,
    400,
  );
  const response = await request("/imports/youtube", {
    url: "https://youtube.com/live/YE7VzlLtp-4",
    ownsRights: true,
    captureSeconds: 60,
  });
  assert.equal(response.status, 202);
  const body = (await response.json()) as {
    video: { id: string; status: string };
  };
  assert.equal(body.video.status, "import_queued");
  assert.equal(
    (await instance.uploads!.Quota.findById(userId))?.bytes,
    1,
  );
  await startWorker(undefined, async () => {
    throw new Error("YouTube unavailable");
  });
  await waitForVideo(body.video.id, "failed");
  await worker!.close();
  worker = null;
  assert.equal(
    (await request(`/videos/${body.video.id}/retry`, {})).status,
    202,
  );
  assert.equal(
    (await instance.VideoModel.findById(body.video.id))?.status,
    "import_queued",
  );
});

test(
  "YouTube import downloads a bounded live window, checks actual media, and releases unused reservation",
  { skip: process.env.RUN_MEDIA_TESTS !== "1" },
  async () => {
    env.YOUTUBE_ENABLED = true;
    const response = await request("/imports/youtube", {
      url: "https://youtube.com/live/YE7VzlLtp-4",
      ownsRights: true,
      captureSeconds: 60,
    });
    const body = (await response.json()) as { video: { id: string } };
    await startWorker(undefined, async (_env, id, directory, seconds) => {
      assert.equal(id, "YE7VzlLtp-4");
      assert.equal(seconds, 60);
      const path = join(directory, "source.mp4");
      await copyFile(
        new URL("./fixtures/spoken-video.mp4", import.meta.url),
        path,
      );
      return { path, title: "Captured livestream", live: true };
    });
    const video = await waitForVideo(body.video.id, "ready");
    assert.equal(video.title, "Captured livestream");
    assert.equal(video.sourceProvider, "youtube");
    assert.match(video.sha256!, /^[a-f0-9]{64}$/);
    assert.equal(
      (await instance.uploads!.Quota.findById(userId))?.bytes,
      video.expectedSize,
    );
    assert.ok(video.expectedSize! < env.UPLOAD_MAX_BYTES);
    assert.equal((await request(`/videos/${video._id}/clips`, {})).status, 503);
    await request(`/videos/${video._id}`, undefined, cookie, "DELETE");
    await instance.VideoModel.updateOne(
      { _id: video._id },
      { $set: { uploadExpiresAt: new Date(0) } },
    );
    await worker!.maintain();
    assert.equal(await instance.VideoModel.findById(video._id), null);
    assert.equal((await instance.uploads!.Quota.findById(userId))?.bytes, 0);
  },
);

test(
  "real FFmpeg renders a captioned vertical MP4 and serves only owner-authorized downloads",
  { skip: process.env.RUN_MEDIA_TESTS !== "1" },
  async () => {
    const bytes = await readFile(
      new URL("./fixtures/spoken-video.webm", import.meta.url),
    );
    const upload = await initialize({
      filename: "spoken-video.webm",
      sizeBytes: bytes.length,
    });
    await put(upload, bytes);
    await request(`/videos/${upload.videoId}/complete`, {});
    await startWorker();
    await waitForVideo(upload.videoId, "ready");
    await worker!.close();
    worker = null;
    env.TRANSCRIPTION_ENABLED = true;
    env.CLIPS_ENABLED = true;
    env.ANTHROPIC_API_KEY = "isolated-test-key";
    const transcript: Transcript = {
      model: "small",
      language: "en",
      segments: [
        {
          start: 0,
          end: 6,
          text: "A useful idea worth sharing.",
          words: [
            { start: 0, end: 1, word: "A useful" },
            { start: 1, end: 3, word: " idea" },
            { start: 3, end: 5, word: " worth sharing." },
          ],
        },
      ],
    };
    await instance.VideoModel.updateOne(
      { _id: upload.videoId },
      { $set: { transcript, transcriptionStatus: "completed" } },
    );
    const responses = await Promise.all([
      request(`/videos/${upload.videoId}/clips`, {}),
      request(`/videos/${upload.videoId}/clips`, {}),
    ]);
    assert.ok(responses.every((r) => r.status === 202));
    let selections = 0;
    await startWorker(undefined, undefined, async () => {
      selections++;
      return [{ title: "Useful idea", start: 0, end: 6 }];
    });
    const deadline = Date.now() + 30000;
    let video;
    while (Date.now() < deadline) {
      video = await instance.VideoModel.findById(upload.videoId);
      if (video?.clipStatus === "completed" || video?.clipStatus === "failed")
        break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(
      video?.clipStatus,
      "completed",
      video?.clipMessage ?? "Clip creation did not finish",
    );
    assert.equal(selections, 1);
    assert.equal(video.clips.length, 1);
    const response = await request(
      `/videos/${upload.videoId}/clips/0/download`,
    );
    assert.equal(response.status, 302);
    const download = await fetch(response.headers.get("location")!);
    assert.equal(download.status, 200);
    assert.ok((await download.arrayBuffer()).byteLength > 1000);
    const preview = await request(`/videos/${upload.videoId}/clips/0/preview`);
    assert.equal(preview.status, 302);
    assert.match(preview.headers.get("cache-control") ?? "", /no-store/);
    const playbackUrl = preview.headers.get("location")!;
    assert.equal(
      new URL(playbackUrl).searchParams.get("response-content-disposition"),
      "inline",
    );
    const range = await fetch(playbackUrl, {
      headers: { Range: "bytes=0-1023" },
    });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-type"), "video/mp4");
    assert.match(range.headers.get("content-range") ?? "", /^bytes 0-1023\//);
    assert.equal((await range.arrayBuffer()).byteLength, 1024);
    assert.equal(
      (
        await request(
          `/videos/${upload.videoId}/clips/0/preview`,
          undefined,
          "",
        )
      ).status,
      401,
    );
    const other = await verifiedAccount();
    assert.equal(
      (
        await request(
          `/videos/${upload.videoId}/clips/0/preview`,
          undefined,
          other.cookie,
        )
      ).status,
      404,
    );
    assert.equal(
      (await request(`/videos/${upload.videoId}/clips/1/preview`)).status,
      404,
    );
    assert.equal(
      (
        await request(
          `/videos/${upload.videoId}/clips/0/download`,
          undefined,
          other.cookie,
        )
      ).status,
      404,
    );
    assert.equal(
      (await request(`/videos/${upload.videoId}/clips/1/download`)).status,
      404,
    );
    assert.equal(
      (await instance.VideoModel.findById(upload.videoId))?.clipGeneration,
      1,
    );
    assert.equal(video.clipFormatVersion, 3);
    assert.equal(video.clipRenderRevision, 1);
    await worker!.close();
    worker = null;
    for (const status of ["queued", "failed"] as const) {
      await instance.VideoModel.updateOne(
        { _id: upload.videoId },
        { $set: { clipStatus: status } },
      );
      assert.equal(
        (await request(`/videos/${upload.videoId}/clips/0/preview`)).status,
        302,
      );
      const details = z
        .object({
          video: z.object({
            generation: z.object({
              revision: z.number(),
              clips: z.array(z.unknown()),
            }),
          }),
        })
        .parse(await (await request(`/videos/${upload.videoId}`)).json());
      assert.equal(details.video.generation.clips.length, 1);
      assert.equal(details.video.generation.revision, 1);
    }
  },
);

for (const action of ["transcribe", "clips"] as const)
  test(
    `Groq checkpoints stay private and ${action} retries resume saved progress`,
    { skip: process.env.RUN_MEDIA_TESTS !== "1" },
    async () => {
      const bytes = await readFile(
        new URL("./fixtures/spoken-video.webm", import.meta.url),
      );
      const upload = await initialize({
        filename: "spoken-video.webm",
        sizeBytes: bytes.length,
      });
      await put(upload, bytes);
      await request(`/videos/${upload.videoId}/complete`, {});
      await startWorker();
      const source = await waitForVideo(upload.videoId, "ready");
      await worker!.close();
      worker = null;
      env.TRANSCRIPTION_ENABLED = true;
      env.TRANSCRIPTION_PROVIDER = "groq";
      env.GROQ_API_KEY = "isolated-groq-key";
      env.CLIPS_ENABLED = action === "clips";
      env.ANTHROPIC_API_KEY = "isolated-selection-key";
      const checkpoint = {
        version: 1 as const,
        sourceSha256: source.sha256!,
        model: "whisper-large-v3-turbo" as const,
        sampleCount: 8 * 16000,
        chunks: [
          {
            index: 0,
            language: "en",
            words: [{ start: 0, end: 1, word: "private-checkpoint-word" }],
          },
        ],
      };
      let calls = 0;
      const controlled: typeof transcribeConfigured = async (
        _env,
        _source,
        _output,
        _signal,
        context,
      ) => {
        assert.ok(context);
        calls++;
        if (calls === 1) {
          await context.saveCheckpoint(checkpoint);
          assert.equal(
            (await instance.VideoModel.findById(upload.videoId))
              ?.transcriptionCheckpoint,
            undefined,
          );
          const publicResponse = await request(`/videos/${upload.videoId}`);
          const publicText = await publicResponse.text();
          assert.ok(!publicText.includes("private-checkpoint-word"));
          assert.ok(!publicText.includes("transcriptionCheckpoint"));
          throw new TranscriptionProviderError(429);
        }
        assert.deepEqual(context.checkpoint, checkpoint);
        return {
          ...sampleTranscript,
          provider: "groq",
          model: "whisper-large-v3-turbo",
        };
      };
      const waitFor = async (status: "failed" | "completed") => {
        const deadline = Date.now() + 20000;
        while (Date.now() < deadline) {
          const video = await instance.VideoModel.findById(
            upload.videoId,
          ).select("+transcriptionCheckpoint +transcript");
          if (
            (action === "clips"
              ? video?.clipStatus
              : video?.transcriptionStatus) === status
          )
            return video!;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        assert.fail("Transcription test did not finish");
      };
      await request(`/videos/${upload.videoId}/${action}`, {});
      await startWorker(controlled, undefined, async () => [
        { title: "Hosted speech", start: 0, end: 6 },
      ]);
      const failed = await waitFor("failed");
      assert.match(
        (action === "clips"
          ? failed.clipMessage
          : failed.transcriptionMessage)!,
        /usage limit/,
      );
      assert.equal(failed.transcriptionCheckpoint.chunks.length, 1);
      await worker!.close();
      worker = null;
      await request(`/videos/${upload.videoId}/${action}`, {});
      await startWorker(controlled, undefined, async () => [
        { title: "Hosted speech", start: 0, end: 6 },
      ]);
      const completed = await waitFor("completed");
      assert.equal(calls, 2);
      assert.equal(completed.transcriptionCheckpoint, undefined);
      assert.equal(completed.transcript?.provider, "groq");
      const transcriptResponse = await request(
        `/videos/${upload.videoId}/transcript`,
      );
      assert.equal(transcriptResponse.status, 200);
      assert.equal(
        z
          .object({ transcript: transcriptSchema })
          .parse(await transcriptResponse.json()).transcript.model,
        "whisper-large-v3-turbo",
      );
      if (action === "clips") assert.equal(completed.clips.length, 1);
    },
  );

for (const failedStage of ["selection", "rendering"] as const)
  test(
    `a ${failedStage} retry reuses saved work and records stage timings`,
    { skip: process.env.RUN_MEDIA_TESTS !== "1" },
    async () => {
      const bytes = await readFile(
        new URL("./fixtures/spoken-video.webm", import.meta.url),
      );
      const upload = await initialize({
        filename: "spoken-video.webm",
        sizeBytes: bytes.length,
      });
      await put(upload, bytes);
      await request(`/videos/${upload.videoId}/complete`, {});
      await startWorker();
      await waitForVideo(upload.videoId, "ready");
      await worker!.close();
      worker = null;
      env.TRANSCRIPTION_ENABLED = true;
      env.CLIPS_ENABLED = true;
      env.ANTHROPIC_API_KEY = "isolated-test-key";
      await instance.VideoModel.updateOne(
        { _id: upload.videoId },
        {
          $set: {
            transcript: sampleTranscript,
            transcriptionStatus: "completed",
          },
        },
      );
      let selections = 0;
      let transcriptions = 0;
      const noTranscribe: typeof transcribeLocal = async () => {
        transcriptions++;
        throw new Error("Saved transcript should be reused");
      };
      await request(`/videos/${upload.videoId}/clips`, {});
      await startWorker(
        noTranscribe,
        undefined,
        async () => {
          selections++;
          if (failedStage === "selection")
            throw new Error("Private selection diagnostic");
          return [{ title: "Saved selection", start: 0, end: 6 }];
        },
        async () => {
          throw new Error("Private renderer diagnostic");
        },
      );
      const waitForClips = async (status: string) => {
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          const video = await instance.VideoModel.findById(
            upload.videoId,
          ).select("+transcript");
          if (video?.clipStatus === status) return video;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        assert.fail(`Clips did not reach ${status}`);
      };
      const failed = await waitForClips("failed");
      assert.equal(failed.clipFailureStage, failedStage);
      assert.match(
        failed.clipMessage!,
        failedStage === "rendering"
          ? /rendering stopped/
          : /selection couldn’t complete/,
      );
      assert.ok(!failed.clipMessage!.includes("speech"));
      assert.equal(failed.clipPlan.length, failedStage === "rendering" ? 1 : 0);
      assert.ok((failed.clipTimingsMs?.total ?? -1) >= 0);
      assert.ok(failed.transcript);
      await worker!.close();
      worker = null;
      await request(`/videos/${upload.videoId}/clips`, {});
      await startWorker(noTranscribe, undefined, async () => {
        if (failedStage === "rendering")
          throw new Error("Saved selection should be reused");
        selections++;
        return [{ title: "Saved selection", start: 0, end: 6 }];
      });
      const completed = await waitForClips("completed");
      assert.equal(completed.clipGeneration, 2);
      assert.equal(completed.clips.length, 1);
      assert.equal(completed.clipFailureStage, undefined);
      assert.equal(selections, failedStage === "rendering" ? 1 : 2);
      assert.equal(transcriptions, 0);
      assert.equal(completed.clipTimingsMs?.transcription, undefined);
      assert.ok((completed.clipTimingsMs?.rendering ?? 0) > 0);
    },
  );

function publicRequest(
  body?: unknown,
  trialCookie = "",
  requestOrigin = origin,
) {
  return fetch(`${url}/api/public/trial`, {
    method: body ? "POST" : "GET",
    redirect: "manual",
    headers: {
      origin: requestOrigin,
      cookie: trialCookie,
      "content-type": "application/json",
      "x-forwarded-for": randomUUID(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
function enableTrial() {
  env.TRIAL_ENABLED =
    env.YOUTUBE_ENABLED =
    env.CLIPS_ENABLED =
    env.TRANSCRIPTION_ENABLED =
      true;
  env.ANTHROPIC_API_KEY = "isolated-selection-test";
  env.TURNSTILE_SITE_KEY = "isolated-site-key";
  env.TURNSTILE_SECRET_KEY = "isolated-secret-key";
}
const trialInput = () => ({
  url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  challengeToken: `valid-${randomUUID()}`,
});

test("public trials fail closed and reject untrusted origins, signed-in use and option overrides", async () => {
  assert.equal((await publicRequest(trialInput())).status, 503);
  enableTrial();
  assert.equal(
    (await publicRequest(trialInput(), "", "https://evil.test")).status,
    403,
  );
  assert.equal((await publicRequest(trialInput(), cookie)).status, 409);
  assert.equal(
    (await publicRequest({ ...trialInput(), url: "http://169.254.169.254/" }))
      .status,
    400,
  );
  assert.equal(
    (
      await publicRequest({
        ...trialInput(),
        renderOptions: { captions: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (await publicRequest({ ...trialInput(), challengeToken: "invalid" }))
      .status,
    403,
  );
  assert.equal(await instance.trials!.Trial.countDocuments(), 0);
});

test("trial tokens are consumed once and spoofing forwarding headers cannot reset network limits", async () => {
  enableTrial();
  const input = trialInput();
  const response = await publicRequest(input);
  assert.equal(response.status, 202, await response.clone().text());
  const setCookie = response.headers.get("set-cookie")!;
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\/api/i);
  assert.equal((await publicRequest(input)).status, 409);
  assert.equal((await publicRequest(trialInput())).status, 429);
  assert.equal(await instance.trials!.Trial.countDocuments(), 1);
  assert.equal(
    (await publicRequest(undefined, "clipvelto-trial=" + "0".repeat(64)))
      .status,
    200,
  );
  assert.deepEqual(await (await publicRequest()).json(), { status: "none" });
  assert.equal(
    (await fetch(`${url}/api/public/trial/preview`, { redirect: "manual" }))
      .status,
    404,
  );
});

test("concurrent trial creation respects the network fence and daily budget atomically", async () => {
  enableTrial();
  env.TRIAL_DAILY_MINUTES = 3;
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, (_, i) =>
      instance.trials!.create(trialInput().url, `network-${i}`, null),
    ),
  );
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(await instance.trials!.Trial.countDocuments(), 1);
  env.TRIAL_DAILY_MINUTES = 30;
  const sameNetwork = await Promise.allSettled(
    Array.from({ length: 6 }, () =>
      instance.trials!.create(trialInput().url, "same-network", null),
    ),
  );
  assert.equal(
    sameNetwork.filter((result) => result.status === "fulfilled").length,
    1,
  );
});

test("aspect ratio and explicit caption choices are required and server controlled", async () => {
  const body = {
    filename: "video.webm",
    contentType: "video/webm",
    sizeBytes: fixture.length,
    ownsRights: true,
  };
  for (const options of [
    undefined,
    { aspectRatio: "9:16" },
    { aspectRatio: "9:16", captions: "false" },
    { aspectRatio: "4:3", captions: true },
    { captions: false, role: "admin" },
  ]) {
    const response = await fetch(`${url}/api/v1/uploads`, {
      method: "POST",
      headers: { origin, cookie, "content-type": "application/json" },
      body: JSON.stringify({ ...body, renderOptions: options }),
    });
    assert.equal(response.status, 400);
  }
  for (const aspectRatio of ["9:16", "16:9", "1:1"]) {
    const upload = await initialize({
      renderOptions: { aspectRatio, captions: false },
    });
    const video = await instance.VideoModel.findById(upload.videoId);
    assert.equal(video?.renderOptions?.aspectRatio, aspectRatio);
    assert.equal(video?.renderOptions?.captions, false);
  }
});

test("concurrent transcription and clipping requests claim a single processing task", async () => {
  const id = await readyVideo();
  await instance.VideoModel.updateOne(
    { _id: id },
    { $set: { durationSeconds: 8 } },
  );
  env.TRANSCRIPTION_ENABLED = env.CLIPS_ENABLED = true;
  env.ANTHROPIC_API_KEY = "isolated-selection-test";
  const responses = await Promise.all([
    request(`/videos/${id}/clips`, {}),
    request(`/videos/${id}/transcribe`, {}),
  ]);
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [202, 409],
  );
  const video = await instance.VideoModel.findById(id);
  assert.equal(
    [video?.clipStatus, video?.transcriptionStatus].filter(
      (status) => status === "queued",
    ).length,
    1,
  );
  assert.equal(
    await instance.credits.Reservation.countDocuments({ _id: id }),
    1,
  );
});

test(
  "real trial preview stays private and defers full-quality rendering until one atomic claim",
  { skip: process.env.RUN_MEDIA_TESTS !== "1", timeout: 60000 },
  async () => {
    enableTrial();
    const started = await publicRequest(trialInput());
    assert.equal(started.status, 202);
    const guestCookie = started.headers
      .getSetCookie()
      .map((item) => item.split(";", 1)[0])
      .join("; ");
    const trial = (await instance.trials!.Trial.findOne())!;
    let renders = 0;
    const renderer: typeof renderClip = async (...args) => {
      renders++;
      return renderClip(...args);
    };
    const importer: typeof importYoutube = async (
      _env,
      _id,
      output,
      _signal,
      _window,
      previewSeconds,
    ) => {
      assert.equal(previewSeconds, 180);
      assert.equal(_env.UPLOAD_MAX_BYTES, 150 * 1024 ** 2);
      const path = join(output, "source.mp4");
      await copyFile(
        new URL("./fixtures/spoken-video.mp4", import.meta.url),
        path,
      );
      return { path, title: "Trial recording", live: false };
    };
    const transcript: Transcript = {
      ...sampleTranscript,
      segments: [
        { start: 0, end: 3, text: "First useful idea.", words: [] },
        { start: 3, end: 6, text: "Another useful idea.", words: [] },
      ],
    };
    await startWorker(
      async () => transcript,
      importer,
      async () => [
        { title: "First useful idea", start: 0, end: 3 },
        { title: "Another useful idea", start: 3, end: 6 },
      ],
      renderer,
    );
    async function completed() {
      const deadline = Date.now() + 25000;
      while (Date.now() < deadline) {
        const row = await instance.VideoModel.findById(trial.videoId).select(
          "+trialPreviewKey",
        );
        if (row?.clipStatus === "completed") return row;
        if (row?.clipStatus === "failed") assert.fail(row.clipMessage!);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.fail("Trial did not finish");
    }
    const video = await completed();
    assert.equal(video.clips.length, 0);
    assert.equal(video.clipPlan.length, 2);
    assert.ok(video.trialPreviewKey?.endsWith("/preview.mp4"));
    const publicState = await (
      await publicRequest(undefined, guestCookie)
    ).text();
    assert.equal(JSON.parse(publicState).lockedCount, 1);
    for (const secret of [
      video._id.toString(),
      video.trialPreviewKey!,
      "Another useful idea",
      "sourceKey",
      "transcript",
    ])
      assert.ok(!publicState.includes(secret));
    const preview = await fetch(`${url}/api/public/trial/preview`, {
      headers: { cookie: guestCookie },
      redirect: "manual",
    });
    assert.equal(preview.status, 302);
    assert.ok(
      decodeURIComponent(preview.headers.get("location")!).includes(
        "preview.mp4",
      ),
    );
    assert.equal(
      (
        await request(
          `/videos/${video._id}/clips/0/download`,
          undefined,
          guestCookie,
        )
      ).status,
      401,
    );
    assert.equal(
      (await request(`/videos/${video._id}/clips/0/download`)).status,
      404,
    );
    assert.equal((await request("/trial/claim", {}, guestCookie)).status, 401);
    await worker!.close();
    worker = null;
    // Exhausted balances and full storage cannot transfer ownership or consume part of a claim.
    await instance.credits.Account.updateOne(
      { _id: userId },
      { $setOnInsert: { availableSeconds: 0 } },
      { upsert: true },
    );
    await instance.credits.Account.updateOne(
      { _id: userId },
      { $set: { availableSeconds: 0 } },
    );
    assert.equal(
      (await request("/trial/claim", {}, `${cookie}; ${guestCookie}`)).status,
      402,
    );
    assert.match(
      (await instance.VideoModel.findById(video._id))!.userId,
      /^trial:/,
    );
    await instance.credits.Account.updateOne(
      { _id: userId },
      { $set: { availableSeconds: 900 } },
    );
    await instance.uploads!.Quota.updateOne(
      { _id: userId },
      { $set: { bytes: env.UPLOAD_USER_MAX_BYTES, videos: 1 } },
      { upsert: true },
    );
    assert.equal(
      (await request("/trial/claim", {}, `${cookie}; ${guestCookie}`)).status,
      409,
    );
    assert.equal((await instance.credits.summary(userId)).available, 15);
    await instance.uploads!.Quota.updateOne(
      { _id: userId },
      { $set: { bytes: 0, videos: 0 } },
    );
    const claims = await Promise.all(
      Array.from({ length: 5 }, () =>
        request("/trial/claim", {}, `${cookie}; ${guestCookie}`),
      ),
    );
    for (const claim of claims)
      assert.equal(claim.status, 200, await claim.clone().text());
    assert.equal(
      (await instance.VideoModel.findById(video._id))!.userId,
      userId,
    );
    assert.equal(
      await instance.credits.Reservation.countDocuments({ userId }),
      1,
    );
    assert.equal(
      (await instance.credits.summary(userId)).used,
      Math.ceil(video.durationSeconds!) / 60,
    );
    const other = await verifiedAccount();
    assert.equal(
      (await request("/trial/claim", {}, `${other.cookie}; ${guestCookie}`))
        .status,
      409,
    );
    assert.equal(
      (
        await fetch(`${url}/api/public/trial/preview`, {
          headers: { cookie: guestCookie },
          redirect: "manual",
        })
      ).status,
      404,
    );
    await startWorker(
      async () => {
        throw new Error("Should reuse transcript");
      },
      undefined,
      async () => {
        throw new Error("Should reuse selection");
      },
      renderer,
    );
    const unlocked = await completed();
    assert.equal(unlocked.clips.length, 2);
    assert.equal(renders, 3);
    assert.equal(
      (await request(`/videos/${video._id}/clips/1/download`)).status,
      302,
    );
    assert.equal(
      (
        await request(
          `/videos/${video._id}/clips/1/download`,
          undefined,
          other.cookie,
        )
      ).status,
      404,
    );
  },
);

test("two verified accounts cannot both claim a trial, and expired trials release reserved storage", async () => {
  enableTrial();
  const other = await verifiedAccount();
  const created = await instance.trials!.create(
    trialInput().url,
    "claim-race",
    null,
  );
  const trial = (await instance.trials!.Trial.findOne())!;
  await instance.VideoModel.updateOne(
    { _id: trial.videoId },
    {
      $set: { status: "ready", clipStatus: "completed", durationSeconds: 120 },
    },
  );
  const results = await Promise.allSettled([
    instance.trials!.claim(userId, created.token),
    instance.trials!.claim(other.userId, created.token),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const owner = (await instance.VideoModel.findById(trial.videoId))!.userId;
  assert.equal((await instance.credits.summary(owner)).used, 2);
  assert.equal(
    (await instance.credits.summary(owner === userId ? other.userId : userId))
      .available,
    15,
  );
  const expiring = await instance.trials!.create(
    trialInput().url,
    "expiry-network",
    null,
  );
  const expiry = (await instance.trials!.Trial.findOne({
    claimedBy: { $exists: false },
  }))!;
  await instance.trials!.Trial.updateOne(
    { _id: expiry._id },
    { $set: { expiresAt: new Date(0) } },
  );
  await instance.VideoModel.updateOne(
    { _id: expiry.videoId },
    { $set: { trialExpiresAt: new Date(0) } },
  );
  assert.equal((await instance.trials!.read(expiring.token)).status, "expired");
  await assert.rejects(
    instance.trials!.claim(userId, expiring.token),
    /expired/,
  );
  await assert.rejects(
    instance.trials!.preview(expiring.token),
    /no longer available/,
  );
  // The claimed fixture is already queued, so keep it out of this cleanup-only worker.
  await instance.VideoModel.updateOne(
    { _id: trial.videoId },
    { $set: { clipStatus: "completed" } },
  );
  await startWorker();
  await worker!.maintain();
  assert.equal(await instance.VideoModel.findById(expiry.videoId), null);
  const quota = await instance.uploads!.Quota.findById(`trial:${expiry._id}`);
  assert.equal(quota?.bytes, 0);
  assert.equal(quota?.videos, 0);
});

test("failed trials stop the claim-polling flow without consuming account credit", async () => {
  enableTrial();
  const created = await instance.trials!.create(
    trialInput().url,
    "failed-claim",
    null,
  );
  const trial = (await instance.trials!.Trial.findOne())!;
  const proof = `${cookie}; clipvelto-trial=${created.token}`;
  const errorSchema = z.object({ error: z.object({ code: z.string() }) });
  assert.equal(
    errorSchema.parse(await (await request("/trial/claim", {}, proof)).json())
      .error.code,
    "TRIAL_PROCESSING",
  );
  for (const state of [
    { status: "failed" },
    { status: "ready", clipStatus: "failed" },
  ]) {
    await instance.VideoModel.updateOne(
      { _id: trial.videoId },
      { $set: state },
    );
    const response = await request("/trial/claim", {}, proof);
    assert.equal(response.status, 409);
    assert.equal(
      errorSchema.parse(await response.json()).error.code,
      "TRIAL_FAILED",
    );
  }
  assert.equal((await instance.credits.summary(userId)).available, 15);
  assert.equal(await instance.credits.Reservation.countDocuments(), 0);
});
