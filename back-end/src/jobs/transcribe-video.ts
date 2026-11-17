import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Job } from "bullmq";
import type { Env } from "../config/env.js";
import type { UploadService } from "../modules/uploads/upload-service.js";
import type { createVideoModel } from "../modules/videos/video.model.js";
import { transcribe as transcribeConfigured } from "../services/transcriber.js";
import {
  transcriptionFailureMessage,
  transcriptionFailureDetails,
} from "../services/transcription-error.js";
import { transferTimeoutMs } from "../modules/uploads/processing-limits.js";
import {
  readTranscriptData,
  saveTranscriptData,
} from "../services/transcript-storage.js";
import { requireTemporarySpace } from "../services/temporary-space.js";

export async function transcribeVideo(
  job: Job<{ videoId: string; generation: number }>,
  env: Env,
  uploads: UploadService,
  VideoModel: ReturnType<typeof createVideoModel>,
  transcribe = transcribeConfigured,
  shutdown?: AbortSignal,
) {
  const runId = randomUUID();
  const video = await VideoModel.findOneAndUpdate(
    {
      _id: job.data.videoId,
      status: "ready",
      transcriptionGeneration: job.data.generation,
      transcriptionStatus: "queued",
    },
    {
      $set: {
        transcriptionStatus: "processing",
        transcriptionRunId: runId,
        transcriptionHeartbeatAt: new Date(),
        transcriptionMessage: "Listening to your video and adding timestamps.",
      },
    },
    { returnDocument: "after" },
  ).select("+transcriptionCheckpoint +checkpointKey");
  if (!video) return;
  const credits = uploads.creditsFor(video);
  const filter = {
    _id: video._id,
    status: "ready" as const,
    transcriptionGeneration: job.data.generation,
    transcriptionRunId: runId,
    transcriptionStatus: "processing" as const,
  };
  const controller = new AbortController();
  const abort = () => controller.abort();
  shutdown?.addEventListener("abort", abort, { once: true });
  if (shutdown?.aborted) abort();
  let checking = false;
  const heartbeat = setInterval(() => {
    if (checking) return;
    checking = true;
    void VideoModel.updateOne(filter, {
      $set: { transcriptionHeartbeatAt: new Date() },
    })
      .then((result) => {
        if (!result.matchedCount) controller.abort();
      })
      .catch(() => controller.abort())
      .finally(() => {
        checking = false;
      });
  }, 10000).unref();
  let directory: string | undefined;
  try {
    uploads.assertProcessingMode(video);
    env = await uploads.envForUser(video.userId);
    env = {
      ...env,
      TRANSCRIPTION_MAX_SECONDS: Math.ceil(video.durationSeconds ?? 0) + 1,
      TRANSCRIPTION_TIMEOUT_SECONDS: Math.min(
        2147483,
        Math.max(
          env.TRANSCRIPTION_TIMEOUT_SECONDS,
          Math.ceil((video.durationSeconds ?? 0) / 300) * 90,
        ),
      ),
    };
    if (
      !env.TRANSCRIPTION_ENABLED ||
      !video.sourceKey ||
      !video.sourceEtag ||
      !video.expectedSize ||
      !video.sha256 ||
      (video.durationSeconds ?? Infinity) > env.TRANSCRIPTION_MAX_SECONDS
    )
      throw new Error("Transcription unavailable for this source");
    directory = await mkdtemp(join(tmpdir(), "clipvelto-transcript-"));
    await credits.transaction(async (session) => {
      if (!(await VideoModel.exists(filter).session(session)))
        throw new Error("Cancelled");
      await credits.reserve(
        video.userId,
        video._id.toString(),
        video.durationSeconds!,
        session,
        video.expectedSize ?? 0,
      );
    });
    const sourcePath = join(directory, "source");
    await requireTemporarySpace(directory, video.expectedSize);
    const hash = createHash("sha256");
    let size = 0;
    const timeout = transferTimeoutMs(video.expectedSize);
    const source = await uploads.storage.get(
      video.sourceKey,
      video.sourceEtag,
      timeout,
    );
    if (!source.Body) throw new Error("Missing source");
    await pipeline(
      source.Body as Readable,
      new Transform({
        transform(chunk: Buffer, _encoding, done) {
          size += chunk.length;
          if (size > video.expectedSize! || size > env.UPLOAD_MAX_BYTES)
            return done(new Error("Source exceeds its limit"));
          hash.update(chunk);
          done(null, chunk);
        },
      }),
      createWriteStream(sourcePath, { flags: "wx", mode: 0o600 }),
      {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(timeout),
        ]),
      },
    );
    if (size !== video.expectedSize || hash.digest("hex") !== video.sha256)
      throw new Error("Source integrity check failed");
    const transcript = await transcribe(
      env,
      sourcePath,
      join(directory, "transcript.json"),
      controller.signal,
      {
        sourceSha256: video.sha256,
        checkpoint: await readTranscriptData(uploads.storage, video, true),
        recoveryChunkIndex: video.transcriptionFailureChunk,
        saveCheckpoint: async (checkpoint) => {
          await saveTranscriptData(
            uploads.storage,
            VideoModel,
            filter,
            video,
            directory!,
            checkpoint,
            true,
          );
          const result = await VideoModel.updateOne(filter, {
            $set: {
              transcriptionMessage: `Transcribing audio: ${checkpoint.chunks.length} of ${Math.ceil(checkpoint.sampleCount / 16000 / 300)} parts complete.`,
              processedCreditSeconds: Math.min(
                video.durationSeconds!,
                checkpoint.chunks.length * 300,
              ),
            },
          });
          if (!result.matchedCount) throw new Error("Cancelled");
        },
      },
    );
    if (
      transcript.segments.some(
        (segment) => segment.end > (video.durationSeconds ?? 0) + 1,
      )
    )
      throw new Error("Transcript exceeds source duration");
    await saveTranscriptData(
      uploads.storage,
      VideoModel,
      filter,
      video,
      directory!,
      transcript,
    );
    await credits.transaction(async (session) => {
      const transcriptSaved = await VideoModel.updateOne(
        filter,
        {
          $set: {
            transcriptionStatus: "completed",
            mediaExpiresAt: new Date(Date.now() + 30 * 86400000),
            transcriptionMessage:
              transcript.emptyReason === "no_audio"
                ? "This video has no audio track."
                : transcript.emptyReason === "no_speech"
                  ? "No speech was detected in this video."
                  : "Transcript ready. Review the wording before using it in captions.",
          },
          $unset: {
            transcriptionRunId: 1,
            transcriptionHeartbeatAt: 1,
            transcriptionFailureCode: 1,
            transcriptionFailureChunk: 1,
            transcriptionCheckpoint: 1,
            checkpointKey: 1,
          },
        },
        { session },
      );
      if (!transcriptSaved.matchedCount) throw new Error("Cancelled");
      if (transcript.segments.length)
        await credits.commit(video._id.toString(), session);
      else await credits.refund(video._id.toString(), session);
    });
  } catch (error) {
    const failed = await VideoModel.updateOne(filter, {
      $set: {
        transcriptionStatus: "failed",
        ...transcriptionFailureDetails(error),
        transcriptionMessage: transcriptionFailureMessage(error),
      },
      $unset: { transcriptionRunId: 1, transcriptionHeartbeatAt: 1 },
    });
    if (failed.matchedCount) await credits.refund(video._id.toString());
    throw new Error("Video transcription failed");
  } finally {
    clearInterval(heartbeat);
    shutdown?.removeEventListener("abort", abort);
    controller.abort();
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
