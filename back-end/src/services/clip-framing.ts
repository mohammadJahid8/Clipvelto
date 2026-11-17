import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { runMediaProcess } from "./media-process.js";
import { logger } from "../config/logger.js";

const pointSchema = z.object({
  time: z.number().finite().min(0).max(60),
  focusX: z.number().finite().min(0).max(1),
  cut: z.boolean(),
});
const resultSchema = z.object({
  focusX: z.number().finite().min(0).max(1),
  method: z.enum(["face", "center"]),
  matchedSamples: z.number().int().min(0).max(121),
  focusY: z.number().finite().min(0).max(1).optional(),
  points: z.array(pointSchema).min(1).max(48).optional(),
});
const warned = new Set<string>();
export async function chooseClipFocus(
  env: Env,
  source: string,
  start: number,
  end: number,
  signal: AbortSignal,
): Promise<z.infer<typeof resultSchema>> {
  signal.throwIfAborted();
  const directory = await mkdtemp(join(tmpdir(), "clipvelto-frame-samples-"));
  try {
    await runMediaProcess(
      env.FFMPEG_PATH,
      [
        "-nostdin",
        "-loglevel",
        "error",
        "-protocol_whitelist",
        "file",
        "-threads",
        "2",
        "-ss",
        String(start),
        "-i",
        source,
        "-t",
        String(end - start),
        "-vf",
        "fps=2,scale=384:384:force_original_aspect_ratio=decrease",
        "-filter_threads",
        "1",
        "-frames:v",
        "121",
        "-threads",
        "2",
        join(directory, "frame-%03d.jpg"),
      ],
      { signal, timeout: 8000 },
    );
    const result = await runMediaProcess(
      env.YOUTUBE_PYTHON,
      [
        fileURLToPath(
          new URL("../../reframing/detect-faces.py", import.meta.url),
        ),
        "--frames",
        directory,
      ],
      { signal, timeout: 8000 },
    );
    return resultSchema.parse(JSON.parse(result));
  } catch {
    signal.throwIfAborted();
    if (!warned.has(env.YOUTUBE_PYTHON)) {
      warned.add(env.YOUTUBE_PYTHON);
      logger.warn(
        "Face framing unavailable; using full-frame center crop. Run npm run media:setup to enable face framing.",
      );
    }
    return { focusX: 0.5, method: "center" as const, matchedSamples: 0 };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function portraitCrop(
  focusX = 0.5,
  points?: z.infer<typeof pointSchema>[],
  width = 720,
  height = 1280,
  focusY = 0.5,
) {
  let focus = z.number().finite().min(0).max(1).parse(focusX).toFixed(6);
  if (points?.length) {
    const checked = z.array(pointSchema).min(1).max(48).parse(points);
    focus = checked[0].focusX.toFixed(6);
    for (let index = 1; index < checked.length; index++) {
      const previous = checked[index - 1],
        current = checked[index];
      if (current.time <= previous.time)
        throw new Error("Invalid framing timestamps");
      const delta = (current.focusX - previous.focusX).toFixed(6);
      focus += current.cut
        ? `+(${delta})*gte(t,${current.time.toFixed(3)})`
        : `+(${delta})*clip((t-${previous.time.toFixed(3)})/${(current.time - previous.time).toFixed(3)},0,1)`;
    }
  }
  // Crop before upscaling: preserve the display aspect ratio and avoid processing pixels we discard.
  const ratio = `${width}/${height}`;
  const y = z.number().finite().min(0).max(1).parse(focusY).toFixed(6);
  return `crop=w='min(iw,ih*(${ratio})/sar)':h='min(ih,iw*sar/(${ratio}))':x='max(0,min(iw-ow,iw*(${focus})-ow/2))':y='max(0,min(ih-oh,ih*${y}-oh/2))':exact=1,scale=${width}:${height}:flags=lanczos,setsar=1`;
}
