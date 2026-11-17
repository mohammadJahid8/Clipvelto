import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "../src/config/env.js";
import { transcribe } from "../src/services/transcriber.js";
import {
  transcribeHosted,
  transcriptionCheckpointSchema,
  type TranscriptionCheckpoint,
} from "../src/services/hosted-transcriber.js";
import {
  TranscriptionProviderError,
  TranscriptionResponseError,
} from "../src/services/transcription-error.js";
import { runMediaProcess } from "../src/services/media-process.js";

const env = {
  ...parseEnv({
    MONGODB_URI: "mongodb://localhost/test",
    BETTER_AUTH_SECRET: "an-isolated-groq-test-secret-never-used-for-auth",
    FFMPEG_PATH: process.env.FFMPEG_PATH,
    FFPROBE_PATH: process.env.FFPROBE_PATH,
  }),
  TRANSCRIPTION_PROVIDER: "groq" as const,
  GROQ_API_KEY: "isolated-groq-test-key",
};
const media = { skip: process.env.RUN_MEDIA_TESTS !== "1" };
const fixture = fileURLToPath(
  new URL("./fixtures/spoken-video.webm", import.meta.url),
);
function speech() {
  return Response.json({
    language: "english",
    text: "A useful idea.",
    words: [
      { start: 0, end: 1, word: "A" },
      { start: 1, end: 2, word: "useful" },
      { start: 2, end: 5, word: "idea." },
    ],
  });
}
async function temporary(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "clipvelto-groq-test-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test(
  "provider word order and overlapping speech are normalized without dropping words",
  media,
  async (t) =>
    temporary(async (directory) => {
      t.mock.method(globalThis, "fetch", async () =>
        Response.json({
          language: "english",
          words: [
            { start: 2, end: 3, word: "Last." },
            { start: 0, end: 1.5, word: "First" },
            { start: 1, end: 1.4, word: "overlap" },
          ],
        }),
      );
      const result = await transcribeHosted(
        env,
        fixture,
        join(directory, "result.json"),
        new AbortController().signal,
      );
      const words = result.segments.flatMap((segment) => segment.words);
      assert.deepEqual(
        words.map((word) => word.word),
        ["First", "overlap", "Last."],
      );
      assert.ok(
        words.every(
          (word, index) =>
            word.start >= (words[index - 1]?.end ?? 0) &&
            word.end >= word.start,
        ),
      );
    }),
);

test("Groq is explicit, requires its own key when enabled, and old local configuration remains valid", () => {
  const base = {
    MONGODB_URI: "mongodb://localhost/test",
    BETTER_AUTH_SECRET: "an-isolated-groq-test-secret-never-used-for-auth",
  };
  assert.equal(parseEnv(base).TRANSCRIPTION_PROVIDER, "local");
  assert.throws(() => parseEnv({ ...base, TRANSCRIPTION_PROVIDER: "other" }));
  assert.throws(
    () =>
      parseEnv({
        ...base,
        TRANSCRIPTION_ENABLED: "true",
        TRANSCRIPTION_PROVIDER: "groq",
      }),
    /GROQ_API_KEY/,
  );
  assert.throws(() =>
    parseEnv({ ...base, GROQ_TRANSCRIPTION_MODEL: "unknown" }),
  );
});

test("checkpoint validation rejects reordered chunks and words outside their assigned range", () => {
  const base = {
    version: 1,
    sourceSha256: "a".repeat(64),
    model: "whisper-large-v3-turbo",
    sampleCount: 305 * 16000,
  };
  assert.equal(
    transcriptionCheckpointSchema.safeParse({
      ...base,
      chunks: [{ index: 1, language: "en", words: [] }],
    }).success,
    false,
  );
  assert.equal(
    transcriptionCheckpointSchema.safeParse({
      ...base,
      chunks: [
        {
          index: 0,
          language: "en",
          words: [{ start: 299, end: 301, word: "boundary" }],
        },
      ],
    }).success,
    false,
  );
});

test(
  "configured transcription sends bounded mono WAV with word timestamps and produces caption-ready text",
  media,
  async (t) =>
    temporary(async (directory) => {
      let calls = 0;
      t.mock.method(
        globalThis,
        "fetch",
        async (url: unknown, init?: RequestInit) => {
          calls++;
          assert.equal(
            url,
            "https://api.groq.com/openai/v1/audio/transcriptions",
          );
          assert.equal(init?.redirect, "error");
          assert.equal(
            new Headers(init?.headers).get("authorization"),
            `Bearer ${env.GROQ_API_KEY}`,
          );
          const form = init?.body as FormData;
          assert.equal(form.get("model"), "whisper-large-v3-turbo");
          assert.deepEqual(form.getAll("timestamp_granularities[]"), [
            "word",
            "segment",
          ]);
          const file = form.get("file") as File;
          const bytes = Buffer.from(await file.arrayBuffer());
          assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
          assert.equal(bytes.readUInt32LE(24), 16000);
          assert.equal(bytes.readUInt16LE(22), 1);
          assert.ok(bytes.length < 10 * 1024 ** 2);
          return speech();
        },
      );
      const output = join(directory, "result.json");
      const result = await transcribe(
        env,
        fixture,
        output,
        new AbortController().signal,
      );
      assert.equal(calls, 1);
      assert.equal(result.provider, "groq");
      assert.equal(result.segments[0].text, "A useful idea.");
      assert.equal(result.segments[0].words.length, 3);
      assert.equal(
        JSON.parse(await readFile(output, "utf8")).model,
        "whisper-large-v3-turbo",
      );
      assert.deepEqual(await readdir(directory), ["result.json"]);
    }),
);

