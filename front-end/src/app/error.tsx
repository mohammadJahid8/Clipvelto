"use client";

import Link from "next/link";

export default function ApplicationError({ reset }: { reset: () => void }) {
  return (
    <main className="container py-24">
      <h1 className="font-heading text-3xl">We couldn’t open that page.</h1>
      <p className="muted mt-4 mb-7 leading-relaxed">
        The workspace service may be temporarily unavailable. Please try again
        shortly.
      </p>
      <div className="flex flex-wrap gap-3">
        <button className="button button-primary" onClick={reset}>
          Try again
        </button>
        <Link className="button button-secondary" href="/">
          Back to Clipvelto
        </Link>
      </div>
    </main>
  );
}
