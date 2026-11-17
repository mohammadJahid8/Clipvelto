import type { Metadata } from "next";
import { AccountForm } from "@/components/auth/account-form";

export const metadata: Metadata = { title: "Create an account — Clipvelto" };
export default function SignUpPage() {
  return <AccountForm mode="sign-up" />;
}
