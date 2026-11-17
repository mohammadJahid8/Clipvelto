import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { creditPacks, creditPolicy } from "@clipvelto/credit-plans";
import { loadEnv, parseEnv } from "../src/config/env.js";
import {
  paddleClient,
  paddleDeadline,
} from "../src/modules/billing/paddle-gateway.js";

// Sandbox only. Reuse tagged catalogue entries and persist each result so a
// partially completed setup can be resumed without creating a second catalogue.
const env = loadEnv();
if (
  env.PADDLE_ENVIRONMENT !== "sandbox" ||
  !env.PADDLE_API_KEY?.startsWith("pdl_sdbx_apikey_")
)
  throw new Error("Save a sandbox PADDLE_API_KEY in back-end/.env first.");
const client = paddleClient(env);
const args = process.argv.slice(2);
const checkoutArg = args
  .find((value) => value.startsWith("--checkout-url="))
  ?.slice(15);
const webhookArg = args
  .find((value) => value.startsWith("--webhook-url="))
  ?.slice(14);
const path = new URL("../.env", import.meta.url);
const saved: Record<string, string> = {};
async function save(name: string, value: string) {
  let text = await readFile(path, "utf8");
  const line = `${name}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  text = pattern.test(text)
    ? text.replace(pattern, line)
    : `${text.trimEnd()}\n${line}\n`;
  const temporary = new URL(`../.env.paddle-${process.pid}`, import.meta.url);
  await writeFile(temporary, text, { mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o600);
  saved[name] = value;
}
function publicUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error(
      "Use an HTTPS URL on your own public domain, without credentials or query parameters.",
    );
  return url.href;
}
try {
  for (const pack of creditPacks) {
    let product;
    for await (const row of client.products.list({
      status: ["active"],
      perPage: 200,
    })) {
      if (row.customData?.clipvelto_pack_id === pack.id) {
        product = row;
        break;
      }
    }
    product ??= await paddleDeadline(
      client.products.create({
        name: `Clipvelto ${pack.name}`,
        taxCategory: "saas",
        description: `${pack.credits} non-transferable video-processing credits for Clipvelto. One-time purchase; no subscription.`,
        customData: { clipvelto_pack_id: pack.id },
      }),
    );
    let price;
    for await (const row of client.prices.list({
      productId: [product.id],
      status: ["active"],
      perPage: 200,
    })) {
      if (
        !row.billingCycle &&
        !row.trialPeriod &&
        row.unitPrice.amount === String(pack.priceCents) &&
        row.unitPrice.currencyCode === creditPolicy.currency &&
        row.taxMode === creditPolicy.taxMode &&
        !row.unitPriceOverrides.length &&
        row.quantity.minimum === 1 &&
        row.quantity.maximum === 1
      ) {
        price = row;
        break;
      }
    }
    price ??= await paddleDeadline(
      client.prices.create({
        productId: product.id,
        name: `${pack.name} · ${pack.credits} credits`,
        description: `${pack.name} prepaid pack · ${creditPolicy.version}`,
        billingCycle: null,
        trialPeriod: null,
        taxMode: creditPolicy.taxMode,
        unitPrice: { amount: String(pack.priceCents), currencyCode: "USD" },
        quantity: { minimum: 1, maximum: 1 },
      }),
    );
    await save(`PADDLE_PRICE_${pack.id.toUpperCase()}`, price.id);
    console.log(
      `${pack.name}: one-time $${pack.priceCents / 100} plus applicable tax, ${pack.credits} credits configured.`,
    );
  }
  let token;
  if (!env.PADDLE_CLIENT_TOKEN) {
    for await (const row of client.clientTokens.list({
      status: ["active"],
      perPage: 200,
    })) {
      if (row.name === "Clipvelto sandbox checkout") {
        token = row;
        break;
      }
    }
    token ??= await paddleDeadline(
      client.clientTokens.create({
        name: "Clipvelto sandbox checkout",
        description: "Clipvelto sandbox Paddle.js checkout",
      }),
    );
    await save("PADDLE_CLIENT_TOKEN", token.token);
  }
  if (checkoutArg) {
    const response = await fetch(
      "https://sandbox-api.paddle.com/settings/checkout-url",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${env.PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ default_url: publicUrl(checkoutArg) }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new Error(
        "Paddle could not update the sandbox payment link. Check checkout-setting permissions.",
      );
    console.log("Sandbox default payment link configured.");
  }
  if (webhookArg) {
    const destination = publicUrl(webhookArg);
    const existing = (
      await paddleDeadline(client.notificationSettings.list())
    ).find((row) => row.destination === destination);
    const settings = {
      description: "Clipvelto sandbox payment notifications",
      destination,
      type: "url" as const,
      apiVersion: 1,
      includeSensitiveFields: false,
      trafficSource: "platform" as const,
      subscribedEvents: [
        "transaction.created",
        "transaction.updated",
        "transaction.completed",
        "transaction.canceled",
        "adjustment.created",
        "adjustment.updated",
      ] as const,
    };
    const notification = existing
      ? await paddleDeadline(
          client.notificationSettings.update(existing.id, {
            ...settings,
            subscribedEvents: [...settings.subscribedEvents],
            active: true,
          }),
        )
      : await paddleDeadline(
          client.notificationSettings.create({
            ...settings,
            subscribedEvents: [...settings.subscribedEvents],
          }),
        );
    await save("PADDLE_WEBHOOK_SECRET", notification.endpointSecretKey);
    console.log("Sandbox webhook configured; its secret was saved privately.");
  }
  if (args.includes("--activate")) {
    parseEnv({
      ...process.env,
      ...saved,
      BILLING_MODE: "paddle",
      PADDLE_ENVIRONMENT: "sandbox",
    });
    await save("PADDLE_ENVIRONMENT", "sandbox");
    await save("BILLING_MODE", "paddle");
    console.log(
      "Sandbox checkout enabled. Restart your API and worker if they do not reload automatically.",
    );
  }
  console.log(
    "No live payments were enabled. API keys and webhook secrets were not printed.",
  );
} catch (error) {
  // SDK exceptions may contain request details. Print only the code, never the
  // exception object or a server response that might contain a token.
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "SETUP_INCOMPLETE";
  console.error(
    `Paddle setup stopped (${code}). Saved catalogue entries can be reused on the next run.`,
  );
  process.exitCode = 1;
}
