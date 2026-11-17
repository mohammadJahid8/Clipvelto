import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  List,
  ExternalLink,
} from "lucide-react";
import { articles, getArticle, readingMinutes } from "@/content/articles";
import { ContentShell } from "@/components/content/content-shell";
import { ContentSections } from "@/components/content/content-sections";
import { ArticleCards } from "@/components/content/article-cards";
import { StructuredData } from "@/components/content/structured-data";
import { absoluteUrl, breadcrumbData, publicMetadata } from "@/lib/seo";
import { ArticleImage } from "@/components/content/article-image";
import { topicForArticle, relatedArticles } from "@/content/topics";

export const dynamicParams = false;
export function generateStaticParams() {
  return articles.map((post) => ({ slug: post.slug }));
}
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getArticle((await params).slug);
  if (!post) notFound();
  return publicMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    article: {
      published: post.published,
      modified: post.modified,
      section: post.category,
    },
  });
}
const date = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "Asia/Dhaka",
  }).format(new Date(value));

export default async function ArticlePage({ params }: Props) {
  const post = getArticle((await params).slug);
  if (!post) notFound();
  const topic = topicForArticle(post);
  const updated = date(post.modified) !== date(post.published);
  return (
    <ContentShell>
      <StructuredData
        data={breadcrumbData([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: topic.title, path: `/blog/topics/${topic.slug}` },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "@id": absoluteUrl(`/blog/${post.slug}#article`),
          headline: post.title,
          description: post.description,
          image: [
            ...new Set([
              absoluteUrl(post.image),
              ...post.sections.flatMap((section) =>
                section.image ? [absoluteUrl(section.image.src)] : [],
              ),
            ]),
          ],
          datePublished: post.published,
          dateModified: post.modified,
          inLanguage: "en",
          articleSection: post.category,
          author: {
            "@type": "Organization",
            name: "Clipvelto editorial team",
            url: absoluteUrl("/blog#editorial"),
          },
          publisher: { "@id": absoluteUrl("/#organization") },
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": absoluteUrl(`/blog/${post.slug}`),
          },
        }}
      />
      <article className="container editorial-article">
        <header className="article-heading">
          <nav aria-label="Breadcrumb" className="content-breadcrumb">
            <Link href="/blog#top">Blog</Link>
            <ArrowRight size={14} aria-hidden="true" />
            <Link href={`/blog/topics/${topic.slug}#top`}>{topic.title}</Link>
          </nav>
          <h1>{post.title}</h1>
          <p className="article-deck">{post.description}</p>
          <div className="article-byline">
            <span>
              By <Link href="/blog#editorial">Clipvelto editorial team</Link>
            </span>
            <time dateTime={post.published}>{date(post.published)}</time>
            <span>{readingMinutes(post)} min read</span>
            {updated && (
              <span>
                Updated{" "}
                <time dateTime={post.modified}>{date(post.modified)}</time>
              </span>
            )}
          </div>
        </header>
        <ArticleImage
          src={post.image}
          alt={post.imageAlt}
          caption={post.imageCaption}
          source={post.imageSource}
          priority
          className="article-hero"
        />
        <div className="editorial-prose article-reading">
          <details className="article-contents">
            <summary>
              <span>
                <List size={18} aria-hidden="true" /> In this article
              </span>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <nav aria-label="In this article">
              <ol>
                {post.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>{section.title}</a>
                  </li>
                ))}
              </ol>
            </nav>
          </details>
          <p className="article-intro">{post.intro}</p>
          <section
            className="article-takeaways"
            aria-labelledby="key-points-title"
          >
            <h2 id="key-points-title">Key points</h2>
            <ul>
              {post.takeaways.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <ContentSections sections={post.sections} />
          <section className="article-sources" aria-labelledby="sources-title">
            <h2 id="sources-title">Sources</h2>
            <ul>
              {post.sources.map((source) => (
                <li key={source.href}>
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.label}
                    <ExternalLink size={14} aria-hidden="true" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
            <p>
              Information checked {date(post.modified)}.{" "}
              <Link href="/contact">Suggest a correction.</Link>
            </p>
          </section>
          {post.productPath && (
            <section className="editorial-cta">
              <div>
                <h2>Try it with your own recording.</h2>
                <p>
                  Preview a clip from the first three minutes of a supported
                  YouTube video. Trial usage counts toward your 15 free credits.
                </p>
              </div>
              <Link href="/#start" className="button button-primary">
                Create a free preview{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </section>
          )}
        </div>
      </article>
      <section
        className="container article-related"
        aria-labelledby="related-guides-title"
      >
        <div className="content-section-heading">
          <h2 id="related-guides-title">More from the blog</h2>
          <Link href="/blog#top" className="content-text-link">
            All articles <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <ArticleCards posts={relatedArticles(post)} />
      </section>
    </ContentShell>
  );
}
