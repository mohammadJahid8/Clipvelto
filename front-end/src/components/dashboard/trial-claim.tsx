"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
export function TrialClaim() {
  const router = useRouter(),
    [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function claim() {
      try {
        const response = await fetch("/api/v1/trial/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
          signal: controller.signal,
        });
        const body = await response.json();
        if (
          response.status === 409 &&
          z
            .object({
              error: z.object({ code: z.literal("TRIAL_PROCESSING") }),
            })
            .safeParse(body).success
        ) {
          setMessage(
            "Your homepage preview is still processing. It will be saved here when ready.",
          );
          timer = setTimeout(() => void claim(), 5000);
          return;
        }
        if (!response.ok) {
          const terminal = z.object({ error: z.object({ code: z.enum(["TRIAL_CLAIMED", "TRIAL_EXPIRED", "TRIAL_NOT_FOUND"]) }) }).safeParse(body);
          if (terminal.success) {
            setMessage("");
            return;
          }
          const error = z
            .object({ error: z.object({ message: z.string() }) })
            .safeParse(body);
          setMessage(
            error.success
              ? error.data.error.message
              : "We couldn’t save your homepage preview.",
          );
          return;
        }
        const result = z
          .object({
            status: z.enum(["none", "claimed"]),
            videoId: z.string().optional(),
          })
          .parse(body);
        if (result.status === "claimed") {
          setMessage("");
          router.refresh();
        }
      } catch {
        if (!controller.signal.aborted)
          setMessage(
            "Your preview couldn’t be saved yet. Refresh to try again.",
          );
      }
    }
    void claim();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [router]);
  return message ? (
    <div className="workspace-notice workspace-trial-notice" role="status">
      <p>{message}</p>
    </div>
  ) : null;
}
