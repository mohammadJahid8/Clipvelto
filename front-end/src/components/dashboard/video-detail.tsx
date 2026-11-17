"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, CircleAlert, Film, RefreshCw, Trash2 } from "lucide-react";
import type { Video } from "@/lib/server-api";
import { videoResponseSchema } from "@/lib/video-schema";
import { clientApi } from "@/lib/client-api";
import { formatFileSize } from "@/lib/format-file-size";
import { VideoClips } from "./video-clips";
import { VideoTranscript } from "./video-transcript";
import { VideoProcessing } from "./video-processing";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
} from "@headlessui/react";

const waiting = [
  "awaiting_upload",
  "queued",
  "validating",
  "processing",
  "import_queued",
  "importing",
];
const labels: Record<Video["status"], string> = {
  awaiting_upload: "Waiting for upload",
  uploaded: "Uploaded",
  queued: "Waiting for checks",
  validating: "Checking video",
  processing: "Processing",
  ready: "Upload ready",
  completed: "Completed",
  failed: "Checks failed",
  cancelled: "Cancelled",
  deleting: "Removing",
  import_queued: "Import queued",
  importing: "Importing YouTube video",
};
export function VideoDetail({ initialVideo }: { initialVideo: Video }) {
  const router = useRouter();
  const [video, setVideo] = useState(initialVideo);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const working =
    waiting.includes(video.status) ||
    ["queued", "processing"].includes(video.generation.status) ||
    ["queued", "processing"].includes(video.transcription.status);
  const statusLabel =
    video.status === "failed" && video.sourceProvider === "youtube"
      ? "Import failed"
      : video.generation.status === "completed"
        ? "Clips ready"
        : video.generation.status === "failed"
          ? "Clip creation stopped"
          : working && video.status === "ready"
            ? "Creating clips"
            : labels[video.status];
  useEffect(() => {
    if (
      !waiting.includes(video.status) &&
      !["queued", "processing"].includes(video.transcription.status) &&
      !["queued", "processing"].includes(video.generation.status)
    )
      return;
    const controller = new AbortController();
    const interval = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      clientApi(`/videos/${video.id}`, { signal: controller.signal })
        .then((data) => {
          setVideo(videoResponseSchema.parse(data).video);
          setError("");
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError(
              "Status updates were interrupted. We’ll keep trying; you can also refresh this page.",
            );
        });
    }, 2000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [
    video.id,
    video.status,
    video.transcription.status,
    video.generation.status,
  ]);
  return (
    <>
      <section className="workspace-panel video-detail-panel">
        <div className="video-detail-top">
          <div className="empty-state-icon">
            <Film size={27} aria-hidden="true" />
          </div>
          <div>
            <h2>{video.title}</h2>
            <p>{video.originalFilename}</p>
          </div>
          <span
            className={`video-status video-status-${video.generation.status === "failed" ? "failed" : video.status}`}
          >
            {statusLabel}
          </span>
        </div>
        {video.quotedCredits != null && (
          <p className="billing-help">
            Processing quote:{" "}
            <strong>
              {Number(video.quotedCredits.toFixed(2))}{" "}
              {video.creditMode === "test" ? "test " : ""}credits
            </strong>
            . Administrator jobs are exempt.{" "}
            {video.mediaExpiresAt && (
              <>
                Media available until{" "}
                {new Date(video.mediaExpiresAt).toLocaleDateString("en-GB", {
                  timeZone: "UTC",
                })}
                .
              </>
            )}{" "}
            <Link href="/dashboard/billing">View credits</Link>
          </p>
        )}
        {working ? (
          <VideoProcessing video={video} />
        ) : (
          <div
            className="video-validation-status"
            role="status"
            aria-live="polite"
          >
            {video.status === "failed" ||
            video.generation.status === "failed" ? (
              <CircleAlert size={21} aria-hidden="true" />
            ) : video.status === "ready" ? (
              <Check size={21} aria-hidden="true" />
            ) : (
              <Film size={21} aria-hidden="true" />
            )}
            <div>
              <h3>
                {video.generation.status === "completed"
                  ? "Your clips are ready."
                  : video.status === "ready"
                    ? "Your video is uploaded and checked."
                    : statusLabel}
              </h3>
              <p>
                {video.generation.status === "completed"
                  ? "Preview and download your clips below."
                  : video.generation.status === "failed"
                    ? "Retry clip creation below to continue."
                    : (video.statusMessage ??
                      "Your video is saved in your workspace.")}
              </p>
            </div>
          </div>
        )}
        {video.durationSeconds !== null && (
          <dl className="video-metadata">
            <div>
              <dt>Source file</dt>
              <dd>
                {video.sizeBytes === null
                  ? "Unavailable"
                  : formatFileSize(video.sizeBytes)}
              </dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>
                {video.durationSeconds === null
                  ? "Checked after upload"
                  : `${Math.floor(video.durationSeconds / 60)}m ${Math.round(video.durationSeconds % 60)}s`}
              </dd>
            </div>
            <div>
              <dt>Resolution</dt>
              <dd>
                {video.width && video.height
                  ? `${video.width} × ${video.height}`
                  : "Checked after upload"}
              </dd>
            </div>
          </dl>
        )}
        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        <div className="video-detail-actions">
          {video.canRetry && (
            <button
              className="button button-primary"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  const data = videoResponseSchema.parse(
                    await clientApi(`/videos/${video.id}/retry`, {
                      method: "POST",
                      body: "{}",
                    }),
                  );
                  setVideo(data.video);
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Retry failed. Please try again.",
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {video.sourceProvider === "youtube"
                ? "Retry import"
                : "Retry checks"}
            </button>
          )}
          <Link className="button button-secondary" href="/dashboard/upload">
            Upload another video
          </Link>
          {video.canDelete && (
            <button
              className="button button-secondary remove-video-button"
              disabled={pending}
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={16} aria-hidden="true" />
              Delete video
            </button>
          )}
        </div>
      </section>
      {(!working || video.generation.clips.length > 0) && (
        <VideoClips video={video} onChange={setVideo} />
      )}
      {!working && <VideoTranscript video={video} />}
      <Dialog
        open={confirm && video.canDelete}
        onClose={(open) => {
          if (!pending) setConfirm(open);
        }}
        className="dialog-root"
      >
        <DialogBackdrop className="dialog-backdrop" />
        <div className="dialog-position">
          <DialogPanel className="dialog-panel">
            <DialogTitle className="dialog-title">
              Delete this video?
            </DialogTitle>
            <Description className="muted leading-relaxed">
              It will disappear from your library and its stored files will be
              deleted. Used credits are not refunded. Downloads you already
              saved are unaffected.
            </Description>
            <div className="video-detail-actions">
              <button
                className="button button-secondary"
                disabled={pending}
                onClick={() => setConfirm(false)}
              >
                Keep video
              </button>
              <button
                className="button button-primary"
                disabled={pending || !video.canDelete}
                onClick={async () => {
                  if (!video.canDelete) return;
                  setPending(true);
                  setError("");
                  try {
                    await clientApi(`/videos/${video.id}`, {
                      method: "DELETE",
                    });
                    router.replace("/dashboard/videos");
                    router.refresh();
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "We couldn’t delete that video.",
                    );
                    setConfirm(false);
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Delete video
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
