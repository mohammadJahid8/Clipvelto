import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { connectDatabase } from "../src/config/database.js";
import { parseEnv } from "../src/config/env.js";
import { createCreditService } from "../src/modules/credits/credit-service.js";
import { createBillingService } from "../src/modules/billing/billing-service.js";
import { UploadError } from "../src/modules/uploads/upload-error.js";
import { createApp } from "../src/app.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let database: MongoMemoryReplSet;
let connection: Awaited<ReturnType<typeof connectDatabase>>;
let credits: ReturnType<typeof createCreditService>;
let billing: ReturnType<typeof createBillingService>;
const video = () => new Types.ObjectId().toString();
before(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { version: "8.2.2" },
    replSet: { count: 1 },
  });
  connection = await connectDatabase(database.getUri());
  credits = createCreditService(connection, "test");
  await credits.init();
  billing = createBillingService(
    connection,
    parseEnv({
      NODE_ENV: "test",
      BILLING_MODE: "mock",
      MONGODB_URI: database.getUri(),
      BETTER_AUTH_SECRET: "isolated-billing-test-secret-not-used-for-auth",
    }),
    credits,
  );
  await billing.init();
});
beforeEach(async () => {
  await Promise.all(
    [
      credits.Account,
      credits.Wallet,
      credits.Grant,
      credits.Reservation,
      credits.Ledger,
      billing.Order,
    ].map((model) => model.deleteMany({})),
  );
});
after(async () => {
  await connection?.close();
  await database?.stop();
});

test("repeated and concurrent mock fulfillment adds the purchased pack exactly once", async () => {
  const requestId = randomUUID();
  const orders = await Promise.all(
    Array.from({ length: 8 }, () =>
      billing.create("alice", "starter", requestId),
    ),
  );
  assert.equal(new Set(orders.map((order) => order._id)).size, 1);
  await Promise.all(
    Array.from({ length: 8 }, () =>
      billing.simulate("alice", orders[0]._id, "success"),
    ),
  );
  assert.equal((await credits.summary("alice")).available, 135);
  assert.equal(
    await credits.Ledger.countDocuments({ userId: "alice", kind: "purchase" }),
    1,
  );
  assert.equal(
    (await createCreditService(connection, "live").summary("alice")).available,
    15,
  );
});
test("failed and cancelled checkouts do not grant credits and cannot later turn into a paid order", async () => {
  for (const action of ["failure", "cancel"] as const) {
    const order = await billing.create("alice", "creator", randomUUID());
    await billing.simulate("alice", order._id, action);
    await assert.rejects(
      billing.simulate("alice", order._id, "success"),
      (error) => error instanceof UploadError && error.code === "ORDER_STATE",
    );
  }
  assert.equal((await credits.summary("alice")).available, 15);
});
test("cross-account checkout access and client price changes cannot grant credits", async () => {
  const request = randomUUID();
  const order = await billing.create("alice", "starter", request);
  await assert.rejects(
    billing.simulate("bob", order._id, "success"),
    (error) => error instanceof UploadError && error.status === 404,
  );
  await assert.rejects(
    billing.create("alice", "studio", request),
    (error) =>
      error instanceof UploadError && error.code === "CHECKOUT_CHANGED",
  );
  assert.equal((await credits.summary("bob")).available, 15);
});
test("concurrent jobs cannot overspend and retries cannot double-charge or double-refund", async () => {
  const ids = Array.from({ length: 10 }, video);
  const outcomes = await Promise.allSettled(
    ids.map((id) => credits.reserveWork("alice", id, 120)),
  );
  assert.equal(
    outcomes.filter((result) => result.status === "fulfilled").length,
    7,
  );
  assert.equal((await credits.summary("alice")).available, 1);
  const held =
    ids[outcomes.findIndex((result) => result.status === "fulfilled")];
  await Promise.all(Array.from({ length: 5 }, () => credits.refund(held)));
  assert.equal((await credits.summary("alice")).available, 3);
  await credits.reserveWork("alice", held, 180);
  await Promise.all(Array.from({ length: 5 }, () => credits.commit(held)));
  assert.equal((await credits.summary("alice")).used, 3);
  assert.equal((await credits.summary("alice")).available, 0);
});
test("upgrades preserve existing credits and only an unused purchased lot can be refunded", async () => {
  const starter = await billing.create("alice", "starter", randomUUID());
  await billing.simulate("alice", starter._id, "success");
  const id = video();
  await credits.reserveWork("alice", id, 905);
  await credits.commit(id);
  await assert.rejects(
    billing.simulate("alice", starter._id, "refund"),
    (error) =>
      error instanceof UploadError && error.code === "PACK_ALREADY_USED",
  );
  const before = (await credits.summary("alice")).available;
  const creator = await billing.create("alice", "creator", randomUUID());
  await billing.simulate("alice", creator._id, "success");
  assert.equal((await credits.summary("alice")).available, before! + 360);
  await Promise.all(
    Array.from({ length: 4 }, () =>
      billing.simulate("alice", creator._id, "refund"),
    ),
  );
  assert.equal((await credits.summary("alice")).available, before);
});
test("legacy balances are preserved once and reservations adjust to verified video cost", async () => {
  await credits.Account.create({
    _id: "legacy",
    availableSeconds: 100,
    reservedSeconds: 0,
    usedSeconds: 800,
  });
  await Promise.all(Array.from({ length: 5 }, () => credits.summary("legacy")));
  assert.equal((await credits.summary("legacy")).available, 100 / 60);
  assert.equal(
    await credits.Ledger.countDocuments({ userId: "legacy", kind: "opening" }),
    1,
  );
  const id = video();
  await credits.reserveWork("legacy", id, 0);
  await credits.reserveWork("legacy", id, 90);
  await credits.refund(id);
  assert.equal((await credits.summary("legacy")).available, 100 / 60);
  assert.equal((await credits.summary("legacy")).reserved, 0);
});
test("production cannot enable the mock provider", () => {
  assert.throws(() =>
    parseEnv({
      NODE_ENV: "production",
      BILLING_MODE: "mock",
      MONGODB_URI: "mongodb://localhost/test",
      BETTER_AUTH_SECRET: "isolated-production-test-configuration",
    }),
  );
});

