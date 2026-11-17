import { Schema, type Connection } from "mongoose";

const trialSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    ipHash: { type: String, required: true },
    videoId: { type: Schema.Types.ObjectId, required: true },
    expiresAt: { type: Date, required: true },
    claimedBy: String,
    claimedAt: Date,
    allowanceSeconds: { type: Number, default: 180 },
  },
  { timestamps: true, versionKey: false },
);
trialSchema.index({ ipHash: 1, createdAt: -1 });
trialSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 86400 });
const gateSchema = new Schema(
  { _id: String, nextAllowedAt: Date },
  { versionKey: false },
);
gateSchema.index({ nextAllowedAt: 1 }, { expireAfterSeconds: 0 });
const budgetSchema = new Schema(
  { _id: String, seconds: { type: Number, default: 0 }, expiresAt: Date },
  { versionKey: false },
);
budgetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export function trialModels(connection: Connection) {
  return {
    Trial: connection.model("GuestTrial", trialSchema),
    Gate: connection.model("GuestTrialGate", gateSchema),
    Budget: connection.model("GuestTrialBudget", budgetSchema),
  };
}
