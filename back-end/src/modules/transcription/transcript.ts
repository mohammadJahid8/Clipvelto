import { z } from "zod";
import { maximumProcessingSeconds } from "../uploads/processing-limits.js";

const time = z.number().finite().nonnegative();
export const transcriptSchema = z
  .object({
    language: z.string().min(2).max(20),
    model: z.enum([
      "tiny",
      "base",
      "small",
      "whisper-large-v3-turbo",
      "whisper-large-v3",
    ]),
    provider: z.enum(["local", "groq", "deepinfra", "mixed"]).optional(),
    emptyReason: z.enum(["no_audio", "no_speech"]).optional(),
    segments: z.array(
      z.object({
        start: time,
        end: time,
        text: z.string().trim().min(1).max(10000),
        words: z
          .array(
            z.object({
              start: time,
              end: time,
              word: z.string().min(1).max(1000),
            }),
          )
          .max(2000),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    let previous = 0;
    for (const segment of value.segments) {
      if (
        segment.start < previous ||
        segment.end < segment.start ||
        segment.end > maximumProcessingSeconds + 1 ||
        segment.words.some(
          (word) =>
            word.end < word.start ||
            word.start < segment.start - 0.1 ||
            word.end > segment.end + 0.1,
        )
      )
        ctx.addIssue({
          code: "custom",
          message: "Invalid transcript timestamps",
        });
      previous = segment.end;
    }
    if ((value.segments.length === 0) !== !!value.emptyReason)
      ctx.addIssue({
        code: "custom",
        message: "Invalid transcript size or empty result",
      });
  });
export type Transcript = z.infer<typeof transcriptSchema>;

function timestamp(seconds: number) {
  const milliseconds = Math.round(seconds * 1000);
  return `${String(Math.floor(milliseconds / 3600000)).padStart(2, "0")}:${String(Math.floor(milliseconds / 60000) % 60).padStart(2, "0")}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")},${String(milliseconds % 1000).padStart(3, "0")}`;
}
export function transcriptText(transcript: Transcript, format: "txt" | "srt") {
  if (format === "txt")
    return transcript.segments.map((segment) => segment.text).join("\n") + "\n";
  return transcript.segments
    .map(
      (segment, index) =>
        `${index + 1}\n${timestamp(segment.start)} --> ${timestamp(segment.end)}\n${segment.text.replace(/[\r\n]+/g, " ")}\n`,
    )
    .join("\n");
}
