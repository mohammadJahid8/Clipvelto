import type { Metadata } from "next";
import { VideoInput } from "@/components/dashboard/video-input";
import "@/styles/uploads.css";

export const metadata: Metadata = { title: "Upload a video — Clipvelto" };
export default function UploadPage() {
  return (
    <>
      <div className="dashboard-page-heading">
        <div>
          <h1>Start with your video.</h1>
          <p>Add a YouTube link or upload a recording from your device.</p>
        </div>
      </div>
      <VideoInput />
    </>
  );
}
