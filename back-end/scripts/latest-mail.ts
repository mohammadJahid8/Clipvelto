import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnv } from "../src/config/env.js";

const env = loadEnv();
if (env.NODE_ENV === "production" || env.MAIL_TRANSPORT !== "file")
  throw new Error("This helper is only for local file delivery.");
try {
  const files = (await readdir(env.MAIL_DIRECTORY))
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (!files.length)
    console.log(
      "No local mail yet. Create an account or request a password reset first.",
    );
  else {
    const message = JSON.parse(
      await readFile(join(env.MAIL_DIRECTORY, files.at(-1)!), "utf8"),
    ) as { to: string; subject: string; text: string };
    console.log(
      `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`,
    );
  }
} catch (error) {
  if (error instanceof Error && "code" in error && error.code === "ENOENT")
    console.log("No local mail yet.");
  else throw error;
}
