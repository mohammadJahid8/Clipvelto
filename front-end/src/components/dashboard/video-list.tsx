import Link from "next/link";
import { Film } from "lucide-react";
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
        <h3>No videos yet</h3>
        <p>Add a YouTube link or upload a video to create clips.</p>
        <UploadVideoButton />
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
            {video.durationSeconds !== null && (
              <p>{Math.floor(video.durationSeconds / 60)}m {Math.round(video.durationSeconds % 60)}s</p>
            )}
          </div>
          <span className={`video-status video-status-${video.status}`}>
            {video.generation.status === "completed"
              ? "Clips ready"
              : video.generation.status === "failed"
                ? "Needs attention"
                : ["queued", "processing"].includes(video.generation.status)
                  ? "Creating clips"
                  : video.status === "ready" &&
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
