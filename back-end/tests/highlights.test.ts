import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "../src/config/env.js";
import {
  selectHighlights,
  validateHighlights,
  HighlightProviderError,
  HighlightSelectionError,
  highlightCandidates,
} from "../src/services/highlight-selector.js";
import { clipFailureMessage } from "../src/jobs/generate-clips.js";
import type { Transcript } from "../src/modules/transcription/transcript.js";
const env = parseEnv({
  MONGODB_URI: "mongodb://localhost/test",
  BETTER_AUTH_SECRET: "an-isolated-test-secret-not-used-for-any-account",
  ANTHROPIC_API_KEY: "test-key",
});
const transcript: Transcript = {
  model: "small",
  language: "en",
  segments: [{ start: 0, end: 6, text: "This is a useful idea.", words: [] }],
};
function selection(clips: unknown, stop_reason = "tool_use") {
  return Response.json({
    stop_reason,
    content: [
      { type: "tool_use", name: "select_highlights", input: { clips } },
    ],
  });
}
const valid = [{ title: "A useful idea", candidateId: 1 }];

test("long recordings are ranked in bounded batches without dropping later sections", async (t) => {
  const seen: number[] = [];
  const long: Transcript = {
    model: "small",
    language: "en",
    segments: Array.from({ length: 600 }, (_, i) => ({
      start: i * 45,
      end: i * 45 + 40,
      text: `Section ${i}. ` + "Useful spoken words. ".repeat(60),
      words: [],
    })),
  };
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const input = JSON.parse(body.messages[0].content) as {
        candidates: { id: number; start: number }[];
      };
      assert.ok(Buffer.byteLength(body.messages[0].content) < 200000);
      seen.push(...input.candidates.map((item) => item.start));
      return selection([
        { title: "A useful section", candidateId: input.candidates.at(-1)!.id },
      ]);
    },
  );
  const plan = await selectHighlights(
    env,
    long,
    27000,
    new AbortController().signal,
  );
  assert.ok(seen.includes(599 * 45));
  assert.ok(plan.length > 0);
});

test("strict Claude selection refers to known candidate IDs and derives timestamps locally", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (url: unknown, init?: RequestInit) => {
      assert.equal(url, "https://api.anthropic.com/v1/messages");
      const body = JSON.parse(String(init?.body)) as {
        messages: { content: string }[];
        tools: {
          strict: boolean;
          input_schema: {
            properties: {
              clips: {
                items: { properties: { candidateId: { type: string } } };
              };
            };
          };
        }[];
        tool_choice: { name: string };
      };
      assert.ok(body.messages[0].content.includes("This is a useful idea."));
      assert.equal(body.tool_choice.name, "select_highlights");
      assert.equal(body.tools[0].strict, true);
      assert.equal(
        body.tools[0].input_schema.properties.clips.items.properties.candidateId
          .type,
        "integer",
      );
      return selection(valid);
    },
  );
  assert.deepEqual(
    await selectHighlights(env, transcript, 8, new AbortController().signal),
    [{ title: "A useful idea", start: 0, end: 6 }],
  );
});

test("a malformed model entry gets one bounded repair request without changing the transcript", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return calls === 1
      ? selection([{ title: "", candidateId: "invalid" }])
      : selection(valid);
  });
  assert.deepEqual(
    await selectHighlights(env, transcript, 8, new AbortController().signal),
    [{ title: "A useful idea", start: 0, end: 6 }],
  );
  assert.equal(calls, 2);
  assert.equal(transcript.segments[0].text, "This is a useful idea.");
});

test("invalid candidate references stop after two attempts and keep a selection-specific error", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return selection([{ title: "Invalid reference", candidateId: 999 }]);
  });
  await assert.rejects(
    selectHighlights(env, transcript, 8, new AbortController().signal),
    HighlightSelectionError,
  );
  assert.equal(calls, 2);
  assert.ok(
    !clipFailureMessage(new HighlightSelectionError(), "selection").includes(
      "clear speech",
    ),
  );
});

test("truncated model output is retried once instead of using a partial selection", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return selection(valid, calls === 1 ? "max_tokens" : "tool_use");
  });
  assert.equal(
    (await selectHighlights(env, transcript, 8, new AbortController().signal))
      .length,
    1,
  );
  assert.equal(calls, 2);
});

