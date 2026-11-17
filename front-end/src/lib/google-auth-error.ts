export function googleAuthError(code: string) {
  if (code === "access_denied") return "Google sign-in was cancelled. You can try again.";
  if (["account_not_linked", "email_not_verified"].includes(code)) return "Sign in with your password and verify your email first. Then you can use Google.";
  if (["state_mismatch", "state_not_found", "state_expired", "invalid_state"].includes(code)) return "Google sign-in expired. Please try again.";
  if (code === "account_already_linked_to_different_user" || code === "email_does_not_match") return "Choose the Google account that matches your Clipvelto email.";
  return "Google sign-in couldn’t finish. Try again or use email and password.";
}
