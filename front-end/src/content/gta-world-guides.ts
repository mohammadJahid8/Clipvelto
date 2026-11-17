import type { Article } from "./articles";
import { gtaCover, gtaMedia } from "./gta-media";

const published = "2026-11-17T12:20:02Z";
const media = {
  label: "Rockstar Games: official GTA VI screenshots",
  href: "https://www.rockstargames.com/VI/media/screenshots",
};
const places = {
  label: "Rockstar Games: the people and places of Leonida",
  href: "https://www.rockstargames.com/VI/only-in-leonida",
};
const music = {
  label: "Rockstar Games: official GTA VI music, score and radio previews",
  href: "https://www.rockstargames.com/VI/music",
};

export const gtaWorldGuides: Article[] = [
  {
    slug: "gta-6-vehicles-cars-bikes-aircraft",
    title: "GTA 6 vehicles: a closer look at cars, bikes and aircraft",
    description:
      "Look through Rockstar’s official vehicle imagery: Jason’s motorcycle, cars, dirt bikes and the aircraft and boats around Leonida. What is shown, and what remains a question?",
    category: "GTA 6 world",
    topic: "gaming",
    published,
    modified: published,
    ...gtaCover(gtaMedia.motorcycle),
    intro:
      "The vehicles in GTA 6’s promotional images help give different parts of Leonida a different character. A sports motorcycle beneath palm trees feels different from a muddy group ride or an aircraft above the islands. This is a closer look at the vehicles visible in Rockstar’s screenshots, not a complete vehicle catalogue or a guide to unverified spawn locations.",
    takeaways: [
      "Official images show several kinds of road vehicles as well as aircraft and boats.",
      "An appearance in promotional imagery does not establish an ownership method, price or fixed spawn point.",
      "Compare each vehicle with its surroundings; the setting is often as interesting as the machine.",
    ],
    sections: [
      {
        id: "motorcycle",
        title: "Jason’s sports motorcycle is an immediate focal point",
        paragraphs: [
          "The cover image puts a green sports motorcycle close to the camera, with Jason standing beside it. The low viewpoint makes the front wheel and fairing prominent, while the palm trees establish the setting. It is a useful image to revisit when you want a clear view of one vehicle rather than a busy street.",
          "What it does not provide is a reliable purchase price, handling measurement or a guaranteed place to collect that same bike. If a vehicle guide gives you exact coordinates or a performance ranking, check whether it is based on the released game rather than this promotional frame.",
        ],
        links: [media],
      },
      {
        id: "cars",
        title: "Cars are also part of the character imagery",
        paragraphs: [
          "In another screenshot, Jason sits behind the wheel with the window open. The frame is more interested in the person and the atmosphere than a full exterior view of the car. That limits how confidently you can identify a complete model or infer its equipment from the image alone.",
          "Once playing, a useful personal comparison is to pay attention to visibility, control feel and the kinds of roads you are using. Choose vehicles for the trip you want to take rather than relying on an unsupported pre-launch ‘best car’ list. A vehicle can be enjoyable without being the fastest thing in the game.",
        ],
        image: gtaMedia.driving,
      },
      {
        id: "dirt-bikes",
        title: "The dirt-bike images change the mood",
        paragraphs: [
          "Rockstar’s dirt-bike screenshot shows riders on a muddy course with industrial structures behind them. Its close, busy composition is quite different from the clean sports-bike portrait. It suggests a different kind of scene, but a still image does not explain the rules of an activity or establish a named competitive mode.",
          "Look closely at the surface, the riders and the obstacles as separate details. After release, the interesting question is how those elements actually behave together. That is something to investigate in play, not something a screenshot can settle.",
        ],
        image: gtaMedia.dirtBikes,
      },
      {
        id: "water-and-air",
        title: "Leonida’s water and aircraft deserve a separate look",
        paragraphs: [
          "The wide Leonida Keys image includes a seaplane, boats, low islands and a long bridge. Unlike a close vehicle portrait, it shows how several forms of movement can share the same landscape. Following the bridge with your eyes gives a different sense of scale from looking down from the aircraft.",
          "An aircraft or boat appearing in a screenshot does not prove that every pictured version is player-controlled, purchasable or available immediately. Treat those as separate questions for the finished game. For now, the official collection is a reliable place to inspect what Rockstar has actually shown.",
        ],
        image: gtaMedia.keys,
      },
      {
        id: "vehicle-notes",
        title: "Build your own vehicle notes when you play",
        paragraphs: [
          "If exploring the vehicle selection is part of the fun for you, keep a simple record: what you tried, where you encountered it, and how it suited that journey. Add the version of the game if you later share a location tip. A chance encounter should not become a promise that the same vehicle always appears there.",
          "For a first session, a small goal is enough: compare two road vehicles, notice how a bike frames the city differently, or follow a bridge until the landscape changes. You do not need an exhaustive checklist before you have had time to enjoy the world.",
        ],
        links: [
          {
            label: "Plan a spoiler-light first trip around Leonida",
            href: "/blog/gta-6-exploration-map-tips",
          },
        ],
      },
    ],
    sources: [media, places],
  },
  {
    slug: "gta-6-exploration-map-tips",
    title:
      "GTA 6 exploration tips for a spoiler-light first trip around Leonida",
    description:
      "Use landmarks, small goals and the places Rockstar has revealed to plan your first exploration. Practical ideas without invented secret routes, coordinates or glitches.",
    category: "GTA 6 exploration",
    topic: "gaming",
    published,
    modified: published,
    ...gtaCover(gtaMedia.keys),
    intro:
      "You do not need to turn your first GTA 6 session into a checklist of secrets. A few small exploration goals can make Leonida easier to remember while leaving room for surprises. These are suggested ways to approach the world after launch, using Rockstar’s published places as reference points—not tested shortcuts, mission instructions or a complete map.",
    takeaways: [
      "Choose one place or one type of journey instead of trying to cover the whole setting immediately.",
      "Use visible landmarks and your actual in-game map to build a sense of direction.",
      "Exact shortcuts, collectibles and guaranteed vehicle spawns need evidence from the released game.",
    ],
    sections: [
      {
        id: "one-area",
        title: "Start with one area you are curious about",
        paragraphs: [
          "Rockstar’s presentation names Vice City, Leonida Keys, Grassrivers, Port Gellhorn, Ambrosia and Mount Kalaga. You can use those names to organize your interests without assuming that all areas are accessible at the same point in the story or connected by a particular route.",
          "Pick a small question for the first trip: what does this neighborhood feel like on foot, where does the road lead, or which view helps explain the surroundings? A focused question gives an ordinary journey a purpose without requiring a guide to reveal a secret in advance.",
        ],
        links: [
          places,
          {
            label: "See the places revealed in the official images",
            href: "/blog/gta-6-vice-city-leonida-locations",
          },
        ],
      },
      {
        id: "landmarks",
        title: "Remember a landmark, not just a turn instruction",
        paragraphs: [
          "A sign, a bridge, a distinctive building or a change in terrain gives you something to recognize on the return journey. Port Gellhorn’s motel image is a useful visual example: its illuminated sign stands out even though the surrounding scene is dark.",
          "When you find a place you want to revisit, note what is around it as well as its map position. Use whatever marking tools the released game actually provides. Do not assume a screenshot on a guide page supplies enough information to identify an exact entrance or a safe approach.",
        ],
        image: gtaMedia.motel,
      },
      {
        id: "different-views",
        title: "Change the scale of what you notice",
        paragraphs: [
          "An elevated view shows how roads, blocks and buildings relate to one another. A street-level view makes signs, shop fronts and people easier to notice. Switching between broad and small observations helps prevent a large city from becoming one continuous blur of traffic.",
          "Try choosing one visual detail to follow for a while: the shape of an intersection, the way a bridge meets a neighborhood, or the signs around a business. This is a suggested observation exercise, not a promise that any particular building is enterable or part of a mission.",
        ],
        image: gtaMedia.skyline,
      },
      {
        id: "small-detours",
        title: "Give yourself permission to take a small detour",
        paragraphs: [
          "A roadside gathering can be as memorable as a skyline. Rockstar’s Leonida Keys image below includes people, a bus, businesses and an alligator in the same scene. There is plenty to look at before inventing a hidden reward behind every object.",
          "If the game lets you pause your current objective and explore, keep the detour manageable. Choose a destination you can recognize and return when the journey has answered your question. The point is to become more familiar with the setting, not to turn the first hour into a hunt for information you have not learned yet.",
        ],
        image: gtaMedia.roadside,
      },
      {
        id: "location-tips",
        title: "How to judge a location tip you find online",
        paragraphs: [
          "Look for the game version, the starting point and evidence showing the whole route. A cropped image of an item is weaker evidence than a clear journey to it. A claim that something ‘always’ appears deserves more support than a single encounter.",
          "Pre-launch map reconstructions and promotional images can be interesting to compare, but they should not be confused with a verified walkthrough. If you prefer fewer spoilers, search for the small problem you are trying to solve rather than a complete secrets list.",
        ],
      },
      {
        id: "first-trip",
        title: "Three simple goals for your first trip",
        paragraphs: [
          "Choose one of these and let the rest of the session develop naturally. They do not depend on a particular hidden item, button combination or unannounced game mode.",
        ],
        items: [
          "Find a view you would keep as a postcard, then remember the landmark that helps you return.",
          "Follow one recognizable road or bridge and notice how the surrounding buildings change.",
          "Revisit an ordinary place later and compare what you notice the second time.",
        ],
        links: [
          {
            label: "Look more closely at the vehicles in Rockstar’s imagery",
            href: "/blog/gta-6-vehicles-cars-bikes-aircraft",
          },
        ],
      },
    ],
    sources: [places, media],
  },
  {
    slug: "gta-6-radio-soundtrack-music-guide",
    title: "GTA 6 music: radio stations, the soundtrack and Justice’s score",
    description:
      "Find Rockstar’s official GTA 6 radio previews and understand the difference between in-game stations, The Album and the original score by Justice.",
    category: "GTA 6 music",
    topic: "gaming",
    published,
    modified: published,
    ...gtaCover(gtaMedia.friends),
    intro:
      "GTA 6’s music is presented in three different ways on Rockstar’s official site: radio, a soundtrack album and a score. They are related, but they are not interchangeable tracklists. Knowing which one you are looking at makes it much easier to find the official previews and follow the release you actually want to hear.",
    takeaways: [
      "Rockstar’s music page links to radio previews, album singles and score singles.",
      "The Album is scheduled for November 19; the Original Score by Justice is scheduled for December 11.",
      "A fan playlist or a song in a trailer is not, by itself, a complete in-game radio list.",
    ],
    sections: [
      {
        id: "three-types",
        title: "Radio, soundtrack and score: what is the difference?",
        paragraphs: [
          "Radio is organized as in-world broadcasts. A soundtrack album is a separately presented collection of songs. A score is the music composed to accompany the experience. For GTA VI, Rockstar’s site gives each of these its own section, so start there rather than treating every result labelled ‘soundtrack’ as the same thing.",
          "For a listener, the useful distinction is practical: are you trying to sample a station, find a particular song, or hear the composed music? Decide that first and you will spend less time moving between unrelated unofficial playlists.",
        ],
        links: [music],
      },
      {
        id: "radio-previews",
        title: "The stations currently previewed on Rockstar’s page",
        paragraphs: [
          "The official page currently offers previews for the following stations. This is a guide to the previews checked on November 17, not a claim that these are every station or every track in the finished game.",
        ],
        table: {
          headings: ["Station", "Style described on the official page"],
          rows: [
            ["Cocoteo", "Modern Latin"],
            ["Back Country", "Country"],
            ["Afro Bank FM", "Amapiano, African classics and 3-step"],
            ["The Chamber", "Metal"],
            ["Flash FM", "Pop"],
            ["Dirty South Classics", "Regional rap and hip-hop classics"],
          ],
        },
        image: gtaMedia.balcony,
        links: [music],
      },
      {
        id: "the-album",
        title: "Grand Theft Auto VI: The Album",
        paragraphs: [
          "Rockstar describes The Album as 34 original tracks, with a November 19 release. Its music page provides selected singles and links for the album’s digital and physical releases.",
          "An album page is useful when you want an artist or a specific song. Keep the release title attached to anything you save to your library: a similarly named fan compilation may mix trailer tracks, guesses and released singles without explaining the difference.",
        ],
      },
      {
        id: "justice-score",
        title: "The original score by Justice",
        paragraphs: [
          "The Original Score by Justice is separately scheduled for December 11, with 30 tracks plus digital bonus tracks. Rockstar describes the in-game score as adaptive to the player’s experience.",
          "That distinction is interesting when listening closely. A composed cue can support the tension or mood of a scene without behaving like a standalone radio song. The album release gives that material another context for listening; it should not be confused with the radio-station preview list.",
        ],
        image: gtaMedia.bikers,
        links: [music],
      },
      {
        id: "find-official",
        title: "A simple way to find the official listening links",
        paragraphs: [
          "Open Rockstar’s GTA VI music page and choose the section you want. Use its artist, streaming and store links to reach the relevant release. That gives you a clear chain back to the publisher instead of relying on the title of a re-upload.",
          "For early listening, pick one station outside your usual taste and one score single. Compare what each makes you pay attention to: a voice introducing music, a song’s structure, or a cue’s changing atmosphere. That is a more rewarding starting point than trying to memorize a supposed complete tracklist before you have played.",
        ],
      },
    ],
    sources: [
      music,
      {
        label: "Rockstar Support: information on the GTA VI Original Score",
        href: "https://support.rockstargames.com/articles/pTQg14Os4HIlN7nnktCsG/information-on-the-grand-theft-auto-vi-original-score",
      },
    ],
  },
];