test("provider authentication failures are not retried and do not leak the response", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json(
      { error: { message: "Sensitive upstream detail" } },
      { status: 401 },
    );
  });
  await assert.rejects(
    selectHighlights(env, transcript, 8, new AbortController().signal),
    (error: unknown) =>
      error instanceof HighlightProviderError &&
      error.status === 401 &&
      !error.message.includes("Sensitive"),
  );
  assert.equal(calls, 1);
});

test("highlight validation rejects unsafe ranges and accepts fewer worthwhile clips", () => {
  const cases = [
    { duration: 8, clips: [{ title: "Overrun", start: 0, end: 9 }] },
    {
      duration: 8,
      clips: [
        { title: "Overlap", start: 0, end: 5 },
        { title: "Again", start: 4, end: 8 },
      ],
    },
    { duration: 8, clips: [{ title: "Too short", start: 0, end: 1 }] },
    {
      duration: 120,
      clips: [
        { title: "Too long", start: 0, end: 61 },
        { title: "Two", start: 65, end: 85 },
        { title: "Three", start: 90, end: 110 },
      ],
    },
  ];
  for (const sample of cases)
    assert.throws(() => validateHighlights(sample.clips, sample.duration));
  assert.equal(
    validateHighlights(
      [{ title: "One worthwhile moment", start: 0, end: 20 }],
      120,
    ).length,
    1,
  );
  assert.equal(
    validateHighlights(
      [
        { title: "One", start: 0, end: 20 },
        { title: "Two", start: 25, end: 45 },
        { title: "Three", start: 50, end: 70 },
      ],
      100,
    ).length,
    3,
  );
});

test("stage-specific failures identify rendering and saving without blaming speech", () => {
  assert.match(
    clipFailureMessage(new Error("private file path"), "rendering"),
    /rendering stopped/,
  );
  assert.match(
    clipFailureMessage(new Error("private storage detail"), "storage"),
    /couldn’t be saved/,
  );
  assert.ok(
    !clipFailureMessage(new Error("private detail"), "selection").includes(
      "private",
    ),
  );
});

test("long-video candidate windows are bounded locally at transcript boundaries", () => {
  const long: Transcript = {
    model: "small",
    language: "en",
    segments: Array.from({ length: 203 }, (_, i) => ({
      start: i * 4.5,
      end: (i + 1) * 4.5,
      text: `Sentence ${i + 1}.`,
      words: [],
    })),
  };
  const windows = highlightCandidates(long, 913.5);
  assert.ok(windows.length >= 20 && windows.length <= 22);
  let previousEnd = 0;
  for (const window of windows) {
    assert.ok(window.start >= previousEnd);
    previousEnd = window.end;
    assert.ok(
      window.end - window.start >= 15 && window.end - window.start <= 60,
    );
    assert.ok(window.end <= 913.5);
    assert.equal(window.start, long.segments[window.firstSegment - 1].start);
    assert.equal(window.end, long.segments[window.lastSegment - 1].end);
  }
});

test("duplicate model choices are removed without discarding three distinct valid clips", async (t) => {
  const long: Transcript = {
    model: "small",
    language: "en",
    segments: [
      { start: 0, end: 20, text: "First idea.", words: [] },
      { start: 30, end: 50, text: "Second idea.", words: [] },
      { start: 60, end: 80, text: "Third idea.", words: [] },
    ],
  };
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return selection([
      { title: "First", candidateId: 1 },
      { title: "Duplicate", candidateId: 1 },
      { title: "Second", candidateId: 2 },
      { title: "Duplicate", candidateId: 2 },
      { title: "Third", candidateId: 3 },
    ]);
  });
  const clips = await selectHighlights(
    env,
    long,
    90,
    new AbortController().signal,
  );
  assert.equal(clips.length, 3);
  assert.equal(calls, 1);
  assert.deepEqual(
    clips.map((clip) => clip.start),
    [0, 30, 60],
  );
});

test("a sparse long recording and duplicate choices do not force pointless provider retries", async (t) => {
  const sparse: Transcript = {
    ...transcript,
    segments: [
      {
        start: 120,
        end: 140,
        text: "One worthwhile spoken moment.",
        words: [],
      },
    ],
  };
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return selection([
      { title: "A".repeat(120), candidateId: 1 },
      { title: "Duplicate", candidateId: 1 },
    ]);
  });
  const clips = await selectHighlights(
    env,
    sparse,
    300,
    new AbortController().signal,
  );
  assert.equal(calls, 1);
  assert.equal(clips.length, 1);
  assert.equal(clips[0].title.length, 100);
  assert.deepEqual([clips[0].start, clips[0].end], [120, 140]);
});
