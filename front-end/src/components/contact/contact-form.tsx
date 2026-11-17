"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import { z } from "zod";
import { FormField } from "@/components/ui/form-field";
import { HumanCheck } from "@/components/ui/human-check";

const configSchema = z.object({
  enabled: z.boolean(),
  siteKey: z.string().nullable(),
  localCapture: z.boolean(),
});
const replySchema = z.object({
  sent: z.literal(true),
  delivery: z.enum(["local", "email"]),
});
export function ContactForm() {
  const [config, setConfig] = useState<z.infer<typeof configSchema> | null>(
    null,
  );
  const [configError, setConfigError] = useState(false);
  const [reload, setReload] = useState(0);
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<"local" | "email" | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setConfigError(false);
    void fetch("/api/public/contact/config", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setConfig(configSchema.parse(await response.json()));
      })
      .catch(() => {
        if (!controller.signal.aborted) setConfigError(true);
      });
    return () => controller.abort();
  }, [reload]);
  if (sent)
    return (
      <section className="contact-success" role="status">
        <CheckCircle2 size={32} aria-hidden="true" />
        <h2>{sent === "email" ? "Message sent." : "Message saved locally."}</h2>
        <p>
          {sent === "email"
            ? "Your message has been sent to the administrator. Replies will go to the email address you provided."
            : "This development environment uses local email capture. Use mail:latest to read the message; SMTP is needed for inbox delivery."}
        </p>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => {
            setSent(null);
            setError("");
          }}
        >
          Send another message
        </button>
      </section>
    );
  return (
    <form
      className="contact-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (lock.current || !config?.enabled) return;
        const form = event.currentTarget;
        if (!form.reportValidity()) return;
        const fields = new FormData(form);
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 45000);
        lock.current = true;
        setPending(true);
        setError("");
        try {
          const response = await fetch("/api/public/contact", {
            method: "POST",
            signal: controller.signal,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name: fields.get("name"),
              email: fields.get("email"),
              subject: fields.get("subject"),
              message: fields.get("message"),
              website: fields.get("website") ?? "",
              challengeToken: token,
            }),
          });
          const result: unknown = await response.json().catch(() => null);
          if (!response.ok) {
            const failure = z
              .object({ error: z.object({ message: z.string() }) })
              .safeParse(result);
            throw new Error(
              failure.success
                ? failure.data.error.message
                : "Your message couldn’t be sent. Please try again later.",
            );
          }
          setSent(replySchema.parse(result).delivery);
          form.reset();
        } catch (cause) {
          setError(
            controller.signal.aborted
              ? "We couldn’t confirm delivery. Please wait before trying again."
              : cause instanceof Error
                ? cause.message
                : "Your message couldn’t be sent. Please try again later.",
          );
        } finally {
          window.clearTimeout(timeout);
          lock.current = false;
          setPending(false);
          setToken("");
          setResetKey((value) => value + 1);
        }
      }}
    >
      <fieldset disabled={pending} className="contact-fields">
        <legend className="sr-only">Your message</legend>
        <div className="contact-name-email">
          <FormField
            label="Your name"
            name="name"
            autoComplete="name"
            required
            maxLength={100}
          />
          <FormField
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </div>
        <FormField label="Subject" name="subject" required maxLength={100} />
        <div className="form-field">
          <label className="form-label" htmlFor="contact-message">
            Message
          </label>
          <textarea
            id="contact-message"
            name="message"
            className="form-input"
            required
            minLength={10}
            maxLength={4000}
            rows={7}
            aria-describedby="contact-message-hint"
          />
          <p id="contact-message-hint" className="field-hint">
            Include a video ID if it helps. Please leave out passwords, API keys
            and payment details.
          </p>
        </div>
        <div className="contact-honeypot" aria-hidden="true">
          <label htmlFor="contact-website">Website</label>
          <input
            id="contact-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            maxLength={200}
          />
        </div>
      </fieldset>
      {config?.siteKey && (
        <HumanCheck
          siteKey={config.siteKey}
          action="contact"
          resetKey={resetKey}
          onToken={setToken}
        />
      )}
      {!config && !configError && (
        <p className="contact-form-note" role="status">
          Loading contact form…
        </p>
      )}
      {configError && (
        <p className="form-alert" role="alert">
          The contact form couldn’t load.{" "}
          <button
            type="button"
            className="contact-retry"
            onClick={() => setReload((value) => value + 1)}
          >
            Try again
          </button>
          .
        </p>
      )}
      {config && !config.enabled && (
        <p role="status" className="form-alert">
          Contact messaging is temporarily unavailable. Please try again later.
        </p>
      )}
      {config?.localCapture && (
        <p className="contact-form-note">
          Development mode: messages are captured locally instead of delivered
          to an inbox.
        </p>
      )}
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      <div className="contact-submit">
        <button
          type="submit"
          className="button button-primary"
          disabled={pending || !config?.enabled || (!!config.siteKey && !token)}
          aria-busy={pending}
        >
          <Send size={18} aria-hidden="true" />
          {pending ? "Sending…" : "Send message"}
        </button>
        <p>
          We use your details to respond to this request.{" "}
          <Link href="/privacy">Privacy policy</Link>
        </p>
      </div>
    </form>
  );
}
