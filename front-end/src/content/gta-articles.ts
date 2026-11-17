import type { Article } from "./articles";
import { gtaMedia } from "./gta-media";

const published = "2026-11-17T11:21:53Z";
const official = {
  label: "Rockstar Games: GTA VI official site",
  href: "https://www.rockstargames.com/VI",
};
const places = {
  label: "Rockstar Games: Only in Leonida",
  href: "https://www.rockstargames.com/VI/only-in-leonida",
};
const screenshots = {
  label: "Rockstar Games: official GTA VI screenshots",
  href: "https://www.rockstargames.com/VI/media/screenshots",
};

export const gtaArticles: Article[] = [
  {
    slug: "gta-6-release-date-platforms-creator-guide",
    title: "GTA 6 release date, platforms and a creator’s launch checklist",
    description:
      "The confirmed GTA 6 release date, announced platforms, Jason and Lucia, and a practical checklist for recording your first session without spoilers.",
    category: "GTA 6 guides",
    published,
    modified: "2026-11-17T12:20:02Z",
    image: "/blog/gta-6-jason-lucia.jpg",
    imageAlt:
      "Jason and Lucia overlooking the waterfront in an official GTA VI screenshot.",
    imageCaption: "Jason and Lucia. © Rockstar Games.",
    imageSource: screenshots,
    intro:
      "GTA 6 launch coverage is easier to follow when confirmed information is separated from predictions. This pre-launch guide brings together the release date, announced platforms and basic story setup, then turns them into a practical recording checklist for creators. It contains no leaked footage or story walkthrough spoilers.",
    takeaways: [
      "Rockstar’s official site lists November 19, 2026 and PlayStation 5 / Xbox Series X|S as of November 17.",
      "Vice City is part of the wider Leonida setting, and Jason and Lucia are central to the story.",
      "Before recording, check your capture, commentary audio and spoiler plan—not just the game installation.",
    ],
    sections: [
      {
        id: "release-date",
        title: "When is GTA 6 coming out?",
        paragraphs: [
          "Rockstar currently lists Grand Theft Auto VI for November 19, 2026. The announced platforms on its official page are PlayStation 5 and Xbox Series X|S. This article was checked on November 17, before release; it is not a hands-on review.",
          "A calendar date alone does not establish the unlock hour in your region. Before scheduling a launch stream, check the listing for your platform, account region and edition. Do not turn an assumed midnight unlock into a countdown presented as confirmed information.",
        ],
        table: {
          headings: ["Question", "Confirmed information checked November 17"],
          rows: [
            ["Release date", "November 19, 2026"],
            ["Announced platforms", "PlayStation 5 and Xbox Series X|S"],
            ["Setting", "Vice City and the wider state of Leonida"],
            ["Story leads", "Jason Duval and Lucia Caminos"],
          ],
        },
        links: [official],
      },
      {
        id: "story-setting",
        title: "Who are Jason and Lucia, and where is it set?",
        paragraphs: [
          "Rockstar’s character introductions identify Jason Duval and Lucia Caminos. Jason has an Army background and works in the Keys; Lucia is newly out of prison. The official story setup follows the pair into a conspiracy across Leonida after a job goes wrong.",
          "That is enough background for a spoiler-light introduction. When making an explainer, tell viewers whether you are discussing published promotional information or events you have actually played. A trailer image is not evidence for a mission order, a complete map or a particular gameplay mechanic.",
        ],
        links: [
          places,
          {
            label: "Explore the confirmed Leonida locations",
            href: "/blog/gta-6-vice-city-leonida-locations",
          },
        ],
      },
      {
        id: "official-images",
        title: "Where can you find genuine GTA 6 images?",
        paragraphs: [
          "Rockstar maintains a media page with named screenshots and download options. The pictures in this article come from that official collection. They are game promotional images, not AI-generated recreations and not screenshots captured by Clipvelto.",
          "Keep the source alongside each image in your editing notes. A useful caption names what is actually visible and credits the publisher. Avoid presenting promotional imagery as proof that you have played the game, and avoid using an unrelated real-world photograph as if it were a location screenshot.",
        ],
        image: {
          src: "/blog/gta-6-vice-city.jpg",
          alt: "A passenger plane above the Vice City sign at dusk in Rockstar’s GTA VI screenshot.",
          caption: "Vice City. © Rockstar Games.",
          source: screenshots,
        },
        links: [screenshots],
      },
      {
        id: "recording-checklist",
        image: gtaMedia.skyline,
        title: "Run a short recording check before your first session",
        paragraphs: [
          "A stream can look fine on your display while the saved recording has quiet commentary, missing game sound or overlays covering important information. A short test gives you something concrete to inspect before the session you care about.",
        ],
        items: [
          "Record a minute of gameplay and commentary, then play the saved file back with headphones.",
          "Confirm where recordings are saved and leave enough storage for the session you intend to record.",
          "Check facecam and overlay placement against both the full frame and a narrow portrait crop.",
          "Decide in advance how you will handle story reveals in titles, thumbnails and clips.",
          "Keep a timestamp log with a short note about what makes each moment interesting.",
        ],
      },
      {
        id: "first-clips",
        title: "Give each launch clip one clear purpose",
        paragraphs: [
          "Choose one angle per clip: an initial reaction, a location observation or a question you can answer with your own recording. Keep enough of the setup for someone who did not watch the stream. A vague ‘everything you missed’ title is harder to support than a specific observation visible in the footage.",
          "For commentary-led recordings, Clipvelto can select transcript-based highlights and produce short MP4 clips. Watch the result before publishing: it does not automatically recognize every visual gameplay event, and a vertical crop may remove information from a wide shot. Our separate launch workflow covers that review in more detail.",
        ],
        links: [
          {
            label: "Plan your GTA 6 Shorts workflow",
            href: "/blog/gta-6-launch-shorts-workflow",
          },
        ],
      },
    ],
    sources: [official, places, screenshots],
    productPath: "/youtube-to-shorts",
  },
  {
    slug: "gta-6-vice-city-leonida-locations",
    title: "GTA 6 locations: Vice City and the places revealed in Leonida",
    description:
      "Explore the GTA 6 locations named by Rockstar, from Vice City and Leonida Keys to Grassrivers, with official screenshots and ideas for clear location videos.",
    category: "GTA 6 guides",
    published,
    modified: published,
    image: "/blog/gta-6-vice-city.jpg",
    imageAlt:
      "The illuminated Vice City sign and a passenger plane at sunset in GTA VI.",
    imageCaption: "Vice City. © Rockstar Games.",
    imageSource: screenshots,
    intro:
      "Vice City is the familiar name, but Rockstar’s GTA 6 presentation also introduces places beyond the city. This guide collects the locations named on the official site and pairs selected screenshots with practical ideas for explaining a setting on video. It is a pre-launch overview, not a complete map or a claim about places we have explored ourselves.",
    takeaways: [
      "Rockstar names Vice City, Leonida Keys, Grassrivers, Port Gellhorn, Ambrosia and Mount Kalaga in its Leonida presentation.",
      "Official screenshots show selected views; they do not establish the full map, travel times or everything a player can do.",
      "A good location clip explains one visible detail and preserves enough of the frame to show it.",
    ],
    sections: [
      {
        id: "vice-city-leonida",
        title: "Vice City and Leonida are not interchangeable names",
        paragraphs: [
          "Rockstar places Vice City within the wider state of Leonida. Its official people-and-places presentation names six destinations: Vice City, Leonida Keys, Grassrivers, Port Gellhorn, Ambrosia and Mount Kalaga. Treat that list as a starting point for coverage, not a complete catalogue of every area in the game.",
          "For a location video, introduce the name before offering your interpretation. ‘This is the Vice City screenshot Rockstar published’ gives the viewer a clear reference point. Claims about exact map boundaries, driving distances or access requirements need additional evidence.",
        ],
        links: [places],
      },
      {
        id: "vice-city",
        title: "Vice City: start with a recognizable frame",
        paragraphs: [
          "The official image at the top of this article shows the Vice City sign, a passenger plane and a sunset sky. It is a useful example of an establishing image: the sign identifies the location immediately, while the plane and lighting supply a subject for visual discussion.",
          "If you explain a screenshot like this in a Short, let viewers see the whole image before focusing on a detail. A tight portrait crop can cut off the sign or separate the aircraft from the scene. Describe a feature you can point to rather than using the image to support an unconfirmed gameplay claim.",
        ],
      },
      {
        id: "leonida-keys",
        title: "Leonida Keys: give the wider view room to breathe",
        paragraphs: [
          "The official Leonida Keys image below shows a long bridge crossing blue water, low islands, boats and a seaplane, with a city skyline in the distance. It gives a very different view of the setting from Vice City’s illuminated sign. These are observations from the published image, not a claim about where players can fly or how long the crossing takes.",
          "When your point depends on the relationship between water, shoreline and buildings, keep enough of the landscape visible. Start with the setting, explain the specific observation, then return to the wide view. The edit should help someone understand where to look without implying a route or activity that the picture cannot confirm.",
        ],
        image: {
          src: "/blog/gta-6-leonida-keys.jpg",
          alt: "A seaplane above blue water, islands and a long bridge in Rockstar’s official Leonida Keys screenshot.",
          caption: "Leonida Keys. © Rockstar Games.",
          source: screenshots,
        },
      },
      {
        id: "grassrivers",
        title: "Grassrivers: separate the image from your prediction",
        paragraphs: [
          "Rockstar’s Grassrivers screenshot below puts three armed characters on a wooden waterside platform beside an airboat and an alligator. The close framing emphasizes people and equipment rather than the wide coastal panorama of the Keys. A single picture does not establish their identities or the mission that might bring a player there.",
          "A useful format is observation, question, then limit: identify a visible feature, explain what you would like to investigate when playing, and make clear that the answer is not established by a screenshot. That creates a discussion without turning speculation into news.",
        ],
        image: {
          src: "/blog/gta-6-grassrivers.jpg",
          alt: "Three armed characters beside an airboat and an alligator in Rockstar’s official Grassrivers screenshot.",
          caption: "Grassrivers. © Rockstar Games.",
          source: screenshots,
        },
      },
      {
        id: "other-destinations",
        title: "Port Gellhorn, Ambrosia and Mount Kalaga",
        paragraphs: [
          "Rockstar also names Port Gellhorn, Ambrosia and Mount Kalaga. Rather than squeezing every destination into one fast montage, consider an individual explanation for each place once you have a specific point to make.",
          "Use a consistent structure across the series: location name, the official material you are examining, one observation and one question. After release, return with your own recorded evidence if you want to answer the question. That gives the follow-up a clear purpose and avoids repeating the same general launch information across several pages or videos.",
        ],
        links: [screenshots],
      },
      {
        id: "make-location-clips",
        title: "Turn your own exploration into a clear location clip",
        paragraphs: [
          "Once you have your own recording, choose a short moment with commentary that makes sense on its own. State the place and the observation in the clip itself. Review the whole crop so captions, a facecam or a narrow frame do not hide the detail you are describing.",
          "For a wider visual comparison, landscape or square output may communicate more than portrait. Clipvelto offers those formats alongside vertical clips, with optional added captions. Review every export and publish it yourself; automated highlight selection is based on speech rather than a complete understanding of the game’s geography.",
        ],
        links: [
          {
            label: "Create short clips from a YouTube recording",
            href: "/youtube-to-shorts",
          },
          {
            label: "GTA 6 release date and launch preparation",
            href: "/blog/gta-6-release-date-platforms-creator-guide",
          },
        ],
      },
    ],
    sources: [places, screenshots, official],
    productPath: "/youtube-to-shorts",
  },
];
