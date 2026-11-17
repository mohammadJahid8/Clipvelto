import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "../src/config/env.js";
import { processingEnv } from "../src/modules/uploads/processing-limits.js";
import { transcriptSchema } from "../src/modules/transcription/transcript.js";
import { transcriptionCheckpointSchema, transcriptFromChunks } from "../src/services/hosted-transcriber.js";

test("admin media limits support two-hour recordings while free limits remain unchanged", () => {
  const base = parseEnv({ MONGODB_URI: "mongodb://localhost/test", BETTER_AUTH_SECRET: "isolated-processing-limits-test-secret" });
  const admin = processingEnv(base, "admin");
  assert.equal(admin.TRANSCRIPTION_MAX_SECONDS, 7200);
  assert.equal(admin.UPLOAD_MAX_BYTES, 2 * 1024 ** 3);
  assert.equal(processingEnv(base, "free").TRANSCRIPTION_MAX_SECONDS, 1800);
  assert.equal(processingEnv(base, "free").UPLOAD_MAX_BYTES, 500 * 1024 ** 2);
  assert.equal(base.TRANSCRIPTION_MAX_SECONDS, 1800);
  assert.throws(() => parseEnv({ MONGODB_URI: "mongodb://localhost/test", BETTER_AUTH_SECRET: "isolated-processing-limits-test-secret", TRANSCRIPTION_MAX_SECONDS: "7200" }));
});

test("long transcription checkpoints preserve every five-minute chunk and late timestamps", () => {
  const checkpoint = transcriptionCheckpointSchema.parse({
    version: 1, sourceSha256: "a".repeat(64), model: "whisper-large-v3-turbo",
    sampleCount: 7072 * 16000,
    chunks: Array.from({ length: 24 }, (_, index) => ({ index, language: "en",
      words: [{ start: index * 300 + 1, end: index * 300 + 2, word: "speech" }] })),
  });
  const transcript = transcriptSchema.parse(transcriptFromChunks(checkpoint));
  assert.equal(transcript.segments.flatMap(segment => segment.words).length, 24);
  assert.equal(transcript.segments.at(-1)?.end, 6902);
  assert.equal(transcriptionCheckpointSchema.safeParse({ ...checkpoint, sampleCount: 7202 * 16000 }).success, false);
  assert.equal(transcriptSchema.safeParse({ ...transcript, segments: [{ start: 7202, end: 7203, text: "speech", words: [] }] }).success, false);
});
