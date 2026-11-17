import type { Metadata } from "next";

export const site = {
  name: "Clipvelto",
  url: "https://clipvelto.com",
  description:
    "Turn long videos into short clips with AI highlight selection, optional captions, and vertical, horizontal or square MP4 exports.",
};

export const absoluteUrl = (path = "/") => new URL(path, site.url).toString();

export function publicMetadata({
  title,
  description,
  path,
  image = "/opengraph-image.png",
  article,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  article?: { published: string; modified: string; section: string };
}): Metadata {
  const fullTitle = `${title} | ${site.name}`;
  const socialImage = {
    url: absoluteUrl(image),
    width: 1200,
    height: 630,
    alt: title,
  };
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
      images: [socialImage],
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
      images: [socialImage],
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
