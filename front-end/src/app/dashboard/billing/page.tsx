import type { Metadata } from "next";
import { getBilling } from "@/lib/server-api";
import { BillingWorkspace } from "@/components/billing/billing-workspace";
export const metadata: Metadata = { title: "Credits & billing — Clipvelto" };
export default async function BillingPage() {
  return <BillingWorkspace initial={await getBilling()} />;
}
