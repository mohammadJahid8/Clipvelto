import type { MetadataRoute } from "next";
import { articles } from "@/content/articles";
import { workflows } from "@/content/workflows";
import { absoluteUrl } from "@/lib/seo";
import { topics, articlesForTopic } from "@/content/topics";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl(), changeFrequency: "monthly", priority: 1 },
    { url: absoluteUrl("/gta-6-countdown"), lastModified: "2026-11-19", changeFrequency: "daily", priority: 0.9, images: [absoluteUrl("/blog/gta-6-jason-lucia.jpg"), absoluteUrl("/blog/gta-6-vice-city.jpg")] },
    {
      url: absoluteUrl("/blog"),
      lastModified: articles
        .map((post) => post.modified)
        .sort()
        .at(-1),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...articles.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: post.modified,
      images: [
        absoluteUrl(post.image),
        ...post.sections.flatMap((section) =>
          section.image ? [absoluteUrl(section.image.src)] : [],
        ),
      ].filter((image, index, images) => images.indexOf(image) === index),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...topics.map((topic) => ({
      url: absoluteUrl(`/blog/topics/${topic.slug}`),
      lastModified: articlesForTopic(topic.slug)
        .map((post) => post.modified)
        .sort()
        .at(-1),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...workflows.map((workflow) => ({
      url: absoluteUrl(`/${workflow.slug}`),
      lastModified: "2026-11-17",
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...["privacy", "terms", "refunds", "contact"].map((page) => ({
      url: absoluteUrl(`/${page}`),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];
}
