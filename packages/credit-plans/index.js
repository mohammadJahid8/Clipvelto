export const creditPolicy = Object.freeze({
  version: "2026-11-17-exclusive",
  secondsPerCredit: 60,
  freeCredits: 15,
  minimumJobCredits: 1,
  storageCreditsPerGb: 2,
  retentionDays: 30,
  currency: "USD",
  taxMode: "external",
});
export const creditPacks = Object.freeze([
  Object.freeze({
    id: "starter",
    name: "Starter",
    priceCents: 600,
    credits: 120,
    description: "For occasional videos",
    recommended: false,
  }),
  Object.freeze({
    id: "creator",
    name: "Creator",
    priceCents: 1500,
    credits: 360,
    description: "For a regular posting routine",
    recommended: true,
  }),
  Object.freeze({
    id: "studio",
    name: "Studio",
    priceCents: 3200,
    credits: 900,
    description: "For a larger video library",
    recommended: false,
  }),
]);
export function processingQuote(durationSeconds, sizeBytes = 0) {
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0 ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 0
  )
    throw new Error("Invalid quote inputs");
  const processingSeconds = Math.max(60, Math.ceil(durationSeconds));
  const storageSeconds = Math.ceil(
    (sizeBytes / 1e9) * creditPolicy.storageCreditsPerGb * 60,
  );
  const seconds = Math.max(processingSeconds, storageSeconds);
  if (!Number.isSafeInteger(seconds))
    throw new Error("Quote exceeds safe accounting range");
  return {
    seconds,
    credits: seconds / 60,
    processingSeconds,
    storageSeconds,
    storageExtraSeconds: seconds - processingSeconds,
    policyVersion: creditPolicy.version,
  };
}
