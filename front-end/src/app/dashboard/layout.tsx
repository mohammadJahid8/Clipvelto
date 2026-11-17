import type { Metadata } from "next";
import { requireUser } from "@/lib/server-api";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TrialClaim } from "@/components/dashboard/trial-claim";
import "@/styles/account.css";
import "@/styles/dashboard.css";
import "@/styles/uploads.css";

export const metadata: Metadata = {
  title: "Your workspace — Clipvelto",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  alternates: { canonical: null },
};
export const dynamic = "force-dynamic";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <DashboardShell key={user.id} user={user}>
      <TrialClaim />
      {children}
    </DashboardShell>
  );
}
