"use client";
import { useState } from "react";
import { Download, Scissors } from "lucide-react";
import { clientApi } from "@/lib/client-api";
import { videoResponseSchema, type Video } from "@/lib/video-schema";
import { formatFileSize } from "@/lib/format-file-size";
import { ClipPreview } from "./clip-preview";
import Link from "next/link";

export function VideoClips({
  video,
  onChange,
}: {
  video: Video;
  onChange: (video: Video) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (video.status !== "ready") return null;
  const generation = video.generation;
  const working = ["queued", "processing"].includes(generation.status);
  return (
    <section
      className="workspace-panel transcript-panel"
      aria-labelledby="clips-heading"
    >
      <div className="transcript-heading">
        <div>
          <h2 id="clips-heading">
            <Scissors size={21} aria-hidden="true" />
            Your clips
          </h2>
        </div>
        {generation.status !== "completed" && !working && generation.canStart && (
          <button
            className="button button-primary"
            disabled={!generation.canStart || pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                onChange(
                  videoResponseSchema.parse(
                    await clientApi(`/videos/${video.id}/clips`, {
                      method: "POST",
                      body: "{}",
                    }),
                  ).video,
                );
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "We couldn’t start clip creation.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending
              ? "Starting…"
              : generation.status === "failed"
                ? "Retry clip creation"
                : "Create clips"}
          </button>
        )}
      </div>
      {generation.status !== "completed" && <p className="transcript-message" role="status">
        {generation.message ??
          (!generation.enabled
            ? "Clip creation isn’t configured on this server yet."
              : !generation.canStart
                ? "Choose a checked recording with at least 3 seconds of video."
                : "Ready to create clips.")}
      </p>}
      {error && (
        <p className="form-alert" role="alert">
          {error}
            {error.toLowerCase().includes("add credits") && <> <Link href="/dashboard/billing">Add credits</Link>, then return here and retry.</>}
        </p>
      )}
      <div className="generated-clips">
        {generation.clips.map((clip) => (
          <article
            key={`${generation.revision}-${clip.index}`}
            className="generated-clip"
          >
            <ClipPreview
              src={`/api/v1/videos/${video.id}/clips/${clip.index}/preview`}
              title={clip.title}
              width={clip.width}
              height={clip.height}
              captions={video.renderOptions.captions}
            />
            <div>
              <h3>{clip.title}</h3>
              <p>
                {Math.round(clip.end - clip.start)} seconds · {clip.width} ×{" "}
                {clip.height} · {formatFileSize(clip.sizeBytes)}
              </p>
            </div>
            <a
              className="button button-secondary"
              href={`/api/v1/videos/${video.id}/clips/${clip.index}/download`}
            >
              <Download size={16} aria-hidden="true" />
              Download MP4
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
