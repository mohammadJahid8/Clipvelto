import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { Env } from "../config/env.js";
import {
  transcriptSchema,
  type Transcript,
} from "../modules/transcription/transcript.js";
import { runMediaProcess } from "./media-process.js";
import {
  TranscriptionProviderError,
  TranscriptionResponseError,
} from "./transcription-error.js";
import { logger } from "../config/logger.js";
import { maximumProcessingSeconds } from "../modules/uploads/processing-limits.js";

const rate = 16000;
const chunkSeconds = 300;
const wordSchema = z
  .object({
    start: z.number().finite().nonnegative(),
    end: z.number().finite().nonnegative(),
    word: z.string().trim().min(1).max(1000),
  })
  .refine((word) => word.end >= word.start);
const chunkSchema = z.object({
  // Legacy checkpoints were produced by Groq. Keep their provenance when a
  // job resumes using DeepInfra rather than relabeling already-paid work.
  provider: z.enum(["groq", "deepinfra"]).optional(),
  index: z
    .number()
    .int()
    .min(0)
    .max(maximumProcessingSeconds / chunkSeconds),
  language: z.string().min(2).max(20),
  words: z.array(wordSchema).max(40000),
});
export const transcriptionCheckpointSchema = z
  .object({
    version: z.literal(1),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    model: z.enum(["whisper-large-v3-turbo", "whisper-large-v3"]),
    sampleCount: z
      .number()
      .int()
      .positive()
      .max((maximumProcessingSeconds + 1) * rate),
    chunks: z
      .array(chunkSchema)
      .max(maximumProcessingSeconds / chunkSeconds + 1),
  })
  .superRefine((value, ctx) => {
    let count = 0;
    for (const [index, chunk] of value.chunks.entries()) {
      count += chunk.words.length;
      if (
        chunk.index !== index ||
        index * chunkSeconds * rate >= value.sampleCount ||
        chunk.words.some(
          (word) =>
            word.start < index * chunkSeconds ||
            word.end >
              Math.min((index + 1) * chunkSeconds, value.sampleCount / rate),
        )
      )
        ctx.addIssue({
          code: "custom",
          message: "Invalid transcription checkpoint",
        });
    }
    if (count > Math.ceil(value.sampleCount / rate) * 50 + 1000)
      ctx.addIssue({
        code: "custom",
        message: "Transcription checkpoint exceeds limit",
      });
  });
export type TranscriptionCheckpoint = z.infer<
  typeof transcriptionCheckpointSchema
>;
export type TranscriptionContext = {
  sourceSha256: string;
  checkpoint?: unknown;
  recoveryChunkIndex?: number;
  saveCheckpoint: (checkpoint: TranscriptionCheckpoint) => Promise<void>;
};
const providerSchema = z.object({
  language: z.string().min(2).max(64).optional(),
  text: z.string().max(200000).optional(),
  words: z.array(wordSchema).max(40000).default([]),
  segments: z
    .array(
      z
        .object({
          start: z.number().finite().nonnegative(),
          end: z.number().finite().nonnegative(),
        })
        .refine((segment) => segment.end >= segment.start),
    )
    .max(10000)
    .default([]),
});
const deepinfraProviderSchema = providerSchema.extend({
  words: z
    .array(
      z.union([
        wordSchema,
        z
          .object({
            start: z.number().finite().nonnegative(),
            end: z.number().finite().nonnegative(),
            text: z.string().trim().min(1).max(1000),
          })
          .refine((word) => word.end >= word.start)
          .transform(({ text, ...timing }) => ({ ...timing, word: text })),
      ]),
    )
    .max(40000)
    .default([]),
});

function hostedProvider(env: Env) {
  const deepinfra = env.TRANSCRIPTION_PROVIDER === "deepinfra";
  return {
    name: deepinfra ? ("deepinfra" as const) : ("groq" as const),
    model: deepinfra
      ? env.DEEPINFRA_TRANSCRIPTION_MODEL
      : env.GROQ_TRANSCRIPTION_MODEL,
    key: deepinfra ? env.DEEPINFRA_API_KEY : env.GROQ_API_KEY,
    url: deepinfra
      ? `https://api.deepinfra.com/v1/inference/openai/${env.DEEPINFRA_TRANSCRIPTION_MODEL}`
      : "https://api.groq.com/openai/v1/audio/transcriptions",
  };
}

