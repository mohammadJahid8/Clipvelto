import { randomUUID } from "node:crypto";
import { writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ObjectStorage } from "./object-storage.js";
import type { createVideoModel } from "../modules/videos/video.model.js";

// Large transcripts/checkpoints live in private object storage instead of
// approaching MongoDB's document limit. Existing inline records remain readable.
export async function readTranscriptData(
  storage: ObjectStorage,
  video: {
    transcript?: unknown;
    transcriptionCheckpoint?: unknown;
    transcriptKey?: string | null;
    checkpointKey?: string | null;
  },
  checkpoint = false,
): Promise<unknown> {
  const key = checkpoint ? video.checkpointKey : video.transcriptKey;
  if (!key)
    return checkpoint ? video.transcriptionCheckpoint : video.transcript;
  const head = await storage.head(key);
  if (!head.ETag || !head.ContentLength || head.ContentLength > 512 * 1024 ** 2)
    throw new Error("Invalid saved transcript");
  const object = await storage.get(key, head.ETag);
  if (!object.Body) throw new Error("Missing saved transcript");
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
    bytes += chunk.length;
    if (bytes > head.ContentLength) throw new Error("Transcript size changed");
    chunks.push(Buffer.from(chunk));
  }
  if (bytes !== head.ContentLength)
    throw new Error("Incomplete saved transcript");
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
export async function saveTranscriptData(
  storage: ObjectStorage,
  Model: ReturnType<typeof createVideoModel>,
  filter: Record<string, unknown>,
  video: { userId: string; _id: { toString(): string } },
  directory: string,
  data: unknown,
  checkpoint = false,
) {
  const encoded = JSON.stringify(data);
  const field = checkpoint ? "transcriptionCheckpoint" : "transcript";
  const keyField = checkpoint ? "checkpointKey" : "transcriptKey";
  if (Buffer.byteLength(encoded) <= 1024 ** 2) {
    const saved = await Model.updateOne(filter, {
      $set: { [field]: data },
      $unset: { [keyField]: 1 },
    });
    if (!saved.matchedCount) throw new Error("Cancelled");
    return;
  }
  const key = `transcripts/${video.userId}/${video._id}/${randomUUID()}.json`;
  const registered = await Model.updateOne(filter, {
    $addToSet: { artifactKeys: key },
  });
  if (!registered.matchedCount) throw new Error("Cancelled");
  const path = join(directory, `${randomUUID()}.json`);
  await writeFile(path, encoded, { mode: 0o600, flag: "wx" });
  try {
    await storage.putFile(
      key,
      path,
      Buffer.byteLength(encoded),
      "application/json",
    );
    const saved = await Model.updateOne(filter, {
      $set: { [keyField]: key },
      $unset: { [field]: 1 },
    });
    if (!saved.matchedCount) {
      await storage.remove(key);
      throw new Error("Cancelled");
    }
  } finally {
    await rm(path, { force: true });
  }
}
