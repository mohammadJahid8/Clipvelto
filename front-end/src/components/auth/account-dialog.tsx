"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from "@headlessui/react";
import { LockKeyhole, X } from "lucide-react";
import { AccountForm, authTitles, type AuthStep } from "./account-form";
import "@/styles/account.css";

export function AccountDialog({ open, onClose, initialMode = "sign-up", moreCount, oauthError }: {
  open: boolean; onClose: () => void; initialMode?: "sign-in" | "sign-up"; moreCount?: number; oauthError?: string;
}) {
  const [step, setStep] = useState<AuthStep>(initialMode);
  useEffect(() => { if (open) setStep(initialMode); }, [open, initialMode]);
  return <Dialog open={open} onClose={onClose} className="dialog-root">
    <DialogBackdrop className="dialog-backdrop" />
    <div className="dialog-position">
      <DialogPanel className="dialog-panel trial-signup-dialog">
        <button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <span className="trial-dialog-icon" aria-hidden="true"><LockKeyhole size={23} /></span>
        <DialogTitle className="dialog-title">{authTitles[step]}</DialogTitle>
        {moreCount !== undefined && (step === "sign-in" || step === "sign-up") && <Description className="muted">Save this clip{moreCount ? ` and unlock ${moreCount} more highlights` : ""} with a free account.</Description>}
        <AccountForm key={initialMode} mode={initialMode} embedded onStepChange={setStep} oauthError={oauthError} />
      </DialogPanel>
    </div>
  </Dialog>;
}
