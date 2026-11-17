import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ArticleCards } from "./article-cards";
import { articles } from "@/content/articles";

export function BlogHighlights() {
  return (
    <section
      className="container section content-highlights"
      aria-labelledby="creator-guides-title"
    >
      <div className="content-section-heading">
        <div>
          <h2 id="creator-guides-title">From the blog</h2>
          <p>
            Editing advice, publishing guides and ideas for your next video.
          </p>
        </div>
        <Link href="/blog" className="content-text-link">
          All articles <ArrowUpRight size={19} aria-hidden="true" />
        </Link>
      </div>
      <ArticleCards
        posts={articles.filter((post) =>
          [
            "gta-6-release-date-platforms-creator-guide",
            "youtube-shorts-length-size-guide",
            "turn-podcast-into-short-clips",
          ].includes(post.slug),
        )}
      />
    </section>
  );
}
