import type { Connection } from "mongoose";

// Await uniqueness before accepting traffic; adapter index creation is asynchronous.
export async function ensureAuthIndexes(connection: Connection) {
  const db = connection.db!;
  await Promise.all([
    db.collection("auth_email_limits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db
      .collection("user")
      .createIndex({ email: 1 }, { unique: true, name: "user_email_uidx" }),
    db
      .collection("session")
      .createIndex({ token: 1 }, { unique: true, name: "session_token_uidx" }),
    db
      .collection("session")
      .createIndex({ userId: 1 }, { name: "session_userId_idx" }),
    db
      .collection("account")
      .createIndex({ userId: 1 }, { name: "account_userId_idx" }),
    db
      .collection("account")
      .createIndex({ providerId: 1, accountId: 1 }, { unique: true }),
    db
      .collection("verification")
      .createIndex({ identifier: 1 }, { name: "verification_identifier_idx" }),
    db
      .collection("session")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db
      .collection("verification")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
