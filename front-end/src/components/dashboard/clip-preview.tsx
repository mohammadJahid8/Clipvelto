"use client";

import { useState } from "react";

export function ClipPreview({
  src,
  title,
  width = 720,
  height = 1280,
  captions = true,
}: {
  src: string;
  title: string;
  width?: number;
  height?: number;
  captions?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  return (
    <div className="clip-preview">
      <video
        key={attempt}
        src={`${src}?attempt=${attempt}`}
        controls
        playsInline
        preload="metadata"
        style={{ aspectRatio: `${width} / ${height}` }}
        aria-label={`Preview: ${title}.${captions ? " Captions are included in the video." : ""}`}
        onError={() => setFailed(true)}
        onLoadedMetadata={() => setFailed(false)}
      >
        Your browser cannot play this video. Use Download MP4 to watch it.
      </video>
      {failed && (
        <div className="clip-preview-error" role="status">
          <p>Preview couldn’t load. Try again or download the MP4.</p>
          <button
            className="button button-secondary"
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            Reload preview
          </button>
        </div>
      )}
    </div>
  );
}
