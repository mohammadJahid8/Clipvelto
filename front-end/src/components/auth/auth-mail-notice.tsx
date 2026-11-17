"use client";
import { useEffect, useState } from "react";

export function AuthMailNotice() {
  const [local, setLocal] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth-config", { cache: "no-store", signal: controller.signal })
      .then((response) =>
        response.ok
          ? (response.json() as Promise<{ localMailCapture?: boolean }>)
          : null,
      )
      .then((data) => {
        if (data) setLocal(data.localMailCapture === true);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return local ? (
    <aside
      className="form-success auth-local-mail"
      aria-label="Local email testing"
    >
      <strong>Local email testing</strong>
      <p>
        Emails are saved on this computer instead of being sent to an inbox.
        Read the latest code by running:
      </p>
      <code>npm run mail:latest --workspace @clipvelto/api</code>
    </aside>
  ) : null;
}
