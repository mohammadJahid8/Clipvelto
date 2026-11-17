"use client";

import { useEffect, useState } from "react";
import { Check, Film, LoaderCircle, Scissors, Sparkles } from "lucide-react";

export function ProcessingProgress({
  step, title, detail, phases, startedAt, completionNote, slowNote, label,
}: {
  step: number;
  title: string;
  detail: string;
  phases: readonly string[];
  startedAt?: string;
  completionNote: string;
  slowNote: string;
  label: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const parsed = startedAt ? Date.parse(startedAt) : NaN;
    const started = Number.isFinite(parsed) ? parsed : Date.now();
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  return (
    <div className="trial-progress">
      <div className="trial-progress-visual" aria-hidden="true">
        <div className="trial-film-frame"><Film size={42} strokeWidth={1.3} /><span /><span /><span /></div>
        <div className="trial-processing-mark"><Scissors size={22} /></div>
        <span className="trial-progress-spark"><Sparkles size={20} /></span>
      </div>
      <div className="trial-progress-content">
        <div className="trial-progress-heading" role="status" aria-live="polite">
          <span className="trial-live-dot" aria-hidden="true" />
          <h3>{title}</h3>
        </div>
        <p>{detail}</p>
        <div className="trial-progress-track" role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={phases.length} aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1} of ${phases.length}: ${phases[step]}`}>
          {phases.map((phase, index) => <span key={phase} className={index < step ? "done" : index === step ? "active" : ""} />)}
        </div>
        <ol className="trial-progress-steps" aria-label="Processing stages">
          {phases.map((phase, index) => <li key={phase} className={index <= step ? "active" : ""} aria-current={index === step ? "step" : undefined}>
            {index < step ? <Check size={16} aria-hidden="true" /> : index === step ? <LoaderCircle size={16} className="loading-spinner" aria-hidden="true" /> : <span className="trial-step-dot" aria-hidden="true" />}
            {phase}
          </li>)}
        </ol>
        <div className="trial-wait-note">
          <span className="trial-elapsed" aria-live="off">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} elapsed</span>
          <span>{completionNote}</span>
        </div>
        {elapsed >= 90 && <p className="trial-slow-note">{slowNote}</p>}
      </div>
    </div>
  );
}
