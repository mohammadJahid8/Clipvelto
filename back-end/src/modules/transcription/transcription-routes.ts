import { Router } from "express";
import type { Env } from "../../config/env.js";
import type { UploadService } from "../uploads/upload-service.js";
import type { createVideoModel } from "../videos/video.model.js";
import { UploadError } from "../uploads/upload-error.js";
import { presentVideo } from "../videos/video-presenter.js";
import { enqueueTranscription } from "../../jobs/upload-queue.js";
import { transcriptSchema, transcriptText } from "./transcript.js";
import { logger } from "../../config/logger.js";
import { readTranscriptData } from "../../services/transcript-storage.js";

export function transcriptionRoutes(
  env: Env,
  uploads: UploadService | null,
  VideoModel: ReturnType<typeof createVideoModel>,
) {
  const router = Router();
  router.post("/videos/:id/transcribe", async (req, res) => {
    if (!uploads)
      throw new UploadError(
        503,
        "TRANSCRIPTION_UNAVAILABLE",
        "Transcription isn’t configured yet.",
      );
    const id = String(req.params.id);
    const video = await uploads.findOwned(res.locals.session.user.id, id);
    if (!env.TRANSCRIPTION_ENABLED)
      throw new UploadError(
        503,
        "TRANSCRIPTION_UNAVAILABLE",
        "Local transcription isn’t enabled yet.",
      );
    if (video.status !== "ready" || !video.sourceKey || !video.sourceEtag)
      throw new UploadError(
        409,
        "VIDEO_NOT_READY",
        "Wait for this video’s upload checks to finish.",
      );
    if (["queued", "processing"].includes(video.clipStatus ?? ""))
      throw new UploadError(
        409,
        "CLIPS_IN_PROGRESS",
        "Wait for clip creation to finish before starting another transcription.",
      );
    const credits = await uploads.creditsForRetry(video);
    if (!video.transcriptionStatus || video.transcriptionStatus === "failed") {
      uploads.assertProcessingMode(video);
      await credits.transaction(async (session) => {
        const current = await VideoModel.findOne({
          _id: video._id,
          userId: video.userId,
          status: "ready",
        }).session(session);
        if (
          !current ||
          ["queued", "processing"].includes(current.clipStatus ?? "")
        )
          throw new UploadError(
            409,
            "PROCESSING_IN_PROGRESS",
            "Wait for the current processing task to finish.",
          );
        if (
          current.transcriptionStatus &&
          current.transcriptionStatus !== "failed"
        )
          return;
        await credits.reserve(
          video.userId,
          video._id.toString(),
          video.durationSeconds!,
          session,
          video.expectedSize ?? 0,
        );
        // Only one of concurrent requests can claim this generation.
        await VideoModel.updateOne(
          {
            _id: id,
            userId: video.userId,
            status: "ready",
            clipStatus: { $nin: ["queued", "processing"] },
            transcriptionGeneration:
              video.transcriptionGeneration === 0
                ? { $in: [0, null] }
                : video.transcriptionGeneration,
            $or: [
              { transcriptionStatus: { $exists: false } },
              { transcriptionStatus: "failed" },
            ],
          },
          {
            $set: {
              transcriptionStatus: "queued",
              transcriptionMessage: "Waiting for the transcriber.",
              transcriptionHeartbeatAt: new Date(),
            },
            $inc: { transcriptionGeneration: 1 },
            $unset: { transcript: 1, transcriptionRunId: 1 },
          },
          { session },
        );
      });
    }
    const current = await uploads.findOwned(video.userId, id);
    if (current.transcriptionStatus === "queued") {
      try {
        await enqueueTranscription(
          uploads.queue,
          id,
          current.transcriptionGeneration,
        );
      } catch {
        logger.warn(
          { videoId: id },
          "Transcription persisted; queue reconciliation will retry delivery",
        );
      }
    }
    res
      .status(current.transcriptionStatus === "completed" ? 200 : 202)
      .json({ video: presentVideo(current, env) });
  });
  router.get("/videos/:id/transcript", async (req, res) => {
    if (!uploads)
      throw new UploadError(
        503,
        "TRANSCRIPTION_UNAVAILABLE",
        "Transcription isn’t configured yet.",
      );
    const video = await uploads.findOwned(
      res.locals.session.user.id,
      String(req.params.id),
    );
    const record = await VideoModel.findOne({
      _id: video._id,
      userId: video.userId,
      status: "ready",
      transcriptionStatus: "completed",
    })
      .select("+transcript +transcriptKey")
      .lean();
    if (!record || (!record.transcript && !record.transcriptKey))
      throw new UploadError(
        409,
        "TRANSCRIPT_NOT_READY",
        "This transcript isn’t ready yet.",
      );
    const transcript = transcriptSchema.parse(
      await readTranscriptData(uploads.storage, record),
    );
    if (
      Object.keys(req.query).some((key) => key !== "format") ||
      (req.query.format !== undefined &&
        !["txt", "srt", "json"].includes(String(req.query.format)))
    )
      throw new UploadError(400, "INVALID_FORMAT", "Choose txt, srt, or json.");
    const format = req.query.format;
    if (format === "txt" || format === "srt") {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="transcript-${video._id}.${format}"`,
      );
      res
        .type("text/plain; charset=utf-8")
        .send(transcriptText(transcript, format));
    } else res.json({ transcript });
  });
  return router;
}
