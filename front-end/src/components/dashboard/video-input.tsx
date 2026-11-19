"use client";
import {
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  Checkbox,
  Field,
  Label,
} from "@headlessui/react";
import { Check, Link as LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UploadVideoForm } from "./upload-video-form";
import { ClientForm } from "@/components/ui/client-form";
import { FormField } from "@/components/ui/form-field";
import { clientApi } from "@/lib/client-api";
import { videoResponseSchema } from "@/lib/video-schema";
import { RenderOptionsFields } from "./render-options-fields";
import { WorkspaceHelp } from "./workspace-help";
import {
  initialRenderOptions,
  renderOptionsPayload,
} from "@/lib/render-options";

const importSchema = z.object({
  url: z.url("Enter a YouTube video or livestream URL."),
  captureSeconds: z.coerce.number<number>().int().min(60).max(600),
  ownsRights: z
    .boolean()
    .refine(
      (v) => v,
      "Confirm you own this video or have permission to use it.",
    ),
});
const configSchema = z.object({
  youtubeEnabled: z.boolean(),
  importMaxSeconds: z.number(),
  availableCredits: z.number().nullable(),
  admin: z.boolean(),
});
export function VideoInput() {
  return (
    <TabGroup>
      <TabList className="video-input-tabs" aria-label="Video source">
        <Tab>From YouTube</Tab>
        <Tab>From device</Tab>
      </TabList>
      <TabPanels>
        <TabPanel>
          <YoutubeImportForm />
        </TabPanel>
        <TabPanel>
          <UploadVideoForm />
        </TabPanel>
      </TabPanels>
    </TabGroup>
  );
}
function YoutubeImportForm() {
  const router = useRouter();
  const [renderOptions, setRenderOptions] = useState(initialRenderOptions);
  const [config, setConfig] = useState<z.infer<typeof configSchema> | null>(
    null,
  );
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<{
    title: string;
    durationSeconds: number;
    credits: number;
    available: number | null;
    admin: boolean;
    mode: "test" | "live";
  } | null>(null);
  const {
    register,
    watch,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof importSchema>>({
    resolver: zodResolver(importSchema),
    defaultValues: { url: "", captureSeconds: 300, ownsRights: false },
  });
  const currentUrl = watch("url");
  const currentCapture = watch("captureSeconds");
  const insufficientCredits =
    !!quote && !quote.admin && (quote.available ?? 0) < quote.credits;
  useEffect(() => {
    setQuote(null);
  }, [currentUrl, currentCapture]);
  useEffect(() => {
    const controller = new AbortController();
    const update = () => {
      if (document.visibilityState !== "visible") return;
      void clientApi("/uploads/config", { signal: controller.signal })
        .then((data) => {
          if (controller.signal.aborted) return;
          const next = configSchema.parse(data);
          setConfig(next);
          setQuote((value) =>
            value
              ? {
                  ...value,
                  available: next.availableCredits,
                  admin: next.admin,
                }
              : null,
          );
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError(
              "We couldn’t load the import service. Refresh this page to try again.",
            );
        });
    };
    update();
    const timer = window.setInterval(update, 15000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <section className="workspace-panel" aria-label="YouTube import">
      <ClientForm
        className="video-upload-form"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setError("");
          try {
            if (!quote) {
              setQuote(
                z
                  .object({
                    title: z.string(),
                    durationSeconds: z.number(),
                    credits: z.number(),
                    available: z.number().nullable(),
                    admin: z.boolean(),
                    mode: z.enum(["test", "live"]),
                  })
                  .parse(
                    await clientApi("/imports/youtube/quote", {
                      method: "POST",
                      body: JSON.stringify({
                        ...values,
                        renderOptions: renderOptionsPayload(renderOptions),
                      }),
                    }),
                  ),
              );
              return;
            }
            if (insufficientCredits) {
              setError(
                "Not enough available credits for this video. Add credits to continue.",
              );
              return;
            }
            const data = videoResponseSchema.parse(
              await clientApi("/imports/youtube", {
                method: "POST",
                body: JSON.stringify({
                  ...values,
                  renderOptions: renderOptionsPayload(renderOptions),
                }),
              }),
            );
            router.push(`/dashboard/videos/${data.video.id}`);
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : "Import couldn’t start.",
            );
          }
        })}
      >
        <FormField
          label="YouTube link"
          type="url"
          disabled={isSubmitting}
          placeholder="https://www.youtube.com/watch?v=…"
          {...register("url")}
          error={errors.url?.message}
        />
        <WorkspaceHelp title={`Live stream settings · ${Number(currentCapture) / 60} min`}>
        <div className="form-field">
          <label htmlFor="live-capture-length">Live capture length</label>
          <select
            id="live-capture-length"
            disabled={isSubmitting}
            {...register("captureSeconds", { valueAsNumber: true })}
          >
            {[1, 3, 5, 10].map((minutes) => (
              <option key={minutes} value={minutes * 60}>
                {minutes} {minutes === 1 ? "minute" : "minutes"}
              </option>
            ))}
          </select>
          <p className="field-hint">
            Only for streams that are live now. Capture starts when processing begins.
          </p>
        </div>
        </WorkspaceHelp>
        <RenderOptionsFields
          value={renderOptions}
          onChange={setRenderOptions}
          disabled={isSubmitting}
        />
        <Controller
          name="ownsRights"
          control={control}
          render={({ field }) => (
            <Field className="rights-field">
              <Checkbox
                className="rights-checkbox"
                checked={field.value}
                onChange={field.onChange}
                disabled={isSubmitting}
              >
                <Check size={15} aria-hidden="true" />
              </Checkbox>
              <Label>I own this video or have permission to use it.</Label>
            </Field>
          )}
        />
        {errors.ownsRights && (
          <p className="form-alert" role="alert">
            {errors.ownsRights.message}
          </p>
        )}
        {config && config.importMaxSeconds < 3 && (
          <p role="status">
            No credits available. <Link href="/dashboard/billing">Add credits</Link>
          </p>
        )}
        {config && !config.youtubeEnabled && (
          <p role="status">
            YouTube imports are unavailable. Upload from your device instead.
          </p>
        )}
        {error && (
          <p className="form-alert" role="alert">
            {error}{" "}
            {error.toLowerCase().includes("add credits") && (
              <Link href="/dashboard/billing">Add credits</Link>
            )}
          </p>
        )}
        {quote && (
          <div className="upload-quote">
            <div>
              <strong>{quote.title}</strong>
              <p>
                {Number((quote.durationSeconds / 60).toFixed(2))} source minutes
                ·{" "}
                {quote.admin
                  ? "Administrator: no charge"
                  : `${Number(quote.credits.toFixed(2))} ${quote.mode === "test" ? "test " : ""}credits estimated`}
              </p>
              {quote.available !== null && (
                <p>{Number(quote.available.toFixed(2))} credits available</p>
              )}
              {!quote.admin && (quote.available ?? 0) < quote.credits && (
                <Link href="/dashboard/billing">
                  Add credits before importing
                </Link>
              )}
            </div>
          </div>
        )}
        <button
          type="submit"
          className="button button-primary"
          disabled={
            !config?.youtubeEnabled ||
            config.importMaxSeconds < 3 ||
            insufficientCredits ||
            isSubmitting
          }
        >
          <LinkIcon size={16} aria-hidden="true" />
          {isSubmitting
            ? quote
              ? "Starting…"
              : "Checking video…"
            : quote
              ? "Confirm & create clips"
              : "Check video & credits"}
        </button>
        <p className="field-hint upload-commit-note">Submitted jobs can’t be cancelled.</p>
        <WorkspaceHelp title="Credits & import details">
          <p>1 credit per video minute, minimum 1 credit. Large files have a minimum of 2 credits per GB; the higher quote applies.</p>
          <p>Credits are reserved before import and returned if processing fails. Generated clips are kept for 30 days; originals are removed after completion.</p>
          <p>Restricted or YouTube-blocked videos may not import. Playlists and channels aren’t supported.</p>
          <Link href="/dashboard/billing">View credits</Link>
        </WorkspaceHelp>
      </ClientForm>
    </section>
  );
}
