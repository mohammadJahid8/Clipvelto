import { Captions, Download, ScanLine, Smartphone } from "lucide-react";

const features = [
  {
    icon: ScanLine,
    title: "Find the good bits",
    text: "Highlight detection that gets to the point.",
  },
  {
    icon: Smartphone,
    title: "Choose your shape",
    text: "Vertical, horizontal, or square.",
  },
  {
    icon: Captions,
    title: "Make every word count",
    text: "Automatic captions. Sound on or off.",
  },
  {
    icon: Download,
    title: "Yours to share",
    text: "Download MP4s. Post them anywhere.",
  },
];

export function Features() {
  return (
    <section className="feature-strip" aria-label="Clip creation features">
      <div className="container feature-grid">
        {features.map(({ icon: Icon, title, text }) => (
          <div className="feature" key={title}>
            <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
            <div>
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
