import type { Connection } from "mongoose";

// Private approvals are provisioned operationally, never from an API request.
// Retain redeemed approvals so late webhooks/refunds can verify old purchases.
export interface BillingDiscountApproval {
  _id: string; // environment:discount ID
  discountId: string;
  environment: "sandbox" | "live";
  priceId: string;
  percent: number;
  userIds: string[];
  expiresAt: Date;
  redeemedOrderId?: string;
}

export function billingDiscounts(connection: Connection) {
  return connection.db!.collection<BillingDiscountApproval>("billing_discounts");
}
