"use client";
import type { RenderOptions } from "@/lib/render-options";

export function RenderOptionsFields({
  value,
  onChange,
  disabled = false,
}: {
  value: RenderOptions;
  onChange: (value: RenderOptions) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="render-options" disabled={disabled}>
      <legend>Clip settings</legend>
      <label>
        Video shape
        <select
          value={value.aspectRatio}
          onChange={(event) =>
            onChange({
              ...value,
              aspectRatio: event.target.value as RenderOptions["aspectRatio"],
            })
          }
        >
          <option value="9:16">Vertical · 9:16 · 1080 × 1920</option>
          <option value="16:9">Horizontal · 16:9 · 1920 × 1080</option>
          <option value="1:1">Square · 1:1 · 1080 × 1080</option>
        </select>
      </label>
      <fieldset className="caption-choice">
        <legend>
          Generated captions <span>(choose one)</span>
        </legend>
        <label>
          <input
            type="radio"
            required
            name="captions"
            value="yes"
            checked={value.captions === "yes"}
            onChange={() => onChange({ ...value, captions: "yes" })}
          />{" "}
          Add captions
        </label>
        <label>
          <input
            type="radio"
            required
            name="captions"
            value="no"
            checked={value.captions === "no"}
            onChange={() => onChange({ ...value, captions: "no" })}
          />{" "}
          No added captions
        </label>
      </fieldset>
      <p className="field-hint">
        The video fills the selected shape by cropping. Captions already baked
        into the source remain visible. Export detail depends on your original
        video.
      </p>
    </fieldset>
  );
}
