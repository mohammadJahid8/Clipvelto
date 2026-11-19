"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { z } from "zod";
import { clientApi } from "@/lib/client-api";
import { WorkspaceHelp } from "./workspace-help";
import {
  transcriptResponseSchema,
  type Video,
} from "@/lib/video-schema";

type Transcript = z.infer<typeof transcriptResponseSchema>["transcript"];
function timestamp(seconds: number) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function VideoTranscript({
  video,
}: {
  video: Video;
}) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(50);
  const [reload, setReload] = useState(0);
  const { status } = video.transcription;
  useEffect(() => {
    if (status !== "completed") return;
    const controller = new AbortController();
    clientApi(`/videos/${video.id}/transcript`, { signal: controller.signal })
      .then((data) => {
        setTranscript(transcriptResponseSchema.parse(data).transcript);
        setError("");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("We couldn’t load this transcript. Please try again.");
      });
    return () => controller.abort();
  }, [video.id, status, reload]);
  if (video.status !== "ready" || status !== "completed") return null;
  return (
    <section
      className="workspace-panel transcript-panel"
      aria-labelledby="transcript-heading"
    >
      <div className="transcript-heading">
        <div>
          <h2 id="transcript-heading">
            <FileText size={21} aria-hidden="true" />
            Transcript
          </h2>
        </div>
      </div>
      {status === "completed" && !transcript && !error && (
        <p>Loading transcript…</p>
      )}
      {error && (
        <div className="form-alert" role="alert">
          <p>{error}</p>
          {status === "completed" && (
            <button
              className="button button-secondary"
              onClick={() => setReload((value) => value + 1)}
            >
              Reload transcript
            </button>
          )}
        </div>
      )}
      {transcript && transcript.segments.length > 0 && (
        <>
          <div className="transcript-downloads">
            <a
              className="button button-secondary"
              href={`/api/v1/videos/${video.id}/transcript?format=txt`}
              download
            >
              <Download size={16} aria-hidden="true" />
              Download text
            </a>
            <a
              className="button button-secondary"
              href={`/api/v1/videos/${video.id}/transcript?format=srt`}
              download
            >
              <Download size={16} aria-hidden="true" />
              Download subtitles
            </a>
          </div>
          <WorkspaceHelp title="Read transcript">
          <ol
            className="transcript-segments"
            aria-label="Timestamped transcript"
          >
            {transcript.segments.slice(0, visible).map((segment, index) => (
              <li key={index}>
                <span
                  className="transcript-time"
                  aria-label={`From ${timestamp(segment.start)} to ${timestamp(segment.end)}`}
                >
                  {timestamp(segment.start)}–{timestamp(segment.end)}
                </span>
                <p>{segment.text}</p>
              </li>
            ))}
          </ol>
          {visible < transcript.segments.length && (
            <button
              className="button button-secondary"
              onClick={() => setVisible((value) => value + 50)}
            >
              Show more transcript
            </button>
          )}
          </WorkspaceHelp>
        </>
      )}
    </section>
  );
}
