import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ContentShell } from "@/components/content/content-shell";
import { ArticleCards } from "@/components/content/article-cards";
import { StructuredData } from "@/components/content/structured-data";
import { articles, readingMinutes } from "@/content/articles";
import { topics, articlesForTopic } from "@/content/topics";
import { absoluteUrl, breadcrumbData, publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata({
  title: "Blog: video editing, creator workflows and gaming",
  description:
    "Practical video editing and publishing guides, podcast and webinar clip ideas, and GTA 6 stories with real photographs and official sources.",
  path: "/blog",
});

export default function BlogPage() {
  const featured = articles[0];
  return (
    <ContentShell>
      <StructuredData
        data={breadcrumbData([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
        ])}
      />
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Clipvelto Blog",
          url: absoluteUrl("/blog"),
          mainEntity: {
            "@type": "ItemList",
            itemListElement: articles.map((post, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: post.title,
              url: absoluteUrl(`/blog/${post.slug}`),
            })),
          },
        }}
      />
      <div className="container">
        <header className="editorial-heading">
          <h1>Blog</h1>
          <p>
            Editing advice, publishing guides and ideas for your next video.
          </p>
        </header>
        <nav className="blog-topics" aria-label="Blog topics">
          <Link href="/blog#top" aria-current="page">
            All articles <span>{articles.length}</span>
          </Link>
          {topics.map((topic) => (
            <Link key={topic.slug} href={`/blog/topics/${topic.slug}#top`}>
              {topic.title}
              <span>{articlesForTopic(topic.slug).length}</span>
            </Link>
          ))}
        </nav>
        <section className="blog-feature" aria-labelledby="featured-title">
          <Link
            className="blog-feature-image"
            href={`/blog/${featured.slug}#top`}
            tabIndex={-1}
            aria-hidden="true"
          >
            <Image
              src={featured.image}
              alt=""
              width={1200}
              height={675}
              sizes="(max-width: 900px) 100vw, 650px"
              preload
            />
          </Link>
          <div>
            <p className="article-category">
              {featured.category} · {readingMinutes(featured)} min read
            </p>
            <h2 id="featured-title">
              <Link href={`/blog/${featured.slug}#top`}>{featured.title}</Link>
            </h2>
            <p className="blog-feature-description">{featured.description}</p>
            <Link
              className="content-text-link"
              href={`/blog/${featured.slug}#top`}
            >
              Read article <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
        <section aria-labelledby="latest-articles-title">
          <div className="content-section-heading">
            <h2 id="latest-articles-title">More articles</h2>
          </div>
          <ArticleCards posts={articles.slice(1)} />
        </section>
        <section className="editorial-standards" id="editorial">
          <div>
            <h2>About the blog</h2>
            <p>
              Written by the Clipvelto editorial team for people recording,
              editing and publishing video. Platform and game information links
              to official sources; articles show when the information was
              checked.
            </p>
            <p>
              Photography and publisher screenshots are credited beside each
              image. Stock photographs illustrate the topic and do not imply an
              endorsement of Clipvelto.
            </p>
          </div>
          <div>
            <h3>Have a question or correction?</h3>
            <Link className="content-text-link" href="/contact">
              Contact us <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="content-text-link" href="/youtube-to-shorts">
              Explore the tool <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </ContentShell>
  );
}
