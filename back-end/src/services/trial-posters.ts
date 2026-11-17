import { join } from "node:path";
import type { Env } from "../config/env.js";
import type { Highlight } from "./highlight-selector.js";
import { runMediaProcess } from "./media-process.js";

// These are real, permanently blurred source frames, never unlocked video files.
export async function renderTrialPoster(
  env: Env, source: string, directory: string, index: number,
  clip: Highlight, signal: AbortSignal,
) {
  const path = join(directory, `locked-${index}.jpg`);
  await runMediaProcess(env.FFMPEG_PATH, [
    "-nostdin", "-loglevel", "error", "-y", "-protocol_whitelist", "file",
    "-threads", "2", "-ss", String((clip.start + clip.end) / 2), "-i", source,
    "-frames:v", "1", "-vf",
    "scale=320:200:force_original_aspect_ratio=increase,crop=320:200,gblur=sigma=6",
    "-filter_threads", "1", "-threads", "2", "-q:v", "5", path,
  ], { signal, timeout: 2000 });
  return path;
}
