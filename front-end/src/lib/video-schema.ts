import { z } from "zod";

export const videoSchema = z.object({
  id: z.string(),
  title: z.string(),
  originalFilename: z.string(),
  status: z.enum([
    "awaiting_upload",
    "uploaded",
    "queued",
    "validating",
    "processing",
    "ready",
    "completed",
    "failed",
    "cancelled",
    "deleting",
    "import_queued",
    "importing",
  ]),
  createdAt: z.string(),
  processingStartedAt: z.string().optional(),
  sizeBytes: z.number().nullable(),
  durationSeconds: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  statusMessage: z.string().nullable(),
  quotedCredits: z.number().nullable().optional(),
  creditMode: z.enum(["test", "live"]).optional(),
  mediaExpiresAt: z.string().nullable().optional(),
  canRetry: z.boolean(),
  canDelete: z.boolean().default(false),
  sourceProvider: z.enum(["device", "youtube"]),
  renderOptions: z
    .object({
      aspectRatio: z.enum(["9:16", "16:9", "1:1"]),
      captions: z.boolean(),
    })
    .default({ aspectRatio: "9:16", captions: true }),
  generation: z.object({
    revision: z.number().default(0),
    enabled: z.boolean(),
    status: z.enum([
      "not_started",
      "queued",
      "processing",
      "completed",
      "failed",
    ]),
    message: z.string().nullable(),
    stage: z
      .enum(["source", "transcription", "selection", "rendering", "storage"])
      .nullable()
      .optional(),
    canStart: z.boolean(),
    clips: z.array(
      z.object({
        index: z.number(),
        title: z.string(),
        start: z.number(),
        end: z.number(),
        sizeBytes: z.number(),
        width: z.number().default(720),
        height: z.number().default(1280),
      }),
    ),
  }),
  transcription: z.object({
    provider: z.enum(["local", "groq", "deepinfra", "mixed"]).default("local"),
    enabled: z.boolean(),
    status: z.enum([
      "not_started",
      "queued",
      "processing",
      "completed",
      "failed",
    ]),
    message: z.string().nullable(),
    maxSeconds: z.number(),
    canStart: z.boolean(),
  }),
});
export type Video = z.infer<typeof videoSchema>;
export const videoResponseSchema = z.object({ video: videoSchema });

export const transcriptResponseSchema = z.object({
  transcript: z.object({
    language: z.string(),
    model: z.string(),
    emptyReason: z.enum(["no_audio", "no_speech"]).optional(),
    segments: z.array(
      z.object({
        start: z.number(),
        end: z.number(),
        text: z.string(),
        words: z.array(
          z.object({ start: z.number(), end: z.number(), word: z.string() }),
        ),
      }),
    ),
  }),
});
