import { Router } from "express";
import type { Env } from "../../config/env.js";
import type { UploadService } from "./upload-service.js";
import { presentVideo } from "../videos/video-presenter.js";
import { UploadError } from "./upload-error.js";
import { processingEnv } from "./processing-limits.js";

export function uploadRoutes(env: Env, uploads: UploadService | null) {
  const router = Router();
  router.get("/uploads/config", async (_req, res) => {
    const balance = uploads
      ? await uploads.credits.summary(res.locals.session.user.id)
      : null;
    const policy = processingEnv(env, balance?.role);
    res.json({
      enabled: !!uploads,
      workerAvailable: uploads ? await uploads.workerAvailable() : false,
      maxBytes: policy.UPLOAD_MAX_BYTES,
      maxSeconds: policy.UPLOAD_MAX_SECONDS,
      allowedTypes: ["video/mp4", "video/quicktime", "video/webm"],
      youtubeEnabled: !!uploads && env.YOUTUBE_ENABLED,
      importMaxSeconds: Math.min(
        policy.UPLOAD_MAX_SECONDS,
        policy.TRANSCRIPTION_MAX_SECONDS,
        balance?.role === "admin"
          ? Infinity
          : Math.round((balance?.available ?? 0) * 60),
      ),
      availableCredits:
        balance?.available ?? (balance?.role === "admin" ? null : 0),
      admin: balance?.role === "admin",
    });
  });
  router.use((req, _res, next) => {
    if (
      !uploads &&
      (req.path.startsWith("/uploads") ||
        req.path.match(/^\/videos\/[^/]+(?:\/complete|\/retry)?$/))
    )
      throw new UploadError(
        503,
        "UPLOADS_UNAVAILABLE",
        "Video uploads aren’t configured yet. Please try again later.",
      );
    next();
  });
  router.post("/uploads", async (req, res) => {
    res
      .status(201)
      .json(await uploads!.initialize(res.locals.session.user.id, req.body));
  });
  router.post("/uploads/:id/parts/:part", async (req, res) => {
    res.json(
      await uploads!.signPart(
        res.locals.session.user.id,
        String(req.params.id),
        Number(req.params.part),
      ),
    );
  });
  router.post("/videos/:id/complete", async (req, res) => {
    res.status(202).json({
      video: await uploads!.complete(
        res.locals.session.user.id,
        String(req.params.id),
      ),
    });
  });
  router.post("/videos/:id/retry", async (req, res) => {
    res.status(202).json({
      video: await uploads!.retry(
        res.locals.session.user.id,
        String(req.params.id),
      ),
    });
  });
  router.delete("/videos/:id", async (req, res) => {
    await uploads!.remove(res.locals.session.user.id, String(req.params.id));
    res.status(202).json({
      message: "Video deletion requested. Used credits are not refunded.",
    });
  });
  router.get("/videos/:id", async (req, res) => {
    res.json({
      video: presentVideo(
        await uploads!.findOwned(
          res.locals.session.user.id,
          String(req.params.id),
        ),
        env,
      ),
    });
  });
  return router;
}
