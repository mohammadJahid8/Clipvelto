import { gtaArticles } from "./gta-articles";
import { photos } from "./photos";
import { editingArticles } from "./editing-articles";
import { creatorArticles } from "./creator-articles";
import { gamingStories } from "./gaming-stories";
import { gtaLaunchGuides } from "./gta-launch-guides";
import { gtaWorldGuides } from "./gta-world-guides";
import { gtaMedia } from "./gta-media";

export type SourceLink = { label: string; href: string };
export type ArticleTopic =
  "gaming" | "video-editing" | "podcasts" | "repurposing";
export type ContentSection = {
  id: string;
  title: string;
  paragraphs: string[];
  items?: string[];
  table?: { headings: string[]; rows: string[][] };
  links?: SourceLink[];
  image?: { src: string; alt: string; caption: string; source: SourceLink };
};
export type Article = {
  slug: string;
  title: string;
  description: string;
  category: string;
  topic?: ArticleTopic;
  published: string;
  modified: string;
  image: string;
  imageAlt: string;
  imageCaption: string;
  imageSource?: SourceLink;
  intro: string;
  takeaways: string[];
  sections: ContentSection[];
  sources: SourceLink[];
  productPath?: "/youtube-to-shorts" | "/podcast-clip-maker";
};

const published = "2026-11-17T10:28:17Z";
const rockstar = {
  label: "Rockstar Games: official GTA VI release information",
  href: "https://www.rockstargames.com/VI",
};
const rockstarPolicy = {
  label: "Rockstar Games: policy on posting game footage",
  href: "https://support.rockstargames.com/articles/7bNaeoMFTV0iUDGhStTXvz/policy-on-posting-copyrighted-rockstar-games-material",
};
const shortsLength = {
  label: "YouTube Help: three-minute Shorts",
  href: "https://support.google.com/youtube/answer/15424877?hl=en",
};
const relatedVideo = {
  label: "YouTube Help: add a related video to a Short",
  href: "https://support.google.com/youtube/answer/14075157?hl=en",
};
const madeOnYouTube = {
  label: "YouTube: creator announcements from Made on YouTube 2026",
  href: "https://blog.youtube/news-and-events/innovation-youtube-era-made-on-viewers-creators/",
};
const podcastHelp = {
  label: "YouTube Help: create and manage a podcast",
  href: "https://support.google.com/youtube/answer/12751636?hl=en",
};

