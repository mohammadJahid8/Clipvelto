export type CreditPackId = "starter" | "creator" | "studio";
export type CreditPack = Readonly<{
  id: CreditPackId;
  name: string;
  priceCents: number;
  credits: number;
  description: string;
  recommended: boolean;
}>;
export const creditPolicy: Readonly<{
  version: string;
  secondsPerCredit: number;
  freeCredits: number;
  minimumJobCredits: number;
  storageCreditsPerGb: number;
  retentionDays: number;
  currency: string;
  taxMode: "external";
}>;
export const creditPacks: readonly CreditPack[];
export function processingQuote(
  durationSeconds: number,
  sizeBytes?: number,
): {
  seconds: number;
  credits: number;
  processingSeconds: number;
  storageSeconds: number;
  storageExtraSeconds: number;
  policyVersion: string;
};