test("cancelling charges only completed work, releases the remainder, and is idempotent", async () => {
  const id = video();
  await credits.reserveWork("creator", id, 600);
  await credits.transaction((session) =>
    credits.cancelWork("creator", id, 125, session),
  );
  await credits.transaction((session) =>
    credits.cancelWork("creator", id, 125, session),
  );
  const balance = await credits.summary("creator");
  assert.equal(balance.used, 125 / 60);
  assert.equal(balance.available, 775 / 60);
  assert.equal(balance.reserved, 0);
  const queued = video();
  await credits.reserveWork("creator", queued, 120);
  await credits.transaction((session) =>
    credits.cancelWork("creator", queued, 0, session),
  );
  assert.equal((await credits.summary("creator")).available, 775 / 60);
});

test("HTTP checkout requires a verified session and origin, ignores no client pricing, and scopes history to its owner", async () => {
  const directory = await mkdtemp(join(tmpdir(), "clipvelto-billing-http-"));
  const env = parseEnv({
    NODE_ENV: "test",
    BILLING_MODE: "mock",
    MONGODB_URI: database.getUri(),
    BETTER_AUTH_SECRET: "isolated-billing-http-secret-never-used-in-production",
    MAIL_DIRECTORY: directory,
  });
  const instance = await createApp(connection, env);
  const server = instance.app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const origin = new URL(env.BETTER_AUTH_URL).origin;
  async function account() {
    const email = `${randomUUID()}@example.test`,
      password = "an isolated billing test passphrase";
    const response = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ name: "Billing Test", email, password }),
    });
    assert.equal(response.status, 200);
    await connection
      .collection("user")
      .updateOne({ email }, { $set: { emailVerified: true } });
    const login = await fetch(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(login.status, 200);
    return login.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0])
      .join("; ");
  }
  const call = (
    path: string,
    cookie: string,
    body?: unknown,
    requestOrigin = origin,
  ) =>
    fetch(`${base}/api/v1${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        cookie,
        origin: requestOrigin,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    assert.equal((await call("/billing", "")).status, 401);
    const owner = await account(),
      other = await account();
    const input = { packId: "starter", requestId: randomUUID() };
    assert.equal(
      (
        await call("/billing/orders", owner, {
          ...input,
          priceCents: 1,
          credits: 999999,
        })
      ).status,
      400,
    );
    assert.equal(
      (await call("/billing/orders", owner, input, "https://untrusted.example"))
        .status,
      403,
    );
    const response = await call("/billing/orders", owner, input);
    assert.equal(response.status, 201);
    const { order } = (await response.json()) as { order: { _id: string } };
    assert.equal(
      (
        await call(`/billing/orders/${order._id}/simulate`, other, {
          action: "success",
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call(`/billing/orders/${order._id}/simulate`, owner, {
          action: "success",
        })
      ).status,
      200,
    );
    const own = (await (await call("/billing", owner)).json()) as {
      credits: { available: number };
      orders: unknown[];
    };
    const foreign = (await (await call("/billing", other)).json()) as {
      credits: { available: number };
      orders: unknown[];
    };
    assert.equal(own.credits.available, 135);
    assert.equal(own.orders.length, 1);
    assert.equal(foreign.credits.available, 15);
    assert.equal(foreign.orders.length, 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await instance.mailer.drain();
    await rm(directory, { recursive: true, force: true });
  }
});