export const articles: Article[] = [
  ...gtaLaunchGuides,
  ...gtaWorldGuides,
  ...editingArticles,
  ...gamingStories,
  ...creatorArticles,
  ...gtaArticles,
  {
    slug: "gta-6-launch-shorts-workflow",
    title: "GTA 6 launch: a Shorts workflow for gameplay creators",
    description:
      "Prepare your GTA 6 launch recordings for Shorts: choose self-contained moments, protect the action when cropping, review captions and publish with context.",
    category: "Gaming creators",
    published,
    modified: "2026-11-17T12:20:02Z",
    image: "/blog/gta-6-leonida-keys.jpg",
    imageAlt: "Rockstar’s official Leonida Keys 01 screenshot from GTA VI.",
    imageCaption: "Leonida Keys. © Rockstar Games.",
    imageSource: {
      label: "Rockstar Games screenshot collection",
      href: "https://www.rockstargames.com/VI/media/screenshots",
    },
    intro:
      "A launch stream produces hours of footage, but a useful Short needs one clear idea. For GTA 6, the practical preparation is to make your own recording easy to review: keep commentary audible, mark interesting moments and plan how the action will fit a phone screen. Here is a workflow you can prepare before launch and reuse for later sessions.",
    takeaways: [
      "Give each clip a setup and a payoff that make sense without the full stream.",
      "Check a vertical crop against the action, facecam and on-screen information.",
      "Treat AI selection and captions as a first pass that still needs your review.",
    ],
    sections: [
      {
        id: "release-context",
        title: "Start with the confirmed release context",
        paragraphs: [
          "As checked on November 17, 2026, Rockstar lists GTA VI for November 19, 2026 on PlayStation 5 and Xbox Series X|S. This is a pre-launch preparation guide. Check the official page for the latest release information before presenting a date or platform as current.",
          "Separate your own commentary from official announcements. A title such as ‘My first driving attempt’ describes your footage; a title claiming an unannounced feature needs evidence. Clear framing gives viewers a reason to watch without promising something the clip cannot deliver.",
        ],
        links: [rockstar],
      },
      {
        id: "recording-plan",
        image: gtaMedia.motorcycle,
        title: "Record for the edit you want to make",
        paragraphs: [
          "Keep a clean master recording rather than relying on a compressed social repost. If your recording setup allows separate microphone and game-audio tracks, retain them in your editing archive. A clear voice track helps both a human editor and a transcription service understand your reaction.",
          "Plan your facecam and overlays with a narrow crop in mind. A webcam in the far corner and gameplay action in the opposite corner cannot both fill a single portrait frame without a layout decision. Before the stream, record a short test and inspect it on a phone.",
          "During the session, keep a simple timestamp log. Note the moment and why it mattered, not just the time: ‘failed jump, then unexpected recovery’ is more useful later than ‘01:12:00’. Those notes also help you judge whether an automated selection captured the actual event.",
        ],
      },
      {
        id: "moments",
        image: gtaMedia.dirtBikes,
        title: "Choose a small number of complete moments",
        paragraphs: [
          "Look for a short story rather than a random burst of activity. A mistake followed by a recovery, a surprising interaction, or a clear comparison can stand on its own. A clip that starts after the explanation and ends before the outcome leaves a new viewer guessing.",
          "Use the opening to explain the immediate question. Then let the action answer it. Avoid adding a long introduction about the rest of the stream. If the moment needs several minutes of backstory, choose another moment or make an intentionally longer edit outside the short-highlight workflow.",
        ],
        items: [
          "Reaction: establish what surprised you before showing the response.",
          "Experiment: show the question, one attempt and its outcome.",
          "Mistake and recovery: keep enough lead-in to make the recovery meaningful.",
          "Observation: explain one detail using your own footage and commentary.",
        ],
      },
      {
        id: "portrait-review",
        title: "Review the crop while the action is moving",
        paragraphs: [
          "A 16:9 frame contains much more horizontal information than a full-height 9:16 crop. Preview the entire moment, especially turns, camera movement and changes in where the action happens. A crop that looks correct on the opening frame may lose the subject a few seconds later.",
          "In Clipvelto, vertical output fills the frame by cropping. Horizontal and square formats are also available in the workspace. If a moment depends on a wide comparison, map or interface, keep a horizontal version rather than assuming every recording will work in portrait. Caption placement deserves a separate check against game subtitles and interface elements.",
        ],
        links: [
          {
            label: "See Clipvelto’s YouTube-to-Shorts workflow",
            href: "/youtube-to-shorts",
          },
        ],
      },
      {
        id: "rights-and-context",
        title: "Use your own footage and check publishing guidance",
        paragraphs: [
          "Rockstar’s footage policy discusses fan gameplay uploads and restrictions including story spoilers. Read the current policy before publishing; this guide does not grant rights to game footage, music, trailers or another creator’s stream. Avoid leaked material and obtain permission for recordings that are not yours.",
          "Keep launch-week titles and thumbnails specific. If your edit contains a story reveal, consider whether it belongs in the clip at all and review the publisher’s guidance. Check music separately: being audible during gameplay does not make a track automatically cleared for every later use.",
        ],
        links: [rockstarPolicy],
      },
      {
        id: "publish",
        title: "Publish a reviewed clip, then learn from it",
        paragraphs: [
          "Proofread captions for character names, places and words spoken over loud game audio. Watch once with sound and once muted. Make sure the title describes what is actually shown, then choose the matching full video as a related video in YouTube Studio when your channel has access to that feature.",
          "Clipvelto accepts supported YouTube links or video files from your device, selects transcript-based highlights and exports MP4 clips. It is not a visual gameplay-event detector: commentary-led moments are a better fit than a silent action montage. Review every result before posting. Clipvelto does not publish to your social accounts or guarantee views.",
          "Keep the source recording and your editing notes. After publishing, compare the opening, clarity and payoff across your own clips. Use that evidence to decide what to record next, rather than treating launch interest as a promise that every clip will perform.",
        ],
        links: [relatedVideo],
      },
    ],
    sources: [rockstar, rockstarPolicy, relatedVideo],
    productPath: "/youtube-to-shorts",
  },
  {
    slug: "youtube-shorts-length-size-guide",
    title: "YouTube Shorts in 2026: length, framing and related videos",
    description:
      "Understand YouTube Shorts length and aspect ratios, choose a sensible edit length, review captions and connect a Short to your original long video.",
    category: "YouTube guides",
    published,
    modified: published,
    ...photos.phone,
    intro:
      "Shorts support more than one length, and a longer allowance is not a reason to make every edit longer. Start with the idea you want a new viewer to understand, then choose the frame and runtime that let that idea land. This guide separates YouTube’s upload rules from the editing choices you still need to make.",
    takeaways: [
      "YouTube currently categorizes eligible square or vertical uploads of up to three minutes as Shorts.",
      "A full-height vertical crop removes horizontal information; review the composition before exporting.",
      "Clipvelto currently creates highlights of up to 60 seconds, not three-minute edits.",
    ],
    sections: [
      {
        id: "current-rules",
        title: "Know the current Shorts length rule",
        paragraphs: [
          "YouTube’s help page says standard-channel videos uploaded from October 15, 2024 onward can be categorized as Shorts when they are square or vertical and no longer than three minutes. Artist-channel rules differ, so check the official guidance for your channel.",
          "There is an important music distinction: YouTube says Shorts over one minute with an active Content ID claim are blocked globally until the claim is resolved. Review the current help page and your upload checks rather than assuming a longer Short has the same music treatment as a shorter one.",
        ],
        links: [shortsLength],
      },
      {
        id: "choose-runtime",
        title: "Choose the shortest runtime that completes the idea",
        paragraphs: [
          "A definition, a reaction and a worked example need different amounts of explanation. Start with the promise of the clip and work backward. If the promised answer arrives in 25 seconds, an extra minute of introductions is unlikely to make the explanation clearer.",
          "For an interview, preserve the question when the answer depends on it. For a tutorial, keep the step that makes the result reproducible. For a comparison, show both sides before reaching the conclusion. These are editorial checks, not a formula for the recommendation system.",
          "YouTube announced additional editing and series features at Made on YouTube 2026. Feature announcements and account availability can change; they do not remove the need to review pacing, accuracy and context in your own edit.",
        ],
        links: [madeOnYouTube],
      },
      {
        id: "aspect-ratios",
        title: "Pick a frame before committing to the crop",
        paragraphs: [
          "Use the frame as a composition choice. A portrait crop suits a centered speaker; a wide screen recording may depend on information at both edges. Review the subject, captions and any diagrams together. Simply exporting more pixels cannot recover details that were absent or compressed in the original.",
        ],
        table: {
          headings: ["Shape", "Example dimensions", "Composition check"],
          rows: [
            [
              "Vertical · 9:16",
              "1080 × 1920",
              "Keep the speaker or action inside the narrow frame.",
            ],
            [
              "Square · 1:1",
              "1080 × 1080",
              "Check that side-by-side elements still fit.",
            ],
            [
              "Horizontal · 16:9",
              "1920 × 1080",
              "Preserve wide demonstrations or multiple subjects.",
            ],
          ],
        },
      },
      {
        id: "caption-review",
        title: "Treat automatic captions as an editable first pass",
        paragraphs: [
          "Names, specialist terms, accents and speech over music can produce transcription mistakes. Read the captions against the audio before you publish. Watch for a wrong word that changes the speaker’s meaning, even when the rest of the sentence looks plausible.",
          "Check readability at phone size. Large captions can hide a demonstration, while small captions are hard to read. Preview against the destination app’s controls as well as the clean MP4. If the source already contains burned-in subtitles, adding another set can create an unreadable overlap.",
          "Clipvelto lets you choose added captions or no added captions before submitting a workspace job. Switching captions off does not remove subtitles that are already part of the source image. Download the output and check it before posting to any platform.",
        ],
      },
      {
        id: "related-video",
        title: "Connect the Short to the original video",
        paragraphs: [
          "YouTube offers a Related Video selection in a Short’s details. The feature requires advanced feature access, and the selected video must be public or unlisted. Viewers can follow the link displayed below the channel handle to see the related content.",
          "Choose the recording that actually expands the same idea. A clip about a specific camera setting should lead to the tutorial that explains that setting, rather than to an unrelated recent upload. Give the Short a complete answer even when there is more depth in the full video.",
        ],
        links: [relatedVideo],
      },
      {
        id: "clipvelto-workflow",
        title: "Use Clipvelto for short highlights, then review the export",
        paragraphs: [
          "Clipvelto’s current highlight pipeline selects clips up to 60 seconds long. For a longer source, candidates normally run from 15 to 60 seconds. The platform allowance of three minutes does not mean Clipvelto currently generates three-minute edits.",
          "Start with a YouTube recording you have permission to process, or upload your video file. In the workspace, choose the output shape and whether to add captions before confirming the credit quote. The app imports, transcribes, selects highlights and renders without a separate transcription button.",
          "Once the clips are ready, inspect the beginning, the ending, the crop and the words on screen. Download the MP4 you want and upload it yourself. Keep a copy of your source and exported media; Clipvelto is a processing workspace with a retention period, not a permanent video archive.",
        ],
        links: [
          {
            label: "Turn a YouTube recording into short clips",
            href: "/youtube-to-shorts",
          },
        ],
      },
    ],
    sources: [shortsLength, relatedVideo, madeOnYouTube],
    productPath: "/youtube-to-shorts",
  },
  {
    slug: "turn-podcast-into-short-clips",
    title: "How to turn a podcast into short clips that stand alone",
    description:
      "A practical video podcast clipping workflow: select complete answers, keep the speaker’s meaning, review portrait framing and connect clips to full episodes.",
    category: "Podcast creators",
    published,
    modified: published,
    ...photos.podcast,
    intro:
      "A podcast clip should work for someone who has never met the guest or heard the show. That changes the editing task: the strongest excerpt is not always the loudest reaction or the most dramatic sentence. It is often a compact question and answer with a specific example and a useful conclusion.",
    takeaways: [
      "Select one complete idea instead of combining disconnected provocative lines.",
      "Preserve qualifications, questions and examples that affect the answer’s meaning.",
      "Review the speaker crop, names and caption timing before publishing.",
    ],
    sections: [
      {
        id: "start-with-episode",
        title: "Keep full episodes and promotional clips distinct",
        paragraphs: [
          "YouTube treats a podcast as a playlist of podcast episodes. Its help guidance distinguishes full episodes from supporting content, and notes that Shorts made to support a podcast do not appear in YouTube Music. A promotional clip and a full episode serve different viewing situations.",
          "Keep a clear path between the two. The full episode can hold the longer discussion; a clip can answer one concrete question and introduce the guest’s perspective. A new viewer should not need to open the episode just to understand what the clip was saying.",
        ],
        links: [podcastHelp],
      },
      {
        id: "select-answer",
        title: "Find an answer with a useful beginning and ending",
        paragraphs: [
          "Read the transcript for complete ideas. Look for a practical explanation, a specific disagreement, a memorable example or a change of mind. Mark the boundaries around the thought, then listen to the audio to check whether those boundaries sound natural.",
          "A strong opening names the topic quickly. If the guest begins with ‘that was the problem,’ a viewer needs to know what ‘that’ means. Keep the preceding question or choose an opening sentence that makes the subject explicit. Do not manufacture a different meaning by removing a qualification.",
          "A useful ending pays off the opening. It can be a conclusion, a concrete next step or an example that makes the point clear. Ending halfway through an explanation just to reach a target duration usually produces a weaker standalone piece.",
        ],
        items: [
          "The promise: what question will this clip answer?",
          "The evidence: which example makes the answer understandable?",
          "The qualification: what would be misleading if removed?",
          "The payoff: where does the thought actually finish?",
        ],
      },
      {
        id: "framing",
        title: "Check who remains visible in a portrait frame",
        paragraphs: [
          "A two-person wide shot creates a different crop problem from a single centered speaker. Before choosing vertical output, identify whose expression or demonstration carries the moment. If the answer depends on both people being visible, square or horizontal output may preserve more of the conversation.",
          "Do not assume a format choice is the same as a custom multi-camera edit. Clipvelto provides vertical, square and horizontal exports, but does not offer a manual timeline editor or a promised two-speaker split-screen layout. Preview the result from start to finish, especially when the speaker or subject moves.",
          "For future recordings, leave enough space around each speaker for a portrait crop. Keep important diagrams and physical demonstrations close to the main subject. A few recording decisions made in advance are often more useful than trying to repair a difficult crop after the interview.",
        ],
      },
      {
        id: "caption-pass",
        title: "Run a separate caption and context pass",
        paragraphs: [
          "Use two review passes. First check the words against the audio: guest names, company names, numbers and specialist vocabulary need particular attention. Then watch the clip as a new viewer and ask whether the claim still means what the speaker intended.",
          "Captions should support the conversation rather than cover the guest’s face or a demonstration. Preview on a small screen. If your source already has captions burned into the picture, decide whether another caption layer is helpful before you submit the job.",
          "Keep responsibility for the final edit with a person. AI highlight selection can propose useful candidates, but it cannot reliably decide every question of nuance, consent, accuracy or how a guest will interpret an isolated excerpt.",
        ],
      },
      {
        id: "publishing",
        title: "Make the next step relevant to the clip",
        paragraphs: [
          "Give the clip a descriptive title that matches its actual answer. Include the guest’s name where it helps a viewer identify the conversation. If you publish on YouTube, its Related Video feature can connect a Short to an eligible full episode from your channel.",
          "Review your own results by topic and opening, not just by duration. A practical explanation may attract a different audience from an entertaining anecdote. Keep a simple record of what each clip promised and whether the edited answer delivered it. Do not assume a fixed number of posts or a particular caption style guarantees distribution.",
        ],
        links: [relatedVideo],
      },
      {
        id: "using-clipvelto",
        title: "Build a repeatable Clipvelto workflow",
        paragraphs: [
          "Use a video podcast recording you own or have permission to process. Paste a supported YouTube URL or upload an MP4, MOV or WebM file. Clipvelto currently works with video inputs; it is not an audio-only MP3 upload tool.",
          "Choose the shape and added-caption setting in the workspace, review the credit estimate and submit once. Importing, transcription, highlight selection and rendering follow in sequence. Submitted jobs cannot be cancelled. Successful clips can be downloaded and the completed video can later be deleted from your dashboard.",
          "For a first look, the homepage trial checks the first three minutes of a supported YouTube recording and shows one watermarked preview. That sample may contain your introduction rather than the best exchange in the whole episode. Use the workspace for a full episode when your available credits cover it; processing time depends on the recording, queue and services involved.",
        ],
        links: [
          {
            label: "Explore the video podcast clip maker",
            href: "/podcast-clip-maker",
          },
        ],
      },
    ],
    sources: [podcastHelp, relatedVideo],
    productPath: "/podcast-clip-maker",
  },
];

export function getArticle(slug: string) {
  return articles.find((article) => article.slug === slug);
}

export function readingMinutes(article: Article) {
  const text = [
    article.intro,
    ...article.takeaways,
    ...article.sections.flatMap((section) => [
      section.title,
      ...section.paragraphs,
      ...(section.items ?? []),
      ...(section.table?.rows.flat() ?? []),
    ]),
  ].join(" ");
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 220));
}
