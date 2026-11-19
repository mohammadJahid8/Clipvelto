import type { Video } from "./video.model.js";
import type { Types } from "mongoose";
import type { Env } from "../../config/env.js";
import { canDeleteVideo } from "./video-policy.js";

export function presentVideo(
  video: Video & { _id: Types.ObjectId },
  env?: Env,
) {
  // Older records read with lean() do not receive newer schema defaults.
  const clips = video.clips ?? [];
  const maxSeconds = Number.MAX_SAFE_INTEGER;
  return {
    id: video._id.toString(),
    title: video.title,
    originalFilename: video.originalFilename,
    status: video.status,
    createdAt: video.createdAt,
    processingStartedAt: video.processingStartedAt ?? video.createdAt,
    sizeBytes:
      video.sourceProvider === "youtube" && !video.sourceEtag && !video.sourceRemovedAt
        ? null
        : (video.expectedSize ?? null),
    durationSeconds: video.durationSeconds ?? null,
    width: video.width ?? null,
    height: video.height ?? null,
    statusMessage: video.statusMessage ?? null,
    quotedCredits:
      video.quotedCreditSeconds == null ? null : video.quotedCreditSeconds / 60,
    creditMode: video.creditMode ?? "live",
    mediaExpiresAt: video.mediaExpiresAt ?? null,
    canRetry: video.status === "failed" && video.failureKind === "temporary",
    canDelete: canDeleteVideo(video),
    sourceProvider: video.sourceProvider ?? "device",
    renderOptions: video.renderOptions ?? {
      aspectRatio: "9:16",
      captions: true,
    },
    generation: {
      revision: video.clipRenderRevision ?? 0,
      enabled: !!env?.CLIPS_ENABLED && !!env.ANTHROPIC_API_KEY,
      status: video.clipStatus ?? "not_started",
      stage: video.clipStage ?? null,
      message: video.clipMessage ?? null,
      canStart:
        !!env?.CLIPS_ENABLED &&
        !!env.ANTHROPIC_API_KEY &&
        video.status === "ready" &&
        (video.durationSeconds ?? Infinity) <= maxSeconds &&
        (video.durationSeconds ?? 0) >= 3 &&
        !["queued", "processing"].includes(video.transcriptionStatus ?? "") &&
        (!video.clipStatus || video.clipStatus === "failed"),
      clips:
        clips.length > 0
          ? clips.map((clip, index) => ({
              index,
              title: clip.title ?? "Clip",
              start: clip.start ?? 0,
              end: clip.end ?? 0,
              sizeBytes: clip.sizeBytes ?? 0,
              width: clip.width ?? 720,
              height: clip.height ?? 1280,
            }))
          : [],
    },
    transcription: {
      provider: env?.TRANSCRIPTION_PROVIDER ?? "local",
      enabled: env?.TRANSCRIPTION_ENABLED ?? false,
      status: video.transcriptionStatus ?? "not_started",
      message: video.transcriptionMessage ?? null,
      maxSeconds,
      canStart:
        !!env?.TRANSCRIPTION_ENABLED &&
        video.status === "ready" &&
        !!video.sourceKey &&
        !!video.sourceEtag &&
        (video.durationSeconds ?? Infinity) <= maxSeconds &&
        (!video.transcriptionStatus ||
          video.transcriptionStatus === "failed") &&
        !["queued", "processing"].includes(video.clipStatus ?? ""),
    },
  };
}
