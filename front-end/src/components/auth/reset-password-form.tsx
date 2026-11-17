"use client";

import { ClientForm } from "@/components/ui/client-form";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/form-schemas";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "./submit-button";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
  });
  if (!token)
    return (
      <>
        <h1>A fresh link, please.</h1>
        <p className="auth-intro">
          This reset link is missing, invalid, or expired. Request another link
          to reset your password.
        </p>
        <Link className="button button-primary" href="/forgot-password">
          Request a new reset link
        </Link>
      </>
    );
  if (done)
    return (
      <>
        <h1>Fresh start. Same you.</h1>
        <p className="form-success" role="status">
          Your password has been reset and previous sessions have been signed
          out.
        </p>
        <Link className="button button-primary" href="/sign-in">
          Sign in with your new password
        </Link>
      </>
    );
  return (
    <>
      <h1>Choose a new password.</h1>
      <p className="auth-intro">Make it memorable to you and hard to guess.</p>
      <ClientForm
        noValidate
        className="account-form"
        onSubmit={handleSubmit(async ({ password }) => {
          setError("");
          try {
            const result = await authClient.resetPassword({
              token,
              newPassword: password,
            });
            if (result.error) {
              setError(
                "We couldn’t reset your password. The link may have expired or already been used. Request a new link and try again.",
              );
              return;
            }
            setDone(true);
          } catch {
            setError("We couldn’t connect. Please try again shortly.");
          }
        })}
      >
        <FormField
          label="New password"
          type="password"
          autoComplete="new-password"
          maxLength={128}
          hint="Use 12–128 characters."
          {...register("password")}
          error={errors.password?.message}
        />
        <FormField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          maxLength={128}
          {...register("confirmPassword")}
          error={errors.confirmPassword?.message}
        />
        {error && (
          <p className="form-alert" role="alert">
            {error} <Link href="/forgot-password">Get a new link.</Link>
          </p>
        )}
        <SubmitButton pending={isSubmitting}>Reset password</SubmitButton>
      </ClientForm>
    </>
  );
}
