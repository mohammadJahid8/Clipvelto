"use client";

import { ProcessingProgress } from "@/components/ui/processing-progress";

const phases = ["Import video", "Find highlights", "Create preview", "Finish up"];
const stages: Record<string, { step: number; title: string; detail: string }> = {
  starting: { step: 0, title: "Starting your preview…", detail: "Checking your link and getting things ready." },
  queued: { step: 0, title: "Your video is in the queue.", detail: "We’ll start as soon as the current job finishes." },
  importing: { step: 0, title: "Bringing in your video…", detail: "We’re importing only the first three minutes." },
  transcribing: { step: 1, title: "Finding the good moments…", detail: "We’re reading the speech and its timing." },
  selecting: { step: 1, title: "Choosing your best highlight…", detail: "Looking for a moment that works as a short clip." },
  rendering: { step: 2, title: "Creating your first clip…", detail: "Framing the video and adding captions." },
  finishing: { step: 3, title: "Your preview is almost ready…", detail: "Saving it so you can watch it right here." },
};

export function TrialProgress({ stage = "queued", startedAt }: { stage?: string; startedAt?: string }) {
  const current = stages[stage] ?? stages.queued;
  return <ProcessingProgress {...current} phases={phases} startedAt={startedAt}
    label="Preview generation steps"
    completionNote="Your preview will appear here automatically."
    slowNote="This is taking a little longer. We’re still working on your video. Waiting doesn’t use extra credits." />;
}
