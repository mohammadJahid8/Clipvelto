import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { articles } from "@/content/articles";
import { workflows } from "@/content/workflows";
import { topics } from "@/content/topics";

// Article sharing cards follow the same content collection as the blog and sitemap.
const cards = [
  {
    slug: "home",
    title: "Long videos. Great moments. Better shorts.",
    label: "Your next clip starts here",
  },
  {
    slug: "creator-guides",
    title: "Editing, publishing and ideas for your next video.",
    label: "Clipvelto Blog",
  },
  {
    slug: "contact",
    title: "Let’s get your question to the right place.",
    label: "Contact Clipvelto",
  },
  {
    slug: "privacy",
    title: "Your recordings. Your information. Clear choices.",
    label: "Privacy policy",
  },
  {
    slug: "terms",
    title: "A clear starting point for creating together.",
    label: "Terms & conditions",
  },
  ...topics.map((topic) => ({
    slug: `topic-${topic.slug}`,
    title: topic.title,
    label: "From the Clipvelto Blog",
  })),
  ...articles.map((post) => ({
    slug: post.slug,
    title: post.title,
    label: post.category,
  })),
  ...workflows.map((workflow) => ({
    slug: workflow.slug,
    title: workflow.heading,
    label:
      workflow.slug === "youtube-to-shorts"
        ? "YouTube to Shorts"
        : "Video podcast clips",
  })),
];

export const dynamic = "force-static";
// Resolve newly added content without a stale development parameter list.
// The card lookup below still rejects every unknown slug before rendering.
export const dynamicParams = true;
export function generateStaticParams() {
  return cards.map((card) => ({ slug: card.slug }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const card = cards.find((item) => item.slug === slug);
  if (!card) notFound();
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#111b16",
        color: "#f0f3e9",
        padding: "52px 60px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 15,
          fontSize: 32,
          fontWeight: 700,
        }}
      >
        <svg width="43" height="43" viewBox="0 0 43 43">
          <rect width="43" height="43" rx="12" fill="#b2e455" />
          <path d="M17 11L32 21.5L17 32Z" fill="#17280f" />
        </svg>
        Clipvelto
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 45 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              display: "flex",
              color: "#b2e455",
              fontSize: 23,
              marginBottom: 22,
            }}
          >
            {card.label}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: card.title.length > 76 ? 51 : 59,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-2px",
            }}
          >
            {card.title}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 208,
            height: 330,
            border: "3px solid #b2e455",
            borderRadius: 23,
            background: "#23372b",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 136,
              height: 206,
              border: "2px solid #6e936e",
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="52" height="62" viewBox="0 0 52 62">
              <path d="M8 5L47 31L8 57Z" fill="#b2e455" />
            </svg>
          </div>
          <div
            style={{
              display: "flex",
              position: "absolute",
              bottom: 23,
              left: 24,
              width: 156,
              height: 12,
              borderRadius: 4,
              background: "#b2e455",
            }}
          />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderTop: "1px solid #3c5140",
          paddingTop: 22,
          fontSize: 22,
          color: "#bdcbbb",
        }}
      >
        <span>Make more of every recording.</span>
        <span>clipvelto.com</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}
