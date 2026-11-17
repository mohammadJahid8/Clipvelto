import { randomUUID } from "node:crypto";
import type { Connection } from "mongoose";
import {
  creditPacks,
  creditPolicy,
  type CreditPackId,
} from "@clipvelto/credit-plans";
import type { CreditService } from "../credits/credit-service.js";
import { UploadError } from "../uploads/upload-error.js";
import type { Env } from "../../config/env.js";
import { billingOrderModel } from "./billing-models.js";
import { createPaddleBilling } from "./paddle-billing.js";
import { paddlePriceId } from "./paddle-gateway.js";
import { paymentHolds } from "./payment-holds.js";

export function createBillingService(
  connection: Connection,
  env: Env,
  credits: CreditService,
) {
  const Order = billingOrderModel(connection);
  const holds = paymentHolds(connection, credits.mode);
  const paddle =
    env.BILLING_MODE === "paddle"
      ? createPaddleBilling(connection, env, credits, Order)
      : null;
  const provider = paddle ? "paddle" : "mock";
  const mock =
    env.BILLING_MODE === "mock" &&
    env.NODE_ENV !== "production" &&
    credits.mode === "test";
  function available() {
    if (!mock && !paddle)
      throw new UploadError(
        503,
        "PAYMENTS_NOT_ENABLED",
        "Payments are not enabled. No money has been taken.",
      );
  }
  async function owned(
    userId: string,
    id: string,
    session?: import("mongoose").ClientSession,
  ) {
    const order = await Order.findOne({
      _id: id,
      userId,
      mode: credits.mode,
      provider: provider === "mock" ? { $ne: "paddle" } : provider,
    }).session(session ?? null);
    if (!order)
      throw new UploadError(
        404,
        "ORDER_NOT_FOUND",
        "That purchase was not found.",
      );
    return order;
  }
  return {
    mock,
    Order,
    paddle,
    holds,
    checkout: {
      enabled: !!paddle || mock,
      provider: paddle
        ? ("paddle" as const)
        : mock
          ? ("mock" as const)
          : ("disabled" as const),
      environment: env.PADDLE_ENVIRONMENT,
      clientToken: paddle ? env.PADDLE_CLIENT_TOKEN! : null,
    },
    init: () => Promise.all([Order.init(), holds.init()]),
    async create(userId: string, packId: CreditPackId, requestId: string) {
      available();
      const pack = creditPacks.find((item) => item.id === packId);
      if (!pack)
        throw new UploadError(
          400,
          "INVALID_PACK",
          "Choose an available credit pack.",
        );
      const order = await credits.transaction(async (session) => {
        await holds.assertClear(userId, session);
        const previous = await Order.findOne({
          userId,
          mode: credits.mode,
          requestId,
        }).session(session);
        if (previous) {
          if (
            previous.packId !== packId ||
            (previous.provider ?? "mock") !== provider ||
            (paddle && previous.providerEnvironment !== env.PADDLE_ENVIRONMENT)
          )
            throw new UploadError(
              409,
              "CHECKOUT_CHANGED",
              "Start a new checkout to choose another pack.",
            );
          if (
            previous.status === "pending" &&
            (previous.priceCents !== pack.priceCents ||
              previous.taxMode !== creditPolicy.taxMode)
          )
            throw new UploadError(
              409,
              "PRICE_CHANGED",
              "Pack prices have changed. Refresh this page to start a new checkout.",
            );
          return previous;
        }
        const [order] = await Order.create(
          [
            {
              _id: `${paddle ? "paddle" : "test"}_${randomUUID()}`,
              userId,
              mode: credits.mode,
              provider,
              ...(paddle
                ? {
                    providerEnvironment: env.PADDLE_ENVIRONMENT,
                    paddlePriceId: paddlePriceId(env, packId),
                  }
                : {}),
              requestId,
              packId: pack.id,
              packName: pack.name,
              priceCents: pack.priceCents,
              taxMode: creditPolicy.taxMode,
              credits: pack.credits,
              currency: creditPolicy.currency,
              status: "pending",
            },
          ],
          { session },
        );
        return order!;
      });
      return paddle ? paddle.prepare(order._id, userId) : order;
    },
    async simulate(
      userId: string,
      id: string,
      action: "success" | "failure" | "cancel" | "refund",
    ) {
      if (!mock)
        throw new UploadError(
          503,
          "SIMULATOR_DISABLED",
          "Simulated payments are disabled.",
        );
      return credits.transaction(async (session) => {
        const order = await owned(userId, id, session);
        const target = {
          success: "paid",
          failure: "failed",
          cancel: "cancelled",
          refund: "refunded",
        }[action];
        if (order.status === target) return order;
        if (action === "refund") {
          if (order.status !== "paid")
            throw new UploadError(
              409,
              "ORDER_STATE",
              "Only a completed test purchase can be refunded.",
            );
          await credits.reversePurchase(userId, order._id, session);
          order.refundedAt = new Date();
        } else {
          if (order.status !== "pending")
            throw new UploadError(
              409,
              "ORDER_STATE",
              "This checkout has already finished. Start a new purchase to try again.",
            );
          if (action === "success") {
            await credits.grantPurchase(
              userId,
              order._id,
              order.credits * 60,
              session,
            );
            order.paidAt = new Date();
          }
        }
        order.status = target as typeof order.status;
        await order.save({ session });
        return order;
      });
    },
    history: (userId: string) =>
      Order.find({ userId, mode: credits.mode })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    pendingRemovals: (userId: string) =>
      connection.collection("videos").countDocuments({
        userId,
        status: "deleting",
        $and: [
          {
            $or: [
              { deletionRequestedAt: { $exists: true } },
              { cancellationChargeSeconds: { $exists: true } },
            ],
          },
        ],
        ...(credits.mode === "test"
          ? { creditMode: "test" }
          : {
              $or: [{ creditMode: "live" }, { creditMode: { $exists: false } }],
            }),
      }),
  };
}
