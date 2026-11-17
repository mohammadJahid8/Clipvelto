import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";

const orderSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, immutable: true },
    mode: {
      type: String,
      enum: ["test", "live"],
      required: true,
      immutable: true,
    },
    provider: {
      type: String,
      enum: ["mock", "paddle"],
      default: "mock",
      immutable: true,
    },
    providerEnvironment: {
      type: String,
      enum: ["sandbox", "live"],
      immutable: true,
    },
    requestId: { type: String, required: true, immutable: true },
    packId: {
      type: String,
      enum: ["starter", "creator", "studio"],
      required: true,
      immutable: true,
    },
    packName: { type: String, required: true, immutable: true },
    priceCents: { type: Number, required: true, immutable: true },
    // Missing on legacy orders, which added tax on top. New orders snapshot
    // the current policy so reconciliation never rewrites a past purchase.
    taxMode: {
      type: String,
      enum: ["internal", "external"],
      default: "external",
      immutable: true,
    },
    credits: { type: Number, required: true, immutable: true },
    currency: { type: String, required: true, immutable: true },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled", "refunded", "review"],
      default: "pending",
    },
    checkoutState: {
      type: String,
      enum: ["new", "creating", "ready", "uncertain"],
      default: "new",
    },
    paddlePriceId: { type: String, immutable: true },
    paddleTransactionId: String,
    lastCheckedAt: Date,
    paidAt: Date,
    refundedAt: Date,
  },
  { timestamps: true, versionKey: false },
);
orderSchema.index({ userId: 1, mode: 1, requestId: 1 }, { unique: true });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({
  provider: 1,
  providerEnvironment: 1,
  status: 1,
  lastCheckedAt: 1,
});
orderSchema.index(
  { providerEnvironment: 1, paddleTransactionId: 1 },
  {
    unique: true,
    partialFilterExpression: { paddleTransactionId: { $type: "string" } },
  },
);

export function billingOrderModel(connection: Connection): Model<BillingOrder> {
  return (
    (connection.models.BillingOrder as
      Model<InferSchemaType<typeof orderSchema>> | undefined) ??
    connection.model<BillingOrder>("BillingOrder", orderSchema)
  );
}
export type BillingOrder = InferSchemaType<typeof orderSchema>;
