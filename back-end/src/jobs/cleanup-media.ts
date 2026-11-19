import type { Types } from "mongoose";
import type { createVideoModel } from "../modules/videos/video.model.js";
import type { UploadService } from "../modules/uploads/upload-service.js";
import { logger } from "../config/logger.js";

// Only inspect objects registered to a video. A bucket can also contain media
// belonging to another environment, so absence from this database is not enough
// to classify an object as abandoned.
export function createMediaCleanup(
  VideoModel: ReturnType<typeof createVideoModel>,
  uploads: Pick<UploadService, "storage" | "Quota">,
) {
  let cursor: Types.ObjectId | undefined;
  return async function cleanupMedia() {
    const videos = await VideoModel.find({
      status: { $in: ["ready", "failed"] },
      clipStatus: { $nin: ["queued", "processing"] },
      transcriptionStatus: { $nin: ["queued", "processing"] },
      ...(cursor ? { _id: { $gt: cursor } } : {}),
    })
      .sort({ _id: 1 })
      .limit(20)
      .select("+transcriptKey +checkpointKey +trialPreviewKey +trialPosterKeys");
    cursor = videos.at(-1)?._id;
    for (const video of videos) {
      try {
        const completed =
          video.status === "ready" &&
          video.clipStatus === "completed" &&
          video.transcriptionStatus === "completed" &&
          video.clips.length > 0 &&
          !video.userId.startsWith("trial:");
        const keep = new Set([
          ...video.clips.map((clip) => clip.key),
          video.transcriptKey,
          ...(!completed
            ? [video.sourceKey, video.checkpointKey, video.trialPreviewKey,
                ...(video.trialPosterKeys ?? [])]
            : []),
          // A staging URL can be replayed until it expires. The existing
          // expired-upload sweep remains responsible for staging objects.
          video.stagingKey,
        ].filter((key): key is string => !!key));
        const discard = new Set(
          (video.artifactKeys ?? []).filter((key) => !keep.has(key)),
        );
        if (completed) {
          for (const key of [video.sourceKey, video.checkpointKey,
            video.trialPreviewKey, ...(video.trialPosterKeys ?? [])])
            if (key && !keep.has(key)) discard.add(key);
        }
        if (!discard.size) continue;
        // Never discard the original until every published output is present.
        if (completed && video.sourceKey) {
          for (const clip of video.clips) {
            if (!clip.key || !clip.sizeBytes)
              throw new Error("Missing completed clip metadata");
            const head = await uploads.storage.head(clip.key);
            if (head.ContentLength !== clip.sizeBytes || head.ContentType !== "video/mp4")
              throw new Error("Completed clip is not safely stored");
          }
        }
        if (completed && video.sourceKey) {
          const parts = video.sourceKey.split("/");
          if (["sources", "imports"].includes(parts[0] ?? "") &&
            parts.length === 4 && parts[2] === video._id.toString()) {
            // This recording has finished. Reclaim its abandoned multipart
            // parts and duplicate originals as well as the checked source.
            await uploads.storage.removePrefix(`${parts.slice(0, 3).join("/")}/`);
          } else {
            await uploads.storage.remove(video.sourceKey);
          }
        }
        for (const key of discard)
          if (key !== video.sourceKey || !completed)
            await uploads.storage.remove(key);
        const session = await VideoModel.db.startSession();
        try {
          await session.withTransaction(async () => {
            const removedSource = completed && !!video.sourceKey;
            const result = await VideoModel.updateOne(
              {
                _id: video._id,
                userId: video.userId,
                status: video.status,
                clipGeneration: video.clipGeneration || { $in: [0, null] },
                clipStatus: video.clipStatus ?? { $exists: false },
                transcriptionStatus: { $nin: ["queued", "processing"] },
                ...(removedSource ? { sourceKey: video.sourceKey } : {}),
              },
              {
                $pull: { artifactKeys: { $in: [...discard] } },
                ...(completed ? {
                  $unset: {
                    sourceKey: 1, sourceEtag: 1, checkpointKey: 1,
                    transcriptionCheckpoint: 1, trialPreviewKey: 1, trialPosterKeys: 1,
                  },
                  ...(removedSource ? { $set: { sourceRemovedAt: new Date() } } : {}),
                } : {}),
              },
              { session },
            );
            if (result.modifiedCount && removedSource && video.quotaReserved)
              await uploads.Quota.updateOne(
                { _id: video.userId },
                { $inc: { bytes: -(video.expectedSize ?? 0) } },
                { session },
              );
          });
        } finally {
          await session.endSession();
        }
        logger.info({ videoId: video._id.toString(), objects: discard.size },
          "Removed processing media; published clips and transcript retained");
      } catch {
        logger.warn({ videoId: video._id.toString() }, "Media cleanup will retry");
      }
    }
  };
}
