import { notFound } from "next/navigation";
import { articles } from "@/content/articles";
import { workflows } from "@/content/workflows";
import { topics } from "@/content/topics";
import { sharingImage } from "@/lib/seo";

// Keep previously shared image URLs working without rendering extra cards.
const slugs = new Set([
  "home", "creator-guides", "contact", "privacy", "terms",
  ...topics.map((topic) => `topic-${topic.slug}`),
  ...articles.map((post) => post.slug),
  ...workflows.map((workflow) => workflow.slug),
]);

export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return [...slugs].map((slug) => ({ slug }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!slugs.has((await params).slug)) notFound();
  return Response.redirect(sharingImage.url, 308);
}
