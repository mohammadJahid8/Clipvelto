"use client";

import type { Video } from "@/lib/video-schema";
import { ProcessingProgress } from "@/components/ui/processing-progress";

export function VideoProcessing({ video }: { video: Video }) {
  const importing = video.sourceProvider === "youtube";
  const phases = [importing ? "Import video" : "Check video", "Read speech", "Find highlights", "Create clips"];
  let step = 0;
  let title = "Your video is in the queue.";
  let detail = "We’ll start as soon as the current job finishes.";

  if (video.status === "awaiting_upload") {
    title = "Waiting for your upload…";
    detail = "Finish uploading your file to start creating clips.";
  } else if (video.status === "importing") {
    title = "Bringing in your video…";
    detail = "Downloading your recording or capturing the selected live window.";
  } else if (video.status === "validating") {
    title = "Checking your video…";
    detail = "Checking the format, size and duration before processing.";
  } else if (video.status === "ready") {
    step = 1;
    if (video.generation.status === "queued") {
      title = "Getting ready to create your clips…";
      detail = "Your video is saved. Processing will continue automatically.";
    } else {
      const stage = video.generation.stage;
      if (stage === "selection") {
        step = 2;
        title = "Finding the best moments…";
        detail = "Choosing highlights that work as complete short clips.";
      } else if (stage === "rendering" || stage === "storage") {
        step = 3;
        title = stage === "storage" ? "Saving your clips…" : "Creating your clips…";
        detail = stage === "storage"
          ? "Preparing your clips for playback and download."
          : `Framing your video${video.renderOptions.captions ? " and adding captions" : ""}.`;
      } else {
        title = stage === "source" ? "Preparing your recording…" : "Reading the speech…";
        detail = stage === "source" ? "Loading your saved video for processing." : "Turning speech into timed text for your highlights.";
      }
    }
  }

  return (
    <div className="workspace-processing">
      <ProcessingProgress step={step} title={title} detail={detail} phases={phases}
        startedAt={video.processingStartedAt ?? video.createdAt}
        label="Clip creation steps"
        completionNote="Your clips will appear here automatically. No extra steps needed."
        slowNote="Longer recordings can take several minutes. You can return to this video from My videos." />
    </div>
  );
}
