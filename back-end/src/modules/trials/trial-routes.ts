import { Router } from "express";
import { z } from "zod";
import { fromNodeHeaders } from "better-auth/node";
import { createHash } from "node:crypto";
import type { Connection } from "mongoose";
import type { Env } from "../../config/env.js";
import type { Auth } from "../auth/auth.js";
import { UploadError } from "../uploads/upload-error.js";
import {
  cookieToken,
  trialCookie,
  createTrialService,
  localTrialTesting,
} from "./trial-service.js";
import { youtubeVideoId } from "../imports/youtube-url.js";

export async function verifyTrialChallenge(env: Env, token: string) {
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) return false;
    const result = z
      .object({
        success: z.boolean(),
        hostname: z.string().optional(),
        action: z.string().optional(),
      })
      .safeParse(await response.json());
    return (
      result.success &&
      result.data.success &&
      result.data.hostname === new URL(env.BETTER_AUTH_URL).hostname &&
      result.data.action === "trial"
    );
  } catch {
    return false;
  }
}
export function trialRoutes(
  connection: Connection,
  env: Env,
  auth: Auth,
  trials: ReturnType<typeof createTrialService> | null,
  verify = verifyTrialChallenge,
) {
  const router = Router();
  router.get("/trial/config", (req, res) =>
    res.json({
      enabled: !!trials && env.TRIAL_ENABLED,
      siteKey: env.TRIAL_ENABLED ? env.TURNSTILE_SITE_KEY : null,
      maxSeconds: 180,
      freeCredits: 15,
      allowRepeat: localTrialTesting(env, req.socket.remoteAddress),
    }),
  );
  router.post("/trial/reset", async (req, res) => {
    if (!localTrialTesting(env, req.socket.remoteAddress) ||
      req.get("origin") !== new URL(env.BETTER_AUTH_URL).origin)
      throw new UploadError(403, "RESET_UNAVAILABLE", "Repeat testing is only available locally.");
    if ((await trials?.read(cookieToken(req.get("cookie"))))?.status === "processing")
      throw new UploadError(409, "TRIAL_PROCESSING", "Wait for your current preview to finish first.");
    res.clearCookie(trialCookie, { httpOnly: true, secure: new URL(env.BETTER_AUTH_URL).protocol === "https:", sameSite: "lax", path: "/api" });
    res.json({ status: "none" });
  });
  router.get("/trial", async (req, res) =>
    res.json(
      trials
        ? await trials.read(cookieToken(req.get("cookie")))
        : { status: "none" },
    ),
  );
  router.get("/trial/preview", async (req, res) => {
    if (!trials)
      throw new UploadError(
        503,
        "TRIAL_UNAVAILABLE",
        "Preview trials are not available.",
      );
    res.redirect(302, await trials.preview(cookieToken(req.get("cookie"))));
  });
  router.get("/trial/posters/:index", async (req, res) => {
    if (!trials) throw new UploadError(404, "POSTER_NOT_FOUND", "This highlight preview is unavailable.");
    const index = String(req.params.index);
    if (!/^[1-4]$/.test(index)) throw new UploadError(404, "POSTER_NOT_FOUND", "This highlight preview is unavailable.");
    res.redirect(302, await trials.poster(cookieToken(req.get("cookie")), Number(index)));
  });
  router.post("/trial", async (req, res) => {
    if (req.get("origin") !== new URL(env.BETTER_AUTH_URL).origin)
      throw new UploadError(
        403,
        "INVALID_ORIGIN",
        "Start your preview from Clipvelto.",
      );
    if (!trials || !env.TRIAL_ENABLED)
      throw new UploadError(
        503,
        "TRIAL_UNAVAILABLE",
        "Public previews are not enabled yet. Create a free account to use the workspace.",
      );
    if (await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }))
      throw new UploadError(
        409,
        "USE_WORKSPACE",
        "You are signed in. Use your workspace to create clips.",
      );
    const input = z
      .object({
        url: z.string().max(2000),
        challengeToken: z.string().min(1).max(2048),
      })
      .strict()
      .safeParse(req.body);
    if (!input.success)
      throw new UploadError(
        400,
        "INVALID_TRIAL",
        "Enter a YouTube link and complete the human check.",
      );
    try {
      youtubeVideoId(input.data.url);
    } catch {
      throw new UploadError(
        400,
        "INVALID_YOUTUBE_URL",
        "Enter a single public YouTube video link.",
      );
    }
    if (!(await verify(env, input.data.challengeToken)))
      throw new UploadError(
        403,
        "CHALLENGE_FAILED",
        "The human check expired or failed. Please try it again.",
      );
    const tokenHash = createHash("sha256")
      .update(input.data.challengeToken)
      .digest("hex");
    try {
      await connection
        .db!.collection<{ _id: string; expiresAt: Date }>("trial_challenges")
        .insertOne({
          _id: tokenHash,
          expiresAt: new Date(Date.now() + 10 * 60000),
        });
    } catch (error) {
      if (!(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      ))
        throw new UploadError(
          503,
          "TRIAL_UNAVAILABLE",
          "The preview service is temporarily unavailable. Please try again later.",
        );
      throw new UploadError(
        409,
        "CHALLENGE_USED",
        "Please complete a new human check.",
      );
    }
    const created = await trials.create(
      input.data.url,
      req.socket.remoteAddress ?? "unknown",
      cookieToken(req.get("cookie")),
    );
    res.cookie(trialCookie, created.token, {
      httpOnly: true,
      secure: new URL(env.BETTER_AUTH_URL).protocol === "https:",
      sameSite: "lax",
      path: "/api",
      maxAge: 30 * 24 * 3600000,
    });
    res.status(202).json({ status: "processing" });
  });
  return router;
}
