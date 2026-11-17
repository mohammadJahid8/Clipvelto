import { randomUUID } from "node:crypto";
import { Types, type Connection } from "mongoose";
import type { Env } from "../../config/env.js";
import { createObjectStorage } from "../../services/object-storage.js";
import {
  createUploadQueue,
  enqueueValidation,
  enqueueImport,
} from "../../jobs/upload-queue.js";
import type { createVideoModel } from "../videos/video.model.js";
import { canDeleteVideo } from "../videos/video-policy.js";
import { createUploadQuotaModel } from "./upload-quota.model.js";
import {
  uploadRequestSchema,
  uploadSessionMinutes,
  uploadUrlSeconds,
} from "./upload-policy.js";
import { UploadError } from "./upload-error.js";
import { presentVideo } from "../videos/video-presenter.js";
import { logger } from "../../config/logger.js";
import {
  createCreditService,
  billingCreditMode,
  type CreditMode,
} from "../credits/credit-service.js";
import { processingEnv } from "./processing-limits.js";
import { processingQuote } from "@clipvelto/credit-plans";
import { tmpdir } from "node:os";
import { requireTemporarySpace } from "../../services/temporary-space.js";

export async function createUploadService(
  connection: Connection,
  env: Env,
  VideoModel: ReturnType<typeof createVideoModel>,
) {
  const storage = createObjectStorage(env);
  const queue = createUploadQueue(env);
  const Quota = createUploadQuotaModel(connection);
  await Quota.init();
  const credits = createCreditService(connection, billingCreditMode(env));
  await credits.init();
  const creditsFor = (video: { creditMode?: string | null }) => {
    return createCreditService(
      connection,
      (video.creditMode ?? "live") as CreditMode,
    );
  };
  function assertProcessingMode(video: { creditMode?: string | null }) {
    if (video.creditMode === "test" && credits.mode !== "test")
      throw new UploadError(
        409,
        "TEST_JOB_DISABLED",
        "This video belongs to the development test wallet. Test credits cannot fund live processing.",
      );
  }
  async function creditsForRetry(video: {
    creditMode?: string | null;
    userId: string;
    _id: Types.ObjectId;
  }) {
    const previous = createCreditService(
      connection,
      (video.creditMode ?? "live") as CreditMode,
    );
    if (previous.mode === credits.mode) return credits;
    await credits.transaction(async (session) => {
      const reservation = await previous.reservation(
        video.userId,
        video._id.toString(),
        session,
      );
      if (reservation?.state === "spent" || reservation?.state === "exempt")
        return;
      const changed = await VideoModel.updateOne(
        {
          _id: video._id,
          userId: video.userId,
          status: { $in: ["ready", "failed"] },
          clipStatus: { $nin: ["queued", "processing", "completed"] },
          transcriptionStatus: { $nin: ["queued", "processing"] },
        },
        { $set: { creditMode: credits.mode } },
        { session },
      );
      if (!changed.matchedCount)
        throw new UploadError(
          409,
          "VIDEO_CHANGED",
          "This video is already processing. Refresh its status.",
        );
      await previous.refund(video._id.toString(), session);
      video.creditMode = credits.mode;
    });
    return creditsFor(video);
  }
  async function envForUser(userId: string) {
    return processingEnv(env, (await credits.summary(userId)).role);
  }

  async function findOwned(userId: string, id: string) {
    if (!/^[a-f0-9]{24}$/i.test(id))
      throw new UploadError(404, "VIDEO_NOT_FOUND", "That video wasn’t found.");
    const video = await VideoModel.findOne({
      _id: id,
      userId,
      status: { $nin: ["cancelled", "deleting"] },
    });
    if (
      !video ||
      (env.NODE_ENV === "production" && video.creditMode === "test")
    )
      throw new UploadError(404, "VIDEO_NOT_FOUND", "That video wasn’t found.");
    return video;
  }
  async function initialize(userId: string, body: unknown) {
    const balance = await credits.summary(userId);
    const policy = processingEnv(env, balance.role);
    const parsed = uploadRequestSchema(policy).safeParse(body);
    if (!parsed.success)
      throw new UploadError(
        400,
        "INVALID_UPLOAD",
        "Choose an MP4, MOV, or WebM within the file-size limit and confirm you have permission to use it.",
      );
    const { filename, contentType, sizeBytes } = parsed.data;
    await requireTemporarySpace(tmpdir(), sizeBytes);
    if (balance.role !== "admin" && (balance.available ?? 0) <= 0)
      throw new UploadError(
        402,
        "INSUFFICIENT_CREDITS",
        "Add credits to upload and process another video.",
      );
    await credits.allowSubmit(userId);
    const id = new Types.ObjectId();
    const extension = filename.split(".").at(-1)!.toLowerCase();
    const stagingKey = `staging/${userId}/${id}/${randomUUID()}.${extension}`;
    const sourceKey = `sources/${userId}/${id}/${randomUUID()}.${extension}`;
    const signedUrlExpiresAt = new Date(Date.now() + uploadUrlSeconds * 1000);
    const multipartPartSize =
      sizeBytes > 256 * 1024 ** 2
        ? Math.max(
            64 * 1024 ** 2,
            Math.ceil(sizeBytes / 9999 / 1024 ** 2) * 1024 ** 2,
          )
        : undefined;
    const uploadExpiresAt = new Date(
      Date.now() +
        (multipartPartSize ? 86400000 : uploadSessionMinutes * 60000),
    );
    const signedUrl = multipartPartSize
      ? undefined
      : await storage.signUpload(
          stagingKey,
          sizeBytes,
          contentType,
          uploadUrlSeconds,
        );
    await Quota.updateOne(
      { _id: userId },
      { $setOnInsert: { bytes: 0, videos: 0 } },
      { upsert: true },
    );
    const session = await connection.startSession();
    try {
      await session.withTransaction(async () => {
        const reserved = await Quota.updateOne(
          {
            _id: userId,
          },
          { $inc: { bytes: sizeBytes, videos: 1 } },
          { session },
        );
        if (!reserved.modifiedCount)
          throw new UploadError(
            409,
            "STORAGE_LIMIT",
            "Your workspace storage limit has been reached. Remove older videos and allow cleanup to finish before uploading more.",
          );
        await VideoModel.create(
          [
            {
              _id: id,
              userId,
              title: filename.replace(/\.[^.]+$/u, "").slice(0, 200),
              originalFilename: filename,
              status: "awaiting_upload",
              creditMode: credits.mode,
              quotedCreditSeconds: processingQuote(
                parsed.data.durationSeconds ?? 0,
                sizeBytes,
              ).seconds,
              mediaExpiresAt: new Date(Date.now() + 30 * 86400000),
              processingStartedAt: new Date(),
              processingMaxSeconds: policy.TRANSCRIPTION_MAX_SECONDS,
              renderOptions: parsed.data.renderOptions,
              expectedSize: sizeBytes,
              contentType,
              stagingKey,
              multipartPartSize,
              sourceKey,
              signedUrlExpiresAt,
              uploadExpiresAt,
              quotaReserved: true,
              statusMessage: "Waiting for your file to finish uploading.",
            },
          ],
          { session },
        );
        await credits.reserve(
          userId,
          id.toString(),
          parsed.data.durationSeconds ?? 0,
          session,
          sizeBytes,
        );
      });
    } finally {
      await session.endSession();
    }
    if (multipartPartSize) {
      let multipartUploadId: string | undefined;
      try {
        multipartUploadId = await storage.createMultipart(
          stagingKey,
          contentType,
        );
        const saved = await VideoModel.updateOne(
          { _id: id, userId, status: "awaiting_upload" },
          { $set: { multipartUploadId } },
        );
        if (!saved.matchedCount) throw new Error("Upload cancelled");
      } catch (error) {
        if (multipartUploadId)
          await storage
            .abortMultipart(stagingKey, multipartUploadId)
            .catch(() => undefined);
        await VideoModel.updateOne(
          { _id: id, userId, status: "awaiting_upload" },
          { $set: { status: "deleting" } },
        );
        await credits.refund(id.toString());
        throw error;
      }
    }
    return {
      videoId: id.toString(),
      uploadUrl: signedUrl,
      multipart: multipartPartSize
        ? {
            partSize: multipartPartSize,
            parts: Math.ceil(sizeBytes / multipartPartSize),
          }
        : undefined,
      expiresAt: signedUrlExpiresAt.toISOString(),
      headers: { "Content-Type": contentType },
    };
  }
  async function complete(userId: string, id: string) {
    const video = await findOwned(userId, id);
    const privateUpload = video.multipartPartSize
      ? await VideoModel.findOne({ _id: id, userId }).select(
          "+multipartUploadId",
        )
      : null;
    if (["queued", "validating", "ready"].includes(video.status))
      return presentVideo(video, env);
    if (video.status !== "awaiting_upload" || !video.stagingKey)
      throw new UploadError(
        409,
        "INVALID_UPLOAD_STATE",
        "This upload can’t be completed. Choose the video again to start a fresh upload.",
      );
    if (!video.uploadExpiresAt || video.uploadExpiresAt.getTime() < Date.now())
      throw new UploadError(
        410,
        "UPLOAD_EXPIRED",
        "This upload session has expired. Choose the video again.",
      );
    let head;
    if (privateUpload?.multipartUploadId && video.stagingKey) {
      try {
        await storage.completeMultipart(
          video.stagingKey,
          privateUpload.multipartUploadId,
          video.expectedSize!,
          video.multipartPartSize!,
        );
      } catch (error) {
        // A repeated completion may race the first. Only an exact completed object is accepted below.
        const stored = await storage.head(video.stagingKey).catch(() => null);
        if (stored?.ContentLength !== video.expectedSize) throw error;
      }
    }
    try {
      head = await storage.head(video.stagingKey);
    } catch {
      throw new UploadError(
        409,
        "UPLOAD_NOT_FOUND",
        "The uploaded file isn’t available yet. Retry finishing the upload.",
      );
    }
    if (
      head.ContentLength !== video.expectedSize ||
      head.ContentType?.split(";")[0] !== video.contentType ||
      !head.ETag
    )
      throw new UploadError(
        400,
        "UPLOAD_MISMATCH",
        "The uploaded file doesn’t match the selected video. Start a new upload.",
      );
    await VideoModel.updateOne(
      { _id: id, userId, status: "awaiting_upload" },
      {
        $set: {
          status: "queued",
          stagingEtag: head.ETag,
          statusMessage: "Upload received. Waiting for file checks.",
        },
      },
    );
    try {
      await enqueueValidation(queue, id, video.validationGeneration);
    } catch {
      logger.warn(
        { videoId: id },
        "Validation persisted; queue reconciliation will retry delivery",
      );
    }
    return presentVideo(await findOwned(userId, id), env);
  }
  async function retry(userId: string, id: string) {
    await credits.allowSubmit(userId);
    const video = await findOwned(userId, id);
    if (video.status !== "failed" || video.failureKind !== "temporary")
      throw new UploadError(
        409,
        "RETRY_UNAVAILABLE",
        "This video can’t be retried. Please upload a valid video again.",
      );
    const selectedCredits = await creditsForRetry(video);
    const changed = await selectedCredits.transaction(async (session) => {
      const changed = await VideoModel.findOneAndUpdate(
        {
          _id: id,
          userId,
          status: "failed",
          validationGeneration: video.validationGeneration,
        },
        {
          $set: {
            status:
              video.sourceProvider === "youtube" ? "import_queued" : "queued",
            processingStartedAt: new Date(),
            statusMessage:
              video.sourceProvider === "youtube"
                ? "Waiting to retry the import."
                : "Waiting to retry file checks.",
          },
          $unset: { failureKind: 1 },
          $inc: { validationGeneration: 1 },
        },
        { returnDocument: "after", session },
      );
      if (!changed)
        throw new UploadError(
          409,
          "VIDEO_CHANGED",
          "This video changed. Refresh its status.",
        );
      await selectedCredits.reserve(
        userId,
        id,
        video.sourceProvider === "youtube" ? 0 : (video.durationSeconds ?? 0),
        session,
        video.sourceProvider === "youtube" ? 0 : (video.expectedSize ?? 0),
      );
      return changed;
    });
    if (changed) {
      try {
        await (
          video.sourceProvider === "youtube" ? enqueueImport : enqueueValidation
        )(queue, id, changed.validationGeneration);
      } catch {
        logger.warn(
          { videoId: id },
          "Validation retry awaiting queue delivery",
        );
      }
    }
    return presentVideo(await findOwned(userId, id), env);
  }
  async function signPart(userId: string, id: string, part: number) {
    const video = await findOwned(userId, id);
    const privateUpload = await VideoModel.findOne({ _id: id, userId }).select(
      "+multipartUploadId",
    );
    if (
      video.status !== "awaiting_upload" ||
      !video.multipartPartSize ||
      !privateUpload?.multipartUploadId ||
      !video.stagingKey ||
      !video.expectedSize ||
      !video.uploadExpiresAt ||
      video.uploadExpiresAt.getTime() <= Date.now()
    )
      throw new UploadError(
        409,
        "UPLOAD_EXPIRED",
        "This upload is unavailable. Choose the file again.",
      );
    if (
      !Number.isInteger(part) ||
      part < 1 ||
      part > Math.ceil(video.expectedSize / video.multipartPartSize)
    )
      throw new UploadError(400, "INVALID_PART", "Choose a valid upload part.");
    const size = Math.min(
      video.multipartPartSize,
      video.expectedSize - (part - 1) * video.multipartPartSize,
    );
    return {
      uploadUrl: await storage.signPart(
        video.stagingKey,
        privateUpload.multipartUploadId,
        part,
        size,
      ),
    };
  }
  async function remove(userId: string, id: string) {
    const video = await findOwned(userId, id);
    const selectedCredits = creditsFor(video);
    await selectedCredits.transaction(async (session) => {
      const current = await VideoModel.findOne({
        _id: video._id,
        userId,
        status: { $nin: ["deleting", "cancelled"] },
      }).session(session);
      if (!current) return;
      // Check inside the transaction so stale UI or direct DELETE requests
      // cannot turn deletion into cancellation of a submitted job.
      if (!canDeleteVideo(current))
        throw new UploadError(
          409,
          "VIDEO_NOT_DELETABLE",
          "Submitted jobs can’t be cancelled. You can delete this video after clip generation finishes.",
        );
      await VideoModel.updateOne(
        { _id: current._id, userId },
        {
          $set: {
            status: "deleting",
            statusMessage:
              "Deleting this completed video. Used credits are not refunded.",
            deletionRequestedAt: new Date(),
            uploadExpiresAt: new Date(
              Math.max(
                Date.now() + 120000,
                current.signedUrlExpiresAt?.getTime() ?? 0,
              ),
            ),
          },
        },
        { session },
      );
    });
  }
  async function workerAvailable() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          const client = await queue.backend.client;
          return (
            (await client.get(
              `${env.UPLOAD_QUEUE_PREFIX}:upload-worker-heartbeat`,
            )) !== null
          );
        })(),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), 1500);
        }),
      ]);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    creditsFor,
    creditsForRetry,
    assertProcessingMode,
    envForUser,
    initialize,
    signPart,
    complete,
    retry,
    remove,
    findOwned,
    workerAvailable,
    storage,
    queue,
    Quota,
    credits,
    close: async () => {
      await queue.close();
      storage.close();
    },
  };
}
export type UploadService = Awaited<ReturnType<typeof createUploadService>>;
