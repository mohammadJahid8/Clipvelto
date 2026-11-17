import { Queue } from "bullmq";
import type { Env } from "../config/env.js";
import { logger } from "../config/logger.js";

export function redisConnection(env: Env, worker = false) {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number(url.pathname.slice(1) || 0),
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: worker ? null : 1,
    enableOfflineQueue: worker,
    connectTimeout: 3000,
  };
}

export function createUploadQueue(env: Env) {
  const queue = new Queue<{ videoId: string; generation: number }>(
    "upload-validation",
    {
      connection: redisConnection(env),
      prefix: env.UPLOAD_QUEUE_PREFIX,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 1000 },
      },
    },
  );
  queue.on("error", () => logger.warn("Upload queue connection unavailable"));
  return queue;
}
export type UploadQueue = ReturnType<typeof createUploadQueue>;
export async function enqueueValidation(
  queue: UploadQueue,
  videoId: string,
  generation: number,
) {
  return enqueue(queue, "validate", videoId, generation);
}
export async function enqueueTranscription(
  queue: UploadQueue,
  videoId: string,
  generation: number,
) {
  return enqueue(queue, "transcribe", videoId, generation);
}
export async function enqueueImport(
  queue: UploadQueue,
  videoId: string,
  generation: number,
) {
  return enqueue(queue, "import", videoId, generation);
}
export async function enqueueClips(
  queue: UploadQueue,
  videoId: string,
  generation: number,
) {
  return enqueue(queue, "generate", videoId, generation);
}
async function enqueue(
  queue: UploadQueue,
  name: "validate" | "transcribe" | "import" | "generate",
  videoId: string,
  generation: number,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      queue.add(
        name,
        { videoId, generation },
        {
          jobId: `${name === "validate" ? "video" : name === "transcribe" ? "transcript" : name}-${videoId}-${generation}`,
          ...(name !== "validate" ? { attempts: 1 } : {}),
        },
      ),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Queue delivery timed out")),
          3000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
