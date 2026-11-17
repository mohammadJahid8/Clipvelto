import type { Article } from "./articles";
import { gtaMedia } from "./gta-media";

const published = "2026-11-17T11:57:02Z";
const people = {
  label: "Rockstar Games: official GTA VI character introductions",
  href: "https://www.rockstargames.com/VI/only-in-leonida",
};
const media = {
  label: "Rockstar Games: official screenshot collection",
  href: "https://www.rockstargames.com/VI/media/screenshots",
};
const official = {
  label: "Rockstar Games: Grand Theft Auto VI",
  href: "https://www.rockstargames.com/VI",
};

export const gamingStories: Article[] = [
  {
    slug: "gta-6-jason-lucia-characters-guide",
    title: "GTA 6’s cast: Jason, Lucia and the people around them",
    description:
      "A spoiler-light introduction to the GTA 6 characters named by Rockstar, plus the connections worth paying attention to when you make a character explainer.",
    category: "GTA 6 stories",
    topic: "gaming",
    published,
    modified: "2026-11-17T12:20:02Z",
    image: "/blog/gta-6-jason-lucia-dock.jpg",
    imageAlt:
      "Jason and Lucia wearing protective vests inside a vault in an official GTA VI screenshot.",
    imageCaption: "Jason and Lucia. © Rockstar Games.",
    imageSource: media,
    intro:
      "A GTA 6 character video is more useful when it explains who someone is connected to, rather than racing through a list of names. Rockstar’s published introductions provide a starting cast and several relationships. This guide sticks to that promotional material; it does not describe leaked story events or claim to know how anyone’s story ends.",
    takeaways: [
      "Jason Duval and Lucia Caminos are the central pair in Rockstar’s story setup.",
      "The supporting cast connects their world to the Keys, Vice City, robbery and the music business.",
      "A character biography establishes a starting point, not a confirmed ending or a complete mission role.",
    ],
    sections: [
      {
        id: "jason",
        image: gtaMedia.motorcycle,
        title: "Jason Duval: a past he has not left behind",
        paragraphs: [
          "Rockstar introduces Jason as a former soldier who now works for drug runners in the Keys. Cal Hampton is his friend, and Brian Heder provides a place to live in exchange for work.",
          "For an explainer, that is a clearer starting point than describing Jason through an imagined role borrowed from an older GTA protagonist. Introduce the circumstances Rockstar has actually published, then distinguish any theory about his choices from those facts.",
        ],
      },
      {
        id: "lucia",
        image: gtaMedia.lucia,
        title: "Lucia Caminos: a plan for a different life",
        paragraphs: [
          "Lucia is newly out of prison. Rockstar’s introduction describes her determination to improve her circumstances and her belief that a life with Jason could offer a way forward.",
          "If you are discussing her introduction on video, separate what the biography says from your interpretation of a trailer scene. A look, a line or a promotional image can support a question for viewers without proving a future betrayal, mission or outcome.",
        ],
      },
      {
        id: "supporting-cast",
        title: "The other names to know",
        paragraphs: [
          "Rockstar’s introductions also identify the following supporting characters. These brief descriptions summarize the published setup, not a ranking of their importance to the finished story.",
        ],
        table: {
          headings: ["Character", "Published introduction"],
          rows: [
            ["Cal Hampton", "Jason’s friend and an associate of Brian."],
            ["Brian Heder", "A drug runner operating in the Keys."],
            [
              "Boobie Ike",
              "A Vice City businessman with property, nightlife and music interests.",
            ],
            [
              "Dre’Quan Priest",
              "An aspiring music figure connected to Only Raw Records.",
            ],
            [
              "Real Dimez",
              "Bae-Luxe and Roxy, a rap duo signed to Only Raw Records.",
            ],
            [
              "Raul Bautista",
              "An experienced bank robber looking for people willing to take risks.",
            ],
          ],
        },
        links: [people],
      },
      {
        id: "connections",
        title: "Explain a connection instead of reciting every name",
        paragraphs: [
          "A short character video has room for one clear question. You could explain a relationship named in the official biographies, identify the people attached to one part of the setting, or compare how two introductions present their ambitions. Tell viewers which source you are discussing so they can follow the same evidence.",
          "Avoid adding a dramatic label such as ‘the secret villain’ simply because it makes a stronger thumbnail. It turns a speculation video into a claim the official introduction may not support. A useful title can ask a specific question while leaving the answer open.",
        ],
      },
      {
        id: "character-clip",
        title: "A simple structure for a character clip",
        paragraphs: [
          "Start with the name and the one fact a new viewer needs. Show the relevant official material with a credit, then make one observation in your own voice. Finish by stating the question you want to revisit after playing. The complete clip should make sense without a viewer having memorized the whole cast.",
          "When you later work with your own gameplay commentary, keep story reveals out of the title and thumbnail if you intend the clip to be spoiler-light. Review publisher guidance before publishing footage. Clipvelto can help select spoken highlights; it cannot verify your character theory or decide which story details you should reveal.",
        ],
        links: [
          {
            label: "Plan a first-session stream with a clear idea",
            href: "/blog/gta-6-first-stream-ideas",
          },
          {
            label: "See the places revealed in Leonida",
            href: "/blog/gta-6-vice-city-leonida-locations",
          },
        ],
      },
    ],
    sources: [people, official, media],
    productPath: "/youtube-to-shorts",
  },
  {
    slug: "gta-6-first-stream-ideas",
    title: "7 GTA 6 stream ideas beyond a first-impressions marathon",
    description:
      "Give your first GTA 6 recording a clear premise: a first drive, a screenshot comparison, a prediction revisited or one useful lesson for another new player.",
    category: "Gaming ideas",
    topic: "gaming",
    published,
    modified: "2026-11-17T12:20:02Z",
    image: "/blog/gta-6-vice-city-waterfront.jpg",
    imageAlt:
      "Two people on a balcony overlooking palm trees, a pool and the Vice City beachfront in an official GTA VI screenshot.",
    imageCaption: "Vice City. © Rockstar Games.",
    imageSource: media,
    intro:
      "A long first-session stream can be enjoyable for people who already know you. A new viewer usually needs a smaller reason to watch. These are suggested editorial formats, not claims about specific GTA 6 modes, missions or customization features. Adapt them to what the released game and your recording setup actually allow.",
    takeaways: [
      "Give each segment one question that a viewer can understand immediately.",
      "Use your own reactions and evidence rather than trying to cover every launch topic.",
      "Keep a clean recording and timestamp notes so a good moment is easy to find later.",
    ],
    sections: [
      {
        id: "first-drive",
        image: gtaMedia.driving,
        title: "1. The first drive, with a reason for every turn",
        paragraphs: [
          "Explain what makes you choose a route, stop or change direction during your first driving segment. The premise is your decision-making, not a promise to discover the fastest route or a hidden location. A short excerpt can follow one choice and its outcome instead of starting halfway through a trip.",
        ],
      },
      {
        id: "postcard",
        image: gtaMedia.motel,
        title: "2. Find your own postcard frame",
        paragraphs: [
          "Look for a view you would want to keep as a still image. Explain the composition, then show the frame you chose. This gives quieter exploration a visible goal. It can work without constant shouting, a long checklist or a claim that you have found the game’s most beautiful location.",
        ],
      },
      {
        id: "screenshot",
        title: "3. Revisit an official screenshot",
        paragraphs: [
          "Choose one image from Rockstar’s media page before you play. If you later encounter the relevant setting, discuss what you can actually compare. Keep the original credit visible in your publishing workflow and separate your own captured footage from the promotional image. Matching a view is an observation, not a graphics benchmark with controlled conditions.",
        ],
        links: [media],
      },
      {
        id: "prediction",
        title: "4. Record a prediction, then come back to it",
        paragraphs: [
          "Before the session, record one modest expectation in your own words. Later, revisit it using a specific moment from your recording. A changed opinion often makes a more coherent short story than a list of immediate reactions. Avoid predictions that depend on unverified leaks or reveal story outcomes in advance.",
        ],
      },
      {
        id: "wrong-turn",
        title: "5. Keep one mistake and the recovery",
        paragraphs: [
          "A wrong turn, a misunderstood instruction or a failed attempt can give a clip a natural beginning and ending. Keep the setup and the recovery together. Do not stage the explanation afterward as if it were a spontaneous live reaction, and do not remove the information that makes the mistake understandable.",
        ],
      },
      {
        id: "beginner-lesson",
        title: "6. Teach one thing you just learned",
        paragraphs: [
          "Once you understand a control or a small task, explain it to someone starting from the same point. Name the situation and show the action if the recording permits it. Review the explanation for accuracy before calling it a tutorial. One clear beginner lesson is more useful than claiming to have mastered the entire game on day one.",
        ],
      },
      {
        id: "hour-later",
        title: "7. Compare your first impression with your later one",
        paragraphs: [
          "Return to an early comment after you have played longer. What changed your mind? Pair the two observations with the evidence between them. You do not need to manufacture a reversal: an expectation that held up can also be interesting when you explain why.",
          "These ideas can overlap during a session, but each published excerpt should keep a clear premise. Write a timestamp and a few words about the payoff when something worth revisiting happens. That small habit makes the later edit much easier.",
        ],
      },
      {
        id: "recording-plan",
        title: "Make the stream easier to turn into clips",
        paragraphs: [
          "Record a short audio and framing test first. Preserve the original file, keep commentary audible, and check where overlays sit relative to a portrait crop. Decide how you will handle spoilers and review Rockstar’s publishing guidance before using game footage.",
          "For commentary-led material, Clipvelto can suggest transcript-based highlights and render short MP4 clips in your selected format. It is not a silent-gameplay event detector. Review each selection for its setup and payoff, then publish only the excerpts that support the idea you chose.",
        ],
        links: [
          {
            label: "Record and review your GTA 6 Shorts",
            href: "/blog/gta-6-launch-shorts-workflow",
          },
          {
            label: "Fix black bars without hiding the action",
            href: "/blog/remove-black-bars-vertical-video",
          },
        ],
      },
    ],
    sources: [
      media,
      official,
      {
        label: "Rockstar Games: posting game footage",
        href: "https://support.rockstargames.com/articles/7bNaeoMFTV0iUDGhStTXvz/policy-on-posting-copyrighted-rockstar-games-material",
      },
    ],
    productPath: "/youtube-to-shorts",
  },
];
