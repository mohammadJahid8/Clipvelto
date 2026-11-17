import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../src/config/env.js";
import { runTranscriber } from "../src/services/local-transcriber.js";

const directory = new URL("../.local-data/transcriber-venv/", import.meta.url);
async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Transcriber setup failed")),
    );
  });
}
const env = loadEnv();
await mkdir(new URL("../.local-data/", import.meta.url), {
  recursive: true,
  mode: 0o700,
});
const defaultPython = fileURLToPath(new URL("bin/python", directory));
if (env.TRANSCRIPTION_PYTHON === defaultPython) {
  await run("python3", ["-m", "venv", fileURLToPath(directory)]);
}
await run(env.TRANSCRIPTION_PYTHON, [
  "-m",
  "pip",
  "install",
  "-r",
  fileURLToPath(new URL("../transcription/requirements.txt", import.meta.url)),
]);
console.log(
  `Preparing the ${env.TRANSCRIPTION_MODEL} model. This downloads public model weights; no videos are sent.`,
);
await runTranscriber(env, ["--prepare"]);
console.log(
  "Transcriber ready. Set TRANSCRIPTION_ENABLED=true in back-end/.env and restart the API and worker.",
);
