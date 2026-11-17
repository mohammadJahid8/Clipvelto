import type { Metadata } from "next";
import { EmailForm } from "@/components/auth/email-form";

export const metadata: Metadata = { title: "Verify your email — Clipvelto" };
export default function VerifyEmailPage() {
  return <EmailForm mode="verify" />;
}
