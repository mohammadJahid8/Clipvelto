"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ClientForm } from "@/components/ui/client-form";
import { FormField } from "@/components/ui/form-field";
import { authClient } from "@/lib/auth-client";
import { signInSchema, signUpSchema } from "@/lib/form-schemas";
import {
  clearVerificationEmail,
  rememberVerificationEmail,
  pendingVerificationEmail,
} from "@/lib/pending-verification";
import { EmailCodeForm } from "./email-code-form";
import { SubmitButton } from "./submit-button";
import { GoogleSignInButton } from "./google-sign-in-button";
import { googleAuthError } from "@/lib/google-auth-error";

export type AuthStep = "sign-in" | "sign-up" | "verify" | "reset";
export const authTitles: Record<AuthStep, string> = {
  "sign-up": "Create your account.",
  "sign-in": "Welcome back.",
  verify: "Verify your email.",
  reset: "Reset your password.",
};

export function AccountForm({
  mode,
  embedded = false,
  initialEmail = "",
  verified = false,
  verificationError = false,
  oauthError,
  onStepChange,
}: {
  mode: AuthStep;
  embedded?: boolean;
  initialEmail?: string;
  verified?: boolean;
  verificationError?: boolean;
  oauthError?: string;
  onStepChange?: (step: AuthStep) => void;
}) {
  const [step, setStep] = useState<AuthStep>(mode);
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState(
    verified
      ? "Email verified. Sign in."
      : verificationError
        ? "Request a new code to verify your email."
        : "",
  );
  const [codeSent, setCodeSent] = useState(mode === "verify" && !!initialEmail);
  const [verificationBack, setVerificationBack] = useState<
    "sign-in" | "sign-up"
  >(mode === "sign-up" ? "sign-up" : "sign-in");
  // Passwords stay in memory only and are discarded on navigation between steps/unmount.
  const password = useRef("");
  useEffect(() => {
    const pending = pendingVerificationEmail();
    if (
      (mode === "sign-up" || mode === "verify") &&
      pending &&
      (!initialEmail || initialEmail === pending)
    ) {
      setEmail(pending);
      setCodeSent(true);
      setStep("verify");
    }
  }, [mode, initialEmail]);
  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);
  useEffect(
    () => () => {
      password.current = "";
    },
    [],
  );
  function switchStep(next: AuthStep, nextEmail = email) {
    password.current = "";
    setEmail(nextEmail);
    setMessage("");
    setCodeSent(false);
    setStep(next);
  }
  function finish() {
    password.current = "";
    clearVerificationEmail();
    window.location.replace("/dashboard");
  }
  async function verificationNeeded(
    nextEmail: string,
    nextPassword: string,
    from: "sign-in" | "sign-up",
  ) {
    const sent = await authClient.emailOtp.sendVerificationOtp({
      email: nextEmail,
      type: "email-verification",
    });
    if (sent.error)
      throw Error(
        sent.error.status === 429
          ? "Please wait a minute before requesting another code."
          : "Couldn’t send a code. Please try again.",
      );
    rememberVerificationEmail(nextEmail);
    setEmail(nextEmail);
    setVerificationBack(from);
    password.current = nextPassword;
    setCodeSent(true);
    setMessage("");
    setStep("verify");
  }
  return (
    <>
      {!embedded && <h1>{authTitles[step]}</h1>}
      {oauthError && (
        <p className="form-alert" role="alert">
          {googleAuthError(oauthError)}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      {step === "sign-up" && (
        <SignUpForm
          initialEmail={email}
          onSignIn={(nextEmail) => switchStep("sign-in", nextEmail)}
          onVerify={(nextEmail, nextPassword) =>
            verificationNeeded(nextEmail, nextPassword, "sign-up")
          }
        />
      )}
      {step === "sign-in" && (
        <SignInForm
          initialEmail={email}
          onSignUp={(nextEmail) => switchStep("sign-up", nextEmail)}
          onReset={(nextEmail) => switchStep("reset", nextEmail)}
          onVerify={(nextEmail, nextPassword) =>
            verificationNeeded(nextEmail, nextPassword, "sign-in")
          }
          onComplete={finish}
        />
      )}
      {(step === "verify" || step === "reset") && (
        <EmailCodeForm
          key={step}
          purpose={step}
          initialEmail={email}
          alreadySent={codeSent}
          onChangeEmail={
            step === "verify"
              ? (nextEmail) => {
                  clearVerificationEmail();
                  switchStep(verificationBack, nextEmail);
                }
              : undefined
          }
          onBack={(nextEmail) => switchStep("sign-in", nextEmail)}
          onDone={async (nextEmail) => {
            if (step === "verify" && password.current) {
              const savedPassword = password.current;
              password.current = "";
              const result = await authClient.signIn.email({
                email: nextEmail,
                password: savedPassword,
              });
              if (!result.error) {
                finish();
                return;
              }
            }
            switchStep("sign-in", nextEmail);
            clearVerificationEmail();
            setMessage(
              step === "reset"
                ? "Password updated. Sign in."
                : "Email verified. Sign in.",
            );
          }}
        />
      )}
    </>
  );
}

type CredentialsCallbacks = {
  initialEmail: string;
  onComplete: () => void;
  onVerify: (email: string, password: string) => Promise<void>;
};
function SignUpForm({
  initialEmail,
  onVerify,
  onSignIn,
}: Omit<CredentialsCallbacks, "onComplete"> & {
  onSignIn: (email: string) => void;
}) {
  const [error, setError] = useState("");
  const [socialPending, setSocialPending] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: initialEmail },
  });
  return (
    <>
      <ClientForm
        noValidate
        className="account-form"
        onSubmit={handleSubmit(async (values) => {
          setError("");
          try {
            const created = await authClient.signUp.email(values);
            if (created.error) {
              setError(
                created.error.code === "EMAIL_ALREADY_REGISTERED"
                  ? "An account with this email already exists. Please sign in."
                  : created.error.status === 429
                    ? "Too many attempts. Try again in a minute."
                    : "Couldn’t create an account. Check your details or sign in.",
              );
              return;
            }
            await onVerify(values.email, values.password);
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Couldn’t connect. Please try again.",
            );
          }
        })}
      >
        <GoogleSignInButton
          disabled={isSubmitting}
          onPendingChange={setSocialPending}
        />
        <FormField
          label="Your name"
          autoFocus
          autoComplete="name"
          maxLength={80}
          disabled={isSubmitting || socialPending}
          {...register("name")}
          error={errors.name?.message}
        />
        <FormField
          label="Email address"
          type="email"
          autoComplete="email"
          maxLength={254}
          disabled={isSubmitting || socialPending}
          {...register("email")}
          error={errors.email?.message}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters."
          maxLength={128}
          disabled={isSubmitting || socialPending}
          {...register("password")}
          error={errors.password?.message}
        />
        {error && (
          <p role="alert" className="form-alert">
            {error}
          </p>
        )}
        <SubmitButton pending={isSubmitting || socialPending}>
          Create account
        </SubmitButton>
      </ClientForm>
      <p className="auth-switch">
        Already have an account?{" "}
        <button
          type="button"
          className="text-button"
          disabled={isSubmitting || socialPending}
          onClick={() => onSignIn(getValues("email"))}
        >
          Sign in
        </button>
      </p>
      <p className="auth-small-print">
        15 free minutes, including your preview. No card needed.
      </p>
      <p className="auth-small-print">
        By creating an account, you agree to our{" "}
        <Link href="/terms">Terms</Link> and acknowledge our{" "}
        <Link href="/privacy">Privacy policy</Link>.
      </p>
    </>
  );
}

