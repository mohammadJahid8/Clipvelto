"use client";

import { useSyncExternalStore } from "react";
import { AccountForm } from "./account-form";
import { pendingVerificationEmail } from "@/lib/pending-verification";

const subscribe = () => () => {};
export function EmailForm({ mode }: { mode: "verify" | "reset" }) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return ready ? <AccountForm mode={mode} initialEmail={pendingVerificationEmail()} /> : null;
}
