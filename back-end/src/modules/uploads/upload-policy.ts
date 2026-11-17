import { z } from "zod";
import type { Env } from "../../config/env.js";
import { renderOptionsSchema } from "../clips/render-options.js";

export const uploadTypes = {
  "video/mp4": ["mp4"],
  "video/quicktime": ["mov"],
  "video/webm": ["webm"],
} as const;
export const uploadUrlSeconds = 600;
export const uploadSessionMinutes = 30;

export function uploadRequestSchema(env: Env) {
  return z
    .object({
      filename: z
        .string()
        .trim()
        .min(1)
        .max(255)
        .refine(
          (value) =>
            value.lastIndexOf(".") > 0 &&
            value.slice(0, value.lastIndexOf(".")).trim().length > 0,
          "Use a filename with a title and extension",
        )
        .refine(
          (value) =>
            !value.includes("/") &&
            !value.includes("\\") &&
            [...value].every(
              (character) =>
                character.codePointAt(0)! >= 32 &&
                character.codePointAt(0)! !== 127,
            ),
          "Use a plain filename",
        ),
      contentType: z.enum(["video/mp4", "video/quicktime", "video/webm"]),
      sizeBytes: z.number().int().positive().max(env.UPLOAD_MAX_BYTES),
      durationSeconds: z.number().finite().positive().optional(),
      ownsRights: z.literal(true),
      renderOptions: renderOptionsSchema,
    })
    .strict()
    .refine(
      (value) =>
        (uploadTypes[value.contentType] as readonly string[]).includes(
          value.filename.split(".").at(-1)?.toLowerCase() ?? "",
        ),
      "The extension must match the video type",
    );
}
