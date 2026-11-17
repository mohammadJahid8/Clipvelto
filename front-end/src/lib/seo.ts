import type { Metadata } from "next";

export const site = {
  name: "Clipvelto",
  url: "https://clipvelto.com",
  description:
    "Turn long videos into short clips with AI highlight selection, optional captions, and vertical, horizontal or square MP4 exports.",
};

export const absoluteUrl = (path = "/") => new URL(path, site.url).toString();

export const sharingImage = {
  url: absoluteUrl("/opengraph-image.png?v=2"),
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "Clipvelto — Video to shorts",
};

export function publicMetadata({
  title,
  description,
  path,
  article,
}: {
  title: string;
  description: string;
  path: string;
  article?: { published: string; modified: string; section: string };
}): Metadata {
  const fullTitle = `${title} | ${site.name}`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: {
      type: article ? "article" : "website",
      title: fullTitle,
      description,
      url: absoluteUrl(path),
      siteName: site.name,
      locale: "en_US",
      images: [sharingImage],
      ...(article && {
        publishedTime: article.published,
        modifiedTime: article.modified,
        section: article.section,
        authors: [absoluteUrl("/blog#editorial")],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [sharingImage],
    },
  };
}

export function breadcrumbData(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
