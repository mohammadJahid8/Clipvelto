import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { createAuthMiddleware, APIError } from "better-auth/api";
import type { Connection } from "mongoose";
import type { Env } from "../../config/env.js";
import type { createMailer } from "../../services/mail.js";
import { z } from "zod";
import { emailOTP } from "better-auth/plugins";
import { createHmac } from "node:crypto";
import { verifyGoogleIdToken } from "better-auth/social-providers";
import {
  googleProfileImage,
  resolveGoogleProfileImage,
} from "./google-profile-image.js";
import { logger } from "../../config/logger.js";

export function createAuth(
  connection: Connection,
  env: Env,
  mailer: ReturnType<typeof createMailer>,
) {
  const origin = new URL(env.BETTER_AUTH_URL).origin;
  const digest = (value: string) =>
    createHmac("sha256", env.BETTER_AUTH_SECRET).update(value).digest("hex");
  const emailLimits = connection.db!.collection<{
    _id: string;
    count: number;
    nextAllowedAt: Date;
    expiresAt: Date;
  }>("auth_email_limits");
  return betterAuth({
    appName: "Clipvelto",
    baseURL: origin,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    onAPIError: { errorURL: `${origin}/?auth=google` },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              prompt: "select_account",
              accessType: "online",
              includeGrantedScopes: false,
              requireEmailVerification: true,
              async getUserInfo(tokens) {
                if (!tokens.idToken) return null;
                const claims = await verifyGoogleIdToken({
                  token: tokens.idToken,
                  audience: env.GOOGLE_CLIENT_ID!,
                });
                const profile = z
                  .object({
                    sub: z.string().min(1),
                    email: z.email().max(254),
                    email_verified: z.literal(true),
                    name: z.unknown().optional(),
                    picture: z.unknown().optional(),
                  })
                  .safeParse(claims);
                if (!profile.success) return null;
                const image = await resolveGoogleProfileImage(
                  profile.data.picture,
                  profile.data.sub,
                  tokens.accessToken,
                );
                return {
                  user: {
                    id: profile.data.sub,
                    email: profile.data.email,
                    emailVerified: true,
                    name:
                      typeof profile.data.name === "string"
                        ? profile.data.name.trim().slice(0, 80) || "Creator"
                        : "Creator",
                    image,
                  },
                  data: { ...claims!, picture: image },
                };
              },
            },
          }
        : {},
    account: {
      encryptOAuthTokens: true,
      storeAccountCookie: false,
      storeStateStrategy: "database",
      skipStateCookieCheck: false,
      accountLinking: {
        enabled: true,
        requireLocalEmailVerified: true,
        allowDifferentEmails: false,
        trustedProviders: [],
        allowUnlinkingAll: false,
      },
    },
    databaseHooks: {
      account: {
        // Google is used for identity only. Do not retain Google API credentials.
        create: {
          before: async (account) =>
            account.providerId === "google"
              ? {
                  data: {
                    ...account,
                    accessToken: undefined,
                    refreshToken: undefined,
                    idToken: undefined,
                  },
                }
              : undefined,
        },
        update: {
          before: async (account) =>
            account.providerId === "google"
              ? {
                  data: {
                    ...account,
                    accessToken: undefined,
                    refreshToken: undefined,
                    idToken: undefined,
                  },
                }
              : undefined,
        },
      },
    },
    database: mongodbAdapter(connection.db!, {
      client: connection.getClient(),
      transaction: true,
    }),
    user: {
      async validateUserInfo({ user, source }, context) {
        if (
          source.method !== "oauth" ||
          source.action === "create-user" ||
          source.oauth?.providerId !== "google" ||
          typeof user.id !== "string"
        )
          return;
        const profile = z
          .object({
            sub: z.string().min(1),
            email: z.email(),
            email_verified: z.literal(true),
            picture: z.unknown().optional(),
          })
          .safeParse(source.oauth.profile);
        if (!profile.success) return;
        const image = googleProfileImage(profile.data.picture);
        if (!image) return;
        // This lifecycle gate receives the verified OAuth profile and selected
        // local identity. Sync only the photo; never overwrite an account's
        // email, display name, provider binding, credits or media ownership.
        try {
          const adapter = context.context.internalAdapter;
          const local = await adapter.findUserById(user.id);
          if (!local?.emailVerified || local.image === image) return;
          const linked = await adapter.findAccountByKey({
            providerId: "google",
            accountId: profile.data.sub,
          });
          if (
            linked
              ? linked.userId !== local.id
              : local.email.toLowerCase() !== profile.data.email.toLowerCase()
          )
            return;
          await adapter.updateUser(local.id, { image });
        } catch {
          logger.warn(
            "Google profile photo sync unavailable; sign-in can continue",
          );
        }
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 60 * 30,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        mailer.send({
          to: user.email,
          subject: "Reset your Clipvelto password",
          text: `Use this link within 30 minutes to choose a new password:\n\n${url}\n\nIf you didn’t request this, you can ignore this email.`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: false,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 5,
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        disableSignUp: true,
        changeEmail: { enabled: true, verifyCurrentEmail: true },
        overrideDefaultEmailVerification: true,
        storeOTP: { hash: async (otp) => digest(`email-otp:${otp}`) },
        async sendVerificationOTP({ email, otp, type }) {
          mailer.send({
            to: email,
            subject:
              type === "forget-password"
                ? "Reset your Clipvelto password"
                : "Your Clipvelto verification code",
            text: `Your Clipvelto code is ${otp}.\n\nIt expires in 5 minutes. Don’t share this code. If you didn’t request it, ignore this email.`,
          });
        },
      }),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    databaseHooks: {
      session: {
        create: {
          async after(session) {
            // Session refreshes update an existing session. Record only new
            // authenticated sessions, and retain this after sign-out/expiry.
            try {
              await connection
                .db!.collection<{ _id: string; lastLoginAt: Date }>(
                  "auth_login_activity",
                )
                .updateOne(
                  { _id: session.userId },
                  { $max: { lastLoginAt: session.createdAt } },
                  { upsert: true },
                );
            } catch {
              logger.warn("Sign-in activity could not be recorded");
            }
          },
        },
      },
    },
    advanced: {
      cookiePrefix: "clipvelto",
      useSecureCookies: new URL(env.BETTER_AUTH_URL).protocol === "https:",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      ipAddress: { ipAddressHeaders: ["x-clipvelto-client-ip"] },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 120,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 5 },
        "/change-email": { window: 60, max: 5 },
        "/sign-in/social": { window: 60, max: 10 },
        "/callback/google": { window: 60, max: 20 },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const result = z
          .object({ user: z.object({ id: z.string(), email: z.string() }) })
          .safeParse(ctx.context.returned);
        if (!result.success) return;
        const stored = await ctx.context.internalAdapter.findUserByEmail(
          result.data.user.email.toLowerCase(),
        );
        // Better Auth returns a synthetic user for duplicate registrations.
        // Reject that result, including races, without minting a login session.
        if (stored && stored.user.id !== result.data.user.id)
          throw new APIError("UNPROCESSABLE_ENTITY", {
            code: "EMAIL_ALREADY_REGISTERED",
            message:
              "An account with this email already exists. Please sign in.",
          });
      }),
      before: createAuthMiddleware(async (ctx) => {
        if (["/sign-in/social", "/link-social"].includes(ctx.path)) {
          if (
            ctx.body?.provider !== "google" ||
            !env.GOOGLE_CLIENT_ID ||
            !env.GOOGLE_CLIENT_SECRET
          )
            throw new APIError("BAD_REQUEST", {
              code: "GOOGLE_UNAVAILABLE",
              message: "Google sign-in is unavailable. Use email and password.",
            });
          if (
            ctx.body?.idToken ||
            (ctx.body?.scopes !== undefined &&
              (!Array.isArray(ctx.body.scopes) ||
                ctx.body.scopes.some(
                  (scope: unknown) =>
                    typeof scope !== "string" ||
                    !["openid", "email", "profile"].includes(scope),
                )))
          )
            throw new APIError("BAD_REQUEST", {
              message: "Start Google sign-in from Clipvelto.",
            });
        }
        // Password sign-in remains the only login method; OTPs verify emails/reset passwords.
        if (
          ctx.path === "/sign-in/email-otp" ||
          (ctx.path === "/email-otp/send-verification-otp" &&
            !["email-verification", "forget-password"].includes(ctx.body?.type))
        )
          throw new APIError("BAD_REQUEST", {
            message: "Use email and password to sign in.",
          });
        if (
          [
            "/email-otp/send-verification-otp",
            "/email-otp/request-password-reset",
            "/forget-password/email-otp",
            "/send-verification-email",
            "/email-otp/request-email-change",
          ].includes(ctx.path)
        ) {
          const email = z
            .email()
            .max(254)
            .safeParse(ctx.body?.email ?? ctx.body?.newEmail);
          if (!email.success)
            throw new APIError("BAD_REQUEST", {
              message: "Enter a valid email address.",
            });
          const now = new Date();
          const id = digest(
            `email-send:${email.data.toLowerCase()}:${now.toISOString().slice(0, 13)}`,
          );
          try {
            await emailLimits.updateOne(
              { _id: id, count: { $lt: 10 }, nextAllowedAt: { $lte: now } },
              {
                $inc: { count: 1 },
                $set: {
                  nextAllowedAt: new Date(Date.now() + 60000),
                  expiresAt: new Date(Date.now() + 7200000),
                },
              },
              { upsert: true },
            );
          } catch (error) {
            if (
              error &&
              typeof error === "object" &&
              "code" in error &&
              error.code === 11000
            )
              throw new APIError("TOO_MANY_REQUESTS", {
                message: "Please wait before requesting another code.",
              });
            throw error;
          }
        }
        if (
          ["/sign-up/email", "/update-user"].includes(ctx.path) &&
          ctx.body?.name !== undefined
        ) {
          const parsed = z
            .string()
            .trim()
            .min(1)
            .max(80)
            .safeParse(ctx.body.name);
          if (!parsed.success)
            throw new APIError("BAD_REQUEST", {
              message: "Use a name between 1 and 80 characters.",
            });
          ctx.body.name = parsed.data;
        }
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