async function responseJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new TranscriptionResponseError("EMPTY_RESPONSE");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 4 * 1024 ** 2)
        throw new TranscriptionResponseError("RESPONSE_TOO_LARGE");
      chunks.push(next.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof TranscriptionResponseError) throw error;
    throw new TranscriptionResponseError("INVALID_RESPONSE_JSON");
  } finally {
    await reader.cancel();
  }
}

async function requestWords(env: Env, audio: Buffer, signal: AbortSignal) {
  const provider = hostedProvider(env);
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(60000)]);
  for (let attempt = 0; attempt < 2; attempt++) {
    requestSignal.throwIfAborted();
    const form = new FormData();
    form.append(
      provider.name === "deepinfra" ? "audio" : "file",
      new Blob([Uint8Array.from(audio)], { type: "audio/wav" }),
      "audio.wav",
    );
    if (provider.name === "deepinfra") {
      form.append("chunk_level", "word");
      form.append("task", "transcribe");
    } else {
      form.append("model", provider.model);
      form.append("response_format", "verbose_json");
      form.append("timestamp_granularities[]", "word");
      form.append("timestamp_granularities[]", "segment");
    }
    form.append("temperature", "0");
    const response = await fetch(provider.url, {
      method: "POST",
      redirect: "error",
      signal: requestSignal,
      headers: { authorization: `Bearer ${provider.key}` },
      body: form,
    });
    if (response.ok) {
      const parsed = (
        provider.name === "deepinfra" ? deepinfraProviderSchema : providerSchema
      ).safeParse(await responseJson(response));
      if (!parsed.success) {
        logger.warn(
          {
            provider: provider.name,
            issueCount: parsed.error.issues.length,
            issues: parsed.error.issues
              .slice(0, 10)
              .map((issue) => ({ code: issue.code, path: issue.path })),
          },
          "Transcription response shape rejected; content omitted",
        );
        throw new TranscriptionResponseError("INVALID_RESPONSE_SHAPE");
      }
      if (!parsed.data.words.length && parsed.data.text?.trim())
        throw new TranscriptionResponseError("MISSING_WORD_TIMESTAMPS");
      return parsed.data;
    }
    const status = response.status;
    const retryAfter = response.headers.get("retry-after");
    await response.body?.cancel();
    const seconds = retryAfter === null ? 0.5 : Number(retryAfter);
    if (
      attempt === 0 &&
      (status === 429 || status >= 500) &&
      Number.isFinite(seconds) &&
      seconds >= 0 &&
      seconds <= 5
    ) {
      await delay(Math.max(250, seconds * 1000), undefined, {
        signal: requestSignal,
      });
      continue;
    }
    throw new TranscriptionProviderError(status);
  }
  throw new TranscriptionProviderError(503);
}

