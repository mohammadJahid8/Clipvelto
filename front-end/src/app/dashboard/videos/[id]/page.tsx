import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVideo } from "@/lib/server-api";
import { VideoDetail } from "@/components/dashboard/video-detail";
import "@/styles/uploads.css";

export const metadata: Metadata = { title: "Your video — Clipvelto" };
export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  const { video } = await getVideo(id);
  return (
    <>
      <div className="dashboard-page-heading">
        <div>
          <h1>Your video</h1>
          <p>Follow progress, preview your clips and download them here.</p>
        </div>
      </div>
      <VideoDetail initialVideo={video} />
    </>
  );
}
