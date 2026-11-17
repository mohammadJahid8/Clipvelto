import type { Metadata } from "next";
import { EmailForm } from "@/components/auth/email-form";

export const metadata: Metadata = { title: "Reset your password — Clipvelto" };
export default function ForgotPasswordPage() {
  return <EmailForm mode="reset" />;
}
