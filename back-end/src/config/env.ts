import { config } from "dotenv";
import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined,
  z.string().optional(),
);

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    MONGODB_URI: z
      .string()
      .regex(/^mongodb(?:\+srv)?:\/\//, "Provide a MongoDB connection string"),
    BETTER_AUTH_SECRET: z.string().min(32),
    CONTACT_TO_EMAIL: z.email().default("mohammadjahid0007@gmail.com"),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    BILLING_MODE: z.enum(["disabled", "mock", "paddle"]).default("disabled"),
    PADDLE_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),
    PADDLE_LIVE_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    PADDLE_API_KEY: optionalSecret,
    PADDLE_CLIENT_TOKEN: optionalSecret,
    PADDLE_WEBHOOK_SECRET: optionalSecret,
    PADDLE_PRICE_STARTER: optionalSecret,
    PADDLE_PRICE_CREATOR: optionalSecret,
    PADDLE_PRICE_STUDIO: optionalSecret,
    GOOGLE_CLIENT_ID: optionalSecret,
    GOOGLE_CLIENT_SECRET: optionalSecret,
    MAIL_TRANSPORT: z.enum(["file", "smtp"]).default("file"),
    MAIL_FROM: z.string().default("Clipvelto <no-reply@clipvelto.com>"),
    MAIL_DIRECTORY: z
      .string()
      .default(new URL("../../.local-data/mail/", import.meta.url).pathname),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    UPLOADS_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
    STORAGE_ENDPOINT: z.url().optional(),
    STORAGE_REGION: z.string().default("auto"),
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_ACCESS_KEY_ID: z.string().optional(),
    STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
    STORAGE_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    UPLOAD_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .max(5 * 1024 ** 4)
      .default(500 * 1024 ** 2),
    UPLOAD_MAX_SECONDS: z.coerce.number().positive().safe().default(7200),
    UPLOAD_USER_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(2 * 1024 ** 3),
    UPLOAD_USER_MAX_VIDEOS: z.coerce
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(20),
    UPLOAD_QUEUE_PREFIX: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .default("clipvelto"),
    TRANSCRIPTION_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    TRANSCRIPTION_PYTHON: z
      .string()
      .min(1)
      .default(
        new URL(
          "../../.local-data/transcriber-venv/bin/python",
          import.meta.url,
        ).pathname,
      ),
    TRANSCRIPTION_MODEL: z.enum(["tiny", "base", "small"]).default("small"),
    TRANSCRIPTION_PROVIDER: z
      .enum(["local", "groq", "deepinfra"])
      .default("local"),
    GROQ_API_KEY: z.string().trim().optional(),
    DEEPINFRA_API_KEY: optionalSecret,
    DEEPINFRA_TRANSCRIPTION_MODEL: z
      .enum(["whisper-large-v3-turbo", "whisper-large-v3"])
      .default("whisper-large-v3-turbo"),
    GROQ_TRANSCRIPTION_MODEL: z
      .enum(["whisper-large-v3-turbo", "whisper-large-v3"])
      .default("whisper-large-v3-turbo"),
    TRANSCRIPTION_MODEL_DIRECTORY: z
      .string()
      .min(1)
      .default(
        new URL("../../.local-data/whisper-models/", import.meta.url).pathname,
      ),
    TRANSCRIPTION_THREADS: z.coerce.number().int().min(1).max(2).default(2),
    TRANSCRIPTION_MAX_SECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .max(Math.floor(Number.MAX_SAFE_INTEGER / 32000) - 1)
      .default(1800),
    ADMIN_TRANSCRIPTION_MAX_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .safe()
      .default(7200),
    ADMIN_UPLOAD_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1024 ** 2)
      .max(5 * 1024 ** 4)
      .default(2 * 1024 ** 3),
    TRANSCRIPTION_TIMEOUT_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(7200)
      .default(1800),
    YOUTUBE_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    YOUTUBE_PYTHON: z
      .string()
      .default(
        new URL("../../.local-data/media-venv/bin/python", import.meta.url)
          .pathname,
      ),
    FFMPEG_PATH: z.string().default("ffmpeg"),
    FFPROBE_PATH: z.string().default("ffprobe"),
    CLIPS_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().min(1).default("claude-haiku-5-5"),
    TRIAL_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    TURNSTILE_SITE_KEY: z.string().optional(),
    TURNSTILE_SECRET_KEY: z.string().optional(),
    TRIAL_DAILY_MINUTES: z.coerce.number().int().min(3).max(300).default(30),
    TRIAL_LOCAL_TESTING: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .superRefine((env, ctx) => {
    if (env.BILLING_MODE === "paddle") {
      for (const key of [
        "PADDLE_API_KEY",
        "PADDLE_CLIENT_TOKEN",
        "PADDLE_PRICE_STARTER",
        "PADDLE_PRICE_CREATOR",
        "PADDLE_PRICE_STUDIO",
      ] as const) {
        if (!env[key])
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Required for Paddle checkout",
          });
      }
      const sandbox = env.PADDLE_ENVIRONMENT === "sandbox";
      if (!sandbox && !env.PADDLE_WEBHOOK_SECRET)
        ctx.addIssue({
          code: "custom",
          path: ["PADDLE_WEBHOOK_SECRET"],
          message: "Verified webhooks are required for live payments",
        });
      if (
        env.PADDLE_API_KEY &&
        !env.PADDLE_API_KEY.startsWith(
          sandbox ? "pdl_sdbx_apikey_" : "pdl_live_apikey_",
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["PADDLE_API_KEY"],
          message: "Use an API key for the selected Paddle environment",
        });
      if (
        env.PADDLE_CLIENT_TOKEN &&
        !env.PADDLE_CLIENT_TOKEN.startsWith(sandbox ? "test_" : "live_")
      )
        ctx.addIssue({
          code: "custom",
          path: ["PADDLE_CLIENT_TOKEN"],
          message: "Use a client token for the selected Paddle environment",
        });
      const prices = [
        env.PADDLE_PRICE_STARTER,
        env.PADDLE_PRICE_CREATOR,
        env.PADDLE_PRICE_STUDIO,
      ];
      if (
        prices.some((id) => id && !/^pri_[a-z0-9]{26}$/.test(id)) ||
        new Set(prices.filter(Boolean)).size !== prices.filter(Boolean).length
      )
        ctx.addIssue({
          code: "custom",
          path: ["PADDLE_PRICE_STARTER"],
          message: "Use three distinct valid Paddle price IDs",
        });
      if (sandbox && env.NODE_ENV === "production")
        ctx.addIssue({
          code: "custom",
          path: ["PADDLE_ENVIRONMENT"],
          message: "Sandbox payments cannot fund a production wallet",
        });
      if (
        !sandbox &&
        (!env.PADDLE_LIVE_ENABLED ||
          !env.BETTER_AUTH_URL.startsWith("https://"))
      )
        ctx.addIssue({
          code: "custom",
          path: ["PADDLE_LIVE_ENABLED"],
          message:
            "Live payments require an approved HTTPS site and explicit live activation",
        });
    }
    if (env.NODE_ENV === "production" && env.BILLING_MODE === "mock")
      ctx.addIssue({
        code: "custom",
        path: ["BILLING_MODE"],
        message:
          "Mock billing is restricted to development and test environments",
      });
    if (!!env.GOOGLE_CLIENT_ID !== !!env.GOOGLE_CLIENT_SECRET)
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID"],
        message:
          "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google sign-in",
      });
    if (
      env.TRIAL_ENABLED &&
      (!env.TURNSTILE_SITE_KEY ||
        !env.TURNSTILE_SECRET_KEY ||
        !env.YOUTUBE_ENABLED ||
        !env.CLIPS_ENABLED ||
        !env.UPLOADS_ENABLED ||
        !env.ANTHROPIC_API_KEY)
    )
      ctx.addIssue({
        code: "custom",
        path: ["TRIAL_ENABLED"],
        message:
          "Trials require Turnstile, uploads, YouTube imports and clip generation",
      });
    const url = new URL(env.BETTER_AUTH_URL);
    if ((env.YOUTUBE_ENABLED || env.CLIPS_ENABLED) && !env.UPLOADS_ENABLED)
      ctx.addIssue({
        code: "custom",
        path: ["UPLOADS_ENABLED"],
        message: "Video imports and clips require storage",
      });
    if (env.CLIPS_ENABLED && !env.TRANSCRIPTION_ENABLED)
      ctx.addIssue({
        code: "custom",
        path: ["CLIPS_ENABLED"],
        message: "Clips require transcription",
      });
    if (
      env.TRANSCRIPTION_ENABLED &&
      env.TRANSCRIPTION_PROVIDER === "groq" &&
      !env.GROQ_API_KEY
    )
      ctx.addIssue({
        code: "custom",
        path: ["GROQ_API_KEY"],
        message: "Required for Groq transcription",
      });
    if (
      env.TRANSCRIPTION_ENABLED &&
      env.TRANSCRIPTION_PROVIDER === "deepinfra" &&
      !env.DEEPINFRA_API_KEY
    )
      ctx.addIssue({
        code: "custom",
        path: ["DEEPINFRA_API_KEY"],
        message: "Required for DeepInfra transcription",
      });
    if (env.TRANSCRIPTION_ENABLED && !env.UPLOADS_ENABLED)
      ctx.addIssue({
        code: "custom",
        path: ["TRANSCRIPTION_ENABLED"],
        message: "Transcription requires uploads",
      });
    if (env.UPLOADS_ENABLED) {
      for (const key of [
        "STORAGE_ENDPOINT",
        "STORAGE_BUCKET",
        "STORAGE_ACCESS_KEY_ID",
        "STORAGE_SECRET_ACCESS_KEY",
      ] as const) {
        if (!env[key])
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Required when uploads are enabled",
          });
      }
      try {
        if (!["redis:", "rediss:"].includes(new URL(env.REDIS_URL).protocol))
          throw new Error();
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["REDIS_URL"],
          message: "Use a Redis or Redis TLS connection URL",
        });
      }
      if (
        env.NODE_ENV === "production" &&
        new URL(env.STORAGE_ENDPOINT ?? "http://invalid").protocol !== "https:"
      )
        ctx.addIssue({
          code: "custom",
          path: ["STORAGE_ENDPOINT"],
          message: "Production storage requires HTTPS",
        });
    }
    if (url.pathname !== "/" || url.search || url.hash)
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "Use the frontend origin without a path or query",
      });
    if (env.MAIL_TRANSPORT === "smtp" && !env.SMTP_HOST)
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_HOST"],
        message: "SMTP_HOST is required for SMTP delivery",
      });
    if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD))
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_USER"],
        message: "Set both SMTP_USER and SMTP_PASSWORD",
      });
    if (env.NODE_ENV === "production") {
      if (url.protocol !== "https:")
        ctx.addIssue({
          code: "custom",
          path: ["BETTER_AUTH_URL"],
          message: "Production authentication requires HTTPS",
        });
      if (env.MAIL_TRANSPORT !== "smtp")
        ctx.addIssue({
          code: "custom",
          path: ["MAIL_TRANSPORT"],
          message: "File delivery is for local development only",
        });
    }
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Report field names and validation messages, never environment values.
    throw new Error(
      `Invalid backend configuration: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}. Run npm run dev:setup for local development.`,
    );
  }
  return result.data;
}

export function loadEnv(): Env {
  config({ path: new URL("../../.env", import.meta.url), quiet: true });
  return parseEnv(process.env);
}
