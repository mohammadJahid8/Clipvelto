import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Job } from "bullmq";
import type { Env } from "../config/env.js";
import type { UploadService } from "../modules/uploads/upload-service.js";
import type { createVideoModel, Video } from "../modules/videos/video.model.js";
import { transcriptSchema } from "../modules/transcription/transcript.js";
import { transcribe as transcribeConfigured } from "../services/transcriber.js";
import {
  transcriptionFailureMessage,
  transcriptionFailureDetails,
} from "../services/transcription-error.js";
import {
  selectHighlights,
  highlightSchema,
  HighlightProviderError,
  validateHighlights,
  HighlightSelectionError,
} from "../services/highlight-selector.js";
import { renderClip } from "../services/clip-renderer.js";
import { downloadSource } from "./download-source.js";
import { probeVideo } from "./probe-video.js";
import { logger } from "../config/logger.js";
import {
  defaultRenderOptions,
  outputDimensions,
  trialPreviewDimensions,
  renderOptionsSchema,
} from "../modules/clips/render-options.js";
import { trialModels } from "../modules/trials/trial.model.js";
import { renderTrialPoster } from "../services/trial-posters.js";
import { stat } from "node:fs/promises";
import { UploadError } from "../modules/uploads/upload-error.js";
import {
  readTranscriptData,
  saveTranscriptData,
} from "../services/transcript-storage.js";

export type ClipStage =
  "source" | "transcription" | "selection" | "rendering" | "storage";
export function clipFailureMessage(error: unknown, stage: ClipStage) {
  if (error instanceof UploadError) return error.message;
  if (stage === "transcription") return transcriptionFailureMessage(error);
  if (
    error instanceof HighlightProviderError ||
    error instanceof HighlightSelectionError
  )
    return error.message;
  const messages: Record<ClipStage, string> = {
    source:
      "The saved video couldn’t be read. Please retry; your source and saved transcript are preserved.",
    transcription:
      "Speech transcription stopped before it finished. Please retry; your source video is saved.",
    selection:
      "Highlight selection couldn’t complete. Your transcript is saved; retrying will reuse it.",
    rendering:
      "Video rendering stopped. Your transcript and selected highlights are saved; retrying will reuse them.",
    storage:
      "The generated clips couldn’t be saved. Your transcript and selected highlights are preserved for retry.",
  };
  return messages[stage];
}

