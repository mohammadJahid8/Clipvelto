import { createHash, createHmac, randomBytes } from "node:crypto";
import { Types, type Connection } from "mongoose";
import type { Env } from "../../config/env.js";
import type { UploadService } from "../uploads/upload-service.js";
import type { createVideoModel } from "../videos/video.model.js";
import { trialModels } from "./trial.model.js";
import { UploadError } from "../uploads/upload-error.js";
import { enqueueImport, enqueueClips } from "../../jobs/upload-queue.js";
import { youtubeVideoId } from "../imports/youtube-url.js";

export const trialCookie = "clipvelto-trial";
export function localTrialTesting(env: Env, ip = "") {
  return env.NODE_ENV === "development" && env.TRIAL_LOCAL_TESTING &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(env.BETTER_AUTH_URL).hostname) &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip);
}
export function cookieToken(header = "") {
  const value = header
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${trialCookie}=`))
    ?.slice(trialCookie.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function createTrialService(
  connection: Connection,
  env: Env,
  uploads: UploadService,
  VideoModel: ReturnType<typeof createVideoModel>,
) {
  const { Trial, Gate, Budget } = trialModels(connection);
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  async function find(token: string | null) {
    return token ? Trial.findOne({ tokenHash: hash(token) }) : null;
  }
  return {
    Trial,
    init: () => Promise.all([Trial.init(), Gate.init(), Budget.init()]),
    async create(url: string, ip: string, previousToken: string | null) {
      if (await find(previousToken))
        throw new UploadError(
          429,
          "TRIAL_USED",
          "Your preview trial has already started. Sign in to continue with your free account.",
        );
      const youtubeId = youtubeVideoId(url),
        id = new Types.ObjectId(),
        videoId = new Types.ObjectId(),
        token = randomBytes(32).toString("hex");
      const userId = `trial:${id}`,
        now = new Date(),
        expiresAt = new Date(Date.now() + 24 * 3600000);
      const ipHash = createHmac("sha256", env.BETTER_AUTH_SECRET)
        .update(`trial-ip:${ip}`)
        .digest("hex");
      await uploads.credits.transaction(async (session) => {
        if (!localTrialTesting(env, ip)) {
          const gate = await Gate.findById(ipHash).session(session);
          if (gate?.nextAllowedAt && gate.nextAllowedAt > now)
            throw new UploadError(
              429,
              "TRIAL_NETWORK_LIMIT",
              "A free preview has already been requested from this network. Create an account for 15 free minutes.",
            );
          await Gate.updateOne(
            { _id: ipHash },
            { $set: { nextAllowedAt: expiresAt } },
            { upsert: true, session },
          );
          const day = now.toISOString().slice(0, 10);
          await Budget.updateOne(
            { _id: day },
            {
              $setOnInsert: {
                seconds: 0,
                expiresAt: new Date(Date.now() + 30 * 86400000),
              },
            },
            { upsert: true, session },
          );
          const budget = await Budget.updateOne(
            { _id: day, seconds: { $lte: env.TRIAL_DAILY_MINUTES * 60 - 180 } },
            { $inc: { seconds: 180 } },
            { session },
          );
          if (!budget.modifiedCount)
            throw new UploadError(
              429,
              "TRIAL_CAPACITY",
              "Today's public preview capacity is full. You can still create a free account.",
            );
        }
        await uploads.Quota.create(
          [
            {
              _id: userId,
              bytes: Math.min(env.UPLOAD_MAX_BYTES, 150 * 1024 ** 2),
              videos: 1,
            },
          ],
          { session },
        );
        await VideoModel.create(
          [
            {
              _id: videoId,
              userId,
              title: "Your YouTube preview",
              originalFilename: `youtube-${youtubeId}.mp4`,
              sourceProvider: "youtube",
              youtubeId,
              captureSeconds: 180,
              trialId: id.toString(),
              trialExpiresAt: expiresAt,
              expectedSize: Math.min(env.UPLOAD_MAX_BYTES, 150 * 1024 ** 2),
              contentType: "video/mp4",
              quotaReserved: true,
              uploadExpiresAt: expiresAt,
              status: "import_queued",
              statusMessage: "Waiting to import a three-minute preview window.",
              renderOptions: { aspectRatio: "9:16", captions: true },
            },
          ],
          { session },
        );
        await Trial.create(
          [{ _id: id, tokenHash: hash(token), ipHash, videoId, expiresAt }],
          { session },
        );
      });
      await enqueueImport(uploads.queue, videoId.toString(), 0).catch(
        () => undefined,
      );
      return { token };
    },
    async read(token: string | null) {
      const trial = await find(token);
      if (!trial) return { status: "none" as const };
      if (trial.claimedBy) return { status: "claimed" as const };
      if (trial.expiresAt < new Date()) return { status: "expired" as const };
      const video = await VideoModel.findById(trial.videoId).select("+trialPosterKeys");
      if (!video || ["deleting", "cancelled"].includes(video.status))
        return { status: "expired" as const };
      const ready = video.clipStatus === "completed";
      const stage = ready ? "completed"
        : video.status === "import_queued" ? "queued"
        : video.status === "importing" ? "importing"
        : video.clipStage === "selection" ? "selecting"
        : video.clipStage === "rendering" ? "rendering"
        : video.clipStage === "storage" ? "finishing"
        : "transcribing";
      const preview = video.clips[0] ?? video.clipPlan[0];
      return {
        status: ready
          ? ("completed" as const)
          : video.status === "failed" || video.clipStatus === "failed"
            ? ("failed" as const)
            : ("processing" as const),
        message: ready
          ? "Your preview is ready."
          : (video.clipMessage ??
            video.statusMessage ??
            "Preparing your preview."),
        usedCredits: ready ? Math.ceil(video.durationSeconds ?? 0) / 60 : null,
        preview:
          ready && preview
            ? {
                title: preview.title,
                seconds: Math.round(
                  (preview.end ?? 0) - (preview.start ?? 0),
                ),
              }
            : null,
        lockedCount: ready ? Math.max(0, video.clipPlan.length - 1) : 0,
        stage,
        startedAt: trial.createdAt.toISOString(),
        lockedPosters: ready ? video.trialPosterKeys.map((key, index) => key ? index + 1 : null).filter((index): index is number => index !== null) : [],
      };
    },
    async preview(token: string | null) {
      const trial = await find(token);
      if (!trial || trial.claimedBy || trial.expiresAt < new Date())
        throw new UploadError(
          404,
          "TRIAL_NOT_FOUND",
          "This preview is no longer available.",
        );
      const video = await VideoModel.findOne({
        _id: trial.videoId,
        userId: `trial:${trial._id}`,
        clipStatus: "completed",
        status: "ready",
      }).select("+trialPreviewKey");
      if (!video?.trialPreviewKey)
        throw new UploadError(
          404,
          "PREVIEW_NOT_READY",
          "Your preview is not ready.",
        );
      return uploads.storage.signDownload(video.trialPreviewKey, true);
    },
    async poster(token: string | null, index: number) {
      const trial = await find(token);
      if (!trial || trial.claimedBy || trial.expiresAt < new Date() || !Number.isInteger(index) || index < 1 || index > 4)
        throw new UploadError(404, "POSTER_NOT_FOUND", "This highlight preview is unavailable.");
      const video = await VideoModel.findOne({ _id: trial.videoId, userId: `trial:${trial._id}`, status: "ready", clipStatus: "completed" }).select("+trialPosterKeys");
      const key = video?.trialPosterKeys[index - 1];
      if (!key) throw new UploadError(404, "POSTER_NOT_FOUND", "This highlight preview is unavailable.");
      return uploads.storage.signDownload(key, true);
    },
    async claim(userId: string, token: string | null) {
      const found = await find(token);
      if (!found) return { status: "none" as const };
      if (found.claimedBy && found.claimedBy !== userId)
        throw new UploadError(
          409,
          "TRIAL_CLAIMED",
          "This trial already belongs to an account.",
        );
      if (found.claimedBy === userId)
        return {
          status: "claimed" as const,
          videoId: found.videoId.toString(),
        };
      if (found.expiresAt < new Date())
        throw new UploadError(
          410,
          "TRIAL_EXPIRED",
          "This preview expired. Your account still has its own free allowance.",
        );
      let generation = 0;
      await uploads.credits.transaction(async (session) => {
        const trial = await Trial.findOne({
          _id: found._id,
          claimedBy: { $exists: false },
          expiresAt: { $gt: new Date() },
        }).session(session);
        if (!trial) {
          if (
            await Trial.exists({ _id: found._id, claimedBy: userId }).session(
              session,
            )
          )
            return;
          if (
            await Trial.exists({
              _id: found._id,
              expiresAt: { $lte: new Date() },
            }).session(session)
          )
            throw new UploadError(
              410,
              "TRIAL_EXPIRED",
              "This preview expired. Your free allowance is available in your workspace.",
            );
          throw new UploadError(
            409,
            "TRIAL_CLAIMED",
            "This preview was already claimed.",
          );
        }
        const video = await VideoModel.findOne({
          _id: trial.videoId,
          userId: `trial:${trial._id}`,
        }).session(session);
        if (!video || ["deleting", "cancelled"].includes(video.status))
          throw new UploadError(
            410,
            "TRIAL_EXPIRED",
            "This preview is no longer available. You can create clips in your workspace.",
          );
        if (video.status === "failed" || video.clipStatus === "failed")
          throw new UploadError(
            409,
            "TRIAL_FAILED",
            "Your homepage preview couldn’t finish. No trial credits were charged; try another recording in your workspace.",
          );
        if (video.status !== "ready" || video.clipStatus !== "completed")
          throw new UploadError(
            409,
            "TRIAL_PROCESSING",
            "Your preview is still processing. It will be saved when it finishes.",
          );
        await uploads.credits.claimTrial(
          userId,
          video._id.toString(),
          Math.ceil(video.durationSeconds ?? 180),
          session,
        );
        await uploads.Quota.updateOne(
          { _id: userId },
          { $setOnInsert: { bytes: 0, videos: 0 } },
          { upsert: true, session },
        );
        const quota = await uploads.Quota.updateOne(
          {
            _id: userId,
          },
          { $inc: { bytes: video.expectedSize ?? 0, videos: 1 } },
          { session },
        );
        if (!quota.modifiedCount)
          throw new UploadError(
            409,
            "STORAGE_LIMIT",
            "Remove a recording before saving this preview to your account.",
          );
        await uploads.Quota.updateOne(
          { _id: video.userId },
          { $inc: { bytes: -(video.expectedSize ?? 0), videos: -1 } },
          { session },
        );
        generation = video.clipGeneration + 1;
        // Ownership is immutable through Mongoose; this is the sole fenced native transfer.
        const moved = await VideoModel.collection.updateOne(
          {
            _id: video._id,
            userId: video.userId,
            clipStatus: "completed",
            clipGeneration: video.clipGeneration,
          },
          {
            $set: {
              userId,
              clipStatus: "queued",
              creditMode: uploads.credits.mode,
              mediaExpiresAt: new Date(Date.now() + 30 * 86400000),
              clipGeneration: generation,
              clipMessage: "Unlocking your selected highlights.",
              processingStartedAt: new Date(),
            },
          },
          { session },
        );
        if (!moved.modifiedCount)
          throw new UploadError(
            409,
            "TRIAL_CHANGED",
            "The preview changed. Please try saving it again.",
          );
        await Trial.updateOne(
          { _id: trial._id, claimedBy: { $exists: false } },
          { $set: { claimedBy: userId, claimedAt: new Date() } },
          { session },
        );
      });
      if (generation)
        await enqueueClips(
          uploads.queue,
          found.videoId.toString(),
          generation,
        ).catch(() => undefined);
      return { status: "claimed" as const, videoId: found.videoId.toString() };
    },
  };
}
