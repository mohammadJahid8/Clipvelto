"use client";

import { ClientForm } from "@/components/ui/client-form";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { User } from "@/lib/server-api";
import { authClient } from "@/lib/auth-client";
import { nameSchema, emailSchema, passwordSchema } from "@/lib/form-schemas";
import { FormField } from "@/components/ui/form-field";
import { UserAvatar } from "@/components/ui/user-avatar";

const profileSchema = z.object({ name: nameSchema });
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Your passwords don’t match.",
  });

export function SettingsForms({ user }: { user: User }) {
  return (
    <div className="settings-stack">
      <ProfileForm user={user} />
      <ChangeEmailForm email={user.email} />
      <ChangePasswordForm />
      <SessionControls />
    </div>
  );
}

function ProfileForm({ user }: { user: User }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name },
  });
  return (
    <section className="settings-panel">
      <div className="settings-panel-heading">
        <h2>Your profile</h2>
      </div>
      <div className="profile-identity">
        <UserAvatar name={user.name} image={user.image} size="profile" />
        <div>
          <strong>{user.name}</strong>
          <p>{user.email}</p>
        </div>
      </div>
      <ClientForm
        noValidate
        className="settings-form"
        onSubmit={handleSubmit(async ({ name }) => {
          setMessage("");
          setError("");
          try {
            const result = await authClient.updateUser({ name });
            if (result.error) {
              setError("We couldn’t update your profile. Please try again.");
              return;
            }
            setMessage("Your profile has been updated.");
            router.refresh();
          } catch {
            setError("We couldn’t connect. Please try again.");
          }
        })}
      >
        <FormField
          label="Your name"
          autoComplete="name"
          maxLength={80}
          {...register("name")}
          error={errors.name?.message}
        />
        <FormMessage message={message} error={error} />
        <SaveButton pending={isSubmitting}>Save changes</SaveButton>
      </ClientForm>
    </section>
  );
}

function ChangeEmailForm({ email }: { email: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<"email" | "current" | "new">("email");
  const [nextEmail, setNextEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="settings-panel">
      <div className="settings-panel-heading">
        <h2>Email address</h2>
        <p>
          Currently signed in as <strong>{email}</strong>.
        </p>
        <p>Confirm your current and new email with a code.</p>
      </div>
      <ClientForm
        className="settings-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setError("");
          setMessage("");
          const parsed = emailSchema.safeParse(nextEmail.trim());
          if (
            !parsed.success ||
            parsed.data.toLowerCase() === email.toLowerCase()
          ) {
            setError("Enter a different valid email address.");
            return;
          }
          if (stage !== "email" && !/^\d{6}$/.test(otp)) {
            setError("Enter the 6-digit code.");
            return;
          }
          setBusy(true);
          try {
            const result =
              stage === "email"
                ? await authClient.emailOtp.sendVerificationOtp({
                    email,
                    type: "email-verification",
                  })
                : stage === "current"
                  ? await authClient.emailOtp.requestEmailChange({
                      newEmail: parsed.data,
                      otp,
                    })
                  : await authClient.emailOtp.changeEmail({
                      newEmail: parsed.data,
                      otp,
                    });
            if (result.error) {
              setError(
                result.error.status === 429
                  ? "Please wait before trying again."
                  : "Couldn’t confirm this change. Check your code or start again.",
              );
              return;
            }
            setOtp("");
            if (stage === "email") {
              setNextEmail(parsed.data);
              setStage("current");
            } else if (stage === "current") setStage("new");
            else {
              setStage("email");
              setNextEmail("");
              setMessage("Email updated.");
              router.refresh();
            }
          } catch {
            setError("Couldn’t connect. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {stage === "email" ? (
          <FormField
            label="New email address"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            disabled={busy}
            value={nextEmail}
            onChange={(event) => setNextEmail(event.target.value)}
          />
        ) : (
          <>
            <p role="status">
              Enter the code sent to{" "}
              <strong>{stage === "current" ? email : nextEmail}</strong>. It
              expires in 5 minutes.
            </p>
            <FormField
              key={stage}
              label="Verification code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              disabled={busy}
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </>
        )}
        <FormMessage message={message} error={error} />
        <SaveButton pending={busy}>
          {stage === "email"
            ? "Send code"
            : stage === "current"
              ? "Continue"
              : "Confirm new email"}
        </SaveButton>
        {stage !== "email" && (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setStage("email");
              setOtp("");
              setError("");
            }}
          >
            Start again
          </button>
        )}
      </ClientForm>
    </section>
  );
}

function ChangePasswordForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
  });
  return (
    <section className="settings-panel">
      <div className="settings-panel-heading">
        <h2>Password</h2>
        <p>
          Choose a strong passphrase. Changing it also signs out your other
          sessions.
        </p>
      </div>
      <ClientForm
        noValidate
        className="settings-form"
        onSubmit={handleSubmit(async (values) => {
          setMessage("");
          setError("");
          try {
            const result = await authClient.changePassword({
              currentPassword: values.currentPassword,
              newPassword: values.newPassword,
              revokeOtherSessions: true,
            });
            if (result.error) {
              setError(
                "We couldn’t change your password. Check your current password and try again.",
              );
              return;
            }
            setMessage(
              "Your password has been changed and other sessions have been signed out.",
            );
            reset();
          } catch {
            setError("We couldn’t connect. Please try again.");
          }
        })}
      >
        <FormField
          label="Current password"
          type="password"
          autoComplete="current-password"
          {...register("currentPassword")}
          error={errors.currentPassword?.message}
        />
        <FormField
          label="New password"
          type="password"
          autoComplete="new-password"
          maxLength={128}
          hint="Use 12–128 characters."
          {...register("newPassword")}
          error={errors.newPassword?.message}
        />
        <FormField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          maxLength={128}
          {...register("confirmPassword")}
          error={errors.confirmPassword?.message}
        />
        <FormMessage message={message} error={error} />
        <SaveButton pending={isSubmitting}>Update password</SaveButton>
      </ClientForm>
    </section>
  );
}

function SessionControls() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="settings-panel">
      <div className="settings-panel-heading">
        <h2>Other sessions</h2>
        <p>
          Signed in on another device? End those sessions and keep this one
          active.
        </p>
      </div>
      <div className="settings-form">
        <FormMessage message={message} error={error} />
        <button
          type="button"
          className="button button-secondary"
          disabled={pending}
          aria-busy={pending}
          onClick={async () => {
            setPending(true);
            setMessage("");
            setError("");
            try {
              const result = await authClient.revokeOtherSessions();
              if (result.error)
                setError("We couldn’t end those sessions. Please try again.");
              else setMessage("Other sessions have been signed out.");
            } catch {
              setError("We couldn’t connect. Please try again.");
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "Signing out…" : "Sign out other sessions"}
        </button>
      </div>
    </section>
  );
}

function FormMessage({ message, error }: { message: string; error: string }) {
  return (
    <>
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
function SaveButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      className="button button-primary"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}
