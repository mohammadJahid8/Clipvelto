import { Router } from "express";
import type { Env } from "../../config/env.js";
import type { UploadService } from "../uploads/upload-service.js";
import type { createVideoModel } from "../videos/video.model.js";
import { UploadError } from "../uploads/upload-error.js";
import { presentVideo } from "../videos/video-presenter.js";
import { enqueueClips } from "../../jobs/upload-queue.js";

export function clipRoutes(
  env: Env,
  uploads: UploadService | null,
  VideoModel: ReturnType<typeof createVideoModel>,
) {
  const router = Router();
  router.post("/videos/:id/clips", async (req, res) => {
    if (!uploads)
      throw new UploadError(
        503,
        "CLIPS_UNAVAILABLE",
        "Clip creation isn’t available on this server yet.",
      );
    const video = await uploads.findOwned(
      res.locals.session.user.id,
      String(req.params.id),
    );
    const credits = await uploads.creditsForRetry(video);
    if (!env.CLIPS_ENABLED || !env.ANTHROPIC_API_KEY)
      throw new UploadError(
        503,
        "CLIPS_UNAVAILABLE",
        "Clip creation isn’t configured on this server yet.",
      );
    if (video.status !== "ready" || (video.durationSeconds ?? 0) < 3)
      throw new UploadError(
        409,
        "SOURCE_NOT_READY",
        "Choose a checked recording with at least 3 seconds of video.",
      );
    if (["queued", "processing"].includes(video.transcriptionStatus ?? ""))
      throw new UploadError(
        409,
        "TRANSCRIPT_IN_PROGRESS",
        "Wait for transcription to finish, then create clips.",
      );
    if (!video.clipStatus || video.clipStatus === "failed") {
      uploads.assertProcessingMode(video);
      await credits.transaction(async (session) => {
        const current = await VideoModel.findOne({
          _id: video._id,
          userId: video.userId,
          status: "ready",
        }).session(session);
        if (
          !current ||
          ["queued", "processing"].includes(current.transcriptionStatus ?? "")
        )
          throw new UploadError(
            409,
            "PROCESSING_IN_PROGRESS",
            "Wait for the current processing task to finish.",
          );
        if (current.clipStatus && current.clipStatus !== "failed") return;
        await credits.reserve(
          video.userId,
          video._id.toString(),
          video.durationSeconds!,
          session,
          video.expectedSize ?? 0,
        );
        await VideoModel.updateOne(
          {
            _id: video._id,
            userId: video.userId,
            status: "ready",
            transcriptionStatus: { $nin: ["queued", "processing"] },
            clipGeneration:
              video.clipGeneration === 0
                ? { $in: [0, null] }
                : video.clipGeneration,
            $or: [{ clipStatus: { $exists: false } }, { clipStatus: "failed" }],
          },
          {
            $set: {
              clipStatus: "queued",
              clipMessage: "Waiting to create your clips.",
              processingStartedAt: new Date(),
            },
            $inc: { clipGeneration: 1 },
            $unset: { clipRunId: 1 },
          },
          { session },
        );
      });
    }
    const current = await uploads.findOwned(video.userId, video._id.toString());
    if (current.clipStatus === "queued") {
      try {
        await enqueueClips(
          uploads.queue,
          video._id.toString(),
          current.clipGeneration,
        );
      } catch {
        /* Durable reconciliation retries delivery. */
      }
    }
    res
      .status(current.clipStatus === "completed" ? 200 : 202)
      .json({ video: presentVideo(current, env) });
  });
  router.get(
    ["/videos/:id/clips/:index/download", "/videos/:id/clips/:index/preview"],
    async (req, res) => {
      if (!uploads)
        throw new UploadError(
          503,
          "CLIPS_UNAVAILABLE",
          "Clips aren’t available.",
        );
      const video = await uploads.findOwned(
        res.locals.session.user.id,
        String(req.params.id),
      );
      const index = String(req.params.index);
      if (!/^[0-4]$/.test(index))
        throw new UploadError(404, "CLIP_NOT_FOUND", "That clip wasn’t found.");
      const clip = video.clips[Number(index)];
      if (!clip?.key)
        throw new UploadError(404, "CLIP_NOT_FOUND", "That clip wasn’t found.");
      res.redirect(
        302,
        await (req.path.endsWith("/preview")
          ? uploads.storage.signPreview(clip.key)
          : uploads.storage.signDownload(clip.key)),
      );
    },
  );
  return router;
}
