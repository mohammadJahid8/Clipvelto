import { UploadError } from "../modules/uploads/upload-error.js";

export class TranscriptionProviderError extends Error {
  constructor(readonly status: number) {
    super(
      status === 401 || status === 403
        ? "The transcription service rejected its credentials. Ask the server administrator to check the configured provider API key."
        : status === 429
          ? "The transcription service is busy or its usage limit was reached. Completed audio chunks are saved; retry later."
          : "The transcription service couldn’t complete this request. Completed audio chunks are saved; please retry.",
    );
  }
}

export class TranscriptionResponseError extends Error {
  constructor(
    readonly problemCode = "INVALID_RESPONSE",
    readonly chunkIndex?: number,
  ) {
    super(
      "The transcription service returned incomplete or invalid timestamps. Completed audio chunks are saved; please retry.",
    );
  }
}

export function transcriptionFailureDetails(error: unknown) {
  return {
    transcriptionFailureCode:
      error instanceof TranscriptionResponseError
        ? error.problemCode
        : error instanceof TranscriptionProviderError
          ? `HTTP_${error.status}`
          : "TRANSCRIPTION_STOPPED",
    transcriptionFailureChunk:
      error instanceof TranscriptionResponseError
        ? error.chunkIndex
        : undefined,
  };
}

export function transcriptionFailureMessage(error: unknown) {
  if (error instanceof UploadError) return error.message;
  return error instanceof TranscriptionProviderError ||
    error instanceof TranscriptionResponseError
    ? error.message
    : "Transcription stopped. Your video and completed audio chunks are saved; please retry.";
}
