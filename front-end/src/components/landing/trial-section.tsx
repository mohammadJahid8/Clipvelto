"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { z } from "zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, ChevronDown, Clock3, Download, Film, Info, Link as LinkIcon, LockKeyhole, Play, ShieldCheck } from "lucide-react";
import { TrialProgress } from "./trial-progress";
import { AccountDialog } from "@/components/auth/account-dialog";
import { authClient } from "@/lib/auth-client";

import type {} from "@/lib/turnstile";
const configSchema = z.object({
  enabled: z.boolean(),
  siteKey: z.string().nullable().optional(),
  maxSeconds: z.number(),
  freeCredits: z.number(),
  allowRepeat: z.boolean().default(false),
});
const stateSchema = z.object({
  status: z.enum([
    "none",
    "processing",
    "completed",
    "failed",
    "expired",
    "claimed",
  ]),
  message: z.string().optional(),
  usedCredits: z.number().nullable().optional(),
  preview: z
    .object({ title: z.string().optional(), seconds: z.number() })
    .nullable()
    .optional(),
  lockedCount: z.number().optional(),
  lockedPosters: z.array(z.number().int().min(1).max(4)).default([]),
  stage: z.enum(["queued", "importing", "transcribing", "selecting", "rendering", "finishing", "completed"]).optional(),
  startedAt: z.string().optional(),
});
export function TrialSection({
  initialSignedIn = false,
}: {
  initialSignedIn?: boolean;
}) {
  const router = useRouter();
  const session = authClient.useSession(),
    signedIn = session.isPending ? initialSignedIn : !!session.data;
  const [config, setConfig] = useState<z.infer<typeof configSchema> | null>(
      null,
    ),
    [trial, setTrial] = useState<z.infer<typeof stateSchema>>({
      status: "none",
      lockedPosters: [],
    });
  const [url, setUrl] = useState(""),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [resetting, setResetting] = useState(false),
    [error, setError] = useState(""),
    [scriptReady, setScriptReady] = useState(false),
    [unlockOpen, setUnlockOpen] = useState(false),
    [unlockMode, setUnlockMode] = useState<"sign-in" | "sign-up">("sign-up"),
    [submittedAt, setSubmittedAt] = useState<string>(),
    [pollIssue, setPollIssue] = useState("");
  const widget = useRef<HTMLDivElement>(null),
    widgetId = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/public/trial/config", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => setConfig(configSchema.parse(data)))
      .catch(() => {
        if (!controller.signal.aborted)
          setError("The preview service is temporarily unavailable.");
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const response = await fetch("/api/public/trial", {
          signal: controller.signal,
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw Error();
        const next = stateSchema.parse(await response.json());
        setTrial(next);
        setPollIssue("");
        if (next.status === "processing")
          timer = setTimeout(() => void poll(), 1500);
      } catch {
        if (!controller.signal.aborted) {
          setPollIssue("Reconnecting… Your video keeps processing. We’ll try again automatically.");
          timer = setTimeout(() => void poll(), 5000);
        }
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [busy]);
  useEffect(() => {
    if (
      !config?.enabled ||
      !config.siteKey ||
      !scriptReady ||
      signedIn ||
      !widget.current ||
      trial.status !== "none"
    )
      return;
    const api = window.turnstile;
    if (!api) return;
    widgetId.current = api.render(widget.current, {
      sitekey: config.siteKey,
      action: "trial",
      theme: "auto",
      size: widget.current.clientWidth < 300 ? "compact" : "normal",
      callback: setToken,
      "expired-callback": () => setToken(""),
      "error-callback": () => {
        setToken("");
        setError(
          "The human check couldn’t load. Please try again or create a free account.",
        );
      },
    });
    return () => {
      if (widgetId.current) api.remove(widgetId.current);
      widgetId.current = null;
      setToken("");
    };
  }, [config, scriptReady, signedIn, trial.status]);
  function openAuth(mode: "sign-in" | "sign-up" = "sign-up") {
    setUnlockMode(mode);
    setUnlockOpen(true);
  }
  const repeatButton = !signedIn && config?.allowRepeat ? (
    <button type="button" className="button button-secondary" disabled={resetting} onClick={async () => {
      setResetting(true);
      setError("");
      try {
        const response = await fetch("/api/public/trial/reset", { method: "POST", credentials: "same-origin" });
        if (!response.ok) throw Error("Couldn’t reset the preview. Please refresh and try again.");
        setTrial({ status: "none", lockedPosters: [] });
        setUrl("");
        setToken("");
        setSubmittedAt(undefined);
        setPollIssue("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Couldn’t reset the preview.");
      } finally {
        setResetting(false);
      }
    }}>{resetting ? "Resetting…" : "Try another video"} <ArrowUpRight size={18} aria-hidden="true" /></button>
  ) : null;
  return (
    <section
      id="start"
      tabIndex={-1}
      className="trial-section section"
      aria-labelledby="trial-title"
    >
      <div className="container trial-layout">
        <div className="trial-copy">
          <h2 id="trial-title">
            {signedIn
              ? "Your next clip starts here."
              : "Your first clip. No signup needed."}
          </h2>
          <p>Paste a YouTube link. Watch your best moment, then save it with a free account.</p>
          <div className="trial-perks" aria-label="Free preview includes">
            <span><Check size={16} aria-hidden="true" /> First 3 minutes</span>
            <span><Check size={16} aria-hidden="true" /> One free preview</span>
            <span><Check size={16} aria-hidden="true" /> No card needed</span>
          </div>
        </div>
        <div className={`trial-card${!signedIn && trial.status === "none" ? " trial-entry-card" : ""}`}>
          {signedIn &&
          trial.status !== "completed" &&
          trial.status !== "processing" ? (
            <>
              <h3>Your workspace is ready.</h3>
              <p>
                Choose your video shape and captions, see your free balance, and
                keep all your clips together.
              </p>
              <Link href="/dashboard" className="button button-primary">
                Open dashboard <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </>
          ) : null}
          {!signedIn && trial.status === "none" && (
            <form hidden={busy} className="trial-form"
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                if (!token) {
                  setError("Complete the human check first.");
                  return;
                }
                setSubmittedAt(new Date().toISOString());
                setBusy(true);
                try {
                  const response = await fetch("/api/public/trial", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ url, challengeToken: token }),
                    credentials: "same-origin",
                  });
                  const data = await response.json();
                  if (!response.ok) {
                    const message = z
                      .object({ error: z.object({ message: z.string() }) })
                      .safeParse(data);
                    throw Error(
                      message.success
                        ? message.data.error.message
                        : "The preview couldn’t start.",
                    );
                  }
                  setTrial({
                    status: "processing",
                    stage: "queued",
                    lockedPosters: [],
                  });
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "The preview couldn’t start.",
                  );
                  if (widgetId.current)
                    window.turnstile?.reset(widgetId.current);
                  setToken("");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label htmlFor="trial-url" className="trial-input-label"><LinkIcon size={19} aria-hidden="true" /> YouTube video link</label>
              <div className="trial-form-row">
              <input
                id="trial-url"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                required
                maxLength={2000}
                disabled={busy}
              />
              <button className="button button-primary" disabled={!config?.enabled || busy}>
                {!config ? "Loading preview…" : !config.enabled ? "Previews unavailable" : "Create my free clip"}
                <ArrowUpRight size={19} aria-hidden="true" />
              </button>
              </div>
              {config?.enabled && <div className="trial-form-bottom">
                <div>
                  <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setScriptReady(true)} />
                  <div ref={widget} className="trial-challenge" />
                </div>
                <div className="trial-form-notes">
                  <p><Clock3 size={15} aria-hidden="true" /><span>Uses up to 3 of your 15 free minutes.</span></p>
                  <p><Play size={15} aria-hidden="true" /><span>Watch your preview on this page.</span></p>
                </div>
              </div>}
              {config && !config.enabled && (
                <p className="muted">
                  Public previews are being configured. You can already{" "}
                  <Link href="/sign-up">create a free account</Link> and use the
                  workspace.
                </p>
              )}
              <div className="trial-form-legal">
                <p className="trial-fine-print"><ShieldCheck size={15} aria-hidden="true" /><span>Only use videos you own or have permission to process. By creating a preview, you agree to our <Link href="/terms">Terms</Link>. Read our <Link href="/privacy">Privacy policy</Link>.</span></p>
                <details className="trial-data-note"><summary><Info size={15} aria-hidden="true" /> How processing works <ChevronDown size={14} className="trial-details-chevron" aria-hidden="true" /></summary><p>Audio is sent to DeepInfra or Groq for transcription, and transcript text to Claude. Active livestreams are available in your account’s workspace.</p></details>
              </div>
            </form>
          )}
          {(busy || trial.status === "processing") && <TrialProgress stage={busy ? "starting" : trial.stage} startedAt={trial.startedAt ?? submittedAt} />}
          {pollIssue && <p className="muted" role="status">{pollIssue}</p>}
          {trial.status === "completed" && trial.preview && (
            <>
              <div className="trial-result">
                <div className="trial-player-wrap">
                  <video src="/api/public/trial/preview" controls playsInline preload="metadata" controlsList="nodownload" aria-label={`Watermarked preview: ${trial.preview.title ?? "Your clip"}`} />
                  <span className="trial-video-badge"><Play size={12} fill="currentColor" aria-hidden="true" /> Your free preview</span>
                </div>
                <div className="trial-result-copy">
                  <span className="trial-ready-label"><Check size={17} aria-hidden="true" /> Ready to watch</span>
                  <h3>Your first clip is ready.</h3>
                  <p className="trial-clip-title">{trial.preview.title ?? "Your best moment"}</p>
                  <p className="trial-clip-meta">{trial.preview.seconds} seconds · 9:16 · 720p preview</p>
                  <p className="trial-result-prompt">Like this moment? Make it yours.</p>
                  <ul className="trial-unlock-benefits">
                    <li><Download size={18} aria-hidden="true" /> Download in 1080p</li>
                    <li><Check size={18} aria-hidden="true" /> Remove the watermark</li>
                    {!!trial.lockedCount && <li><Film size={18} aria-hidden="true" /> Unlock {trial.lockedCount} more highlight{trial.lockedCount === 1 ? "" : "s"}</li>}
                  </ul>
                  {signedIn ? <Link href="/dashboard" className="button button-primary trial-save-button">Save to my dashboard <ArrowUpRight size={18} aria-hidden="true" /></Link> : <button className="button button-primary trial-save-button" onClick={() => openAuth()}>Save & unlock for free <ArrowUpRight size={18} aria-hidden="true" /></button>}
                  <p className="trial-balance-note">{Number((trial.usedCredits ?? 0).toFixed(2))} of 15 free minutes used · No card needed</p>
                  {!signedIn && <button type="button" className="text-button trial-sign-in" onClick={() => openAuth("sign-in")}>Already have an account? Sign in</button>}
                </div>
              </div>
              {!!trial.lockedCount && <div className="trial-more">
                <div className="trial-more-heading"><h3>More moments, waiting for you.</h3><p>Highlights found in your video. We’ll create these clips after you verify your free account.</p></div>
                <div className="trial-locked" aria-label="Locked highlights">
                  {Array.from({ length: trial.lockedCount }, (_, offset) => {
                    const index = offset + 1;
                    return <button type="button" className="trial-locked-card" key={index} onClick={() => signedIn ? router.push("/dashboard") : openAuth()} aria-label={`Unlock highlight ${index + 1} with a free account`}>
                      <span className="trial-locked-poster">
                        {trial.lockedPosters.includes(index) ? <Image src={`/api/public/trial/posters/${index}`} width={320} height={200} unoptimized alt="" onError={event => { event.currentTarget.style.opacity = "0"; }} /> : <span className="trial-poster-placeholder" aria-hidden="true"><Film size={64} strokeWidth={1} /></span>}
                        <span className="trial-locked-shade" />
                        <span className="trial-lock-label"><span className="trial-lock-circle"><LockKeyhole size={23} aria-hidden="true" /></span><strong>Sign up to unlock</strong></span>
                        <span className="trial-locked-number">Highlight {index + 1}</span>
                      </span>
                      <span className="trial-locked-footer">Unlock this highlight <ArrowUpRight size={17} aria-hidden="true" /></span>
                    </button>;
                  })}
                </div>
              </div>}
            </>
          )}
          {!signedIn &&
            ["failed", "expired", "claimed"].includes(trial.status) && (
              <>
                <h3>
                  {trial.status === "failed"
                    ? "This preview couldn’t finish."
                    : trial.status === "expired"
                      ? "Your preview window expired."
                      : "Your preview is saved."}
                </h3>
                <p>
                  {trial.status === "failed"
                    ? trial.message
                    : "Continue in your workspace to create and download clips."}
                </p>
                <div className="trial-actions">
                <Link
                  className="button button-primary"
                  href={
                    signedIn
                      ? "/dashboard"
                      : trial.status === "claimed"
                        ? "/sign-in"
                        : "/sign-up"
                  }
                >
                  {signedIn
                    ? "Open dashboard"
                    : trial.status === "claimed"
                      ? "Sign in to your workspace"
                      : "Create a free account"}
                </Link>
                  {repeatButton}
                </div>
              </>
            )}
          {trial.status === "completed" && repeatButton && <div className="trial-actions">{repeatButton}</div>}
          {error && trial.status !== "processing" && (
            <p className="form-alert" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      <AccountDialog initialMode={unlockMode} open={unlockOpen} onClose={() => setUnlockOpen(false)} moreCount={trial.lockedCount ?? 0} />
    </section>
  );
}
