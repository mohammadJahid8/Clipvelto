import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import type { Env } from "../config/env.js";
import { logger } from "../config/logger.js";

export type AuthMail = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export function createMailer(env: Env) {
  const transport =
    env.MAIL_TRANSPORT === "smtp"
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          requireTLS: env.SMTP_PORT !== 465,
          auth: env.SMTP_USER
            ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
            : undefined,
          connectionTimeout: 10000,
          socketTimeout: 15000,
        })
      : null;

  async function deliver(message: AuthMail) {
    if (transport) {
      await transport.sendMail({ from: env.MAIL_FROM, ...message });
      return;
    }
    if (env.NODE_ENV === "production")
      throw new Error("Local mail capture is disabled in production");
    await mkdir(env.MAIL_DIRECTORY, { recursive: true, mode: 0o700 });
    await writeFile(
      join(env.MAIL_DIRECTORY, `${Date.now()}-${randomUUID()}.json`),
      JSON.stringify(
        { ...message, createdAt: new Date().toISOString() },
        null,
        2,
      ),
      { mode: 0o600, flag: "wx" },
    );
    logger.info(
      "Email captured locally. Use npm run mail:latest --workspace @clipvelto/api to read it.",
    );
  }

  // Do not make the public endpoint's response time depend on whether an email exists.
  // Track work so graceful shutdown can finish outstanding delivery attempts.
  const pending = new Set<Promise<void>>();
  function send(message: AuthMail) {
    const job = deliver(message)
      .catch(() =>
        logger.error(
          "Authentication email delivery failed; check mail transport configuration",
        ),
      )
      .then(() => undefined);
    pending.add(job);
    void job.finally(() => pending.delete(job));
  }
  async function deliverTracked(message: AuthMail) {
    const job = deliver(message);
    pending.add(job);
    try {
      await job;
    } finally {
      pending.delete(job);
    }
  }
  return {
    send,
    deliver: deliverTracked,
    drain: () => Promise.allSettled(pending),
  };
}
