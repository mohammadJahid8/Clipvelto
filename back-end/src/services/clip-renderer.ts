import { writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Env } from "../config/env.js";
import type { Transcript } from "../modules/transcription/transcript.js";
import type { Highlight } from "./highlight-selector.js";
import { runMediaProcess } from "./media-process.js";
import { chooseClipFocus, portraitCrop } from "./clip-framing.js";
import {
  defaultRenderOptions,
  outputDimensions,
  trialPreviewDimensions,
  type RenderOptions,
} from "../modules/clips/render-options.js";

function assTime(seconds: number) {
  const centiseconds = Math.max(0, Math.round(seconds * 100));
  return `${Math.floor(centiseconds / 360000)}:${String(Math.floor(centiseconds / 6000) % 60).padStart(2, "0")}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
}
function captionText(text: string) {
  return text.replace(/[{}\\\r\n]/g, " ").trim();
}
export async function renderClip(
  env: Env,
  source: string,
  directory: string,
  index: number,
  clip: Highlight,
  transcript: Transcript,
  signal: AbortSignal,
  detectFocus = chooseClipFocus,
  options: RenderOptions = defaultRenderOptions,
  trialPreview = false,
) {
  const dimensions = trialPreview ? trialPreviewDimensions : outputDimensions[options.aspectRatio];
  const framing = await detectFocus(env, source, clip.start, clip.end, signal);
  const events: string[] = [];
  for (const segment of transcript.segments) {
    if (segment.end <= clip.start || segment.start >= clip.end) continue;
    const words = segment.words.filter(
      (word) => word.end > clip.start && word.start < clip.end,
    );
    if (words.length) {
      for (let i = 0; i < words.length; i += 6) {
        const group = words.slice(i, i + 6);
        const start = Math.max(clip.start, group[0].start) - clip.start;
        const end = Math.min(clip.end, group.at(-1)!.end) - clip.start;
        if (end > start)
          events.push(
            `Dialogue: 0,${assTime(start)},${assTime(end)},Default,,0,0,0,,${captionText(group.map((word) => word.word.trim()).join(" "))}`,
          );
      }
    } else
      events.push(
        `Dialogue: 0,${assTime(Math.max(0, segment.start - clip.start))},${assTime(Math.min(clip.end, segment.end) - clip.start)},Default,,0,0,0,,${captionText(segment.text)}`,
      );
  }
  if (options.captions && !events.length)
    throw new Error("No captions inside selected clip");
  const subtitles = `captions-${index}.ass`;
  await writeFile(
    join(directory, subtitles),
    `[Script Info]\nScriptType: v4.00+\nPlayResX: ${dimensions.width}\nPlayResY: ${dimensions.height}\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,DejaVu Sans,${Math.round(dimensions.height * 0.038)},&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,1,0,0,0,100,100,0,0,1,3,1,2,${Math.round(dimensions.width * 0.09)},${Math.round(dimensions.width * 0.09)},${Math.round(dimensions.height * 0.164)},1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events.join("\n")}\n`,
    { mode: 0o600 },
  );
  const output = join(directory, `clip-${index}.mp4`);
  await runMediaProcess(
    env.FFMPEG_PATH,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-protocol_whitelist",
      "file",
      "-threads",
      "2",
      "-ss",
      String(clip.start),
      "-i",
      source,
      "-t",
      String(clip.end - clip.start),
      "-map",
      "0:v:0",
      "-map",
      "0:a:0",
      "-vf",
      `${portraitCrop(framing.focusX, framing.points, dimensions.width, dimensions.height, framing.focusY)}${options.captions ? `,ass=${subtitles}` : ""}${trialPreview ? ",drawtext=text='Clipvelto preview':fontcolor=white:fontsize=32:box=1:boxcolor=black@0.45:boxborderw=8:x=w-tw-24:y=32" : ""}`,
      "-filter_threads",
      "1",
      "-fpsmax",
      "60",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      trialPreview ? "20" : "18",
      "-threads",
      "2",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      trialPreview ? "128k" : "160k",
      "-movflags",
      "+faststart",
      "-fs",
      String(256 * 1024 ** 2),
      output,
    ],
    { cwd: directory, signal, timeout: 600000 },
  );
  const info = await stat(output);
  if (!info.size || info.size >= 256 * 1024 ** 2)
    throw new Error("Clip exceeded its output limit");
  return { path: output, sizeBytes: info.size, framing };
}
