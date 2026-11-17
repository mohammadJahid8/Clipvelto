import { spawn } from "node:child_process";

export class MediaProcessError extends Error {
  constructor(
    readonly reason:
      "START_FAILED" | "TIMEOUT" | "CANCELLED" | "OUTPUT_LIMIT" | "EXIT_FAILED",
    readonly exitCode: number | null = null,
    readonly signal: NodeJS.Signals | null = null,
  ) {
    super(
      reason === "START_FAILED"
        ? "A required media tool could not start."
        : "The media tool stopped or exceeded its limits.",
    );
  }
}

export async function runMediaProcess(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    signal?: AbortSignal;
    timeout?: number;
    captureOutput?: boolean;
  } = {},
) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      detached: process.platform !== "win32",
      cwd: options.cwd,
      stdio: [
        "ignore",
        options.captureOutput === false ? "ignore" : "pipe",
        "ignore",
      ],
    });
    let output = "";
    let aborted = false;
    let reason: "TIMEOUT" | "CANCELLED" | "OUTPUT_LIMIT" | undefined;
    let force: ReturnType<typeof setTimeout> | undefined;
    function kill(signal: NodeJS.Signals) {
      try {
        if (child.pid)
          process.kill(
            process.platform === "win32" ? child.pid : -child.pid,
            signal,
          );
      } catch {
        child.kill(signal);
      }
    }
    const stop = (cause: "TIMEOUT" | "CANCELLED" | "OUTPUT_LIMIT") => {
      reason ??= cause;
      aborted = true;
      kill("SIGTERM");
      force ??= setTimeout(() => kill("SIGKILL"), 3000).unref();
    };
    const cancel = () => stop("CANCELLED");
    const timer = setTimeout(
      () => stop("TIMEOUT"),
      options.timeout ?? 1200000,
    ).unref();
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) cancel();
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (Buffer.byteLength(output) > 1024 * 1024) {
        stop("OUTPUT_LIMIT");
        output = "";
      }
    });
    child.once("error", () => reject(new MediaProcessError("START_FAILED")));
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      clearTimeout(force);
      options.signal?.removeEventListener("abort", cancel);
      if (code === 0 && !aborted) resolve(output);
      else reject(new MediaProcessError(reason ?? "EXIT_FAILED", code, signal));
    });
  });
}
