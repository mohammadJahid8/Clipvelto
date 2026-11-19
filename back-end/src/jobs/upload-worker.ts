import { Worker } from "bullmq";
import type { Connection } from "mongoose";
import type { Env } from "../config/env.js";
import type { createVideoModel } from "../modules/videos/video.model.js";
import type { UploadService } from "../modules/uploads/upload-service.js";
import {
  redisConnection,
  enqueueValidation,
  enqueueTranscription,
  enqueueImport,
  enqueueClips,
} from "./upload-queue.js";
import { validateUpload } from "./validate-upload.js";
import { transcribeVideo } from "./transcribe-video.js";
import { transcribe as transcribeConfigured } from "../services/transcriber.js";
import { logger } from "../config/logger.js";
import { importVideo } from "./import-video.js";
import { generateClips } from "./generate-clips.js";
import { importYoutube } from "../services/youtube-importer.js";
import { selectHighlights } from "../services/highlight-selector.js";
import { renderClip } from "../services/clip-renderer.js";
import { createMediaCleanup } from "./cleanup-media.js";

export async function startUploadWorker(
  connection: Connection,
  env: Env,
  uploads: UploadService,
  VideoModel: ReturnType<typeof createVideoModel>,
  transcribe = transcribeConfigured,
  importer = importYoutube,
  selector = selectHighlights,
  renderer = renderClip,
) {
  const stopping = new AbortController();
  const cleanupMedia = createMediaCleanup(VideoModel, uploads);
  await uploads.queue.setGlobalConcurrency(1);
  const worker = new Worker<{ videoId: string; generation: number }>(
    "upload-validation",
    (job, token) =>
      job.name === "import"
        ? importVideo(job, env, uploads, VideoModel, stopping.signal, importer, token)
        : job.name === "generate"
          ? generateClips(
              job,
              env,
              uploads,
              VideoModel,
              stopping.signal,
              selector,
              renderer,
              transcribe,
            )
          : job.name === "transcribe"
            ? transcribeVideo(
                job,
                env,
                uploads,
                VideoModel,
                transcribe,
                stopping.signal,
              )
            : validateUpload(job, env, uploads, VideoModel, stopping.signal),
    {
      connection: redisConnection(env, true),
      prefix: env.UPLOAD_QUEUE_PREFIX,
      concurrency: 1,
      maxStalledCount: 1,
      lockDuration: 60000,
    },
  );
  worker.on("error", () => logger.warn("Upload worker connection interrupted"));
  worker.on("failed", (job) => {
    void (async () => {
      if (!job) return;
      if (job.name === "import") {
        if ((await job.getState()) === "failed")
          await VideoModel.updateOne(
            {
              _id: job.data.videoId,
              validationGeneration: job.data.generation,
              status: { $in: ["import_queued", "importing"] },
            },
            {
              $set: {
                status: "failed",
                failureKind: "temporary",
                statusMessage:
                  "YouTube import stopped unexpectedly. You can retry it.",
              },
              $unset: { validationRunId: 1 },
            },
          );
        return;
      }
      if (job.name === "generate") {
        if ((await job.getState()) === "failed")
          await VideoModel.updateOne(
            {
              _id: job.data.videoId,
              clipGeneration: job.data.generation,
              status: "ready",
              clipStatus: { $in: ["queued", "processing"] },
            },
            {
              $set: {
                clipStatus: "failed",
                clipMessage:
                  "Clip creation stopped unexpectedly. You can retry it.",
              },
              $unset: { clipRunId: 1, clipHeartbeatAt: 1 },
            },
          );
        return;
      }
      if (job.name === "transcribe") {
        if ((await job.getState()) === "failed")
          await VideoModel.updateOne(
            {
              _id: job.data.videoId,
              status: "ready",
              transcriptionGeneration: job.data.generation,
              transcriptionStatus: { $in: ["queued", "processing"] },
            },
            {
              $set: {
                transcriptionStatus: "failed",
                transcriptionMessage:
                  "Transcription stopped unexpectedly. You can retry it.",
              },
              $unset: { transcriptionRunId: 1, transcriptionHeartbeatAt: 1 },
            },
          );
        return;
      }
      // Covers exhausted stalled jobs as well as ordinary processor failures.
      if ((await job.getState()) === "failed")
        await VideoModel.updateOne(
          {
            _id: job.data.videoId,
            validationGeneration: job.data.generation,
            status: { $in: ["queued", "validating"] },
          },
          {
            $set: {
              status: "failed",
              failureKind: "temporary",
              statusMessage:
                "File checks stopped unexpectedly. You can retry them.",
            },
          },
        );
    })().catch(() => logger.warn("Failed job status will be reconciled later"));
  });
  let reconciling = false;
  async function maintain() {
    if (reconciling) return;
    reconciling = true;
    try {
      await uploads.youtube.notify();
      await uploads.credits.reconcile();
      await uploads
        .creditsFor({
          creditMode: uploads.credits.mode === "test" ? "live" : "test",
        })
        .reconcile();
      await VideoModel.updateMany(
        {
          trialId: { $exists: true },
          userId: /^trial:/,
          trialExpiresAt: { $lt: new Date() },
          status: { $nin: ["deleting", "cancelled"] },
        },
        { $set: { status: "deleting", uploadExpiresAt: new Date(0) } },
      );
      const client = await uploads.queue.backend.client;
      await client.set(
        `${env.UPLOAD_QUEUE_PREFIX}:upload-worker-heartbeat`,
        "1",
        { EX: 90 },
      );
      await VideoModel.updateMany(
        {
          status: "validating",
          updatedAt: { $lt: new Date(Date.now() - 5 * 60000) },
        },
        {
          $set: {
            status: "queued",
            statusMessage: "Resuming interrupted file checks.",
          },
          $unset: { validationRunId: 1 },
          $inc: { validationGeneration: 1 },
        },
      );
      const queued = await VideoModel.find({
        status: "queued",
        stagingKey: { $exists: true },
      }).limit(100);
      for (const video of queued)
        await enqueueValidation(
          uploads.queue,
          video._id.toString(),
          video.validationGeneration,
        );
      // Do not repeat expensive CPU work automatically after an interrupted run.
      await VideoModel.updateMany(
        {
          status: "ready",
          transcriptionStatus: "processing",
          transcriptionHeartbeatAt: { $lt: new Date(Date.now() - 120000) },
        },
        {
          $set: {
            transcriptionStatus: "failed",
            transcriptionMessage:
              "Transcription was interrupted. You can retry it.",
          },
          $unset: { transcriptionRunId: 1, transcriptionHeartbeatAt: 1 },
        },
      );
      const transcripts = await VideoModel.find({
        status: "ready",
        transcriptionStatus: "queued",
      }).limit(100);
      for (const video of transcripts)
        await enqueueTranscription(
          uploads.queue,
          video._id.toString(),
          video.transcriptionGeneration,
        );
      await VideoModel.updateMany(
        {
          status: "importing",
          updatedAt: { $lt: new Date(Date.now() - 120000) },
        },
        {
          $set: {
            status: "failed",
            failureKind: "temporary",
            statusMessage: "YouTube import was interrupted. You can retry it.",
          },
          $unset: { validationRunId: 1 },
        },
      );
      for (const video of await VideoModel.find({
        status: "import_queued",
      }).limit(100))
        await enqueueImport(
          uploads.queue,
          video._id.toString(),
          video.validationGeneration,
        );
      await VideoModel.updateMany(
        {
          status: "ready",
          clipStatus: "processing",
          clipHeartbeatAt: { $lt: new Date(Date.now() - 120000) },
        },
        {
          $set: {
            clipStatus: "failed",
            clipMessage: "Clip creation was interrupted. You can retry it.",
          },
          $unset: { clipRunId: 1, clipHeartbeatAt: 1 },
        },
      );
      for (const video of await VideoModel.find({
        status: "ready",
        clipStatus: "queued",
      }).limit(100))
        await enqueueClips(
          uploads.queue,
          video._id.toString(),
          video.clipGeneration,
        );
      await VideoModel.updateMany(
        {
          mediaExpiresAt: { $lt: new Date() },
          status: {
            $in: ["ready", "failed", "awaiting_upload", "import_queued"],
          },
          clipStatus: { $ne: "processing" },
          transcriptionStatus: { $ne: "processing" },
        },
        {
          $set: {
            status: "deleting",
            uploadExpiresAt: new Date(),
            statusMessage: "Media retention ended. Removing stored files.",
          },
        },
      );
      const expired = await VideoModel.find({
        quotaReserved: true,
        uploadExpiresAt: { $lt: new Date() },
        $or: [
          { status: { $in: ["awaiting_upload", "cancelled", "deleting"] } },
          { status: "ready", stagingKey: { $exists: true } },
          { status: "failed", stagingCleanedAt: { $exists: false } },
        ],
      }).limit(100);
      for (const video of expired) {
        if (video.multipartPartSize && video.stagingKey) {
          const privateUpload = await VideoModel.findById(video._id).select(
            "+multipartUploadId",
          );
          if (privateUpload?.multipartUploadId)
            await uploads.storage
              .abortMultipart(video.stagingKey, privateUpload.multipartUploadId)
              .catch(() => undefined);
        }
        if (video.stagingKey) await uploads.storage.remove(video.stagingKey);
        if (video.status === "ready") {
          await VideoModel.updateOne(
            { _id: video._id, status: "ready" },
            { $unset: { stagingKey: 1 } },
          );
          continue;
        }
        // Failed videos remain visible, with a clear error, until the user removes them.
        if (video.status === "failed") {
          if (video.failureKind === "invalid" && video.sourceKey)
            await uploads.storage.remove(video.sourceKey);
          await VideoModel.updateOne(
            { _id: video._id, status: "failed" },
            { $set: { stagingCleanedAt: new Date() } },
          );
          continue;
        }
        if (video.sourceKey) await uploads.storage.remove(video.sourceKey);
        await uploads.storage.removePrefix(
          `staging/${video.userId}/${video._id}/`,
        );
        for (const key of video.artifactKeys ?? [])
          await uploads.storage.remove(key);
        if (video.sourceProvider === "youtube")
          await uploads.storage.removePrefix(
            `imports/${video.userId}/${video._id}/`,
          );
        await uploads.storage.removePrefix(
          `clips/${video.userId}/${video._id}/`,
        );
        await uploads.storage.removePrefix(
          `transcripts/${video.userId}/${video._id}/`,
        );
        const session = await connection.startSession();
        try {
          await session.withTransaction(async () => {
            const deleted = await VideoModel.findOneAndDelete(
              {
                _id: video._id,
                quotaReserved: true,
                status: { $in: ["awaiting_upload", "cancelled", "deleting"] },
              },
              { session },
            );
            if (deleted) {
              await uploads
                .creditsFor(deleted)
                .cancelWork(
                  deleted.userId,
                  deleted._id.toString(),
                  deleted.cancellationChargeSeconds ?? 0,
                  session,
                );
              await uploads
                .creditsFor(deleted)
                .refund(deleted._id.toString(), session);
              await uploads.Quota.updateOne(
                { _id: deleted.userId },
                { $inc: {
                  bytes: deleted.sourceRemovedAt ? 0 : -(deleted.expectedSize ?? 0),
                  videos: -1,
                } },
                { session },
              );
            }
          });
        } finally {
          await session.endSession();
        }
      }
      await cleanupMedia();
    } catch {
      logger.warn(
        "Upload reconciliation will retry after a service interruption",
      );
    } finally {
      reconciling = false;
    }
  }
  await worker.waitUntilReady();
  await maintain();
  const timer = setInterval(() => {
    void maintain();
  }, 30000);
  timer.unref();
  return {
    worker,
    maintain,
    close: async () => {
      clearInterval(timer);
      stopping.abort();
      await worker.close();
    },
  };
}
