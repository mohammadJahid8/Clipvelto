import { ArrowDownToLine, Scissors, Upload } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "Upload your video",
    description:
      "A podcast, tutorial, interview, or stream. Start with a recording that’s yours to share.",
    detail: "Your recording. Your starting point.",
  },
  {
    icon: Scissors,
    title: "Find the best moments",
    description:
      "Find standout moments, framed in your chosen shape with optional captions.",
    detail: "The good bits, without the digging.",
  },
  {
    icon: ArrowDownToLine,
    title: "Download your clips",
    description:
      "Review your favorites and download high-quality MP4s for wherever you publish.",
    detail: "Less editing. More creating.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      tabIndex={-1}
      className="container section workflow"
      aria-labelledby="workflow-title"
    >
      <div className="section-heading">
        <div>
          <p className="section-kicker">A shorter way to create</p>
          <h2 id="workflow-title">Good content goes further.</h2>
        </div>
      </div>
      <ol className="steps">
        {steps.map(({ icon: Icon, title, description, detail }, index) => (
          <li className="step" key={title}>
            <div className="step-top">
              <span className="step-number">0{index + 1}</span>
              <Icon size={23} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
            <span className="step-detail">{detail}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
