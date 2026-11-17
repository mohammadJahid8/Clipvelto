import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import { resolve, join } from "node:path";

// Run locally; creates private deployment files, never prints their contents.
// Refuse to regenerate an existing database's credentials on a later deploy.
const destination = resolve(process.argv[2] ?? ".local-data/production");
for (const name of ["backend.env", "mongo.env", "redis.env", "frontend.env"]) {
  try {
    await access(join(destination, name));
    throw new Error(`Refusing to overwrite ${name}. Keep deployed credentials stable.`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const local = parseEnv(await readFile(new URL("../back-end/.env", import.meta.url), "utf8"));
if (!["groq", "deepinfra"].includes(local.TRANSCRIPTION_PROVIDER))
  throw new Error("Choose a hosted transcription provider before preparing this VPS deployment.");
const copied = [
  "STORAGE_ENDPOINT", "STORAGE_REGION", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY", "STORAGE_FORCE_PATH_STYLE", "MAIL_FROM", "SMTP_HOST",
  "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "CONTACT_TO_EMAIL", "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET", "TRANSCRIPTION_PROVIDER", "GROQ_API_KEY", "DEEPINFRA_API_KEY",
  "GROQ_TRANSCRIPTION_MODEL", "DEEPINFRA_TRANSCRIPTION_MODEL", "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL", "TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY",
];
const rootPassword = randomBytes(32).toString("hex");
const appPassword = randomBytes(32).toString("hex");
const redisPassword = randomBytes(32).toString("hex");
const backend = Object.fromEntries(copied.filter((key) => local[key]).map((key) => [key, local[key]]));
Object.assign(backend, {
  NODE_ENV: "production", HOST: "0.0.0.0", PORT: "4000", TRUST_PROXY_HOPS: "1",
  BETTER_AUTH_URL: "https://clipvelto.com", BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  MONGODB_URI: `mongodb://clipvelto:${appPassword}@mongo:27017/clipvelto?authSource=clipvelto&replicaSet=clipvelto`,
  REDIS_URL: `redis://:${redisPassword}@redis:6379`, UPLOAD_QUEUE_PREFIX: "clipvelto-production",
  MAIL_TRANSPORT: "smtp", UPLOADS_ENABLED: "true", TRANSCRIPTION_ENABLED: "true",
  YOUTUBE_ENABLED: "true", CLIPS_ENABLED: "true", TRANSCRIPTION_THREADS: "2",
  YOUTUBE_PYTHON: "/opt/media/bin/python", FFMPEG_PATH: "/usr/bin/ffmpeg", FFPROBE_PATH: "/usr/bin/ffprobe",
  // Enable only after the widget/domain is checked in production.
  TRIAL_ENABLED: "false", TRIAL_LOCAL_TESTING: "false",
  BILLING_MODE: "disabled", PADDLE_ENVIRONMENT: "live", PADDLE_LIVE_ENABLED: "false",
});
for (const key of ["SMTP_HOST", "STORAGE_ENDPOINT", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY", "ANTHROPIC_API_KEY"])
  if (!backend[key]) throw new Error(`Missing ${key}; production files were not created.`);
const speechKey = backend.TRANSCRIPTION_PROVIDER === "deepinfra" ? "DEEPINFRA_API_KEY" : "GROQ_API_KEY";
if (!backend[speechKey]) throw new Error(`Missing ${speechKey}`);
await mkdir(destination, { recursive: true, mode: 0o700 });
async function save(name, values) {
  // Compose env_file format: raw preserves $, #, quotes and spaces verbatim.
  const content = Object.entries(values).map(([key, value]) => {
    if (/[\r\n\0]/.test(value)) throw new Error(`Invalid multiline value for ${key}`);
    return `${key}=${value}`;
  }).join("\n") + "\n";
  await writeFile(join(destination, name), content, { mode: 0o600, flag: "wx" });
}
await save("backend.env", backend);
await save("mongo.env", {
  MONGO_INITDB_ROOT_USERNAME: "clipvelto-root", MONGO_INITDB_ROOT_PASSWORD: rootPassword,
  MONGO_INITDB_DATABASE: "clipvelto", MONGO_APP_USERNAME: "clipvelto", MONGO_APP_PASSWORD: appPassword,
});
await save("redis.env", { REDIS_PASSWORD: redisPassword });
await save("frontend.env", {
  NODE_ENV: "production", API_INTERNAL_URL: "http://api:4000",
});
console.log(`Private production environment files prepared in ${destination}.`);
console.log("Payments and anonymous generation remain disabled until their production configuration is verified.");
