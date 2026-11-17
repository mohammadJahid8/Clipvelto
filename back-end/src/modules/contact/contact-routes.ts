import { createHmac } from "node:crypto";
import { Router } from "express";
import type { Connection } from "mongoose";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import type { createMailer } from "../../services/mail.js";
import { UploadError } from "../uploads/upload-error.js";
import { logger } from "../../config/logger.js";

const singleLine = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => !/[\r\n\u0000]/u.test(value));
const inputSchema = z
  .object({
    name: singleLine,
    email: z.email().max(254),
    subject: singleLine,
    message: z
      .string()
      .trim()
      .min(10)
      .max(4000)
      .refine((value) => !value.includes("\u0000")),
    website: z.string().max(200).default(""),
    challengeToken: z.string().max(2048).default(""),
  })
  .strict();

export async function contactRoutes(
  connection: Connection,
  env: Env,
  mailer: ReturnType<typeof createMailer>,
) {
  const router = Router();
  const counters = connection.collection<{
    _id: string;
    count: number;
    expiresAt: Date;
  }>("contact_request_limits");
  await counters.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const challengeRequired =
    !!env.TURNSTILE_SITE_KEY && !!env.TURNSTILE_SECRET_KEY;
  const enabled =
    env.NODE_ENV !== "production" ||
    (env.MAIL_TRANSPORT === "smtp" && challengeRequired);
  const digest = (value: string) =>
    createHmac("sha256", env.BETTER_AUTH_SECRET)
      .update(`contact:${value}`)
      .digest("hex");
  async function limit(key: string, count: number, windowMs: number) {
    const window = Math.floor(Date.now() / windowMs);
    const row = await counters.findOneAndUpdate(
      { _id: `${digest(key)}:${windowMs}:${window}` },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((window + 1) * windowMs) },
      },
      { upsert: true, returnDocument: "after" },
    );
    if ((row?.count ?? 0) > count)
      throw new UploadError(
        429,
        "CONTACT_RATE_LIMIT",
        "Too many messages. Please try again later.",
      );
  }
  router.get("/contact/config", (_req, res) =>
    res.json({
      enabled,
      siteKey: challengeRequired ? env.TURNSTILE_SITE_KEY : null,
      localCapture: env.MAIL_TRANSPORT === "file",
    }),
  );
  router.post("/contact", async (req, res) => {
    if (req.get("origin") !== new URL(env.BETTER_AUTH_URL).origin)
      throw new UploadError(
        403,
        "INVALID_ORIGIN",
        "Send your message through the contact form.",
      );
    if (!enabled)
      throw new UploadError(
        503,
        "CONTACT_UNAVAILABLE",
        "Contact messaging is temporarily unavailable. Please try again later.",
      );
    await limit(
      `network:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`,
      10,
      3600000,
    );
    const parsed = inputSchema.safeParse(req.body);
    if (!parsed.success)
      throw new UploadError(
        400,
        "INVALID_CONTACT",
        "Check your name, email, subject and message. Use 10–4,000 characters for the message.",
      );
    const input = parsed.data;
    if (input.website)
      throw new UploadError(
        400,
        "INVALID_CONTACT",
        "Please refresh the page and try again.",
      );
    if (challengeRequired) {
      let verified = false;
      try {
        const response = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              secret: env.TURNSTILE_SECRET_KEY,
              response: input.challengeToken,
            }),
            signal: AbortSignal.timeout(10000),
          },
        );
        if (response.ok) {
          const result = z
            .object({
              success: z.boolean(),
              hostname: z.string().optional(),
              action: z.string().optional(),
            })
            .parse(await response.json());
          verified =
            result.success &&
            result.hostname === new URL(env.BETTER_AUTH_URL).hostname &&
            result.action === "contact";
        }
      } catch {
        /* Verification fails closed without logging tokens or visitor content. */
      }
      if (!verified)
        throw new UploadError(
          400,
          "CONTACT_CHALLENGE",
          "Complete the human check and try again.",
        );
    }
    await limit(`email:${input.email.toLowerCase()}`, 5, 3600000);
    await limit("global-delivery", 100, 86400000);
    try {
      await mailer.deliver({
        to: env.CONTACT_TO_EMAIL,
        replyTo: input.email,
        subject: `[Clipvelto contact] ${input.subject}`,
        text: `Name: ${input.name}\nEmail: ${input.email}\nSubject: ${input.subject}\n\n${input.message}\n\nSent from the Clipvelto contact form.`,
      });
    } catch {
      logger.warn("Contact email delivery failed; visitor content omitted");
      throw new UploadError(
        503,
        "CONTACT_DELIVERY_FAILED",
        "Your message couldn’t be sent. Please try again later.",
      );
    }
    res.json({
      sent: true,
      delivery: env.MAIL_TRANSPORT === "file" ? "local" : "email",
    });
  });
  return router;
}
