import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { creditPacks, creditPolicy } from "@clipvelto/credit-plans";
import { connectDatabase } from "../src/config/database.js";
import { parseEnv } from "../src/config/env.js";
import {
  billingCreditMode,
  createCreditService,
} from "../src/modules/credits/credit-service.js";
import { createBillingService } from "../src/modules/billing/billing-service.js";
import { UploadError } from "../src/modules/uploads/upload-error.js";

let database: MongoMemoryReplSet;
let connection: Awaited<ReturnType<typeof connectDatabase>>;
let credits: ReturnType<typeof createCreditService>;
let billing: ReturnType<typeof createBillingService>;
const originalFetch = globalThis.fetch;
const secret = "sandbox-fixture-signing-secret";
const rawTransactions = new Map<string, Record<string, unknown>>();
const rawAdjustments = new Map<string, Record<string, unknown>[]>();
const priceIds = creditPacks.map(
  (_, index) => `pri_${String(index + 1).padStart(26, "0")}`,
);
let creates = 0;
let wrongPrice = false;
let loseCreateResponse = false;
const now = () => new Date().toISOString();

function price(id: string) {
  const pack = creditPacks[priceIds.indexOf(id)]!;
  return {
    id,
    product_id: `pro_${"1".repeat(26)}`,
    description: pack.name,
    type: "standard",
    status: "active",
    billing_cycle: null,
    trial_period: null,
    tax_mode: creditPolicy.taxMode,
    quantity: { minimum: 1, maximum: 1 },
    unit_price: {
      amount: wrongPrice ? "1" : String(pack.priceCents),
      currency_code: "USD",
    },
    unit_price_overrides: [],
    created_at: now(),
    updated_at: now(),
  };
}
function api(data: unknown) {
  return new Response(
    JSON.stringify({
      data,
      meta: {
        pagination: {
          has_more: false,
          next: null,
          per_page: 50,
          estimated_total: Array.isArray(data) ? data.length : 1,
        },
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
function completed(id: string, taxCents = 0) {
  const row = rawTransactions.get(id)!;
  const unit = (
    row.items as { price: { unit_price: { amount: string } } }[]
  )[0]!.price.unit_price.amount;
  const inclusive = (row.items as { price: { tax_mode: string } }[])[0]!
    .price.tax_mode === "internal";
  const subtotal = inclusive ? Number(unit) - taxCents : Number(unit);
  const total = inclusive ? Number(unit) : Number(unit) + taxCents;
  row.status = "completed";
  row.billed_at = now();
  row.details = {
    line_items: [],
    tax_rates_used: [],
    totals: {
      subtotal: String(subtotal),
      discount: "0",
      tax: String(taxCents),
      total: String(total),
      credit: "0",
      credit_to_balance: "0",
      balance: "0",
      grand_total: String(total),
      currency_code: "USD",
    },
  };
}
function refund(id: string, type = "full", action = "refund") {
  const amount = (rawTransactions.get(id)!.details as {
    totals: { total: string };
  }).totals.total;
  rawAdjustments.set(id, [
    {
      id: `adj_${"1".repeat(26)}`,
      transaction_id: id,
      type,
      action,
      status: "approved",
      currency_code: "USD",
      customer_id: `ctm_${"1".repeat(26)}`,
      reason: "Sandbox fixture",
      items: [],
      totals: {
        subtotal: amount,
        tax: "0",
        total: amount,
        fee: "0",
        earnings: amount,
        currency_code: "USD",
        retained_fee: "0",
      },
      created_at: now(),
      updated_at: now(),
    },
  ]);
}
async function event(
  id: string,
  eventId = `evt_${randomUUID().replaceAll("-", "").slice(0, 26)}`,
  timestamp = Math.floor(Date.now() / 1000),
) {
  const body = Buffer.from(
    JSON.stringify({
      event_id: eventId,
      event_type: "transaction.completed",
      data: { id },
    }),
  );
  const signature = `ts=${timestamp};h1=${createHmac("sha256", secret)
    .update(`${timestamp}:${body.toString("utf8")}`)
    .digest("hex")}`;
  await billing.paddle!.webhook(body, signature);
}

before(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { version: "8.2.2" },
    replSet: { count: 1 },
  });
  connection = await connectDatabase(database.getUri());
  const env = parseEnv({
    NODE_ENV: "test",
    MONGODB_URI: database.getUri(),
    BETTER_AUTH_SECRET: "isolated-paddle-auth-fixture-not-a-real-secret",
    BILLING_MODE: "paddle",
    PADDLE_ENVIRONMENT: "sandbox",
    PADDLE_API_KEY: "pdl_sdbx_apikey_fixture",
    PADDLE_CLIENT_TOKEN: "test_fixture",
    PADDLE_WEBHOOK_SECRET: secret,
    PADDLE_PRICE_STARTER: priceIds[0],
    PADDLE_PRICE_CREATOR: priceIds[1],
    PADDLE_PRICE_STUDIO: priceIds[2],
  });
  credits = createCreditService(connection, billingCreditMode(env));
  await credits.init();
  billing = createBillingService(connection, env, credits);
  await billing.init();
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(
      url.origin,
      "https://sandbox-api.paddle.com",
      "No external requests are permitted in this fixture",
    );
    if (url.pathname.startsWith("/prices/"))
      return api(price(url.pathname.split("/").at(-1)!));
    if (url.pathname === "/transactions" && init?.method === "POST") {
      const request = JSON.parse(String(init.body));
      const id = `txn_${String(++creates).padStart(26, "0")}`;
      const row = {
        id,
        status: "draft",
        custom_data: request.custom_data,
        origin: "api",
        currency_code: "USD",
        collection_mode: "automatic",
        items: [
          {
            price: price(request.items[0].price_id),
            quantity: request.items[0].quantity,
          },
        ],
        payments: [],
        details: null,
        checkout: { url: `https://example.test/pay?_ptxn=${id}` },
        created_at: now(),
        updated_at: now(),
      };
      rawTransactions.set(id, row);
      if (loseCreateResponse)
        throw new Error(
          "Connection lost after Paddle accepted the transaction",
        );
      return api(row);
    }
    if (url.pathname.startsWith("/transactions/"))
      return api(rawTransactions.get(url.pathname.split("/").at(-1)!)!);
    if (url.pathname === "/adjustments")
      return api(
        rawAdjustments.get(url.searchParams.get("transaction_id")!) ?? [],
      );
    throw new Error("Unexpected sandbox request");
  };
});
beforeEach(async () => {
  creates = 0;
  wrongPrice = false;
  loseCreateResponse = false;
  rawTransactions.clear();
  rawAdjustments.clear();
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
  await connection.db!.collection("paddle_events").deleteMany({});
  await connection.db!.collection("payment_holds").deleteMany({});
});
after(async () => {
  globalThis.fetch = originalFetch;
  await billing?.paddle?.close();
  await connection?.close();
  await database?.stop();
});

test("server confirmation grants a pack once across duplicate webhooks and concurrent reconciliation, without touching live credits", async () => {
  const order = await billing.create("alice", "starter", randomUUID());
  assert.equal((await credits.summary("alice")).available, 15);
  completed(order.paddleTransactionId!);
  const id = `evt_${"a".repeat(26)}`;
  await Promise.all([
    event(order.paddleTransactionId!, id),
    event(order.paddleTransactionId!, id),
    billing.paddle!.sync(order._id, "alice"),
  ]);
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

test("exclusive checkout adds tax while verifying the base pack price", async () => {
  for (const pack of creditPacks) {
    const order = await billing.create(pack.id, pack.id, randomUUID());
    assert.equal(order.taxMode, "external");
    completed(order.paddleTransactionId!, Math.round(pack.priceCents * 0.15));
    const confirmed = await billing.paddle!.sync(order._id, pack.id);
    assert.equal(confirmed.priceCents, pack.priceCents);
    assert.equal(confirmed.status, "paid");
    assert.equal((await credits.summary(pack.id)).available, 15 + pack.credits);
  }
});

test("earlier inclusive checkout verifies the gross pack price with zero, 15% and 25% tax", async () => {
  for (const pack of creditPacks) {
    for (const rate of [0, 0.15, 0.25]) {
      const user = `${pack.id}-${rate}`;
      const order = await billing.create(user, pack.id, randomUUID());
      await billing.Order.collection.updateOne(
        { _id: order._id },
        { $set: { taxMode: "internal" } },
      );
      (rawTransactions.get(order.paddleTransactionId!)!.items as {
        price: { tax_mode: string };
      }[])[0]!.price.tax_mode = "internal";
      const tax = pack.priceCents - Math.round(pack.priceCents / (1 + rate));
      completed(order.paddleTransactionId!, tax);
      const confirmed = await billing.paddle!.sync(order._id, user);
      assert.equal(confirmed.taxMode, "internal");
      assert.equal(confirmed.priceCents, pack.priceCents);
      assert.equal(confirmed.status, "paid");
      assert.equal((await credits.summary(user)).available, 15 + pack.credits);
    }
  }
});

test("inclusive checkout rejects a changed gross total or tax mode", async () => {
  for (const tampering of ["total", "taxMode"]) {
    const order = await billing.create(tampering, "starter", randomUUID());
    await billing.Order.collection.updateOne(
      { _id: order._id },
      { $set: { taxMode: "internal" } },
    );
    (rawTransactions.get(order.paddleTransactionId!)!.items as {
      price: { tax_mode: string };
    }[])[0]!.price.tax_mode = "internal";
    completed(order.paddleTransactionId!, 104);
    const row = rawTransactions.get(order.paddleTransactionId!)!;
    if (tampering === "total") {
      (row.details as { totals: { total: string } }).totals.total = "799";
    } else {
      (row.items as { price: { tax_mode: string } }[])[0]!.price.tax_mode = "external";
    }
    assert.equal((await billing.paddle!.sync(order._id, tampering)).status, "review");
    assert.equal((await credits.summary(tampering)).available, 15);
  }
});

test("legacy exclusive orders keep their price and can settle, but cannot start a new checkout", async () => {
  const requestId = randomUUID();
  const order = await billing.create("alice", "starter", requestId);
  // Recreate a pre-migration order: immutable snapshots are not rewritten by
  // the application when pack prices or tax policy changes.
  await billing.Order.collection.updateOne(
    { _id: order._id },
    { $set: { priceCents: 700 }, $unset: { taxMode: "" } },
  );
  const row = rawTransactions.get(order.paddleTransactionId!)!;
  const item = (row.items as { price: { tax_mode: string; unit_price: { amount: string } } }[])[0]!;
  item.price.tax_mode = "external";
  item.price.unit_price.amount = "700";
  await assert.rejects(
    billing.create("alice", "starter", requestId),
    (error) => error instanceof UploadError && error.code === "PRICE_CHANGED",
  );
  assert.equal(creates, 1);
  completed(order.paddleTransactionId!, 105);
  const confirmed = await billing.paddle!.sync(order._id, "alice");
  assert.equal(confirmed.status, "paid");
  assert.equal(confirmed.priceCents, 700);
  assert.equal((await credits.summary("alice")).available, 135);
});

test("forged, modified and expired webhook notifications cannot grant credits", async () => {
  const order = await billing.create("alice", "starter", randomUUID());
  completed(order.paddleTransactionId!);
  await assert.rejects(
    billing.paddle!.webhook(Buffer.from("{}"), "ts=1;h1=wrong"),
    (error) => error instanceof UploadError && error.status === 400,
  );
  await assert.rejects(
    event(
      order.paddleTransactionId!,
      undefined,
      Math.floor(Date.now() / 1000) - 60,
    ),
  );
  assert.equal((await credits.summary("alice")).available, 15);
});

test("a different account cannot inspect, resume or fulfill someone else's order", async () => {
  const order = await billing.create("alice", "starter", randomUUID());
  completed(order.paddleTransactionId!);
  await assert.rejects(
    billing.paddle!.sync(order._id, "bob"),
    (error) => error instanceof UploadError && error.status === 404,
  );
  await assert.rejects(
    billing.paddle!.ownedTransaction(order.paddleTransactionId!, "bob"),
  );
  assert.equal((await credits.summary("bob")).available, 15);
});

test("unpaid checkouts and tampered prices do not grant credits, and the simulator cannot fulfill a Paddle purchase", async () => {
  const order = await billing.create("alice", "starter", randomUUID());
  await billing.paddle!.sync(order._id, "alice");
  assert.equal((await credits.summary("alice")).available, 15);
  await assert.rejects(billing.simulate("alice", order._id, "success"));
  completed(order.paddleTransactionId!);
  rawTransactions.get(order.paddleTransactionId!)!.currency_code = "EUR";
  await event(order.paddleTransactionId!);
  assert.equal((await credits.summary("alice")).available, 15);
  assert.equal((await billing.Order.findById(order._id))!.status, "review");
  await assert.rejects(
    credits.reserveWork("alice", new Types.ObjectId().toString(), 60),
    (error) => error instanceof UploadError && error.code === "PAYMENT_REVIEW",
  );
});

test("checkout creation uses one external transaction per request, including an ambiguous network failure", async () => {
  const request = randomUUID();
  loseCreateResponse = true;
  await assert.rejects(billing.create("alice", "starter", request));
  loseCreateResponse = false;
  await assert.rejects(billing.create("alice", "starter", request));
  assert.equal(creates, 1);
  const transaction = [...rawTransactions.values()][0]!;
  await event(String(transaction.id)); // Later signed notification recovers the binding.
  const recovered = await billing.create("alice", "starter", request);
  assert.equal(recovered.paddleTransactionId, transaction.id);
  assert.equal(creates, 1);
});

test("full unused-pack refunds are idempotent and cannot be undone by an older completed event", async () => {
  const order = await billing.create("alice", "starter", randomUUID());
  completed(order.paddleTransactionId!);
  await event(order.paddleTransactionId!);
  refund(order.paddleTransactionId!);
  await Promise.all([
    event(order.paddleTransactionId!),
    event(order.paddleTransactionId!),
  ]);
  assert.equal((await credits.summary("alice")).available, 15);
  assert.equal((await billing.Order.findById(order._id))!.status, "refunded");
  assert.equal(await billing.holds.active("alice"), false);
  await event(order.paddleTransactionId!);
  assert.equal((await credits.summary("alice")).available, 15);
});

test("partial refunds and refunds of consumed credits hold new spending for review", async () => {
  for (const [user, type] of [
    ["alice", "partial"],
    ["bob", "full"],
  ]) {
    const order = await billing.create(user!, "starter", randomUUID());
    completed(order.paddleTransactionId!);
    await event(order.paddleTransactionId!);
    if (user === "bob") {
      const videoId = new Types.ObjectId().toString();
      await credits.reserveWork(user, videoId, 1200);
      await credits.commit(videoId);
    }
    refund(order.paddleTransactionId!, type);
    await event(order.paddleTransactionId!);
    assert.equal((await billing.Order.findById(order._id))!.status, "review");
    assert.equal(await billing.holds.active(user!), true);
    await assert.rejects(
      billing.create(user!, "creator", randomUUID()),
      (error) =>
        error instanceof UploadError && error.code === "PAYMENT_REVIEW",
    );
    await assert.rejects(
      credits.reserveWork(user!, new Types.ObjectId().toString(), 60),
      (error) =>
        error instanceof UploadError && error.code === "PAYMENT_REVIEW",
    );
  }
});

test("a misconfigured catalogue price is rejected before Paddle checkout creation", async () => {
  wrongPrice = true;
  await assert.rejects(billing.create("alice", "starter", randomUUID()));
  assert.equal(creates, 0);
});

test("sandbox cannot fund production and live payments require explicit HTTPS activation", () => {
  assert.equal(
    billingCreditMode({
      BILLING_MODE: "paddle",
      PADDLE_ENVIRONMENT: "sandbox",
    }),
    "test",
  );
  assert.equal(
    billingCreditMode({ BILLING_MODE: "paddle", PADDLE_ENVIRONMENT: "live" }),
    "live",
  );
  assert.throws(() =>
    parseEnv({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb://localhost/fixture",
      BETTER_AUTH_SECRET: "production-fixture-auth-secret-not-a-real-key",
      BILLING_MODE: "paddle",
      PADDLE_ENVIRONMENT: "sandbox",
    }),
  );
});
