import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Env } from "../config/env.js";
import { transcriptSchema } from "../modules/transcription/transcript.js";

export const transcriptionScript = fileURLToPath(
  new URL("../../transcription/transcribe.py", import.meta.url),
);

// No shell, user filenames, transcripts, or credentials are passed as executable code.
export async function runTranscriber(
  env: Env,
  args: string[],
  signal?: AbortSignal,
) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      env.TRANSCRIPTION_PYTHON,
      [
        transcriptionScript,
        "--model",
        env.TRANSCRIPTION_MODEL,
        "--models",
        env.TRANSCRIPTION_MODEL_DIRECTORY,
        "--threads",
        String(env.TRANSCRIPTION_THREADS),
        "--max-seconds",
        String(env.TRANSCRIPTION_MAX_SECONDS),
        ...args,
      ],
      {
        stdio: "ignore",
        shell: false,
        env: {
          ...process.env,
          OMP_NUM_THREADS: String(env.TRANSCRIPTION_THREADS),
          OPENBLAS_NUM_THREADS: String(env.TRANSCRIPTION_THREADS),
          TOKENIZERS_PARALLELISM: "false",
          HF_HUB_DISABLE_TELEMETRY: "1",
          DO_NOT_TRACK: "1",
          HF_HUB_OFFLINE: args.includes("--prepare") ? "0" : "1",
        },
      },
    );
    let timedOut = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimer ??= setTimeout(() => child.kill("SIGKILL"), 3000).unref();
    };
    const timer = setTimeout(
      stop,
      env.TRANSCRIPTION_TIMEOUT_SECONDS * 1000,
    ).unref();
    signal?.addEventListener("abort", stop, { once: true });
    if (signal?.aborted) stop();
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", stop);
      if (code === 0 && !timedOut) resolve();
      else
        reject(
          new Error(
            "Local transcription stopped. Check the worker setup, model cache, and resource limits.",
          ),
        );
    });
  });
}

export async function transcribeLocal(
  env: Env,
  source: string,
  output: string,
  signal: AbortSignal,
) {
  await runTranscriber(env, ["--input", source, "--output", output], signal);
  const info = await stat(output);
  if (info.size > 512 * 1024 ** 2)
    throw new Error("Transcript exceeds its size limit");
  const transcript = transcriptSchema.parse(
    JSON.parse(await readFile(output, "utf8")),
  );
  if (transcript.model !== env.TRANSCRIPTION_MODEL)
    throw new Error("Unexpected transcription model");
  return transcript;
}
