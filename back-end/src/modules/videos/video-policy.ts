import type { Video } from "./video.model.js";

export function canDeleteVideo(
  video: Pick<Video, "status" | "clipStatus" | "transcriptionStatus" | "clips">,
) {
  return (
    ["ready", "completed"].includes(video.status) &&
    video.clipStatus === "completed" &&
    (video.clips?.length ?? 0) > 0 &&
    !["queued", "processing"].includes(video.transcriptionStatus ?? "")
  );
}
