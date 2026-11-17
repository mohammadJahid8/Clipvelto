import { parentPort, workerData } from "node:worker_threads";
import { open } from "node:fs/promises";
import mediaInfoFactory from "mediainfo.js";

const { path } = workerData as { path: string };
const file = await open(path, "r");
const mediaInfo = await mediaInfoFactory({
  format: "object",
  chunkSize: 256 * 1024,
  full: false,
});
try {
  const { size } = await file.stat();
  let readTotal = 0;
  const result = await mediaInfo.analyzeData(
    size,
    async (requested, offset) => {
      const length = Math.min(requested, 1024 * 1024, size - offset);
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        length < 0 ||
        (readTotal += length) > 32 * 1024 ** 2
      )
        throw new Error("Metadata read budget exceeded");
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await file.read(buffer, 0, length, offset);
      return buffer.subarray(0, bytesRead);
    },
  );
  const general = result.media?.track.find(
    (track) => track["@type"] === "General",
  );
  const video = result.media?.track.find((track) => track["@type"] === "Video");
  if (!general || !video || video["@type"] !== "Video")
    throw new Error("No video stream");
  const durations = result
    .media!.track.filter(
      (track) =>
        track["@type"] === "General" ||
        track["@type"] === "Video" ||
        track["@type"] === "Audio",
    )
    .map((track) => Number("Duration" in track ? track.Duration : 0))
    .filter(Number.isFinite);
  parentPort!.postMessage({
    ok: true,
    metadata: {
      durationSeconds: Math.max(...durations, 0),
      width: Number(video.Width),
      height: Number(video.Height),
      container: String(general.Format ?? ""),
      codec: String(video.Format ?? ""),
      encrypted: "Encryption" in video && !!video.Encryption,
    },
  });
} catch {
  parentPort!.postMessage({ ok: false });
} finally {
  mediaInfo.close();
  await file.close();
}
