import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import type { Connection } from "mongoose";
import type { Env } from "../config/env.js";
import { UploadError } from "../modules/uploads/upload-error.js";
import { createMailer } from "./mail.js";
import { YoutubeImportError } from "./youtube-importer.js";
import { logger } from "../config/logger.js";

export const youtubeResumeDelay = 5 * 60 * 1000;
export class YoutubeSessionPaused extends UploadError {
  constructor() {
    super(503, "YOUTUBE_SESSION_PAUSED", "YouTube imports are temporarily unavailable. Please try later or upload a file from your device.");
  }
}

type Incident = {
  _id: string;
  fingerprint: string;
  blocked: boolean;
  incidentId: string;
  reason: "BOT_CHECK" | "SESSION_UNAVAILABLE" | "SESSION_EXPIRED";
  blockedAt: Date;
  lastSuccessAt?: Date;
  nextAlertAt: Date;
  alertLeaseUntil?: Date;
  alertSentAt?: Date;
};

// Store only a digest in MongoDB. The cookie file remains a mounted secret.
async function sessionFingerprint(path?: string) {
  if (!path) return "anonymous";
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = await file.stat();
    if (!info.isFile() || (info.mode & 0o077) || info.size > 1024 ** 2) return "unavailable";
    const buffer = Buffer.alloc(1024 ** 2 + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (!bytesRead || bytesRead > 1024 ** 2) return "unavailable";
    return createHash("sha256").update(buffer.subarray(0, bytesRead)).digest("hex");
  } catch {
    return "unavailable";
  } finally {
    await file?.close();
  }
}

export function createYoutubeSessionMonitor(
  connection: Connection,
  env: Env,
  mailer: Pick<ReturnType<typeof createMailer>, "deliver"> & { drain(): Promise<unknown> } = createMailer(env),
) {
  const incidents = connection.collection<Incident>("youtube_session_incidents");
  const id = env.UPLOAD_QUEUE_PREFIX;
  async function block(fingerprint: string, reason: Incident["reason"]) {
    // An in-flight failure from the previous export must not block its replacement.
    if (await sessionFingerprint(env.YOUTUBE_COOKIES_FILE) !== fingerprint) return;
    try {
      await incidents.updateOne(
        { _id: id, $or: [{ blocked: { $ne: true } }, { fingerprint: { $ne: fingerprint } }] },
        {
          $set: { fingerprint, blocked: true, incidentId: randomUUID(), reason, blockedAt: new Date(), nextAlertAt: new Date() },
          $unset: { alertSentAt: "", alertLeaseUntil: "" },
        },
        { upsert: true },
      );
    } catch (error) {
      // The unique _id also serializes simultaneous API/worker failures.
      if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
    }
  }
  async function assertAvailable() {
    const fingerprint = await sessionFingerprint(env.YOUTUBE_COOKIES_FILE);
    if (fingerprint === "unavailable") {
      await block(fingerprint, "SESSION_UNAVAILABLE");
      throw new YoutubeSessionPaused();
    }
    const incident = await incidents.findOne({ _id: id, blocked: true, fingerprint });
    if (incident) throw new YoutubeSessionPaused();
    return fingerprint;
  }
  async function run<T>(operation: () => Promise<T>): Promise<T> {
    const fingerprint = await assertAvailable();
    try {
      const result = await operation();
      // Only a successful request with a different export closes an outage.
      // A concurrent success with the failed export must not hide a challenge.
      if (await sessionFingerprint(env.YOUTUBE_COOKIES_FILE) === fingerprint)
        await incidents.updateOne(
          { _id: id, fingerprint: { $ne: fingerprint } },
          { $set: { fingerprint, blocked: false, lastSuccessAt: new Date() } },
        );
      return result;
    } catch (error) {
      if (error instanceof YoutubeImportError &&
          (error.details.code === "BOT_CHECK" || error.details.code === "SESSION_UNAVAILABLE" || error.details.code === "SESSION_EXPIRED")) {
        await block(fingerprint, error.details.code);
        throw new YoutubeSessionPaused();
      }
      throw error;
    }
  }
  async function deliverAlert() {
    const now = new Date();
    const incident = await incidents.findOneAndUpdate(
      { _id: id, blocked: true, alertSentAt: { $exists: false }, nextAlertAt: { $lte: now },
        $or: [{ alertLeaseUntil: { $exists: false } }, { alertLeaseUntil: { $lte: now } }] },
      { $set: { alertLeaseUntil: new Date(now.getTime() + 60000) } },
      { returnDocument: "after" },
    );
    if (!incident) return;
    const filter = { _id: id, incidentId: incident.incidentId, alertLeaseUntil: incident.alertLeaseUntil };
    if (await sessionFingerprint(env.YOUTUBE_COOKIES_FILE) !== incident.fingerprint) {
      await incidents.updateOne(filter, { $set: { nextAlertAt: new Date(Date.now() + 15 * 60000) }, $unset: { alertLeaseUntil: "" } });
      return;
    }
    try {
      await mailer.deliver({
        to: env.YOUTUBE_ALERT_TO_EMAIL ?? env.CONTACT_TO_EMAIL,
        subject: "Clipvelto: YouTube imports need attention",
        text: [
          "Clipvelto could not use its YouTube session. YouTube may require another sign-in or human verification, or the private session file may be unavailable.",
          "New YouTube imports are temporarily paused. Submitted imports are saved and will retry without holding processing credits. Device uploads and already imported videos are unaffected.",
          "Sign in to YouTube with the dedicated project account, export only its YouTube cookies in Netscape format, and replace the private session file on the VPS. Do not email the cookie contents.",
          "After replacement, saved imports retry automatically within five minutes. Their normal expiry and credit checks still apply. A successful import confirms recovery; replacing the file alone does not guarantee YouTube will accept it.",
          `Site: ${new URL(env.BETTER_AUTH_URL).origin}`,
        ].join("\n\n"),
      });
      await incidents.updateOne(filter, { $set: { alertSentAt: new Date() }, $unset: { alertLeaseUntil: "" } });
    } catch {
      await incidents.updateOne(filter, { $set: { nextAlertAt: new Date(Date.now() + 15 * 60000) }, $unset: { alertLeaseUntil: "" } });
      logger.warn("YouTube session alert delivery failed; a later attempt is scheduled");
    }
  }
  let notification: Promise<void> | undefined;
  function notify() {
    notification ??= deliverAlert().finally(() => { notification = undefined; });
    return notification;
  }
  return {
    assertAvailable, run, notify,
    close: async () => { await notification; await mailer.drain(); },
  };
}
