import { articles, type Article, type ArticleTopic } from "./articles";

export const topics: {
  slug: ArticleTopic;
  title: string;
  description: string;
  intro: string;
}[] = [
  {
    slug: "gaming",
    title: "Gaming & GTA 6",
    description:
      "GTA 6 system requirements, download size, editions, music, vehicles and exploration, with official sources and screenshots.",
    intro:
      "Get ready for GTA 6, explore the places and vehicles Rockstar has shown, and find the official music previews. Start with the setup and storage guides, compare the editions, or browse ideas for your first trip around Leonida. Articles distinguish confirmed information from exploration suggestions.",
  },
  {
    slug: "video-editing",
    title: "Video editing & Shorts",
    description:
      "Fix black bars, understand export quality and choose a frame that keeps the important part of your video visible.",
    intro:
      "A portrait file can still contain a tiny landscape picture. A 1080p export can still look soft. These guides explain the decisions behind a good short video, with practical checks for framing, source quality and YouTube publishing. Start with the problem you can actually see in your clip.",
  },
  {
    slug: "podcasts",
    title: "Podcast clips",
    description:
      "Find complete podcast moments, write honest openings and turn longer conversations into short videos that make sense on their own.",
    intro:
      "A good podcast clip gives a new listener a reason to keep watching. Learn how to choose a complete answer, write an opening that fits it and keep the speaker’s meaning intact. Start with a selection guide, then try the example openings on your next episode.",
  },
  {
    slug: "repurposing",
    title: "Interviews & webinars",
    description:
      "Practical ways to turn interviews, webinars and educational recordings into useful short clips without losing the original context.",
    intro:
      "Long recordings often contain several different kinds of useful material: a question, a demonstration, an example or a correction. These guides help you build a small editorial plan around those moments. Keep the evidence and the explanation together, especially when a short extract changes how a statement sounds.",
  },
];

export function articleTopic(post: Article) {
  if (post.topic) return post.topic;
  if (post.category === "Gaming creators" || post.category === "GTA 6 guides")
    return "gaming";
  if (post.category === "Podcast creators") return "podcasts";
  return "video-editing";
}
export function topicForArticle(post: Article) {
  return topics.find((topic) => topic.slug === articleTopic(post))!;
}
export function articlesForTopic(slug: string) {
  return articles.filter((post) => articleTopic(post) === slug);
}
export function relatedArticles(post: Article) {
  return articles
    .filter((item) => item.slug !== post.slug)
    .sort(
      (a, b) =>
        Number(articleTopic(b) === articleTopic(post)) -
        Number(articleTopic(a) === articleTopic(post)),
    )
    .slice(0, 3);
}