test(
  "authentication errors never fall back or retry and omit private upstream details",
  media,
  async (t) =>
    temporary(async (directory) => {
      let calls = 0;
      t.mock.method(globalThis, "fetch", async () => {
        calls++;
        return Response.json(
          { error: { message: "secret provider text" } },
          { status: 401 },
        );
      });
      await assert.rejects(
        transcribeHosted(
          env,
          fixture,
          join(directory, "result.json"),
          new AbortController().signal,
        ),
        (error: unknown) =>
          error instanceof TranscriptionProviderError &&
          error.status === 401 &&
          !error.message.includes("secret provider text"),
      );
      assert.equal(calls, 1);
      assert.deepEqual(await readdir(directory), []);
    }),
);

test(
  "a brief explicit rate limit retries once; long rate limits stop promptly",
  media,
  async (t) =>
    temporary(async (directory) => {
      let calls = 0;
      t.mock.method(globalThis, "fetch", async () =>
        ++calls === 1
          ? new Response(null, { status: 429, headers: { "retry-after": "0" } })
          : speech(),
      );
      await transcribeHosted(
        env,
        fixture,
        join(directory, "result.json"),
        new AbortController().signal,
      );
      assert.equal(calls, 2);
      t.mock.restoreAll();
      t.mock.method(globalThis, "fetch", async () => {
        calls++;
        return new Response(null, {
          status: 429,
          headers: { "retry-after": "3600" },
        });
      });
      await assert.rejects(
        transcribeHosted(
          env,
          fixture,
          join(directory, "again.json"),
          new AbortController().signal,
        ),
        TranscriptionProviderError,
      );
      assert.equal(calls, 3);
    }),
);

test(
  "invalid timestamps and missing word timings are rejected without storing a transcript",
  media,
  async (t) =>
    temporary(async (directory) => {
      for (const body of [
        { text: "Speech without timings", words: [] },
        { text: "Overrun", words: [{ start: 0, end: 100, word: "Overrun" }] },
      ]) {
        t.mock.method(globalThis, "fetch", async () => Response.json(body));
        await assert.rejects(
          transcribeHosted(
            env,
            fixture,
            join(directory, "result.json"),
            new AbortController().signal,
          ),
          TranscriptionResponseError,
        );
        assert.deepEqual(await readdir(directory), []);
        t.mock.restoreAll();
      }
    }),
);

test(
  "missing audio avoids billing and an aborted upload neither retries nor leaves files",
  media,
  async (t) =>
    temporary(async (directory) => {
      let calls = 0;
      const controller = new AbortController();
      t.mock.method(globalThis, "fetch", async () => {
        calls++;
        controller.abort();
        throw new DOMException("Cancelled", "AbortError");
      });
      const empty = await transcribeHosted(
        env,
        fileURLToPath(new URL("./fixtures/short-video.webm", import.meta.url)),
        join(directory, "empty.json"),
        new AbortController().signal,
      );
      assert.equal(empty.emptyReason, "no_audio");
      assert.equal(calls, 0);
      await assert.rejects(
        transcribeHosted(
          env,
          fixture,
          join(directory, "result.json"),
          controller.signal,
        ),
      );
      assert.equal(calls, 1);
      assert.deepEqual(await readdir(directory), ["empty.json"]);
    }),
);

test(
  "completed chunks survive a later failure, resume without rebilling, and join overlap once",
  media,
  async (t) =>
    temporary(async (directory) => {
      const source = join(directory, "long.mka");
      await runMediaProcess(env.FFMPEG_PATH, [
        "-nostdin",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=16000:cl=mono",
        "-t",
        "305",
        "-c:a",
        "flac",
        source,
      ]);
      const sourceSha256 = createHash("sha256")
        .update(await readFile(source))
        .digest("hex");
      let checkpoint: TranscriptionCheckpoint | undefined;
      let calls = 0;
      t.mock.method(globalThis, "fetch", async () => {
        calls++;
        if (calls === 2)
          throw new Error(
            "Uncertain network failure; do not rebill automatically",
          );
        return Response.json({
          language: "english",
          words: [
            { start: 1, end: 2, word: "First." },
            { start: 299.7, end: 300.1, word: "boundary" },
          ],
        });
      });
      const context = () => ({
        sourceSha256,
        checkpoint,
        saveCheckpoint: async (value: TranscriptionCheckpoint) => {
          checkpoint = structuredClone(value);
        },
      });
      await assert.rejects(
        transcribeHosted(
          env,
          source,
          join(directory, "failed.json"),
          new AbortController().signal,
          context(),
        ),
      );
      assert.equal(checkpoint?.chunks.length, 1);
      assert.equal(calls, 2);
      t.mock.restoreAll();
      t.mock.method(globalThis, "fetch", async () => {
        calls++;
        return Response.json({
          language: "english",
          words: [
            { start: 0.7, end: 1.1, word: "boundary" },
            { start: 1.2, end: 2.4, word: "Second." },
          ],
        });
      });
      const result = await transcribeHosted(
        env,
        source,
        join(directory, "result.json"),
        new AbortController().signal,
        context(),
      );
      assert.equal(calls, 3);
      assert.equal(checkpoint?.chunks.length, 2);
      assert.equal(
        result.segments
          .flatMap((segment) => segment.words)
          .filter((word) => word.word === "boundary").length,
        1,
      );
      assert.equal(result.segments.at(-1)?.end, 301.4);
      assert.ok(
        !(await readdir(directory)).some((name) => name.startsWith("hosted-")),
      );
    }),
);
