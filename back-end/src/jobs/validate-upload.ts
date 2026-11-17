import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { UnrecoverableError, type Job } from "bullmq";
import type { Env } from "../config/env.js";
import type { UploadService } from "../modules/uploads/upload-service.js";
import type { createVideoModel } from "../modules/videos/video.model.js";
import { UploadError } from "../modules/uploads/upload-error.js";
import { probeVideo } from "./probe-video.js";
import { enqueueClips } from "./upload-queue.js";
import { transferTimeoutMs } from "../modules/uploads/processing-limits.js";
import { processingQuote } from "@clipvelto/credit-plans";
import { requireTemporarySpace } from "../services/temporary-space.js";

export async function validateUpload(
  job: Job<{ videoId: string; generation: number }>,
  env: Env,
  uploads: UploadService,
  VideoModel: ReturnType<typeof createVideoModel>,
  shutdown?: AbortSignal,
) {
  const { videoId, generation } = job.data;
  const runId = randomUUID();
  const video = await VideoModel.findOneAndUpdate(
    {
      _id: videoId,
      validationGeneration: generation,
      status: { $in: ["queued", "validating"] },
    },
    {
      $set: {
        status: "validating",
        validationRunId: runId,
        statusMessage: "Checking video format, size, and duration.",
      },
    },
    { returnDocument: "after" },
  );
  if (!video) return;
  const filter = {
    _id: videoId,
    validationRunId: runId,
    status: "validating" as const,
  };
  const controller = new AbortController();
  const abort = () => controller.abort();
  shutdown?.addEventListener("abort", abort, { once: true });
  if (shutdown?.aborted) abort();
  const heartbeat = setInterval(() => {
    void VideoModel.updateOne(filter, { $set: { updatedAt: new Date() } })
      .then((result) => {
        if (!result.matchedCount) abort();
      })
      .catch(abort);
  }, 10000).unref();
  let directory: string | undefined;
  const automaticClips =
    env.CLIPS_ENABLED && env.TRANSCRIPTION_ENABLED && !!env.ANTHROPIC_API_KEY;
  try {
    env = await uploads.envForUser(video.userId);
    if (
      !video.stagingKey ||
      !video.sourceKey ||
      !video.stagingEtag ||
      !video.expectedSize ||
      !video.contentType
    )
      throw new UploadError(
        400,
        "INVALID_UPLOAD",
        "This upload is missing required file information. Please upload the video again.",
      );
    let head;
    try {
      head = await uploads.storage.head(video.sourceKey);
    } catch (error) {
      if (!(
        error instanceof Error &&
        (error.name === "NotFound" || error.name === "NoSuchKey")
      ))
        throw error;
      await uploads.storage.copy(
        video.stagingKey,
        video.sourceKey,
        video.stagingEtag,
      );
      head = await uploads.storage.head(video.sourceKey);
    }
    if (
      head.ContentLength !== video.expectedSize ||
      head.ContentLength > env.UPLOAD_MAX_BYTES ||
      head.ContentType?.split(";")[0] !== video.contentType ||
      !head.ETag
    )
      throw new UploadError(
        400,
        "INVALID_UPLOAD",
        "The stored file doesn’t match the selected video. Please upload it again.",
      );
    const timeout = transferTimeoutMs(video.expectedSize);
    const source = await uploads.storage.get(
      video.sourceKey,
      head.ETag,
      timeout,
    );
    if (!source.Body) throw new Error("Missing storage body");
    directory = await mkdtemp(join(tmpdir(), "clipvelto-video-"));
    await requireTemporarySpace(directory, video.expectedSize);
    const path = join(directory, "source");
    const hash = createHash("sha256");
    let size = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        if (size > video.expectedSize! || size > env.UPLOAD_MAX_BYTES) {
          callback(
            new UploadError(
              400,
              "INVALID_UPLOAD",
              "The uploaded file exceeds its allowed size.",
            ),
          );
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    await pipeline(
      source.Body as Readable,
      meter,
      createWriteStream(path, { mode: 0o600, flags: "wx" }),
      {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(timeout),
        ]),
      },
    );
    if (size !== video.expectedSize)
      throw new UploadError(
        400,
        "INVALID_UPLOAD",
        "The uploaded file is incomplete. Please upload it again.",
      );
    const metadata = await probeVideo(
      path,
      video.contentType,
      automaticClips
        ? Math.min(env.UPLOAD_MAX_SECONDS, env.TRANSCRIPTION_MAX_SECONDS)
        : env.UPLOAD_MAX_SECONDS,
    );
    // Client duration is only a preliminary quote. Reserve the verified duration
    // before any transcription/provider work, even when the client understated it.
    const credits = uploads.creditsFor(video);
    try {
      await credits.reserveWork(
        video.userId,
        videoId,
        metadata.durationSeconds,
        size,
      );
    } catch (error) {
      if (!(error instanceof UploadError) || error.status !== 402) throw error;
      await credits.refund(videoId);
      await VideoModel.updateOne(filter, {
        $set: {
          status: "ready",
          clipStatus: "failed",
          clipMessage: error.message,
          durationSeconds: metadata.durationSeconds,
          width: metadata.width,
          height: metadata.height,
          container: metadata.container,
          sha256: hash.digest("hex"),
          sourceEtag: head.ETag,
          quotedCreditSeconds: processingQuote(metadata.durationSeconds, size)
            .seconds,
          mediaExpiresAt: new Date(Date.now() + 86400000),
          statusMessage:
            "Add credits to process this video. This unpaid source will be kept for 24 hours.",
        },
        $unset: { validationRunId: 1, failureKind: 1 },
      });
      return;
    }
    const checked = await VideoModel.updateOne(filter, {
      $set: {
        status: "ready",
        quotedCreditSeconds: processingQuote(metadata.durationSeconds, size)
          .seconds,
        processingMaxSeconds: env.TRANSCRIPTION_MAX_SECONDS,
        statusMessage: "Upload checked and saved.",
        ...(automaticClips
          ? {
              clipStatus: "queued",
              clipGeneration: (video.clipGeneration ?? 0) + 1,
              clipMessage: "Waiting to create your clips.",
            }
          : {}),
        durationSeconds: metadata.durationSeconds,
        width: metadata.width,
        height: metadata.height,
        container: metadata.container,
        sha256: hash.digest("hex"),
        sourceEtag: head.ETag,
      },
      $unset: { failureKind: 1, validationRunId: 1 },
    });
    if (checked.modifiedCount && automaticClips)
      await enqueueClips(
        uploads.queue,
        videoId,
        (video.clipGeneration ?? 0) + 1,
      ).catch(() => undefined);
  } catch (error) {
    const invalid = error instanceof UploadError && error.status < 500;
    const final = invalid || job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    await VideoModel.updateOne(filter, {
      $set: {
        status: final ? "failed" : "queued",
        ...(final ? { mediaExpiresAt: new Date(Date.now() + 86400000) } : {}),
        failureKind: invalid ? "invalid" : "temporary",
        statusMessage:
          error instanceof UploadError
            ? error.message
            : final
              ? "File checks were interrupted. You can retry them."
              : "File checks were interrupted. Retrying automatically.",
      },
      $unset: { validationRunId: 1 },
    });
    if (invalid) {
      throw new UnrecoverableError("Video validation rejected");
    }
    throw new Error("Video validation temporarily unavailable");
  } finally {
    clearInterval(heartbeat);
    shutdown?.removeEventListener("abort", abort);
    abort();
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
