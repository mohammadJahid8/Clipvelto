import { emailSchema } from "./form-schemas";

const key = "clipvelto-verification-email";
export function rememberVerificationEmail(email: string) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ email, kind: "otp", expires: Date.now() + 3600000 }),
    );
  } catch {
    /* The standalone form remains available. */
  }
  window.dispatchEvent(new Event("verification-email-change"));
}
export function pendingVerificationEmail() {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null") as {
      email?: unknown;
      kind?: string;
      expires?: number;
    } | null;
    if (!value || value.kind !== "otp" || !value.expires || value.expires < Date.now()) return "";
    const parsed = emailSchema.safeParse(value.email);
    return parsed.success ? parsed.data : "";
  } catch {
    return "";
  }
}
export function subscribeVerificationEmail(callback: () => void) {
  window.addEventListener("verification-email-change", callback);
  return () =>
    window.removeEventListener("verification-email-change", callback);
}
export function clearVerificationEmail() {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Storage is optional. */
  }
  window.dispatchEvent(new Event("verification-email-change"));
}
