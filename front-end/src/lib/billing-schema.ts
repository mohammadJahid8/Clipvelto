import { z } from "zod";
export const orderSchema = z.object({
  _id: z.string(),
  packId: z.string(),
  packName: z.string(),
  priceCents: z.number(),
  taxMode: z.enum(["internal", "external"]).default("external"),
  credits: z.number(),
  currency: z.string(),
  mode: z.enum(["test", "live"]).default("test"),
  provider: z.enum(["mock", "paddle"]).default("mock"),
  paddleTransactionId: z.string().optional(),
  status: z.enum([
    "pending",
    "paid",
    "failed",
    "cancelled",
    "refunded",
    "review",
  ]),
  createdAt: z.string(),
});
export const billingSchema = z.object({
  mock: z.boolean(),
  checkout: z.object({
    enabled: z.boolean(),
    provider: z.enum(["disabled", "mock", "paddle"]),
    environment: z.enum(["sandbox", "live"]),
    clientToken: z.string().nullable(),
    customerEmail: z.email(),
  }),
  paymentReview: z.boolean(),
  pendingRemovals: z.number().int().nonnegative().default(0),
  credits: z.object({
    mode: z.enum(["live", "test"]),
    role: z.enum(["free", "admin"]),
    available: z.number().nullable(),
    reserved: z.number(),
    used: z.number(),
    purchased: z.number(),
  }),
  orders: z.array(orderSchema),
  ledger: z.array(
    z.object({
      _id: z.string(),
      kind: z.string(),
      reference: z.string(),
      description: z.string(),
      availableDelta: z.number(),
      reservedDelta: z.number(),
      usedDelta: z.number(),
      createdAt: z.string(),
    }),
  ),
});
export type Billing = z.infer<typeof billingSchema>;
export type BillingOrder = z.infer<typeof orderSchema>;
