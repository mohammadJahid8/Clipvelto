import type { Metadata } from "next";
import Link from "next/link";
import { getVideos } from "@/lib/server-api";
import { UploadVideoButton } from "@/components/dashboard/upload-video-button";
import { VideoList } from "@/components/dashboard/video-list";
import { z } from "zod";

export const metadata: Metadata = { title: "My videos — Clipvelto" };
export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const parsed = z
    .string()
    .regex(/^[a-f0-9]{24}$/i)
    .optional()
    .safeParse(cursor);
  const page = await getVideos(parsed.success ? parsed.data : undefined);
  return (
    <>
      <div className="dashboard-page-heading">
        <div>
          <h1>My videos</h1>
        </div>
        <UploadVideoButton />
      </div>
      {!parsed.success && (
        <p className="form-alert" role="status">
          That page link wasn’t valid. Showing your latest videos.
        </p>
      )}
      <section className="workspace-panel" aria-label="Video library">
        <VideoList videos={page.videos} />
      </section>
      {(cursor || page.nextCursor) && (
        <nav className="video-pagination" aria-label="Video pages">
          <Link className="button button-secondary" href="/dashboard/videos">
            Latest videos
          </Link>
          {page.nextCursor && (
            <Link
              className="button button-secondary"
              href={`/dashboard/videos?cursor=${page.nextCursor}`}
            >
              Older videos →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
