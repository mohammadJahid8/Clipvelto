"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function GoogleSignInButton({ disabled, onPendingChange }: { disabled: boolean; onPendingChange: (pending: boolean) => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth-config", { cache: "no-store", signal: controller.signal })
      .then(async response => response.ok ? await response.json() as { googleSignIn?: boolean } : null)
      .then(config => { if (!controller.signal.aborted) setEnabled(config?.googleSignIn === true); })
      .catch(() => { if (!controller.signal.aborted) setEnabled(false); });
    function restore() { request.current = null; setPending(false); onPendingChange(false); }
    window.addEventListener("pageshow", restore);
    return () => { controller.abort(); request.current?.abort(); window.removeEventListener("pageshow", restore); };
  }, [onPendingChange]);
  return <>
    <button type="button" className="google-auth-button" disabled={!enabled || disabled || pending} aria-busy={pending} onClick={async () => {
      if (request.current || !enabled || disabled) return;
      const controller = new AbortController();
      request.current = controller;
      setPending(true); onPendingChange(true); setError("");
      try {
        const result = await authClient.signIn.social({ provider: "google", callbackURL: "/dashboard", newUserCallbackURL: "/dashboard", errorCallbackURL: "/?auth=google", disableRedirect: true }, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (result.error || !result.data?.url) throw Error();
        const target = new URL(result.data.url);
        if (target.origin !== "https://accounts.google.com") throw Error();
        window.location.assign(target.href);
      } catch {
        if (!controller.signal.aborted) { setError("Couldn’t start Google sign-in. Try again or use your email."); request.current = null; setPending(false); onPendingChange(false); }
      }
    }}>
      {pending ? <LoaderCircle size={20} className="loading-spinner" aria-hidden="true" /> : <GoogleMark />}
      {pending ? "Opening Google…" : "Continue with Google"}
    </button>
    {enabled === false && <p className="auth-provider-note">Google sign-in is not available yet. Use your email below.</p>}
    {error && <p className="form-alert" role="alert">{error}</p>}
    <div className="auth-divider" aria-hidden="true">or</div>
  </>;
}

function GoogleMark() {
  return <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.87 46.98 24.55Z" />
    <path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.77 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
  </svg>;
}