function wavHeader(bytes: number) {
  const header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(36 + bytes, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(bytes, 40);
  return header;
}

async function requestTimedWords(
  env: Env,
  audio: Buffer,
  offset: number,
  coreStart: number,
  coreEnd: number,
  signal: AbortSignal,
) {
  const result = await requestWords(
    env,
    Buffer.concat([wavHeader(audio.length), audio]),
    signal,
  );
  const audioSeconds = audio.length / (rate * 2);
  const ordered = [...result.words].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
  const words = ordered.flatMap((word) => {
    let end = word.end;
    if (word.end > audioSeconds + 1) {
      // Whisper can extend the final word beyond the audio while giving its
      // enclosing segment the correct end. Use that real segment boundary;
      // do not rescale timestamps or accept words starting outside the audio.
      const segment = result.segments.find(
        (item) =>
          item.start <= word.start &&
          item.end > word.start &&
          item.end <= audioSeconds + 0.1,
      );
      if (!segment || word.start >= audioSeconds) {
        logger.warn(
          { audioSeconds, wordEnd: word.end, offset },
          "Transcription timing exceeds supplied audio; content omitted",
        );
        throw new TranscriptionResponseError("WORD_EXCEEDS_CHUNK");
      }
      end = Math.min(segment.end, audioSeconds);
      logger.info(
        { audioSeconds, wordEnd: word.end, correctedEnd: end, offset },
        "Transcription word overrun corrected using its segment boundary",
      );
    }
    const midpoint = offset + (word.start + end) / 2;
    return midpoint >= coreStart && midpoint < coreEnd
      ? [
          {
            word: word.word,
            start: Math.max(coreStart, offset + word.start),
            end: Math.min(coreEnd, offset + end),
          },
        ]
      : [];
  });
  return {
    language: result.language?.trim().toLowerCase().slice(0, 20) || "und",
    words,
  };
}

async function requestShortParts(
  env: Env,
  audio: Buffer,
  offset: number,
  coreStart: number,
  coreEnd: number,
  signal: AbortSignal,
) {
  const words: z.infer<typeof wordSchema>[] = [];
  const languages = new Set<string>();
  // Reuse the decoded PCM. A second of overlap keeps speech at each boundary;
  // midpoint ownership includes each word in only one piece.
  for (let start = coreStart; start < coreEnd; start += 60) {
    signal.throwIfAborted();
    const end = Math.min(start + 60, coreEnd);
    const from = Math.max(0, Math.round((start - offset - 1) * rate));
    const to = Math.min(
      audio.length / 2,
      Math.round((end - offset + 1) * rate),
    );
    if (to <= from)
      throw new TranscriptionResponseError("INCOMPLETE_AUDIO_CHUNK");
    const part = await requestTimedWords(
      env,
      audio.subarray(from * 2, to * 2),
      offset + from / rate,
      start,
      end,
      signal,
    );
    words.push(...part.words);
    if (part.words.length) languages.add(part.language);
  }
  return {
    words,
    language:
      languages.size === 1 ? [...languages][0] : languages.size ? "mul" : "und",
  };
}

export function transcriptFromChunks(
  checkpoint: TranscriptionCheckpoint,
): Transcript {
  const segments: Transcript["segments"] = [];
  let words: z.infer<typeof wordSchema>[] = [];
  let previousEnd = 0;
  function flush() {
    if (!words.length) return;
    segments.push({
      start: words[0].start,
      end: words.at(-1)!.end,
      text: words.map((word) => word.word).join(" "),
      words,
    });
    words = [];
  }
  for (const chunk of checkpoint.chunks) {
    for (const item of chunk.words) {
      const word = {
        ...item,
        start: Math.max(previousEnd, item.start),
        end: Math.max(previousEnd, item.end),
      };
      if (words.length && (word.end - words[0].start > 8 || words.length >= 24))
        flush();
      words.push(word);
      previousEnd = word.end;
      if (/[.!?…。।]$/.test(word.word)) flush();
    }
    flush();
  }
  const languages = new Set(
    checkpoint.chunks
      .filter((chunk) => chunk.words.length)
      .map((chunk) => chunk.language),
  );
  const providers = new Set(
    checkpoint.chunks.map((chunk) => chunk.provider ?? "groq"),
  );
  return transcriptSchema.parse({
    provider: providers.size > 1 ? "mixed" : ([...providers][0] ?? "groq"),
    model: checkpoint.model,
    language:
      languages.size === 1 ? [...languages][0] : languages.size ? "mul" : "und",
    segments,
    ...(!segments.length ? { emptyReason: "no_speech" } : {}),
  });
}

export async function transcribeHosted(
  env: Env,
  source: string,
  output: string,
  signal: AbortSignal,
  context?: TranscriptionContext,
): Promise<Transcript> {
  const provider = hostedProvider(env);
  if (!provider.key) throw new TranscriptionProviderError(401);
  const active = AbortSignal.any([
    signal,
    AbortSignal.timeout(env.TRANSCRIPTION_TIMEOUT_SECONDS * 1000),
  ]);
  active.throwIfAborted();
  const directory = await mkdtemp(join(dirname(output), "hosted-"));
  const started = performance.now();
  try {
    const audioInfo = JSON.parse(
      await runMediaProcess(
        env.FFPROBE_PATH,
        [
          "-v",
          "error",
          "-protocol_whitelist",
          "file",
          "-select_streams",
          "a:0",
          "-show_entries",
          "stream=index:format=duration",
          "-of",
          "json",
          source,
        ],
        { signal: active, timeout: 15000 },
      ),
    ) as { streams?: unknown[]; format?: { duration?: string } };
    if (!audioInfo.streams?.length) {
      const empty = transcriptSchema.parse({
        provider: provider.name,
        model: provider.model,
        language: "und",
        segments: [],
        emptyReason: "no_audio",
      });
      await writeFile(output, JSON.stringify(empty), {
        mode: 0o600,
        flag: "wx",
      });
      return empty;
    }
    const duration = Number(audioInfo.format?.duration);
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > env.TRANSCRIPTION_MAX_SECONDS + 1
    )
      throw new TranscriptionResponseError("INVALID_AUDIO_DURATION");
    const sampleCount = Math.ceil(duration * rate);
    let sourceSha256 = context?.sourceSha256;
    if (!sourceSha256) {
      const hash = createHash("sha256");
      for await (const bytes of createReadStream(source, { signal: active }))
        hash.update(bytes);
      sourceSha256 = hash.digest("hex");
    }
    let checkpoint: TranscriptionCheckpoint = {
      version: 1,
      sourceSha256,
      model: provider.model,
      sampleCount,
      chunks: [],
    };
    const cached = transcriptionCheckpointSchema.safeParse(context?.checkpoint);
    if (
      cached.success &&
      cached.data.sourceSha256 === sourceSha256 &&
      cached.data.model === checkpoint.model &&
      Math.abs(cached.data.sampleCount - sampleCount) <= rate
    )
      checkpoint = cached.data;
    const reusedChunks = checkpoint.chunks.length;
    {
      const count = Math.ceil(sampleCount / (chunkSeconds * rate));
      for (let index = checkpoint.chunks.length; index < count; index++) {
        active.throwIfAborted();
        const coreStart = index * chunkSeconds;
        const coreEnd = Math.min(
          (index + 1) * chunkSeconds,
          sampleCount / rate,
        );
        // A second of context on either side; each word belongs to one core by its midpoint.
        const startSample = Math.max(0, (coreStart - 1) * rate);
        const endSample = Math.min(sampleCount, (coreEnd + 1) * rate);
        const pcm = join(directory, "chunk.pcm");
        await runMediaProcess(
          env.FFMPEG_PATH,
          [
            "-nostdin",
            "-loglevel",
            "error",
            "-y",
            "-protocol_whitelist",
            "file",
            "-threads",
            "2",
            "-ss",
            String(startSample / rate),
            "-i",
            source,
            "-map",
            "0:a:0",
            "-vn",
            "-t",
            String((endSample - startSample) / rate),
            "-ac",
            "1",
            "-ar",
            String(rate),
            "-c:a",
            "pcm_s16le",
            "-f",
            "s16le",
            "-fs",
            String((chunkSeconds + 3) * rate * 2),
            pcm,
          ],
          { signal: active, timeout: 120000 },
        );
        const audio = await readFile(pcm);
        await rm(pcm, { force: true });
        if (
          !audio.length ||
          audio.length % 2 ||
          audio.length > (chunkSeconds + 3) * rate * 2
        )
          throw new TranscriptionResponseError("INVALID_AUDIO_CHUNK", index);
        const offset = startSample / rate;
        // Recover malformed long responses using shorter pieces, not an identical
        // five-minute request. Completed checkpoint chunks are never requested again.
        const firstAttempt = context?.recoveryChunkIndex === index ? 1 : 0;
        for (let attempt = firstAttempt; attempt < 2; attempt++) {
          active.throwIfAborted();
          try {
            const result = await (
              attempt === 0 ? requestTimedWords : requestShortParts
            )(env, audio, offset, coreStart, coreEnd, active);
            const next = transcriptionCheckpointSchema.safeParse({
              ...checkpoint,
              chunks: [
                ...checkpoint.chunks,
                {
                  index,
                  provider: provider.name,
                  language: result.language,
                  words: result.words,
                },
              ],
            });
            if (!next.success)
              throw new TranscriptionResponseError("INVALID_CHUNK_TIMESTAMPS");
            try {
              transcriptFromChunks(next.data);
            } catch {
              throw new TranscriptionResponseError(
                "INVALID_TRANSCRIPT_TIMESTAMPS",
              );
            }
            checkpoint = next.data;
            break;
          } catch (error) {
            active.throwIfAborted();
            if (!(error instanceof TranscriptionResponseError)) throw error;
            logger.warn(
              {
                chunkIndex: index,
                attempt: attempt + 1,
                problemCode: error.problemCode,
              },
              "Transcription chunk rejected; audio and provider content omitted",
            );
            if (attempt === 1)
              throw new TranscriptionResponseError(error.problemCode, index);
          }
        }
        active.throwIfAborted();
        await context?.saveCheckpoint(checkpoint);
      }
    }
    const transcript = transcriptFromChunks(checkpoint);
    const encoded = JSON.stringify(transcript);
    if (Buffer.byteLength(encoded) > 512 * 1024 ** 2)
      throw new TranscriptionResponseError();
    active.throwIfAborted();
    await writeFile(output, encoded, { mode: 0o600, flag: "wx" });
    logger.info(
      {
        provider: provider.name,
        chunkCount: checkpoint.chunks.length,
        reusedChunks,
        milliseconds: Math.round(performance.now() - started),
      },
      "Transcription completed",
    );
    return transcript;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
