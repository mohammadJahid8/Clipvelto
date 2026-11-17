import { Worker } from "node:worker_threads";
import { z } from "zod";
import { UploadError } from "../modules/uploads/upload-error.js";

const metadataSchema = z.object({
  durationSeconds: z.number().finite().positive(),
  width: z.number().int().min(1).max(16384),
  height: z.number().int().min(1).max(16384),
  container: z.string(),
  codec: z.string().min(1),
  encrypted: z.boolean(),
});
export type VideoMetadata = z.infer<typeof metadataSchema>;
export async function probeVideo(
  path: string,
  contentType: string,
  maxSeconds: number,
): Promise<VideoMetadata> {
  const worker = new Worker(
    new URL(
      import.meta.url.endsWith(".ts")
        ? "./metadata-worker.ts"
        : "./metadata-worker.js",
      import.meta.url,
    ),
    {
      workerData: { path },
      resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
    },
  );
  try {
    const data = await new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new UploadError(
              400,
              "INVALID_VIDEO",
              "This video took too long to inspect. Try exporting it as a standard MP4.",
            ),
          ),
        20000,
      );
      worker.once("message", (value) => {
        clearTimeout(timer);
        resolve(value);
      });
      worker.once("error", () => {
        clearTimeout(timer);
        reject(
          new UploadError(
            400,
            "INVALID_VIDEO",
            "We couldn’t read this video. Try a different file or export it as a standard MP4.",
          ),
        );
      });
      worker.once("exit", (code) => {
        if (code !== 0) {
          clearTimeout(timer);
          reject(
            new UploadError(
              400,
              "INVALID_VIDEO",
              "We couldn’t inspect this video safely.",
            ),
          );
        }
      });
    });
    const parsed = z
      .object({ ok: z.literal(true), metadata: metadataSchema })
      .safeParse(data);
    if (!parsed.success)
      throw new UploadError(
        400,
        "INVALID_VIDEO",
        "We couldn’t verify a readable video stream and duration. Try exporting the file as a standard MP4.",
      );
    const metadata = parsed.data.metadata;
    if (
      metadata.encrypted ||
      (contentType === "video/webm"
        ? metadata.container !== "WebM"
        : !["MPEG-4", "QuickTime"].includes(metadata.container))
    )
      throw new UploadError(
        400,
        "INVALID_VIDEO",
        "The file content doesn’t match an unencrypted MP4, MOV, or WebM video.",
      );
    if (metadata.durationSeconds > maxSeconds)
      throw new UploadError(
        400,
        "VIDEO_TOO_LONG",
        `Choose a video no longer than ${Math.floor(maxSeconds / 60)} minutes.`,
      );
    return metadata;
  } finally {
    await worker.terminate();
  }
}
