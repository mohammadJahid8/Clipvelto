import type { Article } from "./articles";
import { photos } from "./photos";

const published = "2026-11-17T11:57:02Z";
const captions = {
  label: "YouTube Help: subtitles and captions",
  href: "https://support.google.com/youtube/answer/2734796?hl=en",
};
const podcast = {
  label: "YouTube Help: create and manage a podcast",
  href: "https://support.google.com/youtube/answer/12751636?hl=en",
};

export const creatorArticles: Article[] = [
  {
    slug: "podcast-clip-hooks-without-clickbait",
    title: "12 podcast clip openings that do not distort the conversation",
    description:
      "Specific opening lines for useful podcast excerpts, with examples of when each one fits and a quick check for keeping the guest’s meaning intact.",
    category: "Podcast clips",
    topic: "podcasts",
    published,
    modified: published,
    ...photos.microphone,
    intro:
      "A podcast hook does not need to sound like an argument. Often the strongest opening tells a new viewer exactly what problem the next few sentences solve. The examples here are original writing prompts—not quotes from real guests. Use one only if the conversation actually supports it.",
    takeaways: [
      "Name the situation or question before asking the viewer to care about the answer.",
      "A hook should match the excerpt; do not add a claim the guest did not make.",
      "Keep an example, qualification or result that makes the answer useful.",
    ],
    sections: [
      {
        id: "problem-openings",
        title: "When the guest solves a practical problem",
        paragraphs: [
          "A practical opening works best when the excerpt contains an action someone could understand without hearing the full episode. Name the task and the obstacle. Avoid saying that a simple tip will transform every viewer’s business or career.",
          "If the advice has a condition, keep that condition close to the opening. A process for a two-person team should not be presented as the right answer for every organization.",
        ],
        items: [
          "1. ‘Before you buy another microphone, check where you are recording.’ Use when the answer explains the room, not when it recommends a particular microphone.",
          "2. ‘Here is the question I ask before accepting a new project.’ Follow with the actual question and why it matters.",
          "3. ‘The first draft was not the problem. The brief was.’ Use only if the speaker’s example establishes that distinction.",
        ],
      },
      {
        id: "experience-openings",
        title: "When the interesting part is a specific experience",
        paragraphs: [
          "Concrete experiences give a viewer something to follow: a decision, an unexpected result or a change in approach. Preserve the sequence that makes the result understandable. A dramatic opening followed by an unrelated explanation is a mismatch.",
        ],
        items: [
          "4. ‘We changed one part of the handover. Here is what happened.’ Include what changed and the observed outcome.",
          "5. ‘This was the moment I realized the deadline was unrealistic.’ Keep the evidence behind that realization.",
          "6. ‘I stopped asking for feedback at the end.’ Follow with when the person asks instead and the reason for it.",
        ],
      },
      {
        id: "explanation-openings",
        title: "When the guest makes a confusing idea clearer",
        paragraphs: [
          "An explanation hook promises understanding. It should lead into a comparison, example or definition, rather than several sentences about how complicated the topic is. Leave room for the example to do the work.",
        ],
        items: [
          "7. ‘A useful way to think about a first draft is…’ Finish with the speaker’s analogy and its limit.",
          "8. ‘Those two numbers measure different things.’ Name the numbers immediately; do not leave the viewer guessing.",
          "9. ‘Let me show you with a small project.’ Keep enough of the example to reach its conclusion.",
        ],
      },
      {
        id: "qualified-openings",
        title: "When the answer needs a qualification",
        paragraphs: [
          "Sometimes the most useful part of an answer is the boundary around it. These openings can make an excerpt more accurate while still giving it a clear reason to watch.",
        ],
        items: [
          "10. ‘This worked for our small team. It would change at a larger scale.’ Preserve both the method and the limit.",
          "11. ‘I would use this for a prototype, not the final handover.’ Show the distinction the speaker is making.",
          "12. ‘The answer depends on which problem you are solving.’ Name the different problems before the clip ends.",
        ],
      },
      {
        id: "check-hook",
        title: "Check the opening against the recording",
        paragraphs: [
          "Play the minute before and after the excerpt. Does the hook still describe the speaker’s position? Would the guest recognize the summary? If a question is essential, retain it or supply a faithful, clearly separated introduction rather than making the answer seem spontaneous.",
          "Do not put a rewritten hook in quotation marks as if the guest said it. If you use added text or a separate introduction, make its editorial role clear. Also proofread names and technical terms in captions; an accurate spoken answer can be undermined by the wrong word on screen.",
          "Clipvelto can produce transcript-based highlight suggestions with optional added captions. It does not provide a full manual editing timeline. Review the downloaded result in a separate editor if you need to add a custom introduction or revise the composition.",
        ],
        links: [
          {
            label: "Choose a complete podcast moment",
            href: "/blog/turn-podcast-into-short-clips",
          },
          captions,
        ],
      },
    ],
    sources: [podcast, captions],
    productPath: "/podcast-clip-maker",
  },
  {
    slug: "turn-webinar-into-short-video-clips",
    title: "How to turn a webinar into clips people can use",
    description:
      "Find the useful questions, examples and demonstrations in a webinar, then make short excerpts that keep the explanation and evidence together.",
    category: "Webinars",
    topic: "repurposing",
    published,
    modified: published,
    ...photos.webinar,
    intro:
      "Most webinars contain more than one kind of material: an introduction, a presentation, a demonstration and audience questions. They should not all be edited the same way. A useful clipping plan starts with what a new viewer will learn, then checks whether that learning survives outside the full session.",
    takeaways: [
      "Select questions and complete explanations, not just the presenter’s most energetic sentence.",
      "A slide-heavy demonstration may need a wider frame than a talking-head excerpt.",
      "Check permissions, audience information and outdated details before publishing.",
    ],
    sections: [
      {
        id: "moment-list",
        title: "Build a short list of moments by purpose",
        paragraphs: [
          "On the first review, mark the time and the question each moment answers. ‘The budgeting example’ is a useful note; ‘good section’ is not. Record the answer’s endpoint too, so you know whether the excerpt contains a complete idea.",
          "Aim for a few distinct uses rather than several nearly identical promotional clips. One recording might support a definition, a mistake to avoid, a worked example and a response to an audience question. There is no need to force a fixed number if the material does not support it.",
        ],
        table: {
          headings: ["Moment", "What the short version needs"],
          rows: [
            ["Definition", "The term, a plain explanation and a small example"],
            [
              "Demonstration",
              "The starting state, the relevant action and the result",
            ],
            [
              "Audience question",
              "Enough of the question to understand the answer",
            ],
            [
              "Correction",
              "The mistaken assumption and the corrected explanation",
            ],
          ],
        },
      },
      {
        id: "slides",
        title: "Decide whether the slide or the speaker carries the idea",
        paragraphs: [
          "For a personal explanation, the speaker may be the main visual subject. For a spreadsheet, diagram or software demonstration, the evidence is often on the screen. Cropping the presenter into portrait while removing the relevant slide can leave a confident-sounding answer with nothing to support it.",
          "Preview at phone size. Can you read the labels the speaker mentions? If not, a wider frame may be preferable, or the demonstration may need a separate manual edit with selected close-ups. Do not assume a vertical export is automatically the most understandable version.",
        ],
        links: [
          {
            label: "Fix framing without losing the important information",
            href: "/blog/remove-black-bars-vertical-video",
          },
        ],
      },
      {
        id: "context",
        title: "Keep the example’s assumptions attached",
        paragraphs: [
          "Examples often depend on a date, a sample size, a software version or a fictional scenario introduced earlier. Include the assumption in the excerpt when it changes the meaning. Otherwise choose a different section or add a clear editorial explanation in your publishing workflow.",
          "Suppose a presenter demonstrates a process on sample data. A short version should not make that sample look like an actual customer result. Likewise, a recorded answer about an old interface should not be titled as an up-to-date tutorial without checking it again.",
        ],
      },
      {
        id: "permissions",
        title: "Review what the recording reveals",
        paragraphs: [
          "Check the recording’s publishing permissions and the speakers’ agreement. Review audience names, chat messages, private questions and any customer information visible in a screen share. A public short clip can reach people who were never part of the original session.",
          "If a section needs redaction, do that work before publishing it. Automated highlight selection is not a privacy review. Keep a clean copy of the original and a record of the excerpt you approved.",
        ],
      },
      {
        id: "publish-set",
        title: "Give the clips a sensible order",
        paragraphs: [
          "Publish the simplest explanation before a more detailed example if the clips form a series. Each one should still identify the topic and finish its own small task. A viewer may encounter them in a different order from the one you planned.",
          "In Clipvelto, submit an accepted video once, choose the output shape and added-caption setting, and follow the background stages. Review the credit quote before submitting; a long webinar uses credits based on its verified source duration and any storage minimum. After the clips are ready, review and download them for your own publishing workflow.",
        ],
        links: [
          {
            label: "See the recording-to-clips workflow",
            href: "/youtube-to-shorts",
          },
          {
            label: "Connect a YouTube Short to the complete session",
            href: "/blog/link-youtube-short-to-full-video",
          },
        ],
      },
    ],
    sources: [
      captions,
      {
        label: "YouTube Help: add a related video",
        href: "https://support.google.com/youtube/answer/14075157?hl=en",
      },
    ],
    productPath: "/youtube-to-shorts",
  },
  {
    slug: "edit-interview-clips-with-context",
    title: "How to cut an interview clip without changing the answer",
    description:
      "A practical review for interview excerpts: keep the question, preserve the speaker’s qualifications and make sure the opening matches what was actually said.",
    category: "Interviews",
    topic: "repurposing",
    published,
    modified: published,
    ...photos.podcast,
    intro:
      "A sentence can be accurately transcribed and still become misleading when it is separated from its question. Interview clipping is partly a timing task and partly a context task. Before polishing the captions, check that the short version represents the answer a new viewer would hear in the original conversation.",
    takeaways: [
      "Review the question and the surrounding answer before deciding where the clip begins.",
      "Keep words such as ‘sometimes,’ ‘for this project’ and ‘in our example’ when they limit the claim.",
      "Separate your title or introduction from words that are being presented as a direct quotation.",
    ],
    sections: [
      {
        id: "question",
        title: "Start by writing down the question",
        paragraphs: [
          "Ask what the speaker was responding to, not just what the selected sentence sounds like by itself. ‘Would you recommend this for a first project?’ is a different question from ‘Would you use this for every project?’ The same opening phrase can lead to very different meanings.",
          "If the answer relies on the question, include the question or make a faithful introduction in your edit. Avoid substituting a more provocative question that was never asked. A short excerpt should not require the viewer to reconstruct the missing exchange.",
        ],
      },
      {
        id: "qualification",
        title: "Keep the words that set the boundaries",
        paragraphs: [
          "Small qualifiers are easy to cut because they slow down an opening. They can also carry the most important limitation. Removing ‘for our team,’ ‘at that stage’ or ‘in this example’ can turn a narrow observation into a universal recommendation.",
          "Consider this fictional editing example: ‘For a two-day prototype, we skipped the custom dashboard.’ Cutting it to ‘We skipped the dashboard’ changes the situation the viewer is evaluating. Keep the condition, or choose another excerpt that can stand alone without it.",
        ],
      },
      {
        id: "whole-answer",
        title: "Keep the explanation and the conclusion together",
        paragraphs: [
          "An answer may begin by describing a common assumption and end by disagreeing with it. A clip that stops halfway can reverse the speaker’s position. Listen through the end of the answer before treating its first sentence as the highlight.",
          "Also check whether the next sentence corrects a number, a name or an exaggerated expression. Do not preserve the error while discarding the immediate correction. A clean-looking cut is less important than an accurate account of what was said.",
        ],
      },
      {
        id: "title-captions",
        title: "Review the title and captions as part of the edit",
        paragraphs: [
          "Write the title after you have watched the complete excerpt. It should describe the point the clip actually establishes. Quotation marks should contain words the person said, not an improved version of the sentence or a conclusion you drew from it.",
          "Read generated captions while listening to the audio. Pay attention to negation, numbers, names and technical words. A missing ‘not’ can change an answer more than a slightly awkward visual transition. YouTube provides separate subtitle tools, but those do not automatically fix text already burned into an MP4.",
        ],
        links: [captions],
      },
      {
        id: "review",
        title: "Do one final context pass",
        paragraphs: [
          "Watch the clip without looking at your editing notes. Can you identify the subject, the situation and the conclusion? Then compare it with the longer answer. If you would need a paragraph of explanation to defend the cut, it may be the wrong excerpt.",
          "For collaborative work, save the original timestamp range and the final title together. That gives the guest or editor a concrete version to review. Clipvelto’s transcript-based highlights are a starting point for this judgment; review every selection before publishing.",
        ],
        items: [
          "Does the opening preserve the question’s meaning?",
          "Are important conditions still present?",
          "Does the excerpt include the speaker’s final position?",
          "Do the title, captions and picture support the same interpretation?",
        ],
        links: [
          {
            label: "Write a clearer opening without clickbait",
            href: "/blog/podcast-clip-hooks-without-clickbait",
          },
        ],
      },
    ],
    sources: [captions, podcast],
    productPath: "/podcast-clip-maker",
  },
];