function SignInForm({
  initialEmail,
  onComplete,
  onVerify,
  onSignUp,
  onReset,
}: CredentialsCallbacks & {
  onSignUp: (email: string) => void;
  onReset: (email: string) => void;
}) {
  const [error, setError] = useState("");
  const [socialPending, setSocialPending] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: initialEmail },
  });
  return (
    <>
      <ClientForm
        noValidate
        className="account-form"
        onSubmit={handleSubmit(async (values) => {
          setError("");
          try {
            const result = await authClient.signIn.email(values);
            if (!result.error) {
              onComplete();
              return;
            }
            if (result.error.code === "EMAIL_NOT_VERIFIED") {
              await onVerify(values.email, values.password);
              return;
            }
            setError(
              result.error.status === 429
                ? "Too many attempts. Try again in a minute."
                : "Check your email and password.",
            );
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Couldn’t connect. Please try again.",
            );
          }
        })}
      >
        <GoogleSignInButton
          disabled={isSubmitting}
          onPendingChange={setSocialPending}
        />
        <FormField
          label="Email address"
          autoFocus
          type="email"
          autoComplete="email"
          maxLength={254}
          disabled={isSubmitting || socialPending}
          {...register("email")}
          error={errors.email?.message}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          disabled={isSubmitting || socialPending}
          {...register("password")}
          error={errors.password?.message}
        />
        <button
          type="button"
          className="text-button form-inline-link"
          disabled={isSubmitting || socialPending}
          onClick={() => onReset(getValues("email"))}
        >
          Forgot password?
        </button>
        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        <SubmitButton pending={isSubmitting || socialPending}>
          Sign in
        </SubmitButton>
      </ClientForm>
      <p className="auth-switch">
        New here?{" "}
        <button
          type="button"
          className="text-button"
          disabled={isSubmitting || socialPending}
          onClick={() => onSignUp(getValues("email"))}
        >
          Create account
        </button>
      </p>
    </>
  );
}
