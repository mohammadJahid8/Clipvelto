import Link from "next/link";
import { Film, Upload } from "lucide-react";
import type { Video } from "@/lib/server-api";
import { UploadVideoButton } from "./upload-video-button";
import { VideoStatusRefresh } from "./video-status-refresh";

const statuses: Record<Video["status"], string> = {
  awaiting_upload: "Waiting for upload",
  uploaded: "Uploaded",
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  validating: "Checking video",
  ready: "Upload ready",
  cancelled: "Cancelled",
  deleting: "Removing",
  import_queued: "Import queued",
  importing: "Importing",
};

export function VideoList({
  videos,
  compact = false,
}: {
  videos: Video[];
  compact?: boolean;
}) {
  if (!videos.length)
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Film size={28} strokeWidth={1.4} aria-hidden="true" />
        </div>
        <h3>Your story starts with a video.</h3>
        <p>
          Upload your first recording to save it privately and check its format
          and duration, or start with a YouTube link.
        </p>
        <UploadVideoButton />
        <span className="empty-state-note">
          <Upload size={13} aria-hidden="true" />
          MP4, MOV, and WebM supported
        </span>
      </div>
    );
  return (
    <div
      className="video-list"
      role="list"
      aria-label={compact ? "Recent videos" : "Your videos"}
    >
      <VideoStatusRefresh
        active={videos.some(
          (video) =>
            ["queued", "processing"].includes(video.transcription.status) ||
            ["queued", "processing"].includes(video.generation.status) ||
            [
              "awaiting_upload",
              "queued",
              "validating",
              "processing",
              "import_queued",
              "importing",
            ].includes(video.status),
        )}
      />
      {videos.map((video) => (
        <article className="video-row" role="listitem" key={video.id}>
          <div className="video-file-icon">
            <Film size={22} aria-hidden="true" />
          </div>
          <div className="video-row-title">
            <h3>
              <Link href={`/dashboard/videos/${video.id}`}>{video.title}</Link>
            </h3>
            <p>{video.originalFilename}</p>
          </div>
          <span className={`video-status video-status-${video.status}`}>
            {video.status === "ready" &&
            video.transcription.status !== "not_started"
              ? {
                  queued: "Transcript queued",
                  processing: "Transcribing",
                  completed: "Transcript ready",
                  failed: "Transcription stopped",
                }[video.transcription.status]
              : statuses[video.status]}
          </span>
          <time dateTime={video.createdAt}>
            {new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeZone: "UTC",
            }).format(new Date(video.createdAt))}
          </time>
        </article>
      ))}
    </div>
  );
}
