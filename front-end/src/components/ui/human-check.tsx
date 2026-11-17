"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type {} from "@/lib/turnstile";

export function HumanCheck({
  siteKey,
  action,
  resetKey,
  onToken,
}: {
  siteKey: string;
  action: string;
  resetKey: number;
  onToken: (value: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState("auto");
  const [compact, setCompact] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const update = () =>
      setTheme(document.documentElement.dataset.theme ?? "auto");
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const query = window.matchMedia("(max-width: 420px)");
    const resize = () => setCompact(query.matches);
    resize();
    query.addEventListener("change", resize);
    return () => {
      observer.disconnect();
      query.removeEventListener("change", resize);
    };
  }, []);
  useEffect(() => {
    const api = window.turnstile;
    if (!ready || !api || !container.current) return;
    onToken("");
    setError("");
    let active = true;
    let id: string | undefined;
    try {
      id = api.render(container.current, {
        sitekey: siteKey,
        action,
        theme,
        size: compact ? "compact" : "normal",
        callback: (token) => {
          if (active) {
            onToken(token);
            setError("");
          }
        },
        "expired-callback": () => {
          if (active) onToken("");
        },
        "error-callback": () => {
          if (active) {
            onToken("");
            setError(
              "The human check couldn’t finish. Refresh the page and try again.",
            );
          }
        },
      });
    } catch {
      setError(
        "The human check couldn’t load. Refresh the page and try again.",
      );
    }
    return () => {
      active = false;
      if (id) api.remove(id);
      onToken("");
    };
  }, [siteKey, action, ready, theme, compact, resetKey, onToken]);
  return (
    <div className="contact-human-check">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() =>
          setError(
            "The human check couldn’t load. Check your connection and refresh the page.",
          )
        }
      />
      <div ref={container} />
      {!ready && !error && <p role="status">Loading human check…</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
