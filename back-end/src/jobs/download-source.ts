import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ObjectStorage } from "../services/object-storage.js";
import { transferTimeoutMs } from "../modules/uploads/processing-limits.js";
import { requireTemporarySpace } from "../services/temporary-space.js";
import { dirname } from "node:path";

export async function downloadSource(
  storage: ObjectStorage,
  video: {
    sourceKey?: string | null;
    sourceEtag?: string | null;
    expectedSize?: number | null;
    sha256?: string | null;
  },
  path: string,
  maxBytes: number,
  signal: AbortSignal,
) {
  if (
    !video.sourceKey ||
    !video.sourceEtag ||
    !video.expectedSize ||
    !video.sha256
  )
    throw new Error("Missing validated source");
  const timeout = transferTimeoutMs(video.expectedSize);
  await requireTemporarySpace(dirname(path), video.expectedSize);
  const source = await storage.get(video.sourceKey, video.sourceEtag, timeout);
  if (!source.Body) throw new Error("Missing source body");
  const hash = createHash("sha256");
  let size = 0;
  await pipeline(
    source.Body as Readable,
    new Transform({
      transform(chunk: Buffer, _encoding, done) {
        size += chunk.length;
        if (size > video.expectedSize! || size > maxBytes)
          return done(new Error("Source exceeds limit"));
        hash.update(chunk);
        done(null, chunk);
      },
    }),
    createWriteStream(path, { mode: 0o600, flags: "wx" }),
    { signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]) },
  );
  if (size !== video.expectedSize || hash.digest("hex") !== video.sha256)
    throw new Error("Source integrity check failed");
}
