"use client";

import { Checkbox, Field, Label } from "@headlessui/react";
import { Check, FileVideo, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { processingQuote } from "@clipvelto/credit-plans";
import Link from "next/link";
import { clientApi } from "@/lib/client-api";
import { formatFileSize } from "@/lib/format-file-size";
import { ClientForm } from "@/components/ui/client-form";
import { RenderOptionsFields } from "./render-options-fields";
import {
  initialRenderOptions,
  renderOptionsPayload,
} from "@/lib/render-options";

const configSchema = z.object({
  enabled: z.boolean(),
  workerAvailable: z.boolean(),
  maxBytes: z.number().positive(),
  maxSeconds: z.number().positive(),
  importMaxSeconds: z.number().nonnegative(),
  allowedTypes: z.array(z.string()),
});
const sessionSchema = z.object({
  videoId: z.string(),
  uploadUrl: z.url().optional(),
  multipart: z
    .object({
      partSize: z.number().positive(),
      parts: z.number().int().positive(),
    })
    .optional(),
  expiresAt: z.string(),
  headers: z.record(z.string(), z.string()),
});
const formSchema = z.object({
  ownsRights: z
    .boolean()
    .refine(
      (value) => value,
      "Confirm you own this video or have permission to use it.",
    ),
});
type Session = z.infer<typeof sessionSchema>;

export function UploadVideoForm() {
  const router = useRouter();
  const [renderOptions, setRenderOptions] = useState(initialRenderOptions);
  const [settingsLocked, setSettingsLocked] = useState(false);
  const [config, setConfig] = useState<z.infer<typeof configSchema> | null>(
    null,
  );
  const [duration, setDuration] = useState<number | null>(null);
  const completedParts = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "finishing">(
    "idle",
  );
  const input = useRef<HTMLInputElement>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const session = useRef<Session | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { ownsRights: false },
  });
  const busy = phase !== "idle";

  useEffect(() => {
    const controller = new AbortController();
    clientApi("/uploads/config", { signal: controller.signal })
      .then((data) => setConfig(configSchema.parse(data)))
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "We couldn’t load the upload service. Refresh this page to try again.",
          );
      });
    return () => {
      controller.abort();
      xhr.current?.abort();
    };
  }, []);

  useEffect(() => {
    setDuration(null);
    if (!file) return;
    const url = URL.createObjectURL(file);
    const media = document.createElement("video");
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      if (Number.isFinite(media.duration) && media.duration > 0)
        setDuration(media.duration);
    };
    media.src = url;
    return () => {
      media.onloadedmetadata = null;
      media.removeAttribute("src");
      media.load();
      URL.revokeObjectURL(url);
    };
  }, [file]);

  async function sendFile(current: Session, selected: File) {
    if (current.multipart) {
      const { partSize, parts } = current.multipart;
      for (let index = completedParts.current; index < parts; index++) {
        const part = selected.slice(
          index * partSize,
          Math.min(selected.size, (index + 1) * partSize),
        );
        for (let attempt = 0; ; attempt++) {
          try {
            const response = (await clientApi(
              `/uploads/${current.videoId}/parts/${index + 1}`,
              { method: "POST", body: "{}" },
            )) as { uploadUrl: string };
            await sendPart(
              response.uploadUrl,
              {},
              part,
              index * partSize,
              selected.size,
            );
            break;
          } catch (error) {
            if (attempt >= 1) throw error;
          }
        }
        completedParts.current = index + 1;
      }
    } else {
      if (!current.uploadUrl)
        throw new Error(
          "The upload link is unavailable. Choose your video again.",
        );
      await sendPart(
        current.uploadUrl,
        current.headers,
        selected,
        0,
        selected.size,
      );
    }
  }
  function sendPart(
    url: string,
    headers: Record<string, string>,
    selected: Blob,
    offset: number,
    total: number,
  ) {
    return new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      xhr.current = request;
      request.open("PUT", url);
      request.timeout = 600000;
      for (const [name, value] of Object.entries(headers))
        request.setRequestHeader(name, value);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable)
          setProgress(Math.round(((offset + event.loaded) / total) * 100));
      };
      request.onload = () =>
        request.status >= 200 && request.status < 300
          ? resolve()
          : reject(
              new Error(
                "Storage couldn’t accept the video. Retry the upload; if the link has expired, select the file again.",
              ),
            );
      request.onerror = () =>
        reject(
          new Error(
            "The upload connection was interrupted. Check your connection and try again.",
          ),
        );
      request.ontimeout = () =>
        reject(
          new Error(
            "The upload timed out. Try again on a faster connection or choose a smaller video.",
          ),
        );
      request.onabort = () =>
        reject(new Error("Upload interrupted. Please retry."));
      request.send(selected);
    });
  }

  return (
    <section className="upload-form-panel workspace-panel">
      <div className="panel-heading">
        <div>
          <h2>Give your next idea a starting point.</h2>
          <p>
            Upload a video you own or are authorized to use. We’ll check it and
            save it privately.
          </p>
        </div>
      </div>
      <ClientForm
        className="video-upload-form"
        noValidate
        onSubmit={(event) => {
          void handleSubmit(async (values) => {
            setError("");
            if (!file || !config?.enabled) {
              setError(
                "Choose a video and wait for the upload service to be ready.",
              );
              return;
            }
            if (file.size <= 0 || file.size > config.maxBytes) {
              setError(
                `Choose a video between 1 byte and ${Math.round(config.maxBytes / 1024 ** 2)} MB.`,
              );
              return;
            }
            const inferred = (
              {
                mp4: "video/mp4",
                mov: "video/quicktime",
                webm: "video/webm",
              } as Record<string, string>
            )[file.name.split(".").at(-1)?.toLowerCase() ?? ""];
            const contentType = file.type || inferred;
            if (
              !inferred ||
              !config.allowedTypes.includes(contentType) ||
              contentType !== inferred
            ) {
              setError(
                "Choose an MP4, MOV, or WebM video with a matching file extension.",
              );
              return;
            }
            try {
              setPhase("uploading");
              if (!session.current)
                session.current = sessionSchema.parse(
                  await clientApi("/uploads", {
                    method: "POST",
                    body: JSON.stringify({
                      filename: file.name,
                      contentType,
                      sizeBytes: file.size,
                      ...(duration ? { durationSeconds: duration } : {}),
                      ownsRights: values.ownsRights,
                      renderOptions: renderOptionsPayload(renderOptions),
                    }),
                  }),
                );
              setSettingsLocked(true);
              if (!uploaded) {
                await sendFile(session.current, file);
                setUploaded(true);
              }
              setPhase("finishing");
              setProgress(100);
              await clientApi(`/videos/${session.current.videoId}/complete`, {
                method: "POST",
                body: "{}",
              });
              router.push(`/dashboard/videos/${session.current.videoId}`);
              router.refresh();
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "We couldn’t finish this upload. Please try again.",
              );
            } finally {
              setPhase("idle");
            }
          })(event);
        }}
      >
        {!config && !error && (
          <p role="status" className="muted">
            Checking upload availability…
          </p>
        )}
        {config && !config.enabled && (
          <p className="form-alert" role="status">
            The upload service isn’t configured yet. Please try again later.
          </p>
        )}
        {config?.enabled && !config.workerAvailable && (
          <p className="form-alert" role="status">
            File checks are temporarily offline. Your upload can be received,
            and checks will resume when the worker is available.
          </p>
        )}
        <div className={`upload-drop-area${file ? " has-file" : ""}`}>
          <div className="upload-icon">
            {file ? (
              <FileVideo size={27} aria-hidden="true" />
            ) : (
              <Upload size={27} aria-hidden="true" />
            )}
          </div>
          <h3>{file ? file.name : "Choose your source video"}</h3>
          <p>
            {file
              ? `${formatFileSize(file.size)} · Selected from your device`
              : "Podcasts, interviews, tutorials, and moments worth keeping."}
          </p>
          <button
            type="button"
            className="button button-secondary"
            disabled={busy || settingsLocked || !config?.enabled}
            onClick={() => input.current?.click()}
          >
            {file ? "Choose a different video" : "Choose a video"}
          </button>
          <input
            ref={input}
            className="sr-only"
            tabIndex={-1}
            type="file"
            disabled={busy || settingsLocked}
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            aria-label="Select source video"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (!selected) return;
              if (settingsLocked || busy || session.current) return;
              session.current = null;
              completedParts.current = 0;
              setSettingsLocked(false);
              setUploaded(false);
              setFile(selected);
              setError("");
              setProgress(0);
              reset({ ownsRights: false });
            }}
          />
          <p className="upload-limit-note">
            MP4, MOV, or WebM
            {config ? " · Length is based on your available credits" : ""}
          </p>
        </div>
        {file && (
          <p className="billing-test-note">
            {duration
              ? `Estimated quote: ${Number(processingQuote(duration, file.size).credits.toFixed(2))} credits.`
              : `Storage minimum: ${Number(processingQuote(0, file.size).credits.toFixed(2))} credits; full quote follows the duration check.`}{" "}
            One credit covers one source minute, minimum 1 credit. The higher of
            video duration or 2 credits per GB applies. The server verifies the
            final duration before processing.{" "}
            <Link href="/dashboard/billing">View credits</Link>
          </p>
        )}
        <RenderOptionsFields
          value={renderOptions}
          onChange={setRenderOptions}
          disabled={busy || settingsLocked}
        />
        <Controller
          name="ownsRights"
          control={control}
          render={({ field }) => (
            <Field className="rights-field">
              <Checkbox
                checked={field.value}
                onChange={field.onChange}
                disabled={busy}
                className="rights-checkbox"
                aria-describedby={
                  errors.ownsRights ? "rights-error" : undefined
                }
              >
                <Check size={15} aria-hidden="true" />
              </Checkbox>
              <Label>
                I own this video or have permission to upload and process it.
              </Label>
            </Field>
          )}
        />
        {errors.ownsRights && (
          <p id="rights-error" className="field-error" role="alert">
            {errors.ownsRights.message}
          </p>
        )}
        {busy && (
          <div className="upload-progress" role="status" aria-live="polite">
            <div>
              <span>
                {phase === "finishing"
                  ? "Confirming your upload…"
                  : "Uploading your video…"}
              </span>
              <span>{progress}%</span>
            </div>
            <progress value={progress} max={100} aria-label="Upload progress" />
            <p>Keep this page open until the upload finishes.</p>
          </div>
        )}
        {error && (
          <p role="alert" className="form-alert">
            {error}{" "}
            {error.toLowerCase().includes("add credits") && (
              <Link href="/dashboard/billing">Add credits</Link>
            )}
            {error.includes("session has expired") && (
              <Link href="/sign-in">Sign in</Link>
            )}
          </p>
        )}
        <div className="upload-form-actions">
          <button
            className="button button-primary"
            type="submit"
            disabled={busy || !file || !config?.enabled}
            aria-busy={busy}
          >
            <Upload size={17} aria-hidden="true" />
            {busy ? "Uploading…" : uploaded ? "Finish upload" : "Upload video"}
          </button>
        </div>
        <p className="upload-phase-note">
          Upload once and we’ll create your clips automatically. Credits are
          reserved before processing and charged when your clips are ready.
          Submitted jobs can’t be cancelled. You can delete videos after clip
          generation finishes. Failed jobs return the reservation. New media is
          kept for 30 days.
        </p>
      </ClientForm>
    </section>
  );
}
