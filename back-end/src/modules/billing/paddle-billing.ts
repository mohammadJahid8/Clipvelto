import type { Connection } from "mongoose";
import { ApiError, type Adjustment } from "@paddle/paddle-node-sdk";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import type { CreditService } from "../credits/credit-service.js";
import { UploadError } from "../uploads/upload-error.js";
import { logger } from "../../config/logger.js";
import type { billingOrderModel } from "./billing-models.js";
import { billingDiscounts } from "./billing-discounts.js";
import { paymentHolds } from "./payment-holds.js";
import {
  paddleClient,
  paddleDeadline,
  validPaddlePrice,
  validPaddleTransaction,
} from "./paddle-gateway.js";

const envelopeSchema = z.object({
  event_id: z.string().regex(/^evt_[a-z0-9]{26}$/),
  event_type: z.string(),
  data: z.object({ id: z.string(), transaction_id: z.string().optional() }),
});

export function createPaddleBilling(
  connection: Connection,
  env: Env,
  credits: CreditService,
  Order: ReturnType<typeof billingOrderModel>,
) {
  const client = paddleClient(env);
  const environment = env.PADDLE_ENVIRONMENT;
  const holds = paymentHolds(connection, credits.mode);
  const discounts = billingDiscounts(connection);
  const events = connection.db!.collection<{
    _id: string;
    transactionId: string;
    processedAt: Date;
  }>("paddle_events");
  const scope = {
    provider: "paddle",
    providerEnvironment: environment,
    mode: credits.mode,
  } as const;
  let timer: ReturnType<typeof setInterval> | undefined;
  let running: Promise<void> | undefined;

  async function reconcile(transactionId: string, eventId?: string) {
    if (!/^txn_[a-z0-9]{26}$/.test(transactionId))
      throw new UploadError(
        400,
        "INVALID_TRANSACTION",
        "Invalid payment reference.",
      );
    const receipt = eventId ? `${environment}:${eventId}` : null;
    if (
      receipt &&
      (await events.findOne({ _id: receipt }, { projection: { _id: 1 } }))
    )
      return;
    const transaction = await paddleDeadline(
      client.transactions.get(transactionId),
    );
    const localId = transaction.customData?.clipvelto_order_id;
    const selected = await Order.findOne({
      ...scope,
      $or: [
        { paddleTransactionId: transactionId },
        ...(typeof localId === "string" &&
        /^paddle_[a-f0-9-]{36}$/.test(localId)
          ? [{ _id: localId }]
          : []),
      ],
    }).lean();
    // Ignore transactions for other products in the same Paddle account.
    if (!selected) return;
    const adjustments: Adjustment[] = [];
    const collection = client.adjustments.list({
      transactionId: [transactionId],
      perPage: 50,
    });
    do {
      adjustments.push(...(await paddleDeadline(collection.next())));
      if (adjustments.length > 100)
        throw new Error("Payment adjustment history needs review");
    } while (collection.hasMore);
    await credits.transaction(async (session) => {
      if (
        receipt &&
        (await events.findOne(
          { _id: receipt },
          { session, projection: { _id: 1 } },
        ))
      )
        return;
      const order = await Order.findOne({
        _id: selected._id,
        ...scope,
      }).session(session);
      if (!order) return;
      const approval = transaction.discountId && order.paddlePriceId
        ? await discounts.findOne(
            {
              _id: `${environment}:${transaction.discountId}`,
              userIds: order.userId,
              priceId: order.paddlePriceId,
              $or: [
                { redeemedOrderId: { $exists: false } },
                { redeemedOrderId: order._id },
              ],
            },
            { session },
          )
        : null;
      const billedAt = new Date(transaction.billedAt ?? transaction.updatedAt);
      const approvedDiscount =
        approval &&
        (transaction.status !== "completed" ||
          (Number.isFinite(billedAt.getTime()) && billedAt <= approval.expiresAt))
          ? { id: approval.discountId, percent: approval.percent }
          : undefined;
      await credits.ensureWallet(order.userId, session);
      async function review(reason: string) {
        order!.status = "review";
        await holds.hold(order!.userId, order!._id, reason, session);
      }
      if (
        (order.paddleTransactionId &&
          order.paddleTransactionId !== transactionId) ||
        !validPaddleTransaction(transaction, order, approvedDiscount)
      ) {
        await review("Payment does not match the original credit-pack order");
      } else {
        order.paddleTransactionId = transactionId;
        order.checkoutState = "ready";
        const financial = adjustments.filter(
          (row) =>
            row.status === "approved" &&
            ["refund", "credit", "chargeback", "chargeback_warning"].includes(
              row.action,
            ),
        );
        const fullRefund =
          financial.length === 1 &&
          financial[0]!.action === "refund" &&
          financial[0]!.type === "full";
        if (fullRefund) {
          try {
            await credits.reversePurchase(order.userId, order._id, session);
            order.status = "refunded";
            order.refundedAt = new Date(financial[0]!.updatedAt);
            await holds.clear(order._id, session);
          } catch (error) {
            if (
              !(error instanceof UploadError) ||
              !["PACK_ALREADY_USED", "CREDITS_RESERVED"].includes(error.code)
            )
              throw error;
            await review("Refund affects used or reserved processing credits");
          }
        } else if (financial.length) {
          // Do not invent a proportional debit or make an already-used balance
          // spendable after a partial refund/dispute. Preserve the ledger for review.
          await review(
            "Partial refund, account credit or dispute needs credit reconciliation",
          );
        } else if (
          transaction.status === "completed" &&
          !["paid", "refunded", "review"].includes(order.status)
        ) {
          const totals = transaction.details?.totals;
          if (!totals) throw new Error("Completed payment is missing totals");
          if (approval)
            await discounts.updateOne(
              { _id: approval._id },
              { $set: { redeemedOrderId: order._id } },
              { session },
            );
          order.appliedDiscountId = transaction.discountId ?? undefined;
          order.discountCents = Number(totals.discount);
          order.paidTotalCents = Number(totals.total);
          await credits.grantPurchase(
            order.userId,
            order._id,
            order.credits * 60,
            session,
          );
          order.status = "paid";
          order.paidAt = new Date(
            transaction.billedAt ?? transaction.updatedAt,
          );
        } else if (
          transaction.status === "canceled" &&
          order.status === "pending"
        ) {
          order.status = "cancelled";
        }
      }
      await order.save({ session });
      if (receipt)
        await events.insertOne(
          { _id: receipt, transactionId, processedAt: new Date() },
          { session },
        );
    });
  }

  return {
    holds,
    async canUseDiscounts(userId: string) {
      return !!(await discounts.findOne(
        {
          environment,
          userIds: userId,
          expiresAt: { $gt: new Date() },
          redeemedOrderId: { $exists: false },
        },
        { projection: { _id: 1 } },
      ));
    },
    start() {
      if (timer) return;
      // Recover paid checkouts even if a browser closes or a notification is
      // delayed. In sandbox this also permits local development without a tunnel.
      const sweep = () => {
        if (running) return;
        running = (async () => {
          const pending = await Order.find({
            ...scope,
            status: "pending",
            paddleTransactionId: { $type: "string" },
          })
            .sort({ lastCheckedAt: 1, createdAt: 1 })
            .limit(5)
            .lean();
          for (const row of pending) {
            try {
              await reconcile(row.paddleTransactionId!);
            } catch {
              logger.warn(
                { orderId: row._id },
                "Paddle payment check will retry",
              );
            } finally {
              await Order.updateOne(
                { _id: row._id },
                { $set: { lastCheckedAt: new Date() } },
              );
            }
          }
        })()
          .catch(() => logger.warn("Paddle payment reconciliation will retry"))
          .finally(() => {
            running = undefined;
          });
      };
      timer = setInterval(sweep, 30000).unref();
      sweep();
    },
    async close() {
      clearInterval(timer);
      timer = undefined;
      await running;
    },
    async ownedTransaction(transactionId: string, userId: string) {
      const order = await Order.findOne({
        ...scope,
        userId,
        paddleTransactionId: transactionId,
      }).lean();
      if (!order)
        throw new UploadError(
          404,
          "ORDER_NOT_FOUND",
          "This payment link is not available in this account.",
        );
      return order;
    },
    async prepare(orderId: string, userId: string) {
      let order = await Order.findOne({ _id: orderId, userId, ...scope });
      if (!order)
        throw new UploadError(
          404,
          "ORDER_NOT_FOUND",
          "That purchase was not found.",
        );
      if (order.paddleTransactionId) return order;
      const price = await paddleDeadline(
        client.prices.get(order.paddlePriceId!),
      );
      if (!validPaddlePrice(price, order))
        throw new UploadError(
          503,
          "PRICE_MISMATCH",
          "This pack’s checkout configuration needs attention. No payment has been taken.",
        );
      const claimed = await Order.findOneAndUpdate(
        {
          _id: order._id,
          userId,
          ...scope,
          checkoutState: "new",
          status: "pending",
        },
        { $set: { checkoutState: "creating" } },
        { returnDocument: "after" },
      );
      if (!claimed) {
        order = await Order.findById(order._id);
        if (order?.paddleTransactionId) return order;
        throw new UploadError(
          409,
          "CHECKOUT_PREPARING",
          "This checkout is still being prepared. Refresh purchases before trying again.",
        );
      }
      try {
        const transaction = await paddleDeadline(
          client.transactions.create({
            items: [{ priceId: claimed.paddlePriceId!, quantity: 1 }],
            currencyCode: "USD",
            collectionMode: "automatic",
            customData: {
              clipvelto_order_id: claimed._id,
              clipvelto_user_id: userId,
            },
          }),
        );
        if (!validPaddleTransaction(transaction, claimed))
          throw new Error("Unexpected checkout configuration");
        await Order.updateOne(
          {
            _id: claimed._id,
            ...scope,
            $or: [
              { paddleTransactionId: { $exists: false } },
              { paddleTransactionId: transaction.id },
            ],
          },
          {
            $set: {
              paddleTransactionId: transaction.id,
              checkoutState: "ready",
            },
          },
        );
        return (await Order.findById(claimed._id))!;
      } catch (error) {
        // Paddle has no general idempotency key: never blindly repeat a create
        // after a timeout. transaction.created can recover the original binding.
        await Order.updateOne(
          { _id: claimed._id, checkoutState: "creating" },
          { $set: { checkoutState: "uncertain" } },
        );
        logger.warn(
          {
            orderId: claimed._id,
            providerErrorCode:
              error instanceof ApiError ? error.code : "CHECKOUT_UNCONFIRMED",
          },
          "Paddle checkout creation needs reconciliation",
        );
        throw new UploadError(
          503,
          "CHECKOUT_UNCONFIRMED",
          "Checkout could not be confirmed. Refresh purchases before starting another checkout. No credits have been added.",
        );
      }
    },
    async sync(orderId: string, userId: string) {
      const order = await Order.findOne({ _id: orderId, userId, ...scope });
      if (!order)
        throw new UploadError(
          404,
          "ORDER_NOT_FOUND",
          "That purchase was not found.",
        );
      if (order.paddleTransactionId) await reconcile(order.paddleTransactionId);
      return (await Order.findById(order._id))!;
    },
    async webhook(body: Buffer, signature: string | undefined) {
      if (!env.PADDLE_WEBHOOK_SECRET)
        throw new UploadError(
          503,
          "WEBHOOK_UNAVAILABLE",
          "Payment notifications are not configured.",
        );
      let valid = false;
      try {
        valid =
          !!signature &&
          (await client.webhooks.isSignatureValid(
            body.toString("utf8"),
            env.PADDLE_WEBHOOK_SECRET,
            signature,
          ));
      } catch {
        /* Reject malformed signatures without logging payloads. */
      }
      if (!valid)
        throw new UploadError(
          400,
          "INVALID_SIGNATURE",
          "Invalid payment notification.",
        );
      let parsed;
      try {
        parsed = envelopeSchema.parse(JSON.parse(body.toString("utf8")));
      } catch {
        throw new UploadError(
          400,
          "INVALID_EVENT",
          "Invalid payment notification.",
        );
      }
      const transactionId = parsed.event_type.startsWith("transaction.")
        ? parsed.data.id
        : ["adjustment.created", "adjustment.updated"].includes(
              parsed.event_type,
            )
          ? parsed.data.transaction_id
          : undefined;
      if (transactionId) await reconcile(transactionId, parsed.event_id);
    },
  };
}
