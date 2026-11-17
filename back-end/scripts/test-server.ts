import { MongoMemoryReplSet } from "mongodb-memory-server";
import { randomBytes } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/config/database.js";
import { parseEnv } from "../src/config/env.js";
import { startLocalUploadServices } from "./local-upload-services.js";
import { startUploadWorker } from "../src/jobs/upload-worker.js";
import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { importYoutube } from "../src/services/youtube-importer.js";
import { selectHighlights } from "../src/services/highlight-selector.js";
import { transcribe } from "../src/services/transcriber.js";

const directory = fileURLToPath(
  new URL("../.local-data/browser-test-mail/", import.meta.url),
);
await rm(directory, { recursive: true, force: true });
await mkdir(directory, { recursive: true, mode: 0o700 });
const database = await MongoMemoryReplSet.create({
  binary: { version: "8.2.2" },
  replSet: { count: 1 },
});
const uri = database.getUri("clipvelto-browser-test");
const connection = await connectDatabase(uri);
const services = await startLocalUploadServices(
  fileURLToPath(
    new URL("../.local-data/browser-test-upload-services/", import.meta.url),
  ),
);
const env = parseEnv({
  NODE_ENV: "test",
  MONGODB_URI: uri,
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  BETTER_AUTH_URL: "http://localhost:3000",
  MAIL_DIRECTORY: directory,
  UPLOADS_ENABLED: "true",
  REDIS_URL: services.redisUrl,
  STORAGE_ENDPOINT: services.endpoint,
  STORAGE_REGION: "us-east-1",
  STORAGE_BUCKET: services.bucket,
  STORAGE_ACCESS_KEY_ID: "S3RVER",
  STORAGE_SECRET_ACCESS_KEY: "S3RVER",
  STORAGE_FORCE_PATH_STYLE: "true",
  UPLOAD_QUEUE_PREFIX: `browser-${randomBytes(8).toString("hex")}`,
  TRANSCRIPTION_ENABLED:
    process.env.RUN_GROQ_TESTS === "1" ||
    process.env.RUN_LOCAL_TRANSCRIPTION_TESTS === "1" ||
    process.env.RUN_MEDIA_TESTS === "1"
      ? "true"
      : "false",
  TRANSCRIPTION_PROVIDER: process.env.RUN_GROQ_TESTS === "1" ? "groq" : "local",
  GROQ_API_KEY:
    process.env.RUN_GROQ_TESTS === "1" ? "isolated-test-key" : undefined,
  YOUTUBE_ENABLED: process.env.RUN_MEDIA_TESTS === "1" ? "true" : "false",
  CLIPS_ENABLED: process.env.RUN_MEDIA_TESTS === "1" ? "true" : "false",
  ANTHROPIC_API_KEY:
    process.env.RUN_MEDIA_TESTS === "1" ? "isolated-test-key" : undefined,
  TRIAL_ENABLED: process.env.RUN_TRIAL_TESTS === "1" ? "true" : "false",
  TURNSTILE_SITE_KEY: "isolated-browser-site-key",
  TURNSTILE_SECRET_KEY: "isolated-browser-secret-key",
  FFMPEG_PATH: process.env.FFMPEG_PATH,
  FFPROBE_PATH: process.env.FFPROBE_PATH,
});
const { app, mailer, uploads, VideoModel } = await createApp(connection, env, {
  verifyTrialChallenge: async (_env, token) =>
    process.env.RUN_TRIAL_TESTS === "1" && token.startsWith("valid-browser-"),
});
// External network services are replaced only inside this isolated test server.
const importer: typeof importYoutube = async (_env, _id, directory) => {
  const path = join(directory, "source.mp4");
  await copyFile(
    new URL("../tests/fixtures/spoken-video.mp4", import.meta.url),
    path,
  );
  return { path, title: "Test live window", live: true };
};
const selector: typeof selectHighlights = async () => [
  { title: "A useful short recording", start: 0, end: 6 },
];
const hostedTranscriber: typeof transcribe = async (
  _env,
  _source,
  _output,
  _signal,
  context,
) => {
  const words = [
    { start: 0, end: 2, word: "Welcome to Clipvelto." },
    { start: 2, end: 5, word: "A short recording to test captions." },
    { start: 5, end: 6, word: "An idea worth sharing." },
  ];
  if (context)
    await context.saveCheckpoint({
      version: 1,
      model: "whisper-large-v3-turbo",
      sourceSha256: context.sourceSha256,
      sampleCount: 8 * 16000,
      chunks: [{ index: 0, language: "en", words }],
    });
  return {
    provider: "groq",
    model: "whisper-large-v3-turbo",
    language: "en",
    segments: [
      {
        start: 0,
        end: 6,
        text: words.map((word) => word.word).join(" "),
        words,
      },
    ],
  };
};
const worker = await startUploadWorker(
  connection,
  env,
  uploads!,
  VideoModel,
  process.env.RUN_GROQ_TESTS === "1" ? hostedTranscriber : undefined,
  process.env.RUN_MEDIA_TESTS === "1" ? importer : undefined,
  process.env.RUN_MEDIA_TESTS === "1" ? selector : undefined,
);
const server = app.listen(4000, "127.0.0.1", () =>
  console.log("Isolated browser-test API ready on 4000"),
);
let stopping = false;
const shutdown = () => {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    void mailer
      .drain()
      .then(() => worker.close())
      .then(() => uploads!.close())
      .then(() => connection.close())
      .then(() => database.stop())
      .then(() => services.close())
      .finally(() => process.exit(0));
  });
  server.closeIdleConnections();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
