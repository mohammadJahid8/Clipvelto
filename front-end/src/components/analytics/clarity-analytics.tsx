"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { ShieldCheck } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

// Public project identifier from the owner's Clarity installation screen.
const projectId = "zfwos3evxf";
const preferenceKey = "clipvelto-analytics-v1";
const preferencesEvent = "clipvelto:analytics-preferences";
const preferenceLifetime = 180 * 24 * 60 * 60 * 1000;
type Choice = "accepted" | "declined";
type Clarity = ((...args: unknown[]) => void) & { q?: unknown[][] };
type AnalyticsWindow = Window & { clarity?: Clarity };

function clarityWindow() {
  return window as AnalyticsWindow;
}

function allowedPage() {
  // Keep development, authentication, checkout and private workspaces out.
  return (
    ["clipvelto.com", "www.clipvelto.com"].includes(location.hostname) &&
    !/^\/(dashboard|api|sign-in|sign-up|verify-email|forgot-password|reset-password)(\/|$)/.test(location.pathname) &&
    !location.search
  );
}

function readPreference(): Choice | null {
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? "null");
    if (
      (saved?.choice === "accepted" || saved?.choice === "declined") &&
      Number.isFinite(saved.expiresAt) && saved.expiresAt > Date.now() &&
      saved.expiresAt <= Date.now() + preferenceLifetime
    ) return saved.choice;
  } catch { /* Storage can be unavailable in private browsing. */ }
  return null;
}

function signalConsent(accepted: boolean) {
  clarityWindow().clarity?.("consentv2", {
    ad_Storage: "denied",
    analytics_Storage: accepted ? "granted" : "denied",
  });
}

export function AnalyticsPreferencesButton() {
  return (
    <button type="button" className="analytics-preferences" onClick={() => window.dispatchEvent(new Event(preferencesEvent))}>
      Cookie preferences
    </button>
  );
}

export function ClarityAnalytics() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [visible, setVisible] = useState(false);
  const [scriptRequested, setScriptRequested] = useState(false);
  const loaded = useRef(false);
  const tracking = useRef(false);
  const currentChoice = useRef<Choice | null>(null);

  useEffect(() => {
    const syncPreference = () => {
      const preference = readPreference();
      currentChoice.current = preference;
      setChoice(preference);
      setVisible(preference === null && allowedPage());
    };
    const openPreferences = () => setVisible(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === preferenceKey || event.key === null) syncPreference();
    };
    syncPreference();
    window.addEventListener(preferencesEvent, openPreferences);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(preferencesEvent, openPreferences);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Stop before the browser paints a private route. The root DOM is also
  // explicitly masked, including while an asynchronous script is still loading.
  useLayoutEffect(() => {
    if (choice === null) setVisible(allowedPage());
    const allowed = choice === "accepted" && allowedPage();
    if (!allowed) {
      if (loaded.current) {
        signalConsent(false);
        clarityWindow().clarity?.("stop");
        tracking.current = false;
      }
      return;
    }
    if (!clarityWindow().clarity) {
      const queue: Clarity = (...args: unknown[]) => { (queue.q ??= []).push(args); };
      clarityWindow().clarity = queue;
    }
    if (loaded.current && !tracking.current) {
      clarityWindow().clarity?.("start");
      tracking.current = true;
    }
    signalConsent(true);
    setScriptRequested(true);
  }, [choice, pathname, search]);

  function choose(next: Choice) {
    currentChoice.current = next;
    try {
      localStorage.setItem(preferenceKey, JSON.stringify({ choice: next, expiresAt: Date.now() + preferenceLifetime }));
    } catch { /* Apply the choice for this page even without persistent storage. */ }
    if (next === "declined") {
      signalConsent(false);
      clarityWindow().clarity?.("stop");
      tracking.current = false;
    }
    setChoice(next);
    setVisible(false);
  }

  return (
    <>
      {scriptRequested && <Script
        id="microsoft-clarity"
        src={`https://www.clarity.ms/tag/${projectId}`}
        strategy="afterInteractive"
        onReady={() => {
          loaded.current = true;
          const accepted = currentChoice.current === "accepted" && allowedPage();
          signalConsent(accepted);
          tracking.current = accepted;
          if (!accepted) clarityWindow().clarity?.("stop");
        }}
      />}
      {visible && <section className="analytics-consent" aria-labelledby="analytics-consent-title" aria-describedby="analytics-consent-description">
        <div className="analytics-consent-copy">
          <h2 id="analytics-consent-title"><ShieldCheck size={20} aria-hidden="true" /> Help us improve Clipvelto</h2>
          <p id="analytics-consent-description">Allow Microsoft Clarity analytics and masked session recordings? Optional cookies help us understand how the site is used. <Link href="/privacy#analytics">Privacy policy</Link></p>
        </div>
        <div className="analytics-consent-actions">
          <button type="button" className="button button-secondary" onClick={() => choose("declined")}>No thanks</button>
          <button type="button" className="button button-primary" onClick={() => choose("accepted")}>Allow analytics</button>
        </div>
      </section>}
    </>
  );
}
