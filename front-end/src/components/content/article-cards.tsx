import Image from "next/image";
import Link from "next/link";
import { articles, readingMinutes, type Article } from "@/content/articles";

export function ArticleCards({ posts = articles }: { posts?: Article[] }) {
  return (
    <div className="article-cards">
      {posts.map((post) => (
        <article className="article-card" key={post.slug}>
          <Link
            href={`/blog/${post.slug}#top`}
            className="article-card-image"
            tabIndex={-1}
            aria-hidden="true"
          >
            <Image
              src={post.image}
              alt=""
              width={1200}
              height={675}
              sizes="(max-width: 700px) 100vw, (max-width: 1000px) 50vw, 33vw"
            />
          </Link>
          <div className="article-card-body">
            <p className="article-category">
              {post.category} <span aria-hidden="true">·</span>{" "}
              {readingMinutes(post)} min read
            </p>
            <h3>
              <Link href={`/blog/${post.slug}#top`}>{post.title}</Link>
            </h3>
            <p>{post.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
