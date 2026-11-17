"use client";

import { ArrowUpRight, FileVideo, Upload, X } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

export function UploadPreview() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState("");

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (
      !["video/mp4", "video/webm", "video/quicktime"].includes(selected.type)
    ) {
      setFile(null);
      setError("Choose an MP4, MOV, or WebM video to preview file selection.");
      event.target.value = "";
      return;
    }
    setError("");
    setFile({ name: selected.name, size: selected.size });
  }

  return (
    <section
      id="start"
      tabIndex={-1}
      className="container start-section"
      aria-labelledby="start-title"
    >
      <div className="start-copy">
        <span className="status-tag">
          <span />A first look at Clipvelto
        </span>
        <h2 id="start-title">
          Your next short
          <br />
          is already in there.
        </h2>
        <p>
          Podcasts. Deep dives. Everyday stories.
          <br />
          Give your best moments a little more life.
        </p>
      </div>
      <div className="upload-preview">
        <div className="upload-icon">
          <Upload size={25} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <h3>Got a video in mind?</h3>
        <p>Try selecting a video from your device.</p>
        <button
          className="button button-primary"
          onClick={() => input.current?.click()}
        >
          Choose a video <ArrowUpRight size={18} aria-hidden="true" />
        </button>
        <input
          ref={input}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm"
          onChange={selectFile}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a video for local preview"
        />
        <p className="upload-formats">MP4, MOV, or WebM</p>
        <div className="file-status" role="status" aria-live="polite">
          {error && <p className="file-error">{error}</p>}
          {file && (
            <div className="selected-file">
              <FileVideo size={20} aria-hidden="true" />
              <span>
                <strong>{file.name}</strong>
                <small>
                  {(file.size / 1024 / 1024).toFixed(1)} MB · Selected locally
                </small>
              </span>
              <button
                className="icon-button"
                aria-label="Remove selected video"
                onClick={() => {
                  setFile(null);
                  if (input.current) input.current.value = "";
                }}
              >
                <X size={17} />
              </button>
            </div>
          )}
        </div>
        <p className="upload-disclaimer">
          Preview only. Your file stays on your device.
          <br />
          Sign in to upload privately. Clip creation is coming soon.
        </p>
      </div>
    </section>
  );
}
