import type { Article } from "./articles";
import { photos } from "./photos";

const published = "2026-11-17T11:57:02Z";
const aspect = {
  label: "YouTube Help: video resolution and aspect ratios",
  href: "https://support.google.com/youtube/answer/6375112?hl=en",
};
const encoding = {
  label: "YouTube Help: recommended upload encoding settings",
  href: "https://support.google.com/youtube/answer/1722171?hl=en",
};
const related = {
  label: "YouTube Help: add a related video to a Short",
  href: "https://support.google.com/youtube/answer/14075157?hl=en",
};

export const editingArticles: Article[] = [
  {
    slug: "remove-black-bars-vertical-video",
    title: "Why your vertical video has black bars—and how to fix it",
    description:
      "A 9:16 file can still contain a small landscape picture. Learn the difference between fitting and filling a frame, and what to check before you export.",
    category: "Video editing",
    topic: "video-editing",
    published,
    modified: published,
    ...photos.phone,
    intro:
      "You export a vertical video, open it on a phone, and the actual picture occupies a strip in the middle. The file can be the correct size while the composition is wrong. Usually the editor has fitted a wide source inside a tall canvas. The fix starts with deciding what you are willing to crop.",
    takeaways: [
      "Fit preserves the whole source and can leave empty space. Fill covers the canvas and removes some of the source.",
      "Black bars already baked into a recording need to be removed from the picture itself.",
      "Review moving subjects and on-screen text throughout the clip, not only its first frame.",
    ],
    sections: [
      {
        id: "fit-fill",
        title: "First, check whether the picture is fitted or filled",
        paragraphs: [
          "Imagine putting a wide photograph on a tall sheet of paper. If you show the whole photograph, blank paper remains above and below it. If you enlarge it until the paper is covered, the left and right edges fall outside the sheet. Those are the two basic choices behind fit and fill.",
          "In editing software, look for the canvas or sequence ratio, then the source’s scale or framing control. Names vary by editor. A 9:16 canvas combined with a fit setting still produces a letterboxed-looking picture. Choose a fill or crop treatment only after checking what will leave the frame.",
        ],
        links: [aspect],
      },
      {
        id: "crop-cost",
        title: "Understand how much of a landscape shot you lose",
        paragraphs: [
          "A 1920 × 1080 source cropped to 9:16 at its original height retains only about 608 pixels of width. That is roughly 32% of the original horizontal picture. Enlarging the crop to 1080 × 1920 does not recover the discarded information or create new source detail.",
          "That tradeoff is manageable for a centered speaker. It is harder when two speakers occupy opposite sides, a slide fills the screen, or a game’s map and action are far apart. If both edges carry essential information, a square or landscape version may be the better edit.",
        ],
        table: {
          headings: ["What you need to preserve", "A sensible starting point"],
          rows: [
            [
              "One centered speaker",
              "Portrait crop; review hands and headroom",
            ],
            [
              "Two widely separated speakers",
              "Square or landscape; consider a separate manual layout",
            ],
            [
              "Small text across a slide",
              "Keep the full slide readable or make a dedicated close-up",
            ],
            [
              "Wide gameplay interface",
              "Check the action and interface together before choosing portrait",
            ],
          ],
        },
      },
      {
        id: "baked-bars",
        title: "Check whether the bars are part of the source",
        paragraphs: [
          "Open the original video outside the editor. If the black areas move with the picture when you scale it, they may be encoded pixels rather than empty canvas. Filling the canvas around that entire source can preserve the unwanted bars and cut the wrong edges.",
          "Where your editor supports it, crop away the encoded borders first, then compose the remaining picture inside the output frame. If the visible picture changes shape during the recording, review each affected section. One fixed crop may not suit every scene.",
        ],
      },
      {
        id: "review-motion",
        title: "Check three frames, then watch the whole clip",
        paragraphs: [
          "Look at the beginning, the most active moment and the ending. Does a person lean out of frame? Does a camera pan move the subject away from the center? Are captions hiding the demonstration? These checks catch obvious problems, but only a full playback reveals every transition.",
          "Also compare the actual MP4 with the preview inside your editor. A player may add its own background around a correctly framed file. Test the exported video at a phone-like size before deciding that the black areas are encoded into it.",
        ],
      },
      {
        id: "clipvelto-crop",
        title: "Choosing a format in Clipvelto",
        paragraphs: [
          "The workspace offers portrait, square and landscape output. Portrait fills the selected frame by cropping; it does not preserve the entire width of a landscape recording. Choose your shape and added-caption setting before submitting, then watch the finished MP4 on the site.",
          "For a split-screen interview or a detailed software demonstration, the most useful output may be the wider version. Clipvelto does not currently provide a manual multi-panel composition editor. Keep your original and use a separate editor if the scene needs a custom layout.",
        ],
        links: [
          {
            label: "Compare Shorts formats and lengths",
            href: "/blog/youtube-shorts-length-size-guide",
          },
        ],
      },
    ],
    sources: [aspect, encoding],
    productPath: "/youtube-to-shorts",
  },
  {
    slug: "why-1080p-clips-look-blurry",
    title: "Why a 1080p clip can still look blurry",
    description:
      "Resolution is only one part of video quality. Trace softness back to the source, the crop, repeated compression or the platform’s processing stage.",
    category: "Video quality",
    topic: "video-editing",
    published,
    modified: published,
    ...photos.editing,
    intro:
      "The export says 1080p, but faces, small text or fast movement still look soft. That label describes the dimensions of the output, not how much useful detail it contains. To fix the problem, compare the source, the downloaded export and the published version separately.",
    takeaways: [
      "A larger output cannot restore detail missing from the original recording.",
      "A narrow portrait crop can require substantial enlargement, even from a 1080p source.",
      "Compare the downloaded MP4 before judging a social platform’s lower-quality initial playback.",
    ],
    sections: [
      {
        id: "find-stage",
        title: "Find the first version that looks soft",
        paragraphs: [
          "Play the original recording at a useful size and pause on a face, a sign or a piece of interface text. Now inspect the same moment in your downloaded clip. Finally compare it with the version on the publishing platform. Keep the viewing size and player quality setting as similar as you can.",
          "If the original is already soft, changing the export dimensions is unlikely to solve it. If the source is sharp and the export is not, inspect cropping and encoding. If only the published version looks worse, check playback settings and processing before making another export.",
        ],
        table: {
          headings: ["Where softness first appears", "What to inspect"],
          rows: [
            [
              "Original recording",
              "Focus, motion blur, capture quality and source compression",
            ],
            [
              "Downloaded clip",
              "Crop enlargement, scaling and export settings",
            ],
            [
              "Published version",
              "Processing status, playback quality and another encode",
            ],
          ],
        },
      },
      {
        id: "crop-enlargement",
        title: "Portrait crops magnify the source you have",
        paragraphs: [
          "Turning a wide recording into a tall clip often means throwing away most of its width. A centered 9:16 crop from a 1920 × 1080 frame is about 608 × 1080 before enlargement. Saving that selection as 1080 × 1920 gives it a larger canvas, but the fine detail still comes from the smaller selection.",
          "Record the subject large enough in the source if portrait excerpts are important. For future interviews, keep the speaker’s face, hands and essential props inside a sensible crop area. For existing recordings, a square or landscape clip may preserve readability better.",
        ],
        links: [
          {
            label: "How cropping differs from fitting",
            href: "/blog/remove-black-bars-vertical-video",
          },
        ],
      },
      {
        id: "compression",
        title: "Avoid exporting a copy of a copy",
        paragraphs: [
          "A recording downloaded from a social post has usually already been compressed. Sending it through an editor and then another social upload adds more opportunities to lose detail. Retain the original recording and create each final version from that source when possible.",
          "YouTube’s current upload guidance includes MP4, H.264 and preserving the recorded frame rate. Its SDR reference table lists 8 Mbps for standard-frame-rate 1080p and 12 Mbps for higher-frame-rate 1080p. Those are platform recommendations, not a guarantee that a particular bitrate will make every source look sharp.",
        ],
        links: [encoding],
      },
      {
        id: "processing",
        title: "Allow for publishing-platform processing",
        paragraphs: [
          "YouTube explains that a newly uploaded video may first be available at lower quality while higher-resolution processing continues. Check the available quality options before treating the first playback as the finished result. Upload and processing time can vary with the file and platform workload.",
          "Keep a local reference file. It gives you a stable comparison if an automatic player setting changes with your connection. Do not repeatedly re-export merely because one streamed playback looked worse than another.",
        ],
        links: [
          {
            label: "YouTube Help: video quality after upload",
            href: "https://support.google.com/youtube/answer/71674?hl=en",
          },
        ],
      },
      {
        id: "quality-review",
        title: "Use a repeatable final review",
        paragraphs: [
          "Check faces, gradients, small text and the fastest movement in the clip. Listen for clipping or unexpectedly quiet speech. Watch the entire file once, including the first and last frames, then test the uploaded version after processing has completed.",
          "Clipvelto’s workspace offers 1080-sized output formats, but the detail depends on the source and crop. The public trial is a watermarked preview; judge your final download separately. Keep your originals and downloaded clips rather than using a social repost as the starting point for the next edit.",
        ],
      },
    ],
    sources: [
      encoding,
      {
        label: "YouTube Help: video quality after upload",
        href: "https://support.google.com/youtube/answer/71674?hl=en",
      },
    ],
    productPath: "/youtube-to-shorts",
  },
  {
    slug: "link-youtube-short-to-full-video",
    title: "How to connect a YouTube Short to your full video",
    description:
      "Use YouTube’s related-video feature to give viewers a clear next step, and choose an excerpt that makes the longer video worth opening.",
    category: "YouTube publishing",
    topic: "video-editing",
    published,
    modified: published,
    ...photos.camera,
    intro:
      "A Short can answer a small question while the full recording explains the bigger one. The connection works better when viewers know what they will get next. YouTube provides a related-video link for eligible channels; your editing job is to make that next video relevant to the clip they just watched.",
    takeaways: [
      "YouTube’s related-video setting requires advanced feature access.",
      "Choose a public or unlisted video from your channel that genuinely continues the topic.",
      "Make the Short useful on its own instead of withholding its entire answer.",
    ],
    sections: [
      {
        id: "choose-destination",
        title: "Choose the destination before choosing the excerpt",
        paragraphs: [
          "Start with the full video you want someone to watch. Identify its main question, then find a smaller question answered inside it. That smaller answer gives the Short a clear purpose without requiring a viewer to understand the entire recording.",
          "For a software tutorial, the Short might explain one mistake while the full video walks through the complete task. For an interview, it could contain one practical example while the episode explores the guest’s reasoning. An unrelated popular upload is a weaker destination, even if you would like it to receive more views.",
        ],
      },
      {
        id: "related-video",
        title: "Add the related video in YouTube Studio",
        paragraphs: [
          "YouTube’s current instructions are to open Studio, select Content, open the Short, choose a Related Video from your channel and save. The feature requires advanced feature access. The destination must be public or unlisted and comply with YouTube’s guidelines.",
          "The resulting link appears below the channel handle in the Shorts player. Check the current help page if the setting is unavailable or the interface has changed. Downloading a clip from Clipvelto does not add this link automatically; publishing and related-video selection happen in YouTube.",
        ],
        links: [related],
      },
      {
        id: "clear-promise",
        title: "Tell viewers what the longer video adds",
        paragraphs: [
          "‘Watch the full video’ asks for more time without explaining why. A more concrete invitation names the extra value: the full setup, the complete comparison, the remaining examples or the reasoning behind the answer. Use the invitation only when the destination actually delivers that material.",
          "For example, after showing one camera-positioning fix, you might say that the full tutorial covers the lighting and sound setup too. That is an illustrative example, not a promise about a particular channel. Keep the message brief enough that it does not overwhelm the useful part of the clip.",
        ],
      },
      {
        id: "avoid-cliffhanger",
        title: "Let the Short complete a small idea",
        paragraphs: [
          "An excerpt that cuts away before its answer can feel like a broken video. Give the viewer a result, then offer a deeper explanation. A small complete lesson is a clearer introduction to your channel than a fragment that makes no sense until someone leaves the feed.",
          "Keep the relevant qualification with the answer. If the speaker says a method only works for a certain situation, preserve that limit in the Short. The full video should expand the context rather than correct a misleading impression created by the clip.",
        ],
      },
      {
        id: "review-published",
        title: "Check the published journey on a phone",
        paragraphs: [
          "Watch the Short as a viewer would. Is the opening understandable without your thumbnail notes? Are the captions readable? Does the destination match the invitation? Open the related video and confirm it is the intended upload.",
          "Then compare what you expected with what your own analytics show over time. A link gives viewers an option; it does not guarantee that they will open it. Use the results to improve the relationship between the excerpt and the longer recording, rather than treating the feature as an automatic growth mechanism.",
        ],
        links: [
          {
            label: "Choose a useful podcast excerpt",
            href: "/blog/turn-podcast-into-short-clips",
          },
        ],
      },
    ],
    sources: [related],
    productPath: "/youtube-to-shorts",
  },
];
