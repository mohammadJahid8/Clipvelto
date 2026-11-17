"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheck, X } from "lucide-react";

export function PurchaseNotice({
  orderId,
  credits,
  test,
}: {
  orderId: string;
  credits?: number;
  test: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("purchase") !== orderId) return;
    url.searchParams.delete("purchase");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [orderId]);

  if (dismissed || credits === undefined) return null;
  return (
    <div role="status" className="billing-notice purchase-notice">
      <CircleCheck size={22} aria-hidden="true" />
      <div>
        <strong>Payment confirmed.</strong>{" "}
        {credits.toLocaleString("en-US")} {test ? "test credits" : "credits"} added.
        {test && <p>No real money was charged.</p>}
        <Link href="/dashboard/billing">View purchase details</Link>
      </div>
      <button
        type="button"
        aria-label="Dismiss payment confirmation"
        onClick={() => setDismissed(true)}
      >
        <X size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
