"use client";

import { useEffect, useState } from "react";
import { ClientForm } from "@/components/ui/client-form";
import { FormField } from "@/components/ui/form-field";
import { authClient } from "@/lib/auth-client";
import { emailSchema, passwordSchema } from "@/lib/form-schemas";
import { rememberVerificationEmail } from "@/lib/pending-verification";
import { SubmitButton } from "./submit-button";
import { AuthMailNotice } from "./auth-mail-notice";

export function EmailCodeForm({ purpose, initialEmail, alreadySent, onBack, onDone, onChangeEmail }: {
  purpose: "verify" | "reset"; initialEmail: string; alreadySent: boolean;
  onBack: (email: string) => void; onDone: (email: string) => Promise<void>;
  onChangeEmail?: (email: string) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(alreadySent);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remaining, setRemaining] = useState(alreadySent ? 60 : 0);
  useEffect(() => {
    if (!remaining) return;
    const timer = setTimeout(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);
  async function send() {
    if (busy || remaining) return;
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) { setError("Enter a valid email address."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = purpose === "reset"
        ? await authClient.emailOtp.requestPasswordReset({ email: parsed.data })
        : await authClient.emailOtp.sendVerificationOtp({ email: parsed.data, type: "email-verification" });
      if (result.error) { setError(result.error.status === 429 ? "Please wait before requesting another code." : "Couldn’t send a code. Please try again."); return; }
      setEmail(parsed.data); setSent(true); setOtp(""); setRemaining(60);
      setNotice("If this account is eligible, a code is on its way.");
      if (purpose === "verify") rememberVerificationEmail(parsed.data);
    } catch { setError("Couldn’t connect. Please try again."); }
    finally { setBusy(false); }
  }
  return <>
    <p className="auth-intro">{sent ? <>Enter the 6-digit code sent to <strong className="auth-code-email">{email}</strong>. It expires in 5 minutes.</> : "Enter your email to receive a 6-digit code."}</p>
    <AuthMailNotice />
    <ClientForm className="account-form" onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      if (!sent) { await send(); return; }
      setError(""); setNotice("");
      if (!/^\d{6}$/.test(otp)) { setError("Enter the 6-digit code."); return; }
      if (purpose === "reset") {
        const parsed = passwordSchema.safeParse(password);
        if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Use at least 12 characters."); return; }
        if (password !== confirm) { setError("Your passwords don’t match."); return; }
      }
      setBusy(true);
      try {
        const result = purpose === "reset"
          ? await authClient.emailOtp.resetPassword({ email, otp, password })
          : await authClient.emailOtp.verifyEmail({ email, otp });
        if (result.error) {
          setError(result.error.status === 429 ? "Too many attempts. Try again in a minute." : result.error.code === "TOO_MANY_ATTEMPTS" ? "Too many attempts. Request a new code." : "This code is invalid or expired. Use the latest code.");
          return;
        }
        setOtp(""); setPassword(""); setConfirm("");
        await onDone(email);
      } catch { setError("Couldn’t connect. Please try again."); }
      finally { setBusy(false); }
    }}>
      {!sent ? <FormField label="Email address" type="email" autoComplete="email" maxLength={254} required autoFocus disabled={busy} value={email} onChange={event => setEmail(event.target.value)} /> : <>
        <FormField label="Verification code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus disabled={busy} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} />
        {purpose === "reset" && <>
          <FormField label="New password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} hint="At least 12 characters." value={password} onChange={event => setPassword(event.target.value)} />
          <FormField label="Confirm password" type="password" autoComplete="new-password" maxLength={128} required disabled={busy} value={confirm} onChange={event => setConfirm(event.target.value)} />
        </>}
      </>}
      {notice && <p className="auth-code-notice" role="status">{notice}</p>}
      {error && <p className="form-alert" role="alert">{error}</p>}
      <SubmitButton pending={busy}>{!sent ? "Send code" : purpose === "reset" ? "Reset password" : "Verify email"}</SubmitButton>
    </ClientForm>
    {sent && <div className="auth-code-actions">
      <button type="button" className="text-button" disabled={busy || remaining > 0} onClick={() => void send()}>{remaining > 0 ? `Resend in ${remaining}s` : "Resend code"}</button>
      <button type="button" className="text-button" disabled={busy} onClick={() => { if (onChangeEmail) { onChangeEmail(email); return; } setSent(false); setOtp(""); setError(""); setNotice(""); setRemaining(0); }}>Change email</button>
    </div>}
    <p className="auth-switch"><button type="button" className="text-button" disabled={busy} onClick={() => onBack(email)}>Back to sign in</button></p>
  </>;
}
