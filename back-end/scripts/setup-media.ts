import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
const exec = promisify(execFile);
let python = "";
for (const candidate of [
  process.env.MEDIA_SETUP_PYTHON,
  "python3.12",
  "python3.11",
  "python3",
].filter((value): value is string => !!value)) {
  try {
    await exec(candidate, [
      "-c",
      "import sys; assert sys.version_info >= (3,11)",
    ]);
    python = candidate;
    break;
  } catch {
    /* Try another installed Python. */
  }
}
if (!python)
  throw new Error(
    "Install Python 3.11+ first, then rerun npm run media:setup.",
  );
async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Media setup failed")),
    );
  });
}
const directory = new URL("../.local-data/media-venv/", import.meta.url);
await run(python, ["-m", "venv", fileURLToPath(directory)]);
await run(fileURLToPath(new URL("bin/python", directory)), [
  "-m",
  "pip",
  "install",
  "-r",
  fileURLToPath(new URL("../media/requirements.txt", import.meta.url)),
]);
console.log(
  "YouTube importer and face framing installed. Configure FFmpeg/FFprobe and run npm run media:check. See README.md.",
);
