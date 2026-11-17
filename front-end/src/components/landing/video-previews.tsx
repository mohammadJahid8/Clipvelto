import Image from "next/image";

const previews = [
  {
    src: "/previews/chase.webp",
    alt: "Gaming clip example: a nighttime city chase, with a title and duration",
    width: 196,
    height: 422,
  },
  {
    src: "/previews/jump.webp",
    alt: "Gaming clip example: a car jumping above a city, captioned This Jump Was Crazy, 35 seconds",
    width: 240,
    height: 495,
  },
  {
    src: "/previews/reaction.webp",
    alt: "Entertainment clip example: a creator reacting on camera, 28 seconds",
    width: 195,
    height: 421,
  },
];

export function VideoPreviews() {
  return (
    <figure className="preview-figure" aria-label="Illustrative clip previews">
      <div className="video-previews" aria-label="Three example vertical clips">
        {previews.map((preview, index) => (
          <div
            key={preview.src}
            className={`video-preview${index === 1 ? " video-preview-featured" : ""}`}
          >
            <Image
              {...preview}
              alt={preview.alt}
              sizes="(max-width: 600px) 32vw, (max-width: 1000px) 24vw, 210px"
              preload={index === 1}
              loading={index === 1 ? undefined : "eager"}
            />
          </div>
        ))}
      </div>
    </figure>
  );
}
