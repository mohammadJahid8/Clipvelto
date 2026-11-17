"use client";

import { ArrowUpRight, LoaderCircle } from "lucide-react";

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return <button type="submit" className="button button-primary form-submit" disabled={pending} aria-busy={pending}>
    {children}{pending ? <LoaderCircle size={18} className="loading-spinner" aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" />}
  </button>;
}
