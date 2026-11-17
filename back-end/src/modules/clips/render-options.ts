import { z } from "zod";

export const renderOptionsSchema = z
  .object({
    aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
    captions: z.boolean(),
  })
  .strict();
export const defaultRenderOptions = {
  aspectRatio: "9:16" as const,
  captions: true,
};
export type RenderOptions = z.infer<typeof renderOptionsSchema>;
export const trialPreviewDimensions = { width: 720, height: 1280 } as const;
export const outputDimensions = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
} as const;
