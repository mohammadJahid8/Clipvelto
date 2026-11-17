import { z } from "zod";

export function googleProfileImage(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    const googleHost =
      url.hostname === "googleusercontent.com" ||
      url.hostname.endsWith(".googleusercontent.com") ||
      url.hostname === "ggpht.com" ||
      url.hostname.endsWith(".ggpht.com");
    return url.protocol === "https:" &&
      googleHost &&
      !url.username &&
      !url.password &&
      !url.port
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export async function resolveGoogleProfileImage(
  picture: unknown,
  subject: string,
  accessToken?: string,
) {
  const image = googleProfileImage(picture);
  if (image || !accessToken) return image;
  try {
    const response = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { authorization: `Bearer ${accessToken}` },
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      return undefined;
    }
    const body = await response.text();
    if (Buffer.byteLength(body) > 16384) return undefined;
    const profile = z
      .object({ sub: z.string(), picture: z.unknown().optional() })
      .safeParse(JSON.parse(body));
    if (profile.success && profile.data.sub === subject)
      return googleProfileImage(profile.data.picture);
  } catch {
    /* An optional photo must not prevent an otherwise valid sign-in. */
  }
  return undefined;
}
