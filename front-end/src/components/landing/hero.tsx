import { ArrowDown, ArrowUpRight, Check, Upload } from "lucide-react";
import { VideoPreviews } from "@/components/landing/video-previews";

export function Hero() {
  return (
    <section className="container hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title">
          Long videos.
          <br />
          Great moments.
          <br />
          <span>Better shorts.</span>
        </h1>
        <p className="hero-description">
          Turn long videos into shorts worth watching. Find the moments that
          matter and get ready-to-post clips with captions.
        </p>
        <div className="hero-actions">
          <a className="button button-primary button-large" href="#start">
            <Upload size={18} aria-hidden="true" />
            Try a free preview <ArrowUpRight size={18} aria-hidden="true" />
          </a>
          <a
            className="button button-secondary button-large"
            href="#how-it-works"
          >
            See how it works <ArrowDown size={17} aria-hidden="true" />
          </a>
        </div>
        <p className="hero-note">
          <Check size={14} aria-hidden="true" />
          15 free minutes <span>·</span> No card needed
        </p>
      </div>
      <VideoPreviews />
    </section>
  );
}
