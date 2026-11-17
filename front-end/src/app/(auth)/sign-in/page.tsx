import type { Metadata } from "next";
import { AccountForm } from "@/components/auth/account-form";

export const metadata: Metadata = { title: "Sign in — Clipvelto" };
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AccountForm
      mode="sign-in"
      verified={params.verified === "1"}
      verificationError={!!params.error}
    />
  );
}
