import { fileURLToPath } from "node:url";
import { startLocalUploadServices } from "./local-upload-services.js";

const services = await startLocalUploadServices(
  fileURLToPath(new URL("../.local-data/upload-services/", import.meta.url)),
  { redisPort: 6379, storagePort: 9000 },
);
console.log(
  "Local Redis and private S3 development storage are ready on 127.0.0.1:6379 and 127.0.0.1:9000. Keep this terminal open. These helpers are not for production.",
);
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await services.close();
  process.exit(0);
};
process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});
