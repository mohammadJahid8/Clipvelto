import type { Env } from "../config/env.js";
import { runMediaProcess } from "./media-process.js";

export async function checkMediaTools(env: Env) {
  if (env.YOUTUBE_ENABLED)
    await runMediaProcess(
      env.YOUTUBE_PYTHON,
      ["-c", "import yt_dlp; print(yt_dlp.version.__version__)"],
      { timeout: 15000 },
    );
  if (
    env.YOUTUBE_ENABLED ||
    env.CLIPS_ENABLED ||
    (env.TRANSCRIPTION_ENABLED && env.TRANSCRIPTION_PROVIDER !== "local")
  ) {
    await runMediaProcess(env.FFPROBE_PATH, ["-version"], { timeout: 15000 });
    const filters = await runMediaProcess(
      env.FFMPEG_PATH,
      ["-hide_banner", "-filters"],
      { timeout: 15000 },
    );
    if (env.CLIPS_ENABLED && !/\bass\s+V->V/.test(filters))
      throw new Error(
        "FFmpeg needs the libass subtitle filter. On macOS use ffmpeg-full; see README.md.",
      );
    if (env.TRIAL_ENABLED && !/\bdrawtext\s+V->V/.test(filters))
      throw new Error(
        "Public previews require FFmpeg's drawtext watermark filter.",
      );
  }
}
