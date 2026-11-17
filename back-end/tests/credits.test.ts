import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Types, type Connection } from "mongoose";
import { connectDatabase } from "../src/config/database.js";
import { createCreditService } from "../src/modules/credits/credit-service.js";

let database: MongoMemoryReplSet;
let connection: Connection;
let credits: ReturnType<typeof createCreditService>;
const id = () => new Types.ObjectId().toString();
before(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { version: "8.2.2" },
    replSet: { count: 1 },
  });
  connection = await connectDatabase(database.getUri("credit-tests"));
  credits = createCreditService(connection);
  await credits.init();
});
beforeEach(async () => {
  await credits.Reservation.deleteMany({});
  await credits.Account.deleteMany({});
  await Promise.all(
    [credits.Wallet, credits.Grant, credits.Ledger].map((model) =>
      model.deleteMany({}),
    ),
  );
  await connection.collection("credit_request_windows").deleteMany({});
  await connection.collection("videos").deleteMany({});
  await connection.collection("processingsubmissions").deleteMany({});
});
after(async () => {
  await connection?.close();
  await database?.stop();
});

test("concurrent reservations cannot overspend the one-time 15-minute allowance", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => credits.reserveWork("creator", id(), 180)),
  );
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 5);
  assert.deepEqual(await credits.summary("creator"), {
    mode: "live",
    purchased: 0,
    role: "free",
    available: 0,
    reserved: 15,
    used: 0,
    allowance: 15,
    status: "available",
  });
  assert.equal(await credits.Reservation.countDocuments(), 5);
});

test("same-video retries, settlement and refunds are idempotent and owner-bound", async () => {
  const video = id();
  await Promise.all(
    Array.from({ length: 8 }, () =>
      credits.reserveWork("creator", video, 61.2),
    ),
  );
  assert.equal((await credits.summary("creator")).reserved, 62 / 60);
  await assert.rejects(
    credits.reserveWork("intruder", video, 61.2),
    /another account/,
  );
  await Promise.all(Array.from({ length: 5 }, () => credits.refund(video)));
  assert.equal((await credits.summary("creator")).available, 15);
  await credits.reserveWork("creator", video, 61.2);
  await Promise.all(Array.from({ length: 5 }, () => credits.commit(video)));
  await credits.refund(video);
  await credits.reserveWork("creator", video, 61.2);
  const balance = await credits.summary("creator");
  assert.equal(balance.used, 62 / 60);
  assert.equal(balance.reserved, 0);
  assert.equal(balance.available, 838 / 60);
});

test("trial claiming is atomic with ownership work and never adds another allowance", async () => {
  const video = id();
  await assert.rejects(
    credits.transaction(async (session) => {
      await credits.claimTrial("creator", video, 180, session);
      throw new Error("ownership transfer failed");
    }),
  );
  assert.equal((await credits.summary("creator")).available, 15);
  await credits.transaction((session) =>
    credits.claimTrial("creator", video, 180, session),
  );
  await credits.transaction((session) =>
    credits.claimTrial("creator", video, 180, session),
  );
  assert.equal((await credits.summary("creator")).available, 12);
  assert.equal((await credits.summary("creator")).used, 3);
});

test("administrators bypass credit and submission allowances without a client role field", async () => {
  await credits.account("admin");
  await credits.Account.updateOne(
    { _id: "admin" },
    { $set: { role: "admin" } },
  );
  await Promise.all(
    Array.from({ length: 24 }, () => credits.reserveWork("admin", id(), 7072)),
  );
  for (let i = 0; i < 25; i++) await credits.allowSubmit("admin");
  assert.equal((await credits.summary("admin")).status, "unlimited");
  assert.equal((await credits.summary("admin")).used, 0);
  assert.equal((await credits.summary("regular")).role, "free");
  for (let i = 0; i < 60; i++) await credits.allowSubmit("regular");
  await assert.rejects(credits.allowSubmit("regular"), /Too many/);
});

test("reconciliation releases failed work and keeps active processing reserved", async () => {
  const missing = id(),
    active = id(),
    saved = id();
  for (const video of [missing, active, saved])
    await credits.reserveWork("creator", video, 60);
  await connection.collection("videos").insertMany([
    {
      _id: new Types.ObjectId(active),
      status: "ready",
      clipStatus: "processing",
    },
    {
      _id: new Types.ObjectId(saved),
      status: "ready",
      clipStatus: "failed",
      transcript: { segments: [{ text: "saved" }] },
    },
  ]);
  await credits.Reservation.collection.updateMany(
    {},
    { $set: { updatedAt: new Date(0) } },
  );
  await credits.reconcile();
  assert.equal(
    (await credits.Reservation.findById(`live:${missing}`))?.state,
    "refunded",
  );
  assert.equal(
    (await credits.Reservation.findById(`live:${active}`))?.state,
    "held",
  );
  assert.equal(
    (await credits.Reservation.findById(`live:${saved}`))?.state,
    "refunded",
  );
  const balance = await credits.summary("creator");
  assert.equal(balance.available, 14);
  assert.equal(balance.reserved, 1);
  assert.equal(balance.used, 0);
});

test("a failed clip job returns its charge even when its transcript was saved", async () => {
  const video = id();
  await credits.reserveWork("creator", video, 60);
  await connection.collection("videos").insertOne({
    _id: new Types.ObjectId(video),
    userId: "creator",
    transcript: { segments: [{ text: "usable" }] },
  });
  await credits.refund(video);
  assert.equal(
    (await credits.Reservation.findById(`live:${video}`))?.state,
    "refunded",
  );
  assert.equal((await credits.summary("creator")).used, 0);
  assert.equal((await credits.summary("creator")).available, 15);
});
