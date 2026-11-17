import { Router } from "express";
import { Types, type Connection } from "mongoose";
import type { Env } from "../../config/env.js";
import type { UploadService } from "../uploads/upload-service.js";
import type { createVideoModel } from "../videos/video.model.js";
import { youtubeRequestSchema } from "./youtube-url.js";
import { UploadError } from "../uploads/upload-error.js";
import { enqueueImport } from "../../jobs/upload-queue.js";
import { presentVideo } from "../videos/video-presenter.js";
import { processingEnv } from "../uploads/processing-limits.js";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { importYoutube } from "../../services/youtube-importer.js";
import { processingQuote } from "@clipvelto/credit-plans";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// Video metadata may be reused; wallet balances and roles must stay live.
// Parsing also strips balance fields from quotes cached by older versions.
const quoteMetadataSchema = z.object({
  title: z.string().min(1).max(200),
  durationSeconds: z.number().finite().positive(),
  credits: z.number().finite().nonnegative(),
  seconds: z.number().int().nonnegative().safe(),
});

export function importRoutes(
  connection: Connection,
  env: Env,
  uploads: UploadService | null,
  VideoModel: ReturnType<typeof createVideoModel>,
) {
  const router = Router();
  router.post("/imports/youtube/quote", async (req, res) => {
    if (!uploads || !env.YOUTUBE_ENABLED)
      throw new UploadError(
        503,
        "IMPORT_UNAVAILABLE",
        "YouTube importing isn’t available right now.",
      );
    const parsed = youtubeRequestSchema.safeParse(req.body);
    if (!parsed.success)
      throw new UploadError(
        400,
        "INVALID_YOUTUBE_IMPORT",
        "Enter one YouTube video link and confirm you have permission.",
      );
    const userId = res.locals.session.user.id as string;
    await uploads.credits.allowSubmit(userId);
    const credits = uploads.credits;
    const withCurrentBalance = async (
      metadata: z.infer<typeof quoteMetadataSchema>,
    ) => {
      const balance = await credits.summary(userId);
      return {
        ...metadata,
        available: balance.available,
        admin: balance.role === "admin",
        mode: balance.mode,
      };
    };
    const cache = connection.collection<{
      _id: string;
      expiresAt: Date;
      quote: unknown;
    }>("youtube_credit_quotes");
    const cacheId = `${uploads.credits.mode}:${userId}:${parsed.data.url}:${parsed.data.captureSeconds}`;
    const previous = await cache.findOne({
      _id: cacheId,
      expiresAt: { $gt: new Date() },
    });
    const cached = quoteMetadataSchema.safeParse(previous?.quote);
    if (cached.success) {
      res.json(await withCurrentBalance(cached.data));
      return;
    }
    const client = await uploads.queue.backend.client;
    const lock = `${env.UPLOAD_QUEUE_PREFIX}:youtube-quote:${userId}`;
    const token = randomUUID();
    if ((await client.set(lock, token, "EX", 95, "NX")) !== "OK")
      throw new UploadError(
        429,
        "QUOTE_IN_PROGRESS",
        "Your video is already being checked. Please wait a moment.",
      );
    const globalLock = `${env.UPLOAD_QUEUE_PREFIX}:youtube-quote-capacity`;
    const unlock = (key: string) =>
      client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        key,
        token,
      );
    if ((await client.set(globalLock, token, "EX", 95, "NX")) !== "OK") {
      await unlock(lock);
      throw new UploadError(
        429,
        "QUOTE_CAPACITY",
        "The video checker is busy. Please try again shortly.",
      );
    }
    let directory: string | undefined;
    try {
      directory = await mkdtemp(join(tmpdir(), "clipvelto-quote-"));
      const policy = await uploads.envForUser(userId);
      const metadata = await importYoutube(
        policy,
        parsed.data.url,
        directory,
        parsed.data.captureSeconds,
        AbortSignal.timeout(90000),
        0,
        undefined,
        true,
      );
      if (
        !("durationSeconds" in metadata) ||
        typeof metadata.durationSeconds !== "number"
      )
        throw new Error("Missing video duration");
      const quote = processingQuote(
        metadata.durationSeconds,
        "sizeBytes" in metadata ? (metadata.sizeBytes as number) : 0,
      );
      const metadataQuote = {
        title: metadata.title,
        durationSeconds: metadata.durationSeconds,
        credits: quote.credits,
        seconds: quote.seconds,
      };
      await cache.updateOne(
        { _id: cacheId },
        {
          $set: {
            quote: metadataQuote,
            expiresAt: new Date(Date.now() + 5 * 60000),
          },
        },
        { upsert: true },
      );
      res.json(await withCurrentBalance(metadataQuote));
    } finally {
      if (directory) await rm(directory, { recursive: true, force: true });
      await Promise.all([unlock(lock), unlock(globalLock)]);
    }
  });
  router.post("/imports/youtube", async (req, res) => {
    if (!uploads || !env.YOUTUBE_ENABLED)
      throw new UploadError(
        503,
        "IMPORT_UNAVAILABLE",
        "YouTube importing isn’t available on this server yet.",
      );
    const parsed = youtubeRequestSchema.safeParse(req.body);
    if (!parsed.success)
      throw new UploadError(
        400,
        "INVALID_YOUTUBE_IMPORT",
        "Enter a single YouTube video or livestream URL, choose a 1–10 minute live capture, and confirm you have permission to use the video.",
      );
    const userId = res.locals.session.user.id as string;
    const balance = await uploads.credits.summary(userId);
    const policy = processingEnv(env, balance.role);
    if (balance.role !== "admin" && (balance.available ?? 0) <= 0)
      throw new UploadError(
        402,
        "INSUFFICIENT_CREDITS",
        "Add credits to import and process another video.",
      );
    const id = new Types.ObjectId();
    await uploads.credits.allowSubmit(userId);
    await uploads.Quota.updateOne(
      { _id: userId },
      { $setOnInsert: { bytes: 0, videos: 0 } },
      { upsert: true },
    );
    const session = await connection.startSession();
    try {
      await session.withTransaction(async () => {
        const changed = await uploads.Quota.updateOne(
          {
            _id: userId,
          },
          { $inc: { bytes: 1, videos: 1 } },
          { session },
        );
        if (!changed.modifiedCount)
          throw new UploadError(
            409,
            "STORAGE_LIMIT",
            "Allow space for one maximum-size import by removing older videos first.",
          );
        await VideoModel.create(
          [
            {
              _id: id,
              userId,
              title: "YouTube import",
              originalFilename: `youtube-${parsed.data.url}.mp4`,
              sourceProvider: "youtube",
              youtubeId: parsed.data.url,
              captureSeconds: parsed.data.captureSeconds,
              renderOptions: parsed.data.renderOptions,
              expectedSize: 1,
              contentType: "video/mp4",
              quotaReserved: true,
              uploadExpiresAt: new Date(Date.now() + 30 * 60000),
              status: "import_queued",
              creditMode: uploads.credits.mode,
              mediaExpiresAt: new Date(Date.now() + 30 * 86400000),
              processingStartedAt: new Date(),
              processingMaxSeconds: policy.TRANSCRIPTION_MAX_SECONDS,
              statusMessage:
                "Waiting to import your YouTube video or capture a live window.",
            },
          ],
          { session },
        );
        await uploads.credits.reserve(userId, id.toString(), 0, session);
      });
    } finally {
      await session.endSession();
    }
    try {
      await enqueueImport(uploads.queue, id.toString(), 0);
    } catch {
      /* Durable reconciliation retries delivery. */
    }
    res.status(202).json({
      video: presentVideo(await uploads.findOwned(userId, id.toString()), env),
    });
  });
  return router;
}
