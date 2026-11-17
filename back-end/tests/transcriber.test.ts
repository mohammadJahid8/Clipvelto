import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { parseEnv } from "../src/config/env.js";
import {
  runTranscriber,
  transcribeLocal,
} from "../src/services/local-transcriber.js";

const env = parseEnv({
  MONGODB_URI: "mongodb://127.0.0.1/test",
  BETTER_AUTH_SECRET: "local-test-secret-never-used-for-authentication",
});

test("transcription configuration bounds CPU, model size, and duration", () => {
  for (const setting of [
    { TRANSCRIPTION_THREADS: "4" },
    { TRANSCRIPTION_MODEL: "large-v3" },
    { TRANSCRIPTION_MAX_SECONDS: "7200" },
    { TRANSCRIPTION_ENABLED: "true", UPLOADS_ENABLED: "false" },
  ])
    assert.throws(
      () =>
        parseEnv({
          MONGODB_URI: env.MONGODB_URI,
          BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
          ...setting,
        }),
      /Invalid backend configuration/,
    );
});

test("local process launch failures reject without leaking environment secrets", async () => {
  await assert.rejects(
    runTranscriber(
      { ...env, TRANSCRIPTION_PYTHON: "/nonexistent/clipvelto-python" },
      ["--check"],
    ),
  );
});

test(
  "the real local runner handles missing audio and cancels its child process",
  { skip: process.env.RUN_LOCAL_TRANSCRIPTION_TESTS !== "1" },
  async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "clipvelto-transcriber-test-"),
    );
    try {
      const transcript = await transcribeLocal(
        env,
        fileURLToPath(new URL("./fixtures/short-video.webm", import.meta.url)),
        join(directory, "empty.json"),
        new AbortController().signal,
      );
      assert.equal(transcript.emptyReason, "no_audio");
      assert.deepEqual(transcript.segments, []);
      const silence = await transcribeLocal(
        env,
        fileURLToPath(new URL("./fixtures/silent-video.webm", import.meta.url)),
        join(directory, "silent.json"),
        new AbortController().signal,
      );
      assert.equal(silence.emptyReason, "no_speech");
      assert.deepEqual(silence.segments, []);
      const start = Date.now();
      await assert.rejects(
        runTranscriber(env, ["--check"], AbortSignal.abort()),
      );
      assert.ok(
        Date.now() - start < 5000,
        "An aborted inference should stop promptly",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
