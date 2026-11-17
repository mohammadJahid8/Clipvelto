import { z } from "zod";
import { renderOptionsSchema } from "../clips/render-options.js";

export function youtubeVideoId(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    url.searchParams.has("list")
  )
    throw new Error("Use a single HTTPS YouTube video link");
  let id: string | null = null;
  if (url.hostname === "youtu.be" && /^\/[^/]+\/?$/.test(url.pathname))
    id = url.pathname.split("/")[1];
  if (
    ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
  ) {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else
      id =
        /^\/(?:live|shorts|embed)\/([\w-]{11})\/?$/.exec(url.pathname)?.[1] ??
        null;
  }
  if (!id || !/^[\w-]{11}$/.test(id))
    throw new Error(
      "Use a YouTube video or livestream link, not a playlist or channel",
    );
  return id;
}
export const youtubeRequestSchema = z
  .object({
    url: z
      .string()
      .max(2000)
      .transform((value, ctx) => {
        try {
          return youtubeVideoId(value);
        } catch {
          ctx.addIssue({
            code: "custom",
            message: "Enter a single YouTube video or livestream URL.",
          });
          return z.NEVER;
        }
      }),
    ownsRights: z.literal(true),
    renderOptions: renderOptionsSchema,
    captureSeconds: z.number().int().min(60).max(600).default(300),
  })
  .strict();
