import { Router } from "express";
import { z } from "zod";
import { creditPacks, creditPolicy } from "@clipvelto/credit-plans";
import type { createBillingService } from "./billing-service.js";
import type { CreditService } from "../credits/credit-service.js";
import { UploadError } from "../uploads/upload-error.js";

export function billingRoutes(
  billing: ReturnType<typeof createBillingService>,
  credits: CreditService,
) {
  const router = Router();
  router.get("/billing", async (_req, res) => {
    const userId = res.locals.session.user.id as string;
    const [balance, ledger, history, orders, pendingRemovals] =
      await Promise.all([
        credits.summary(userId),
        credits.ledgerHistory(userId),
        credits.history(userId),
        billing.history(userId),
        billing.pendingRemovals(userId),
      ]);
    res.json({
      credits: balance,
      ledger,
      history,
      orders,
      pendingRemovals,
      packs: creditPacks,
      policy: creditPolicy,
      mock: billing.mock,
      checkout: {
        ...billing.checkout,
        customerEmail: res.locals.session.user.email,
      },
      paymentReview: await billing.holds.active(userId),
    });
  });
  router.post("/billing/orders", async (req, res) => {
    const input = z
      .object({
        packId: z.enum(["starter", "creator", "studio"]),
        requestId: z.uuid(),
      })
      .strict()
      .safeParse(req.body);
    if (!input.success)
      throw new UploadError(
        400,
        "INVALID_CHECKOUT",
        "Choose a credit pack and start a new checkout.",
      );
    await credits.allowSubmit(res.locals.session.user.id);
    const order = await billing.create(
      res.locals.session.user.id,
      input.data.packId,
      input.data.requestId,
    );
    res.status(order.status === "pending" ? 201 : 200).json({ order });
  });
  router.post("/billing/orders/:id/simulate", async (req, res) => {
    const input = z
      .object({ action: z.enum(["success", "failure", "cancel", "refund"]) })
      .strict()
      .safeParse(req.body);
    if (!input.success || !/^test_[a-f0-9-]{36}$/.test(String(req.params.id)))
      throw new UploadError(
        400,
        "INVALID_TEST_PAYMENT",
        "Choose a valid test payment action.",
      );
    await credits.allowSubmit(res.locals.session.user.id);
    const order = await billing.simulate(
      res.locals.session.user.id,
      String(req.params.id),
      input.data.action,
    );
    res.json({
      order,
      credits: await credits.summary(res.locals.session.user.id),
    });
  });
  router.post("/billing/orders/:id/sync", async (req, res) => {
    const id = String(req.params.id);
    if (!/^paddle_[a-f0-9-]{36}$/.test(id))
      throw new UploadError(400, "INVALID_ORDER", "Choose a valid purchase.");
    if (!billing.paddle)
      throw new UploadError(
        503,
        "CHECKOUT_UNAVAILABLE",
        "Paddle checkout is not enabled.",
      );
    const userId = res.locals.session.user.id as string;
    await credits.allowSubmit(userId);
    const order = await billing.paddle.sync(id, userId);
    res.json({ order });
  });
  router.get("/billing/paddle/:transactionId", async (req, res) => {
    const id = String(req.params.transactionId);
    if (!/^txn_[a-z0-9]{26}$/.test(id))
      throw new UploadError(
        400,
        "INVALID_TRANSACTION",
        "Invalid payment link.",
      );
    if (!billing.paddle)
      throw new UploadError(
        503,
        "CHECKOUT_UNAVAILABLE",
        "Paddle checkout is not enabled.",
      );
    res.json({
      order: await billing.paddle.ownedTransaction(
        id,
        res.locals.session.user.id,
      ),
    });
  });
  return router;
}
