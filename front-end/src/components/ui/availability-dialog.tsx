"use client";

import {
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { ArrowUpRight, X } from "lucide-react";
import { useState, type ReactNode } from "react";

export function AvailabilityDialog({
  children,
  title = "A little more time in the edit.",
  description = "Clipvelto is in development. Clip generation and credit purchases aren’t available yet.",
  className = "button button-primary",
  arrow = false,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  arrow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
        {arrow && <ArrowUpRight size={18} aria-hidden="true" />}
      </button>
      <Dialog open={open} onClose={setOpen} className="dialog-root">
        <DialogBackdrop className="dialog-backdrop" />
        <div className="dialog-position">
          <DialogPanel className="dialog-panel">
            <button
              className="icon-button dialog-close"
              onClick={() => setOpen(false)}
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
            <span className="status-tag">
              <span />
              In development
            </span>
            <DialogTitle className="dialog-title">{title}</DialogTitle>
            <Description className="muted leading-relaxed">
              {description}
            </Description>
            <button
              className="button button-primary mt-6"
              onClick={() => setOpen(false)}
            >
              Got it
            </button>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
