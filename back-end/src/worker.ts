import { loadEnv } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { createVideoModel } from "./modules/videos/video.model.js";
import { createUploadService } from "./modules/uploads/upload-service.js";
import { startUploadWorker } from "./jobs/upload-worker.js";
import { logger } from "./config/logger.js";
import { runTranscriber } from "./services/local-transcriber.js";
import { checkMediaTools } from "./services/media-tools.js";

const env = loadEnv();
await checkMediaTools(env);
if (env.TRANSCRIPTION_ENABLED && env.TRANSCRIPTION_PROVIDER === "local")
  await runTranscriber(env, ["--check"]);
if (!env.UPLOADS_ENABLED)
  throw new Error(
    "Enable and configure uploads before starting the worker. See README.md.",
  );
const connection = await connectDatabase(env.MONGODB_URI);
const VideoModel = createVideoModel(connection);
await VideoModel.init();
const uploads = await createUploadService(connection, env, VideoModel);
const worker = await startUploadWorker(connection, env, uploads, VideoModel);
logger.info(
  {
    transcriptionEnabled: env.TRANSCRIPTION_ENABLED,
    transcriptionProvider: env.TRANSCRIPTION_PROVIDER,
  },
  "Video worker is ready",
);
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 150000).unref();
  await worker.close();
  await uploads.close();
  await connection.close();
  clearTimeout(deadline);
  process.exit(0);
};
process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});
