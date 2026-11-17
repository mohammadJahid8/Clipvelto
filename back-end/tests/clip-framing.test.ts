import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseEnv } from "../src/config/env.js";
import { portraitCrop, chooseClipFocus } from "../src/services/clip-framing.js";
import { renderClip } from "../src/services/clip-renderer.js";
import { runMediaProcess } from "../src/services/media-process.js";

const env = parseEnv({
  MONGODB_URI: "mongodb://localhost/test",
  BETTER_AUTH_SECRET: "an-isolated-framing-test-secret-never-used-for-auth",
  FFMPEG_PATH: process.env.FFMPEG_PATH,
  FFPROBE_PATH: process.env.FFPROBE_PATH,
});
test("crop positions are bounded and cancellation never becomes a fallback render", async () => {
  for (const focus of [NaN, Infinity, -0.1, 1.1])
    assert.throws(() => portraitCrop(focus));
  await assert.rejects(
    chooseClipFocus(env, "unused", 0, 3, AbortSignal.abort()),
  );
  assert.equal(
    (
      await chooseClipFocus(
        { ...env, YOUTUBE_PYTHON: "/missing/reframer" },
        "unused",
        0,
        3,
        new AbortController().signal,
      )
    ).focusX,
    0.5,
  );
});

const samples: {
  name: string;
  size: string;
  sar: string;
  focus: number;
  points?: Parameters<typeof portraitCrop>[1];
  time?: string;
  blue?: boolean;
}[] = [
  { name: "landscape", size: "320x180", sar: "1", focus: 0.5 },
  { name: "portrait", size: "180x320", sar: "1", focus: 0.5 },
  { name: "tall", size: "180x400", sar: "1", focus: 0.5 },
  { name: "anamorphic", size: "320x180", sar: "2", focus: 0.5 },
  { name: "off-center subject", size: "320x180", sar: "1", focus: 0.9 },
  {
    name: "moving subject",
    size: "320x180",
    sar: "1",
    focus: 0.5,
    time: "1.5",
    blue: true,
    points: [
      { time: 0, focusX: 0.5, cut: false },
      { time: 1, focusX: 0.9, cut: false },
    ],
  },
  {
    name: "scene change",
    size: "320x180",
    sar: "1",
    focus: 0.5,
    time: "1.5",
    blue: true,
    points: [
      { time: 0, focusX: 0.5, cut: false },
      { time: 1, focusX: 0.9, cut: true },
    ],
  },
  {
    name: "dense crop track",
    size: "320x180",
    sar: "1",
    focus: 0.5,
    time: "2.5",
    blue: true,
    points: Array.from({ length: 48 }, (_, index) => ({
      time: index * 0.04,
      focusX: index % 2 ? 0.9 : 0.5,
      cut: false,
    })),
  },
];
for (const sample of samples) {
  test(
    `${sample.name} fills the actual MP4 frame without padding and preserves audio`,
    { skip: process.env.RUN_MEDIA_TESTS !== "1" },
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "clipvelto-framing-"));
      try {
        const source = join(directory, "source.mp4");
        const pattern = `color=c=0x22aa66:s=${sample.size}:r=30,drawbox=x=iw*0.7:y=0:w=iw*0.3:h=ih:color=blue:t=fill,setsar=${sample.sar}`;
        await runMediaProcess(env.FFMPEG_PATH, [
          "-nostdin",
          "-loglevel",
          "error",
          "-f",
          "lavfi",
          "-i",
          pattern,
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=440:sample_rate=16000",
          "-t",
          "3",
          "-c:v",
          "libx264",
          "-threads",
          "2",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          source,
        ]);
        const clip = await renderClip(
          env,
          source,
          directory,
          0,
          { title: "Framing test", start: 0, end: 3 },
          {
            model: "small",
            language: "en",
            segments: [
              { start: 0, end: 3, text: "Readable captions.", words: [] },
            ],
          },
          new AbortController().signal,
          async () => ({
            focusX: sample.focus,
            method: "face",
            matchedSamples: 11,
            points: sample.points,
          }),
        );
        const metadata = JSON.parse(
          await runMediaProcess(env.FFPROBE_PATH, [
            "-v",
            "error",
            "-show_streams",
            "-of",
            "json",
            clip.path,
          ]),
        ) as {
          streams: {
            codec_type: string;
            codec_name: string;
            width?: number;
            height?: number;
          }[];
        };
        assert.ok(
          metadata.streams.some(
            (stream) =>
              stream.codec_type === "audio" && stream.codec_name === "aac",
          ),
        );
        assert.ok(
          metadata.streams.some(
            (stream) =>
              stream.width === 1080 &&
              stream.height === 1920 &&
              stream.codec_name === "h264",
          ),
        );
        const frame = join(directory, "frame.rgb");
        await runMediaProcess(env.FFMPEG_PATH, [
          "-nostdin",
          "-loglevel",
          "error",
          "-ss",
          sample.time ?? "0.5",
          "-i",
          clip.path,
          "-frames:v",
          "1",
          "-pix_fmt",
          "rgb24",
          "-f",
          "rawvideo",
          frame,
        ]);
        const bytes = await readFile(frame);
        assert.equal(bytes.length, 1080 * 1920 * 3);
        for (const [x, y] of [
          [10, 10],
          [1070, 10],
          [10, 1910],
          [1070, 1910],
        ]) {
          const pixel = bytes.subarray(
            (y * 1080 + x) * 3,
            (y * 1080 + x) * 3 + 3,
          );
          assert.ok(
            Math.max(...pixel) > 100,
            "The exported frame must not contain added black borders",
          );
        }
        const middle = bytes.subarray(
          (600 * 1080 + 540) * 3,
          (600 * 1080 + 540) * 3 + 3,
        );
        if (sample.blue || sample.focus > 0.5)
          assert.ok(
            middle[2] > 180 && middle[1] < 60,
            "The right-side subject must move into the portrait crop",
          );
        else
          assert.ok(
            middle[1] > 100 && middle[2] < 160,
            "The center crop should preserve the original subject",
          );
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  );
}

