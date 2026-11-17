import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { topics, articlesForTopic } from "@/content/topics";
import { ContentShell } from "@/components/content/content-shell";
import { ArticleCards } from "@/components/content/article-cards";
import { StructuredData } from "@/components/content/structured-data";
import { absoluteUrl, breadcrumbData, publicMetadata } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() {
  return topics.map((topic) => ({ topic: topic.slug }));
}
type Props = { params: Promise<{ topic: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).topic;
  const current = topics.find((item) => item.slug === slug);
  if (!current) notFound();
  return publicMetadata({
    title: `${current.title}: articles and guides`,
    description: current.description,
    path: `/blog/topics/${current.slug}`,
  });
}
export default async function TopicPage({ params }: Props) {
  const { topic: slug } = await params;
  const topic = topics.find((item) => item.slug === slug);
  if (!topic) notFound();
  const posts = articlesForTopic(topic.slug);
  return (
    <ContentShell>
      <StructuredData
        data={breadcrumbData([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: topic.title, path: `/blog/topics/${topic.slug}` },
        ])}
      />
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: topic.title,
          description: topic.description,
          url: absoluteUrl(`/blog/topics/${topic.slug}`),
          mainEntity: {
            "@type": "ItemList",
            itemListElement: posts.map((post, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: post.title,
              url: absoluteUrl(`/blog/${post.slug}`),
            })),
          },
        }}
      />
      <div className="container">
        <header className="topic-heading">
          <nav className="content-breadcrumb" aria-label="Breadcrumb">
            <Link href="/blog#top">Blog</Link>
            <ArrowRight size={14} aria-hidden="true" />
            <span aria-current="page">{topic.title}</span>
          </nav>
          <h1>{topic.title}</h1>
          <p>{topic.intro}</p>
        </header>
        <nav className="blog-topics" aria-label="Blog topics">
          <Link href="/blog#top">All articles</Link>
          {topics.map((item) => (
            <Link
              key={item.slug}
              href={`/blog/topics/${item.slug}#top`}
              aria-current={item.slug === topic.slug ? "page" : undefined}
            >
              {item.title}
              <span>{articlesForTopic(item.slug).length}</span>
            </Link>
          ))}
        </nav>
        <section aria-label={`${topic.title} articles`}>
          <ArticleCards posts={posts} />
        </section>
      </div>
    </ContentShell>
  );
}
