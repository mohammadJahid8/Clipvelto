import type { ClientSession, Connection } from "mongoose";
import type { CreditMode } from "../credits/credit-service.js";
import { UploadError } from "../uploads/upload-error.js";

export function paymentHolds(connection: Connection, mode: CreditMode) {
  const rows = connection.db!.collection<{
    _id: string;
    userId: string;
    mode: CreditMode;
    active: boolean;
    reason: string;
    createdAt: Date;
  }>("payment_holds");
  return {
    init: () => rows.createIndex({ userId: 1, mode: 1, active: 1 }),
    async active(userId: string) {
      return !!(await rows.findOne(
        { userId, mode, active: true },
        { projection: { _id: 1 } },
      ));
    },
    async assertClear(userId: string, session: ClientSession) {
      if (
        await rows.findOne(
          { userId, mode, active: true },
          { session, projection: { _id: 1 } },
        )
      )
        throw new UploadError(
          402,
          "PAYMENT_REVIEW",
          "A payment adjustment needs review. Contact support before starting another video.",
        );
    },
    async hold(
      userId: string,
      reference: string,
      reason: string,
      session: ClientSession,
    ) {
      // Serialize holds with reservations, which update this same wallet.
      await connection
        .db!.collection<{ _id: string; paymentRevision: number }>(
          "creditwallets",
        )
        .updateOne(
          { _id: `${mode}:${userId}` },
          { $inc: { paymentRevision: 1 } },
          { session },
        );
      return rows.updateOne(
        { _id: `${mode}:${reference}` },
        {
          $set: { active: true, reason },
          $setOnInsert: { userId, mode, createdAt: new Date() },
        },
        { upsert: true, session },
      );
    },
    clear(reference: string, session: ClientSession) {
      return rows.updateOne(
        { _id: `${mode}:${reference}` },
        { $set: { active: false } },
        { session },
      );
    },
  };
}