test(
  "all export shapes fill their frame, retain 50fps and omit generated captions when disabled",
  { skip: process.env.RUN_MEDIA_TESTS !== "1" },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "clipvelto-shapes-"));
    try {
      const source = join(directory, "source.mp4");
      await runMediaProcess(
        env.FFMPEG_PATH,
        [
          "-nostdin",
          "-loglevel",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=red:s=320x180:r=50:d=1",
          "-f",
          "lavfi",
          "-i",
          "sine=duration=1",
          "-c:v",
          "libx264",
          "-threads",
          "2",
          "-c:a",
          "aac",
          "-shortest",
          source,
        ],
        { timeout: 15000 },
      );
      for (const [index, aspectRatio] of (
        ["9:16", "16:9", "1:1"] as const
      ).entries()) {
        const output = await renderClip(
          env,
          source,
          directory,
          index,
          { title: "Shape", start: 0, end: 1 },
          { model: "small", language: "en", segments: [] },
          new AbortController().signal,
          async () => ({ focusX: 0.5, method: "center", matchedSamples: 0 }),
          { aspectRatio, captions: false },
        );
        const raw = await runMediaProcess(
          env.FFPROBE_PATH,
          [
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,avg_frame_rate",
            "-of",
            "json",
            output.path,
          ],
          { timeout: 15000 },
        );
        const info = JSON.parse(raw).streams[0];
        assert.deepEqual(
          [info.width, info.height],
          aspectRatio === "9:16"
            ? [1080, 1920]
            : aspectRatio === "16:9"
              ? [1920, 1080]
              : [1080, 1080],
        );
        assert.equal(info.avg_frame_rate, "50/1");
        const frame = join(directory, `frame-${index}.rgb`);
        await runMediaProcess(
          env.FFMPEG_PATH,
          [
            "-nostdin",
            "-loglevel",
            "error",
            "-ss",
            "0.4",
            "-i",
            output.path,
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            frame,
          ],
          { timeout: 15000 },
        );
        const pixels = await readFile(frame);
        for (const offset of [
          0,
          (info.width - 1) * 3,
          info.width * (info.height - 1) * 3,
          Math.floor(info.width * info.height * 0.8) * 3,
        ]) {
          assert.ok(
            pixels[offset] > 220 &&
              pixels[offset + 1] < 25 &&
              pixels[offset + 2] < 25,
            "Filled red frame should have no black bars or added captions",
          );
        }
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
