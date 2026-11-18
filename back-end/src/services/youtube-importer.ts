import { readFile, stat, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { MediaProcessError, runMediaProcess } from "./media-process.js";

const importFailureSchema = z.object({
  code: z.enum([
    "DURATION_LIMIT",
    "SIZE_LIMIT",
    "NOT_READY",
    "UNAVAILABLE",
    "ACCESS_DENIED",
    "BOT_CHECK",
    "SESSION_UNAVAILABLE",
    "TIMEOUT",
    "IMPORT_FAILED",
    "MEDIA_CAPACITY",
    "DOWNLOAD_INTERRUPTED",
    "TOOL_UNAVAILABLE",
    "OUTPUT_LIMIT",
  ]),
  durationSeconds: z.number().finite().positive().optional(),
  maxSeconds: z.number().finite().nonnegative().optional(),
  processReason: z
    .enum([
      "START_FAILED",
      "TIMEOUT",
      "CANCELLED",
      "OUTPUT_LIMIT",
      "EXIT_FAILED",
    ])
    .optional(),
  exitCode: z.number().int().nullable().optional(),
  exitSignal: z.string().max(20).nullable().optional(),
});

export class YoutubeImportError extends Error {
  constructor(
    readonly details: z.infer<typeof importFailureSchema>,
    maxBytes: number,
  ) {
    const seconds = Math.ceil(details.durationSeconds ?? 0);
    const duration = `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
    const messages = {
      DURATION_LIMIT: `This video is ${duration} long. Your current import limit is ${Number(((details.maxSeconds ?? 0) / 60).toFixed(2))} minutes. Choose a shorter video.`,
      SIZE_LIMIT: `This video exceeds the ${Math.round(maxBytes / 1024 ** 2)} MB import limit. Try a smaller recording.`,
      NOT_READY:
        "This broadcast is not ready to import. Try again once YouTube has finished processing it.",
      UNAVAILABLE:
        "This video is unavailable or requires access. Use a public video you have permission to process, or upload your own file.",
      ACCESS_DENIED:
        "YouTube blocked the download. Try again later or upload the recording from your device.",
      BOT_CHECK:
        "YouTube is blocking imports from our server with a human verification check. Upload the recording from your device, or try again later.",
      SESSION_UNAVAILABLE:
        "The server’s YouTube session is unavailable. Ask the administrator to check its private session file.",
      TIMEOUT:
        "The YouTube download timed out. Retry the import or upload your own recording.",
      IMPORT_FAILED:
        "The YouTube video couldn’t be imported. Retry or upload the recording from your device.",
      MEDIA_CAPACITY:
        "The processing server needs more temporary space. Try again later. No processing credits were charged.",
      DOWNLOAD_INTERRUPTED:
        "The YouTube download stopped before it finished. Retry the import; no processing credits were charged.",
      TOOL_UNAVAILABLE:
        "The YouTube download tool is unavailable on the processing server. Ask the administrator to check the media tools.",
      OUTPUT_LIMIT:
        "The download tool produced too much diagnostic output and was stopped. Ask the administrator to check the importer configuration.",
    };
    super(messages[details.code]);
    this.name = "YoutubeImportError";
  }
  get retryable() {
    return [
      "NOT_READY",
      "ACCESS_DENIED",
      "BOT_CHECK",
      "SESSION_UNAVAILABLE",
      "TIMEOUT",
      "IMPORT_FAILED",
      "MEDIA_CAPACITY",
      "DOWNLOAD_INTERRUPTED",
      "TOOL_UNAVAILABLE",
      "OUTPUT_LIMIT",
    ].includes(this.details.code);
  }
}

export async function importYoutube(
  env: Env,
  id: string,
  directory: string,
  captureSeconds: number,
  signal: AbortSignal,
  previewSeconds = 0,
  approve?: (quote: YoutubeQuote) => Promise<void>,
  metadataOnly = false,
) {
  const controller = new AbortController();
  const active = AbortSignal.any([signal, controller.signal]);
  let finished = false;
  let approvalError: unknown;
  const approveMetadata = async () => {
    if (!approve) return;
    while (!finished && !active.aborted) {
      const info = await stat(join(directory, "quote.json")).catch(() => null);
      if (info && info.size <= 10000) {
        try {
          const quote = youtubeQuoteSchema.parse(
            JSON.parse(await readFile(join(directory, "quote.json"), "utf8")),
          );
          await approve(quote);
          await writeFile(join(directory, "credit-approved"), "approved", {
            mode: 0o600,
            flag: "wx",
          });
        } catch (error) {
          approvalError = error;
          controller.abort();
        }
        return;
      }
      await delay(100, undefined, { signal: active }).catch(() => undefined);
    }
  };
  const approval = approveMetadata();
  try {
    await runMediaProcess(
      env.YOUTUBE_PYTHON,
      [
        fileURLToPath(
          new URL("../../media/import-youtube.py", import.meta.url),
        ),
        "--id",
        id,
        "--directory",
        directory,
        "--ffmpeg",
        env.FFMPEG_PATH,
        "--node",
        process.execPath,
        "--max-bytes",
        String(env.UPLOAD_MAX_BYTES),
        "--max-seconds",
        String(Math.min(env.UPLOAD_MAX_SECONDS, env.TRANSCRIPTION_MAX_SECONDS)),
        "--capture-seconds",
        String(captureSeconds),
        "--preview-seconds",
        String(previewSeconds),
        ...(approve ? ["--require-credit"] : []),
        ...(metadataOnly ? ["--metadata-only"] : []),
        ...(env.YOUTUBE_COOKIES_FILE
          ? ["--cookies-file", env.YOUTUBE_COOKIES_FILE]
          : []),
      ],
      {
        signal: active,
        // Structured metadata/results are read from bounded JSON files below.
        // A long download must not fill the shared command-output buffer.
        captureOutput: false,
        timeout: metadataOnly ? 90000 : previewSeconds ? 180000 : 2147483647,
      },
    );
  } catch (error) {
    if (approvalError) throw approvalError;
    try {
      const errorPath = join(directory, "error.json");
      if ((await stat(errorPath)).size <= 2048) {
        const details = importFailureSchema.safeParse(
          JSON.parse(await readFile(errorPath, "utf8")),
        );
        if (details.success)
          throw new YoutubeImportError(details.data, env.UPLOAD_MAX_BYTES);
      }
    } catch (diagnostic) {
      if (diagnostic instanceof YoutubeImportError) throw diagnostic;
    }
    if (error instanceof MediaProcessError) {
      const code =
        error.reason === "START_FAILED"
          ? "TOOL_UNAVAILABLE"
          : error.reason === "TIMEOUT"
            ? "TIMEOUT"
            : error.reason === "OUTPUT_LIMIT"
              ? "OUTPUT_LIMIT"
              : "DOWNLOAD_INTERRUPTED";
      throw new YoutubeImportError(
        {
          code,
          processReason: error.reason,
          exitCode: error.exitCode,
          exitSignal: error.signal,
        },
        env.UPLOAD_MAX_BYTES,
      );
    }
    throw error;
  } finally {
    finished = true;
    controller.abort();
    await approval;
  }
  if (metadataOnly)
    return {
      ...youtubeQuoteSchema.parse(
        JSON.parse(await readFile(join(directory, "quote.json"), "utf8")),
      ),
      path: "",
    };
  const info = await stat(join(directory, "result.json"));
  if (info.size > 10000) throw new Error("Import metadata exceeds limit");
  const result = z
    .object({ title: z.string().min(1).max(200), live: z.boolean() })
    .parse(JSON.parse(await readFile(join(directory, "result.json"), "utf8")));
  return { ...result, path: join(directory, "source.mp4") };
}

export const youtubeQuoteSchema = z.object({
  title: z.string().min(1).max(200),
  live: z.boolean(),
  durationSeconds: z.number().finite().positive(),
  sizeBytes: z.number().int().nonnegative().safe(),
});
export type YoutubeQuote = z.infer<typeof youtubeQuoteSchema>;
