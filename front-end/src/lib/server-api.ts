import "server-only";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { videoSchema } from "./video-schema";
export type { Video } from "./video-schema";
import { cache } from "react";
import { z } from "zod";
import { billingSchema } from "./billing-schema";
import { adminUsersSchema } from "./admin-users-schema";

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  image: z.string().nullable().optional(),
  emailVerified: z.boolean(),
  createdAt: z.string(),
  role: z.enum(["free", "admin"]).default("free"),
});
export type User = z.infer<typeof userSchema>;
const videoPageSchema = z.object({
  videos: z.array(videoSchema),
  nextCursor: z.string().nullable(),
});
const dashboardSchema = z.object({
  videos: z.number().int().nonnegative(),
  processing: z.number().int().nonnegative(),
  credits: z.object({
    available: z.number().nullable(),
    reserved: z.number(),
    used: z.number(),
    allowance: z.number(),
    role: z.enum(["free", "admin"]),
    status: z.enum(["available", "unlimited"]),
  }),
  clipGenerationAvailable: z.boolean(),
});

async function apiRequest(path: string) {
  const requestHeaders = await headers();
  try {
    return await fetch(
      `${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000"}/api/v1${path}`,
      {
        headers: { cookie: requestHeaders.get("cookie") ?? "" },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch {
    throw new Error(
      "We couldn’t connect to your workspace. Please try again shortly.",
    );
  }
}

async function readApi<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await apiRequest(path);
  if (response.status === 401) redirect("/sign-in");
  if (response.status === 403) redirect("/verify-email");
  if (response.status === 404) notFound();
  if (!response.ok)
    throw new Error(
      "We couldn’t load your workspace. Please try again shortly.",
    );
  return schema.parse(await response.json());
}

export const requireUser = cache(
  async () => (await readApi("/me", z.object({ user: userSchema }))).user,
);
export const optionalUser = cache(async () => {
  try {
    const h = await headers();
    if (!h.get("cookie")?.includes("clipvelto")) return null;
    const r = await apiRequest("/me");
    if (!r.ok) return null;
    return z.object({ user: userSchema }).parse(await r.json()).user;
  } catch {
    return null;
  }
});
export const getCredits = () =>
  readApi(
    "/credits",
    z.object({
      credits: dashboardSchema.shape.credits,
      history: z.array(
        z.object({
          _id: z.string(),
          seconds: z.number(),
          state: z.string(),
          reason: z.string().optional(),
          createdAt: z.string(),
        }),
      ),
    }),
  );
export const getDashboard = () => readApi("/dashboard", dashboardSchema);
export const getBilling = () => readApi("/billing", billingSchema);
export async function getAdminUsers(cursor?: string) {
  const user = await requireUser();
  if (user.role !== "admin") notFound();
  const response = await apiRequest(
    `/admin/users${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
  if (response.status === 401) redirect("/sign-in");
  // The API independently checks the current role, including revocations.
  if (response.status === 403 || response.status === 404) notFound();
  if (!response.ok)
    throw new Error("We couldn’t load users. Please try again.");
  return adminUsersSchema.parse(await response.json());
}
export const getVideos = (cursor?: string, limit = 12) =>
  readApi(
    `/videos?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    videoPageSchema,
  );
export const getVideo = (id: string) =>
  readApi(
    `/videos/${encodeURIComponent(id)}`,
    z.object({ video: videoSchema }),
  );
