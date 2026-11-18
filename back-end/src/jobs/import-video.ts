import { randomUUID, createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DelayedError, type Job } from "bullmq";
import type { Env } from "../config/env.js";
import type { UploadService } from "../modules/uploads/upload-service.js";
import type { createVideoModel } from "../modules/videos/video.model.js";
import {
  importYoutube,
  YoutubeImportError,
} from "../services/youtube-importer.js";
import { probeVideo } from "./probe-video.js";
import { enqueueClips } from "./upload-queue.js";
import { trialModels } from "../modules/trials/trial.model.js";
import { UploadError } from "../modules/uploads/upload-error.js";
import { logger } from "../config/logger.js";
import { processingQuote } from "@clipvelto/credit-plans";
import { requireTemporarySpace } from "../services/temporary-space.js";
import { YoutubeSessionPaused, youtubeResumeDelay } from "../services/youtube-session.js";

export async function importVideo(
  job: Job<{ videoId: string; generation: number }>,
  env: Env,
  uploads: UploadService,
  VideoModel: ReturnType<typeof createVideoModel>,
  shutdown: AbortSignal,
  importer = importYoutube,
  token?: string,
) {
  const run = randomUUID();
  const video = await VideoModel.findOneAndUpdate(
    {
      _id: job.data.videoId,
      validationGeneration: job.data.generation,
      status: "import_queued",
    },
    {
      $set: {
        status: "importing",
        validationRunId: run,
        statusMessage:
          "Importing YouTube video. Active streams are recorded for the selected window.",
      },
    },
    { returnDocument: "after" },
  );
  if (!video) return;
  const filter = {
    _id: video._id,
    validationRunId: run,
    status: "importing" as const,
  };
  const controller = new AbortController();
  const abort = () => controller.abort();
  shutdown.addEventListener("abort", abort, { once: true });
  if (shutdown.aborted) abort();
  const timer = setInterval(() => {
    void VideoModel.updateOne(filter, { $set: { updatedAt: new Date() } })
      .then((result) => {
        if (!result.matchedCount) abort();
      })
      .catch(abort);
  }, 10000).unref();
  let directory: string | undefined;
  let key: string | undefined;
  let saved = false;
  const automaticClips =
    env.CLIPS_ENABLED && env.TRANSCRIPTION_ENABLED && !!env.ANTHROPIC_API_KEY;
  try {
    uploads.assertProcessingMode(video);
    directory = await mkdtemp(join(tmpdir(), "clipvelto-import-"));
    if (!env.YOUTUBE_ENABLED || !video.youtubeId)
      throw new Error("Import unavailable");
    const guest = !!video.trialId && video.userId.startsWith("trial:");
    if (
      guest &&
      !(await trialModels(VideoModel.db).Trial.exists({
        _id: video.trialId,
        videoId: video._id,
        claimedBy: { $exists: false },
        expiresAt: { $gt: new Date() },
      }))
    )
      throw new Error("Trial expired");
    const credits = uploads.creditsFor(video);
    const policy = guest ? env : await uploads.envForUser(video.userId);
    const maximum = guest ? 180 : policy.TRANSCRIPTION_MAX_SECONDS;
    if (maximum < 1) throw new Error("No processing allowance");
    const importEnv = {
      ...policy,
      UPLOAD_MAX_BYTES: guest
        ? Math.min(env.UPLOAD_MAX_BYTES, 150 * 1024 ** 2)
        : policy.UPLOAD_MAX_BYTES,
      TRANSCRIPTION_MAX_SECONDS: maximum,
    };
    const imported = await uploads.youtube.run(() => importer(
      importEnv,
      video.youtubeId!,
      directory!,
      video.captureSeconds ?? 300,
      controller.signal,
      guest ? 180 : 0,
      guest
        ? undefined
        : async (quote) => {
            await requireTemporarySpace(directory!, quote.sizeBytes * 2);
            await credits.transaction(async (session) => {
              const current = await VideoModel.exists(filter).session(session);
              if (!current) throw new Error("Import cancelled");
              await credits.reserve(
                video.userId,
                video._id.toString(),
                quote.durationSeconds,
                session,
                quote.sizeBytes,
              );
              await VideoModel.updateOne(
                filter,
                {
                  $set: {
                    quotedCreditSeconds: processingQuote(
                      quote.durationSeconds,
                      quote.sizeBytes,
                    ).seconds,
                    durationSeconds: quote.durationSeconds,
                    title: quote.title,
                    statusMessage: "Credits reserved. Downloading your video.",
                  },
                },
                { session },
              );
            });
          },
    ));
    const info = await stat(imported.path);
    if (!info.size || info.size > importEnv.UPLOAD_MAX_BYTES)
      throw new Error("Import exceeds size limit");
    const metadata = await probeVideo(
      imported.path,
      "video/mp4",
      Math.min(policy.UPLOAD_MAX_SECONDS, maximum),
    );
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(imported.path))
      hash.update(chunk);
    const digest = hash.digest("hex");
    key = `imports/${video.userId}/${video._id}/${run}.mp4`;
    const claim = await VideoModel.updateOne(filter, {
      $addToSet: { artifactKeys: key },
    });
    if (!claim.matchedCount) throw new Error("Import cancelled");
    await uploads.storage.putFile(key, imported.path, info.size, "video/mp4");
    const head = await uploads.storage.head(key);
    const session = await VideoModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        if (!guest)
          await credits.reserve(
            video.userId,
            video._id.toString(),
            metadata.durationSeconds,
            session,
            info.size,
          );
        const result = await VideoModel.updateOne(
          filter,
          {
            $set: {
              status: "ready",
              processingMaxSeconds: policy.TRANSCRIPTION_MAX_SECONDS,
              ...(guest || automaticClips
                ? {
                    clipStatus: "queued",
                    clipGeneration: (video.clipGeneration ?? 0) + 1,
                    clipMessage: "Waiting to create your clips.",
                  }
                : {}),
              title: imported.title,
              expectedSize: info.size,
              sourceKey: key,
              sourceEtag: head.ETag,
              sha256: digest,
              durationSeconds: metadata.durationSeconds,
              quotedCreditSeconds: guest
                ? undefined
                : processingQuote(metadata.durationSeconds, info.size).seconds,
              width: metadata.width,
              height: metadata.height,
              container: metadata.container,
              statusMessage: "YouTube video imported and checked.",
            },
            $unset: {
              validationRunId: 1,
              failureKind: 1,
              importFailureCode: 1,
              importProcessReason: 1,
              importExitCode: 1,
              importExitSignal: 1,
            },
          },
          { session },
        );
        if (!result.modifiedCount) throw new Error("Import cancelled");
        await uploads.Quota.updateOne(
          { _id: video.userId },
          {
            $inc: {
              bytes: info.size - (video.expectedSize ?? 1),
            },
          },
          { session },
        );
      });
      saved = true;
      if (guest || automaticClips)
        await enqueueClips(
          uploads.queue,
          video._id.toString(),
          (video.clipGeneration ?? 0) + 1,
        ).catch(() => undefined);
    } finally {
      await session.endSession();
    }
  } catch (error) {
    if (error instanceof YoutubeSessionPaused) {
      await uploads.creditsFor(video).transaction(async (session) => {
        const waiting = await VideoModel.updateOne(filter, {
          $set: {
            status: "import_queued",
            importFailureCode: "SESSION_PAUSED",
            statusMessage: "YouTube imports are temporarily paused. Your job is saved and will retry automatically. No credits are reserved while it waits.",
          },
          $unset: { validationRunId: 1 },
        }, { session });
        if (waiting.matchedCount && !video.userId.startsWith("trial:"))
          await uploads.creditsFor(video).refund(video._id.toString(), session);
      });
      await job.moveToDelayed(Date.now() + youtubeResumeDelay, token);
      throw new DelayedError();
    }
    logger.warn(
      {
        videoId: video._id.toString(),
        ...(error instanceof YoutubeImportError
          ? {
              processReason: error.details.processReason,
              exitCode: error.details.exitCode,
              exitSignal: error.details.exitSignal,
            }
          : {}),
        reason:
          error instanceof YoutubeImportError
            ? error.details.code
            : "IMPORT_OR_STORAGE_FAILED",
      },
      "YouTube import failed; provider content omitted",
    );
    const failed = await VideoModel.updateOne(filter, {
      $set: {
        status: "failed",
        importProcessReason:
          error instanceof YoutubeImportError
            ? error.details.processReason
            : undefined,
        importExitCode:
          error instanceof YoutubeImportError
            ? error.details.exitCode
            : undefined,
        importExitSignal:
          error instanceof YoutubeImportError
            ? error.details.exitSignal
            : undefined,
        importFailureCode:
          error instanceof YoutubeImportError
            ? error.details.code
            : error instanceof UploadError
              ? error.code
              : "IMPORT_OR_STORAGE_FAILED",
        mediaExpiresAt: new Date(Date.now() + 86400000),
        failureKind:
          (error instanceof UploadError &&
            error.status < 500 &&
            error.status !== 402) ||
          (error instanceof YoutubeImportError && !error.retryable)
            ? "invalid"
            : "temporary",
        statusMessage:
          error instanceof YoutubeImportError || error instanceof UploadError
            ? error.message
            : "The video couldn’t be imported or saved. Retry the import or upload a file from your device.",
      },
      $unset: { validationRunId: 1 },
    });
    if (failed.matchedCount && !video.userId.startsWith("trial:"))
      await uploads.creditsFor(video).refund(video._id.toString());
    throw new Error("YouTube import unavailable");
  } finally {
    clearInterval(timer);
    shutdown.removeEventListener("abort", abort);
    abort();
    if (key && !saved) await uploads.storage.remove(key).catch(() => undefined);
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
