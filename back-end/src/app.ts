import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import type { Connection } from "mongoose";
import { createAuth } from "./modules/auth/auth.js";
import { ensureAuthIndexes } from "./modules/auth/auth-indexes.js";
import { createVideoModel } from "./modules/videos/video.model.js";
import { videoRoutes } from "./modules/videos/video-routes.js";
import { requireSession } from "./middleware/require-session.js";
import { createMailer } from "./services/mail.js";
import type { Env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { createUploadService } from "./modules/uploads/upload-service.js";
import { uploadRoutes } from "./modules/uploads/upload-routes.js";
import { UploadError } from "./modules/uploads/upload-error.js";
import { transcriptionRoutes } from "./modules/transcription/transcription-routes.js";
import { importRoutes } from "./modules/imports/import-routes.js";
import { clipRoutes } from "./modules/clips/clip-routes.js";
import {
  createCreditService,
  billingCreditMode,
} from "./modules/credits/credit-service.js";
import { createBillingService } from "./modules/billing/billing-service.js";
import { billingRoutes } from "./modules/billing/billing-routes.js";
import { adminRoutes } from "./modules/admin/admin-routes.js";
import { contactRoutes } from "./modules/contact/contact-routes.js";
import {
  createTrialService,
  cookieToken,
} from "./modules/trials/trial-service.js";
import {
  trialRoutes,
  verifyTrialChallenge,
} from "./modules/trials/trial-routes.js";

export async function createApp(
  connection: Connection,
  env: Env,
  options?: { verifyTrialChallenge?: typeof verifyTrialChallenge },
) {
  await ensureAuthIndexes(connection);
  const mailer = createMailer(env);
  const auth = createAuth(connection, env, mailer);
  const VideoModel = createVideoModel(connection);
  await VideoModel.init();
  const uploads = env.UPLOADS_ENABLED
    ? await createUploadService(connection, env, VideoModel)
    : null;
  const app = express();
  const credits =
    uploads?.credits ?? createCreditService(connection, billingCreditMode(env));
  await credits.init();
  await connection
    .collection("youtube_credit_quotes")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const billing = createBillingService(connection, env, credits);
  await billing.init();
  const trials = uploads
    ? createTrialService(connection, env, uploads, VideoModel)
    : null;
  await trials?.init();
  await connection
    .collection("trial_challenges")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use(helmet());
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    // Never trust caller-supplied IP headers. The API binds only to loopback.
    // Per-client proxy trust must be configured during the deployment phase.
    req.headers["x-clipvelto-client-ip"] =
      req.socket.remoteAddress ?? "127.0.0.1";
    next();
  });
  app.get("/api/health", (_req, res) => {
    res
      .status(connection.readyState === 1 ? 200 : 503)
      .json({ status: connection.readyState === 1 ? "ok" : "unavailable" });
  });
  app.get("/api/auth-config", (_req, res) =>
    res.json({
      localMailCapture:
        env.NODE_ENV !== "production" && env.MAIL_TRANSPORT === "file",
      googleSignIn: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
    }),
  );
  app.all("/api/auth/*splat", toNodeHandler(auth));
  // Paddle must receive the exact signed bytes, before JSON parsing and without
  // browser session/origin middleware. Its signature authenticates this route.
  app.post(
    "/api/webhooks/paddle",
    express.raw({ type: "application/json", limit: "512kb" }),
    async (req, res) => {
      if (!billing.paddle)
        throw new UploadError(
          503,
          "WEBHOOK_UNAVAILABLE",
          "Paddle is not enabled.",
        );
      if (!Buffer.isBuffer(req.body))
        throw new UploadError(
          400,
          "INVALID_EVENT",
          "Invalid payment notification.",
        );
      await billing.paddle.webhook(req.body, req.get("paddle-signature"));
      res.json({ received: true });
    },
  );
  app.use(express.json({ limit: "16kb" }));
  app.use("/api/public", await contactRoutes(connection, env, mailer));
  app.use(
    "/api/public",
    trialRoutes(connection, env, auth, trials, options?.verifyTrialChallenge),
  );
  app.use("/api/v1", requireSession(auth));
  app.use("/api/v1", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") !== new URL(env.BETTER_AUTH_URL).origin
    ) {
      res.status(403).json({
        error: {
          code: "INVALID_ORIGIN",
          message: "This request must come from Clipvelto.",
        },
      });
      return;
    }
    next();
  });
  app.use("/api/v1/admin", adminRoutes(connection, credits, billing));
  app.get("/api/v1/me", async (_req, res) => {
    const { id, name, email, emailVerified, createdAt, image } =
      res.locals.session.user;
    const access = await credits.summary(id);
    res.json({
      user: {
        id,
        name,
        email,
        emailVerified,
        createdAt,
        image: image ?? null,
        role: access.role,
      },
    });
  });
  app.get("/api/v1/dashboard", async (_req, res) => {
    const userId = res.locals.session.user.id;
    const [videos, processing] = await Promise.all([
      VideoModel.countDocuments({
        userId,
        ...(env.NODE_ENV === "production"
          ? { creditMode: { $ne: "test" } }
          : {}),
        status: { $nin: ["deleting", "cancelled"] },
      }),
      VideoModel.countDocuments({
        userId,
        ...(env.NODE_ENV === "production"
          ? { creditMode: { $ne: "test" } }
          : {}),
        $or: [
          {
            status: {
              $in: [
                "queued",
                "validating",
                "processing",
                "import_queued",
                "importing",
              ],
            },
          },
          { status: "ready", clipStatus: { $in: ["queued", "processing"] } },
          {
            status: "ready",
            transcriptionStatus: { $in: ["queued", "processing"] },
          },
        ],
      }),
    ]);
    res.json({
      videos,
      processing,
      credits: await credits.summary(userId),
      clipGenerationAvailable: env.CLIPS_ENABLED && !!env.ANTHROPIC_API_KEY,
    });
  });
  app.get("/api/v1/credits", async (_req, res) =>
    res.json({
      credits: await credits.summary(res.locals.session.user.id),
      history: await credits.history(res.locals.session.user.id),
    }),
  );
  app.use("/api/v1", billingRoutes(billing, credits));
  app.post("/api/v1/trial/claim", async (req, res) =>
    res.json(
      trials
        ? await trials.claim(
            res.locals.session.user.id,
            cookieToken(req.get("cookie")),
          )
        : { status: "none" },
    ),
  );
  app.use("/api/v1/videos", videoRoutes(VideoModel, env));
  app.use("/api/v1", transcriptionRoutes(env, uploads, VideoModel));
  app.use("/api/v1", importRoutes(connection, env, uploads, VideoModel));
  app.use("/api/v1", clipRoutes(env, uploads, VideoModel));
  app.use("/api/v1", uploadRoutes(env, uploads));
  app.use((_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "This endpoint doesn’t exist." },
    });
  });
  const handleError: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    _next,
  ) => {
    if (error instanceof UploadError) {
      res
        .status(error.status)
        .json({ error: { code: error.code, message: error.message } });
      return;
    }
    const malformed =
      error instanceof SyntaxError && "status" in error && error.status === 400;
    const tooLarge =
      error instanceof Error && "status" in error && error.status === 413;
    logger.error(
      { errorType: error instanceof Error ? error.name : "UnknownError" },
      "API request failed",
    );
    res.status(tooLarge ? 413 : malformed ? 400 : 500).json({
      error: {
        code: tooLarge
          ? "REQUEST_TOO_LARGE"
          : malformed
            ? "INVALID_JSON"
            : "INTERNAL_ERROR",
        message: tooLarge
          ? "This request is too large. Please shorten it and try again."
          : malformed
            ? "Send a valid JSON request."
            : "Something went wrong. Please try again.",
      },
    });
  };
  app.use(handleError);
  return { app, auth, mailer, VideoModel, uploads, credits, billing, trials };
}
