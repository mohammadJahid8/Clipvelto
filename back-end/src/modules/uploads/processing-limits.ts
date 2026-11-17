import type { Env } from "../../config/env.js";

// Numeric/protocol bounds, not plan entitlements. The wallet funds actual work.
export const maximumProcessingSeconds =
  Math.floor(Number.MAX_SAFE_INTEGER / 32000) - 1;
export const maximumObjectBytes = 5 * 1024 ** 4;

export function processingEnv(env: Env, _role?: string): Env {
  return {
    ...env,
    TRANSCRIPTION_MAX_SECONDS: maximumProcessingSeconds,
    UPLOAD_MAX_SECONDS: maximumProcessingSeconds,
    UPLOAD_MAX_BYTES: maximumObjectBytes,
  };
}

export function transferTimeoutMs(bytes: number) {
  return Math.min(
    30 * 60000,
    Math.max(120000, Math.ceil(bytes / 1024 ** 2) * 2000),
  );
}