export async function generateClips(
  job: Job<{ videoId: string; generation: number }>,
  env: Env,
  uploads: UploadService,
  VideoModel: ReturnType<typeof createVideoModel>,
  shutdown: AbortSignal,
  select = selectHighlights,
  render = renderClip,
  transcribe = transcribeConfigured,
) {
  const run = randomUUID();
  const video = await VideoModel.findOneAndUpdate(
    {
      _id: job.data.videoId,
      status: "ready",
      clipStatus: "queued",
      clipGeneration: job.data.generation,
    },
    {
      $set: {
        clipStatus: "processing",
        clipRunId: run,
        clipHeartbeatAt: new Date(),
        clipMessage: "Preparing your recording.",
        clipStage: "source",
      },
    },
    { returnDocument: "after" },
  ).select(
    "+transcript +transcriptionCheckpoint +transcriptKey +checkpointKey",
  );
  if (!video) return;
  const credits = uploads.creditsFor(video);
  const filter = {
    _id: video._id,
    status: "ready" as const,
    clipStatus: "processing" as const,
    clipRunId: run,
    clipGeneration: job.data.generation,
  };
  const controller = new AbortController();
  const abort = () => controller.abort();
  shutdown.addEventListener("abort", abort, { once: true });
  if (shutdown.aborted) abort();
  const heartbeat = setInterval(() => {
    void VideoModel.updateOne(filter, { $set: { clipHeartbeatAt: new Date() } })
      .then((result) => {
        if (!result.matchedCount) abort();
      })
      .catch(abort);
  }, 10000).unref();
  let directory: string | undefined;
  const uploaded: string[] = [];
  let saved = false;
  let stage: ClipStage = "source";
  const started = performance.now();
  let stageStarted = started;
  const timings: Partial<Record<ClipStage | "total", number>> = {};
  function enterStage(next: ClipStage) {
    const now = performance.now();
    timings[stage] = (timings[stage] ?? 0) + now - stageStarted;
    stageStarted = now;
    stage = next;
  }
  function finishTimings() {
    enterStage(stage);
    timings.total = performance.now() - started;
    return Object.fromEntries(
      Object.entries(timings).map(([name, milliseconds]) => [
        name,
        Math.round(milliseconds),
      ]),
    );
  }
  try {
    uploads.assertProcessingMode(video);
    if (!video.userId.startsWith("trial:"))
      env = await uploads.envForUser(video.userId);
    env = {
      ...env,
      TRANSCRIPTION_MAX_SECONDS: Math.ceil(video.durationSeconds ?? 0) + 1,
      TRANSCRIPTION_TIMEOUT_SECONDS: Math.min(
        2147483,
        Math.max(
          env.TRANSCRIPTION_TIMEOUT_SECONDS,
          Math.ceil((video.durationSeconds ?? 0) / 300) * 90,
        ),
      ),
    };
    directory = await mkdtemp(join(tmpdir(), "clipvelto-clips-"));
    if (
      !env.CLIPS_ENABLED ||
      !env.ANTHROPIC_API_KEY ||
      !video.durationSeconds ||
      video.durationSeconds > env.TRANSCRIPTION_MAX_SECONDS
    )
      throw new Error("Clip creation unavailable");
    const source = join(directory, "source");
    const guest = !!video.trialId && video.userId.startsWith("trial:");
    if (
      guest &&
      !(await trialModels(VideoModel.db).Trial.exists({
        _id: video.trialId,
        videoId: video._id,
        claimedBy: { $exists: false },
        expiresAt: { $gt: new Date() },
      }))
    )
      throw new Error("Trial expired");
    if (!guest)
      await credits.transaction(async (session) => {
        if (!(await VideoModel.exists(filter).session(session)))
          throw new Error("Cancelled");
        await credits.reserve(
          video.userId,
          video._id.toString(),
          video.durationSeconds!,
          session,
          video.expectedSize ?? 0,
        );
      });
    const options = renderOptionsSchema.parse(
      video.renderOptions
        ? {
            aspectRatio: video.renderOptions.aspectRatio,
            captions: video.renderOptions.captions,
          }
        : defaultRenderOptions,
    );
    const dimensions = guest
      ? trialPreviewDimensions
      : outputDimensions[options.aspectRatio];
    let sourceDownloaded = false;
    const savedTranscript = await readTranscriptData(uploads.storage, video);
    let transcript = savedTranscript
      ? transcriptSchema.parse(savedTranscript)
      : null;
    if (!transcript) {
      await downloadSource(
        uploads.storage,
        video,
        source,
        env.UPLOAD_MAX_BYTES,
        controller.signal,
      );
      sourceDownloaded = true;
      enterStage("transcription");
      await VideoModel.updateOne(filter, {
        $set: {
          clipMessage: "Transcribing speech and adding timestamps.",
          clipStage: "transcription",
        },
      });
      transcript = await transcribe(
        env,
        source,
        join(directory, "transcript.json"),
        controller.signal,
        {
          sourceSha256: video.sha256!,
          checkpoint: await readTranscriptData(uploads.storage, video, true),
          recoveryChunkIndex: video.transcriptionFailureChunk ?? undefined,
          saveCheckpoint: async (checkpoint) => {
            await saveTranscriptData(
              uploads.storage,
              VideoModel,
              filter,
              video,
              directory!,
              checkpoint,
              true,
            );
            const result = await VideoModel.updateOne(filter, {
              $set: {
                clipMessage: `Transcribing audio: ${checkpoint.chunks.length} of ${Math.ceil(checkpoint.sampleCount / 16000 / 300)} parts complete.`,
                processedCreditSeconds: Math.min(
                  video.durationSeconds!,
                  checkpoint.chunks.length * 300,
                ),
              },
            });
            if (!result.matchedCount) throw new Error("Cancelled");
          },
        },
      );
      if (transcript.segments.some((s) => s.end > video.durationSeconds! + 1))
        throw new Error("Invalid transcript timing");
      await saveTranscriptData(
        uploads.storage,
        VideoModel,
        filter,
        video,
        directory!,
        transcript,
      );
      const transcriptSaved = await VideoModel.updateOne(filter, {
        $set: {
          transcriptionStatus: "completed",
          processedCreditSeconds: video.durationSeconds!,
          transcriptionMessage: "Transcript ready.",
        },
        $unset: { transcriptionCheckpoint: 1, checkpointKey: 1 },
      });
      if (!transcriptSaved.matchedCount) throw new Error("Cancelled");
    }
    if (!transcript.segments.length) {
      enterStage("transcription");
      throw new Error("No speech to select");
    }
    enterStage("selection");
    await VideoModel.updateOne(filter, {
      $set: {
        clipMessage: "Selecting complete, interesting moments with Claude.",
        clipStage: "selection",
      },
    });
    const plan = video.clipPlan.length
      ? highlightSchema.parse(video.clipPlan.map((clip) => clip.toObject()))
      : await select(env, transcript, video.durationSeconds, controller.signal);
    const checkedPlan = validateHighlights(plan, video.durationSeconds);
    if (
      checkedPlan.some(
        (clip) =>
          clip.start < 0 ||
          clip.end > video.durationSeconds! ||
          clip.end - clip.start < 3 ||
          clip.end - clip.start > 60,
      )
    )
      throw new Error("Invalid selected clip");
    const planSaved = await VideoModel.updateOne(filter, {
      $set: { clipPlan: checkedPlan },
    });
    if (!planSaved.matchedCount) throw new Error("Cancelled");
    const clips: Array<Video["clips"][number]> = [];
    let trialPreviewKey: string | undefined;
    for (const [index, clip] of (guest
      ? checkedPlan.slice(0, 1)
      : checkedPlan
    ).entries()) {
      const cached =
        !guest && video.clipFormatVersion === 3
          ? video.clips.find(
              (item) =>
                item.start === clip.start &&
                item.end === clip.end &&
                item.width === dimensions.width &&
                item.height === dimensions.height,
            )
          : null;
      if (cached?.key) {
        try {
          const head = await uploads.storage.head(cached.key);
          if (
            head.ContentLength === cached.sizeBytes &&
            head.ContentType === "video/mp4"
          ) {
            clips.push(cached.toObject());
            continue;
          }
        } catch {
          controller.signal.throwIfAborted();
        }
      }
      if (!sourceDownloaded) {
        enterStage("source");
        await downloadSource(
          uploads.storage,
          video,
          source,
          env.UPLOAD_MAX_BYTES,
          controller.signal,
        );
        sourceDownloaded = true;
      }
      enterStage("rendering");
      await VideoModel.updateOne(filter, {
        $set: {
          clipStage: "rendering",
          clipMessage: `Rendering clip ${index + 1} of ${guest ? 1 : checkedPlan.length}${options.captions ? " with captions" : ""}.`,
        },
      });
      const output = await render(
        env,
        source,
        directory,
        index,
        clip,
        transcript,
        controller.signal,
        undefined,
        options,
        guest,
      );
      const metadata = await probeVideo(output.path, "video/mp4", 61);
      if (
        metadata.width !== dimensions.width ||
        metadata.height !== dimensions.height ||
        Math.abs(metadata.durationSeconds - (clip.end - clip.start)) > 1
      )
        throw new Error("Rendered clip failed checks");
      const key = `clips/${video.userId}/${video._id}/${run}/${guest ? "preview" : index}.mp4`;
      const claim = await VideoModel.updateOne(filter, {
        $addToSet: { artifactKeys: key },
        $set: { clipStage: "storage" },
      });
      if (!claim.matchedCount) throw new Error("Cancelled");
      uploaded.push(key);
      enterStage("storage");
      await uploads.storage.putFile(
        key,
        output.path,
        output.sizeBytes,
        "video/mp4",
      );
      if (!guest)
        clips.push({
          key,
          title: clip.title,
          start: clip.start,
          end: clip.end,
          sizeBytes: output.sizeBytes,
          focusX: output.framing.focusX,
          framingMethod: output.framing.method,
          width: metadata.width,
          height: metadata.height,
        });
      if (guest) trialPreviewKey = key;
    }
    const posterKeys: string[] = [];
    if (guest) {
      const posterSignal = AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(3000),
      ]);
      for (const [index, moment] of checkedPlan.slice(1, 5).entries()) {
        if (posterSignal.aborted) break;
        try {
          const path = await renderTrialPoster(
            env,
            source,
            directory,
            index + 1,
            moment,
            posterSignal,
          );
          const key = `clips/${video.userId}/${video._id}/${run}/locked-${index + 1}.jpg`;
          const claim = await VideoModel.updateOne(filter, {
            $addToSet: { artifactKeys: key },
          });
          if (!claim.matchedCount) throw new Error("Cancelled");
          uploaded.push(key);
          await uploads.storage.putFile(
            key,
            path,
            (await stat(path)).size,
            "image/jpeg",
          );
          posterKeys[index] = key;
        } catch {
          controller.signal.throwIfAborted();
          posterKeys[index] = "";
        }
      }
    }
    const completedSession = await VideoModel.db.startSession();
    try {
      await completedSession.withTransaction(async () => {
        const result = await VideoModel.updateOne(
          filter,
          {
            $set: {
              clipTimingsMs: finishTimings(),
              clipStatus: "completed",
              mediaExpiresAt: new Date(Date.now() + 30 * 86400000),
              clipFormatVersion: 3,
              clipRenderRevision: job.data.generation,
              clipMessage: guest
                ? "Your preview is ready."
                : `${clips.length}${options.captions ? " captioned" : ""} ${clips.length === 1 ? "clip is" : "clips are"} ready to download.`,
              clips,
              ...(trialPreviewKey
                ? { trialPreviewKey, trialPosterKeys: posterKeys }
                : {}),
            },
            $unset: {
              clipRunId: 1,
              clipHeartbeatAt: 1,
              clipFailureStage: 1,
              clipStage: 1,
              transcriptionFailureCode: 1,
              transcriptionFailureChunk: 1,
            },
          },
          { session: completedSession },
        );
        saved = !!result.modifiedCount;
        if (saved && !guest)
          await credits.commit(video._id.toString(), completedSession);
      });
    } finally {
      await completedSession.endSession();
    }
    if (saved)
      logger.info(
        {
          videoId: video._id.toString(),
          generation: job.data.generation,
          timingsMs: finishTimings(),
          reusedTranscript: !!video.transcript,
          reusedSelection: !!video.clipPlan.length,
          clipCount: guest ? 1 : clips.length,
        },
        "Clip generation completed",
      );
  } catch (error) {
    logger.warn(
      {
        videoId: video._id.toString(),
        generation: job.data.generation,
        stage,
        ...((stage as ClipStage) === "transcription"
          ? transcriptionFailureDetails(error)
          : {}),
        errorType:
          error instanceof Error ? error.constructor.name : "UnknownError",
      },
      "Clip generation failed; private source/transcript/provider content omitted",
    );
    const failed = await VideoModel.updateOne(filter, {
      $set: {
        clipStatus: "failed",
        ...((stage as ClipStage) === "transcription"
          ? transcriptionFailureDetails(error)
          : {}),
        mediaExpiresAt: new Date(Date.now() + 86400000),
        clipMessage: clipFailureMessage(error, stage),
        clipFailureStage: stage,
        clipTimingsMs: finishTimings(),
      },
      $unset: { clipRunId: 1, clipHeartbeatAt: 1 },
    });
    if (failed.matchedCount && !video.userId.startsWith("trial:"))
      await credits.refund(video._id.toString());
    throw new Error(`Clip generation failed during ${stage}`);
  } finally {
    clearInterval(heartbeat);
    shutdown.removeEventListener("abort", abort);
    abort();
    if (!saved)
      for (const key of uploaded)
        await uploads.storage.remove(key).catch(() => undefined);
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
