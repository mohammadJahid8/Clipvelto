"use client";

import Link from "next/link";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="workspace-panel workspace-load-error">
      <h2>We couldn’t load your workspace.</h2>
      <p>Please try again. If the problem continues, sign in again.</p>
      <div>
        <button className="button button-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/sign-in" className="button button-secondary">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
