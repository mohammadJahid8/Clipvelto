import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

const path = new URL("../.env", import.meta.url);
try {
  const current = await readFile(path, "utf8");
  const template = await readFile(
    new URL("../.env.example", import.meta.url),
    "utf8",
  );
  const additions = template
    .split("\n")
    .filter(
      (line) =>
        line &&
        !line.startsWith("#") &&
        !current.match(new RegExp(`^${line.split("=")[0]}=`, "m")),
    );
  if (additions.length)
    await writeFile(
      path,
      `${current.trimEnd()}\n\n# Added local development defaults; existing values were preserved.\n${additions.join("\n")}\n`,
      { mode: 0o600 },
    );
  console.log(
    "Local configuration is ready. Existing values and secrets were preserved. Start npm run dev:database and npm run dev:uploads in separate terminals, then npm run dev.",
  );
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
    throw error;
  const template = await readFile(
    new URL("../.env.example", import.meta.url),
    "utf8",
  );
  await writeFile(
    path,
    template.replace(
      "BETTER_AUTH_SECRET=\n",
      `BETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}\n`,
    ),
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "Created back-end/.env with a unique local authentication secret. Next: npm run dev:database, then npm run dev in another terminal.",
  );
}
