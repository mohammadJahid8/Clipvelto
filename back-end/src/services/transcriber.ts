import type { Env } from "../config/env.js";
import { transcribeLocal } from "./local-transcriber.js";
import {
  transcribeHosted,
  type TranscriptionContext,
} from "./hosted-transcriber.js";

export function transcribe(
  env: Env,
  source: string,
  output: string,
  signal: AbortSignal,
  context?: TranscriptionContext,
) {
  return env.TRANSCRIPTION_PROVIDER === "local"
    ? transcribeLocal(env, source, output, signal)
    : transcribeHosted(env, source, output, signal, context);
}
