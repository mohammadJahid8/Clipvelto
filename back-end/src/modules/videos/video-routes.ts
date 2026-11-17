import { Router } from "express";
import { Types } from "mongoose";
import type { createVideoModel } from "./video.model.js";
import { z } from "zod";
import { presentVideo } from "./video-presenter.js";
import type { Env } from "../../config/env.js";

export function videoRoutes(
  VideoModel: ReturnType<typeof createVideoModel>,
  env: Env,
) {
  const router = Router();
  router.get("/", async (req, res) => {
    const parsed = z
      .object({
        limit: z.coerce.number().int().min(1).max(50).default(12),
        cursor: z
          .string()
          .regex(/^[a-f0-9]{24}$/i)
          .optional(),
      })
      .strict()
      .safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "INVALID_QUERY",
          message: "Use a limit of 1–50 and a valid video cursor.",
        },
      });
      return;
    }
    const { limit, cursor } = parsed.data;
    const videos = await VideoModel.find({
      userId: res.locals.session.user.id,
      status: { $nin: ["deleting", "cancelled"] },
      ...(env.NODE_ENV === "production" ? { creditMode: { $ne: "test" } } : {}),
      ...(cursor ? { _id: { $lt: new Types.ObjectId(cursor) } } : {}),
    })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = videos.length > limit;
    const page = videos.slice(0, limit);
    res.json({
      videos: page.map((video) => presentVideo(video, env)),
      nextCursor: hasMore ? page.at(-1)!._id.toString() : null,
    });
  });
  return router;
}
