export type RenderOptions = {
  aspectRatio: "9:16" | "16:9" | "1:1";
  captions: "" | "yes" | "no";
};
export const initialRenderOptions: RenderOptions = {
  aspectRatio: "9:16",
  captions: "",
};
export function renderOptionsPayload(value: RenderOptions) {
  if (!value.captions)
    throw new Error("Choose whether to add captions before continuing.");
  return { aspectRatio: value.aspectRatio, captions: value.captions === "yes" };
}
