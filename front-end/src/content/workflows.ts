import { photos } from "./photos";
import type { SourceLink, ContentSection } from "./articles";

export type Workflow = {
  slug: "youtube-to-shorts" | "podcast-clip-maker";
  title: string;
  description: string;
  heading: string;
  intro: string;
  image: string;
  imageAlt: string;
  imageCaption: string;
  imageSource: SourceLink;
  benefits: { title: string; text: string }[];
  steps: { title: string; text: string }[];
  sections: ContentSection[];
  questions: { question: string; answer: string }[];
};

export const workflows: Workflow[] = [
  {
    slug: "youtube-to-shorts",
    title: "YouTube to Shorts: turn long videos into short clips",
    description:
      "Turn a supported YouTube recording into short MP4 clips with Clipvelto. Choose vertical, square or horizontal output and optional captions, then review and download.",
    heading: "A long YouTube video. A fresh set of short clips.",
    intro:
      "Start with a recording you have permission to use. Clipvelto transcribes the speech, selects short highlights and creates MP4 clips for you to review. One submission takes you through the workflow.",
    ...photos.phone,
    benefits: [
      {
        title: "Three useful shapes",
        text: "Choose 9:16 portrait, 1:1 square or 16:9 landscape in your workspace before submitting.",
      },
      {
        title: "Captions when you want them",
        text: "Select added captions or keep the source image without an extra caption layer.",
      },
      {
        title: "Review before publishing",
        text: "Play your clips on the site and download the MP4s you want. You control what gets posted.",
      },
    ],
    steps: [
      {
        title: "Paste your recording",
        text: "Use a supported public YouTube video or completed stream. Device uploads are available too.",
      },
      {
        title: "Review the quote and submit",
        text: "Choose your format and caption setting. The server verifies the source and reserves credits before processing.",
      },
      {
        title: "Preview and download",
        text: "After transcription, highlight selection and rendering, check your clips and save the MP4s.",
      },
    ],
    sections: [
      {
        id: "right-recording",
        title: "Start with speech and a complete idea",
        paragraphs: [
          "Podcasts, interviews, commentary, explainers and spoken tutorials give transcript-based highlight selection useful material to work with. A clear question and a self-contained answer are easier to turn into a coherent clip than an isolated sentence with missing context.",
          "Clipvelto selects moments from transcribed speech. It does not promise to recognize every visual event, detect a silent gaming highlight or turn any random recording into a viral video. Review the selected moments against your own intent before you publish.",
        ],
      },
      {
        id: "output",
        title: "Choose the shape your content actually needs",
        paragraphs: [
          "Portrait output fills a 9:16 frame by cropping the wider source. That works best when the subject and essential information fit the narrow composition. For wide demonstrations or side-by-side comparisons, consider square or landscape output instead.",
          "Current exports target 1080 × 1920, 1080 × 1080 or 1920 × 1080, depending on the chosen shape. A larger output frame does not restore detail missing from a low-quality source. Use your cleanest available recording and preview the crop and captions on a phone.",
        ],
      },
      {
        id: "transparent-workflow",
        title: "Know what happens after you submit",
        paragraphs: [
          "Clipvelto currently generates highlight clips up to 60 seconds long. Importing, transcription, selection and rendering are separate background stages of one job; you do not need to start transcription manually. A long recording may still take time to download and process, and one global media job runs at a time in the current setup.",
          "One credit covers one source minute, measured in seconds, with a one-credit minimum per recording. Large files also have a storage-based minimum; the higher quote applies. The same 15 free credits cover both a homepage trial and later account processing. The homepage trial samples the first three minutes and shows one watermarked preview.",
          "Submitted jobs cannot be cancelled. System failures return the processing reservation and preserve recoverable progress. Once generation finishes, you can delete the completed video from your dashboard; deleting completed media does not refund spent credits. New media normally remains available for 30 days.",
        ],
        links: [
          {
            label: "Review credit packs and current availability",
            href: "/#pricing",
          },
        ],
      },
    ],
    questions: [
      {
        question: "Can I paste any YouTube link?",
        answer:
          "Use a single supported video or livestream link and confirm you have permission to process it. Playlists are not supported. Private, age-restricted, unavailable or YouTube-blocked recordings may not import; uploading your own video file is an alternative.",
      },
      {
        question: "Can I create a three-minute Short?",
        answer:
          "Clipvelto’s current highlight renderer creates clips up to 60 seconds long. YouTube’s own Shorts length allowance is a separate platform rule and does not change Clipvelto’s current output length.",
      },
      {
        question: "Does Clipvelto upload the result to YouTube?",
        answer:
          "No. You preview and download MP4 files, then publish them yourself. This gives you a chance to check the crop, captions, rights and final context first.",
      },
      {
        question: "What happens with a stream that is live now?",
        answer:
          "The workspace can capture a bounded window of 1–10 minutes near the live edge when the queued job starts. It does not capture the whole past broadcast or monitor the channel continuously. Active streams are not available in the homepage trial.",
      },
    ],
  },
  {
    slug: "podcast-clip-maker",
    title: "Video podcast clip maker with optional captions",
    description:
      "Turn a video podcast episode into short, captioned clips. Clipvelto selects transcript-based highlights and exports vertical, square or landscape MP4 files.",
    heading: "Let a good conversation travel further.",
    intro:
      "Find short, self-contained moments in your video podcast without starting a separate transcription job. Clipvelto proposes highlights, adds captions when selected, and gives you MP4 previews to review before sharing.",
    ...photos.podcast,
    benefits: [
      {
        title: "Start with the conversation",
        text: "Speech transcription gives highlight selection a text version of the episode to work from.",
      },
      {
        title: "Keep your format options",
        text: "Choose portrait for a focused speaker or keep a wider frame when the conversation needs it.",
      },
      {
        title: "A human review stays essential",
        text: "Check guest names, qualifications and context before sharing an isolated excerpt.",
      },
    ],
    steps: [
      {
        title: "Bring your video episode",
        text: "Paste a supported YouTube recording or upload an MP4, MOV or WebM that you own or may process.",
      },
      {
        title: "Choose the output",
        text: "Select the frame shape and whether to add captions, review credits and submit the job once.",
      },
      {
        title: "Review your selected moments",
        text: "Watch each preview for a complete thought, accurate captions and a suitable crop, then download.",
      },
    ],
    sections: [
      {
        id: "good-fit",
        title: "An excerpt should make sense to a new listener",
        paragraphs: [
          "The best candidate is often an answer with one useful example and a clear conclusion. A dramatic sentence can become misleading if the question or an important qualification is removed. Use the proposed moments as a shortlist, then check the original conversation when context matters.",
          "Clipvelto does not promise that every selected moment is the right editorial choice. It cannot replace your judgment about guest consent, factual accuracy or the implications of sharing part of a longer discussion. You remain in control of the clip you download and publish.",
        ],
      },
      {
        id: "two-speakers",
        title: "Plan the framing for your recording setup",
        paragraphs: [
          "A wide two-person conversation may lose one participant in a portrait crop. Preview the whole clip, including changes of speaker. Use square or landscape output when preserving both subjects matters more than filling a phone screen.",
          "Current output shapes are 9:16, 1:1 and 16:9. Clipvelto is not a manual timeline editor and does not currently provide a custom two-speaker split-screen layout. It creates highlights up to 60 seconds long, with optional captions, for you to review and download.",
        ],
      },
      {
        id: "episode-workflow",
        title: "A clear workflow from episode to export",
        paragraphs: [
          "The tool works with video podcast recordings rather than audio-only MP3 uploads. Use a clean recording with audible speech. Imported audio is sent to the configured transcription service, while transcript text is used for highlight selection; media is stored privately. See the privacy policy for the providers involved.",
          "Your credit estimate is based on verified source duration and a storage minimum for large files. The homepage trial samples only the first three minutes, so it may see your introduction rather than a later interview highlight. Its usage comes from the same 15 free credits included with an account.",
          "For a full episode, use the workspace and confirm a quote covered by your available credits. Submitted jobs cannot be cancelled. Failed processing releases the reservation, and saved progress can be reused on a recoverable retry. Download successful clips and keep your own copies before the media retention period ends.",
        ],
        links: [
          {
            label: "How your recordings and transcripts are handled",
            href: "/privacy",
          },
        ],
      },
    ],
    questions: [
      {
        question: "Do I need to transcribe the episode first?",
        answer:
          "No. Once you submit an accepted video, transcription, highlight selection and rendering run as stages of one background job. You can follow progress in the dashboard.",
      },
      {
        question: "Can I upload an audio-only podcast?",
        answer:
          "Current device inputs are MP4, MOV and WebM video files. Audio-only MP3 upload is not currently supported. Use your video recording or a supported YouTube episode.",
      },
      {
        question: "Can I switch captions off?",
        answer:
          "Yes. Choose the added-caption setting before you submit the workspace job. Turning added captions off does not remove subtitles already burned into the original recording.",
      },
      {
        question: "Can I delete the episode afterward?",
        answer:
          "You can delete a completed video from your dashboard once clip generation has finished. Used credits are not refunded by deletion. Submitted or running jobs cannot be cancelled.",
      },
    ],
  },
];
