import Image from "next/image";
import { ExternalLink } from "lucide-react";
import type { SourceLink } from "@/content/articles";

export function ArticleImage({
  src,
  alt,
  caption,
  source,
  priority = false,
  className = "editorial-image",
}: {
  src: string;
  alt: string;
  caption: string;
  source?: SourceLink;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={className}>
      <Image
        src={src}
        alt={alt}
        width={1920}
        height={1080}
        sizes="(max-width: 840px) calc(100vw - 40px), 800px"
        preload={priority}
      />
      <figcaption>
        <span>{caption}</span>
        {source && (
          <a
            href={source.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${source.label} (opens in a new tab)`}
          >
            Source <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </figcaption>
    </figure>
  );
}
