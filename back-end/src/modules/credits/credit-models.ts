import { Schema, type Connection, type Model } from "mongoose";

const legacyAccountSchema = new Schema(
  {
    _id: { type: String, required: true },
    role: { type: String, enum: ["free", "admin"], default: "free" },
    availableSeconds: { type: Number, default: 900 },
    reservedSeconds: { type: Number, default: 0 },
    usedSeconds: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

const walletSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, immutable: true },
    mode: {
      type: String,
      enum: ["live", "test"],
      required: true,
      immutable: true,
    },
    availableSeconds: { type: Number, required: true, min: 0 },
    reservedSeconds: { type: Number, required: true, min: 0 },
    usedSeconds: { type: Number, required: true, min: 0 },
    grantedSeconds: { type: Number, required: true, min: 0 },
    paymentRevision: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);
walletSchema.index({ userId: 1, mode: 1 }, { unique: true });

const grantSchema = new Schema(
  {
    _id: { type: String, required: true },
    walletId: { type: String, required: true, immutable: true },
    userId: { type: String, required: true, immutable: true },
    mode: {
      type: String,
      enum: ["live", "test"],
      required: true,
      immutable: true,
    },
    source: {
      type: String,
      enum: ["opening", "purchase"],
      required: true,
      immutable: true,
    },
    seconds: { type: Number, required: true, immutable: true },
    remainingSeconds: { type: Number, required: true, min: 0 },
    reservedSeconds: { type: Number, required: true, default: 0, min: 0 },
    consumedSeconds: { type: Number, required: true, default: 0, min: 0 },
    reversed: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);
grantSchema.index({ walletId: 1, createdAt: 1, _id: 1 });

const reservationSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    videoId: String,
    mode: { type: String, enum: ["live", "test"] },
    seconds: { type: Number, required: true },
    state: {
      type: String,
      enum: ["held", "spent", "refunded", "exempt"],
      required: true,
    },
    reason: String,
    policyVersion: String,
    revision: { type: Number, default: 0 },
    allocations: {
      type: [
        new Schema(
          {
            grantId: { type: String, required: true },
            seconds: { type: Number, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true, versionKey: false },
);
reservationSchema.index({ userId: 1, mode: 1, createdAt: -1 });

const ledgerSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, immutable: true },
    walletId: { type: String, required: true, immutable: true },
    mode: {
      type: String,
      enum: ["live", "test"],
      required: true,
      immutable: true,
    },
    kind: {
      type: String,
      enum: [
        "opening",
        "purchase",
        "reserve",
        "consume",
        "release",
        "refund",
        "exempt",
      ],
      required: true,
      immutable: true,
    },
    availableDelta: { type: Number, required: true, immutable: true },
    reservedDelta: { type: Number, required: true, immutable: true },
    usedDelta: { type: Number, required: true, immutable: true },
    reference: { type: String, required: true, immutable: true },
    description: {
      type: String,
      required: true,
      maxlength: 200,
      immutable: true,
    },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false, strict: "throw" },
);
ledgerSchema.index({ walletId: 1, createdAt: -1, _id: -1 });

export function creditModels(connection: Connection) {
  function model<T>(name: string, schema: Schema<T>): Model<T> {
    return (
      (connection.models[name] as Model<T> | undefined) ??
      connection.model<T>(name, schema)
    );
  }
  return {
    Account: model("CreditAccount", legacyAccountSchema),
    Wallet: model("CreditWallet", walletSchema),
    Grant: model("CreditGrant", grantSchema),
    Reservation: model("CreditReservation", reservationSchema),
    Ledger: model("CreditLedger", ledgerSchema),
  };
}
