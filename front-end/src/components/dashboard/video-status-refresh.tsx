"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function VideoStatusRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [active, router]);
  return null;
}
