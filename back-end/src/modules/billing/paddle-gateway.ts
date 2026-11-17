import {
  Environment,
  LogLevel,
  Paddle,
  type Transaction,
  type Price,
} from "@paddle/paddle-node-sdk";
import type { Env } from "../../config/env.js";
import type { BillingOrder } from "./billing-models.js";
import type { CreditPackId } from "@clipvelto/credit-plans";
import { UploadError } from "../uploads/upload-error.js";

export function paddleClient(env: Env) {
  if (!env.PADDLE_API_KEY) throw new Error("Paddle API key is not configured");
  return new Paddle(env.PADDLE_API_KEY, {
    environment:
      env.PADDLE_ENVIRONMENT === "sandbox"
        ? Environment.sandbox
        : Environment.production,
    logLevel: LogLevel.none,
  });
}

export function paddlePriceId(env: Env, pack: CreditPackId) {
  const id = {
    starter: env.PADDLE_PRICE_STARTER,
    creator: env.PADDLE_PRICE_CREATOR,
    studio: env.PADDLE_PRICE_STUDIO,
  }[pack];
  if (!id)
    throw new UploadError(
      503,
      "CHECKOUT_UNAVAILABLE",
      "This credit pack is not available for purchase yet.",
    );
  return id;
}

export async function paddleDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Paddle request timed out")),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function validPaddlePrice(
  price: Price,
  order: Pick<
    BillingOrder,
    "paddlePriceId" | "priceCents" | "currency" | "taxMode"
  >,
) {
  return (
    price.id === order.paddlePriceId &&
    price.status === "active" &&
    price.billingCycle === null &&
    price.trialPeriod === null &&
    price.unitPrice.amount === String(order.priceCents) &&
    price.unitPrice.currencyCode === order.currency &&
    price.taxMode === (order.taxMode ?? "external") &&
    price.unitPriceOverrides.length === 0
  );
}

export function validPaddleTransaction(
  transaction: Transaction,
  order: BillingOrder,
) {
  const item = transaction.items[0];
  const price = item?.price;
  const totals = transaction.details?.totals;
  // Match the immutable local order, not the payer's editable email or browser
  // event. Prices/quantities/custom data supplied by a browser never set credits.
  return (
    transaction.origin === "api" &&
    transaction.collectionMode === "automatic" &&
    transaction.currencyCode === order.currency &&
    !transaction.subscriptionId &&
    !transaction.discountId &&
    transaction.customData?.clipvelto_order_id === order._id &&
    transaction.customData?.clipvelto_user_id === order.userId &&
    transaction.items.length === 1 &&
    item?.quantity === 1 &&
    price &&
    price.id === order.paddlePriceId &&
    price.billingCycle === null &&
    price.trialPeriod === null &&
    price.taxMode === (order.taxMode ?? "external") &&
    price.unitPrice.amount === String(order.priceCents) &&
    price.unitPrice.currencyCode === order.currency &&
    (transaction.status !== "completed" ||
      (totals &&
        totals.currencyCode === order.currency &&
        // Inclusive prices match the final total, not the pre-tax subtotal.
        // Each purchase retains its recorded inclusive or exclusive treatment.
        (order.taxMode === "internal"
          ? totals.total === String(order.priceCents)
          : totals.subtotal === String(order.priceCents)) &&
        totals.discount === "0"))
  );
}
