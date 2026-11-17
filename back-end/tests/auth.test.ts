import { after, afterEach, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import type { Connection } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/config/database.js";
import { parseEnv } from "../src/config/env.js";
import { z } from "zod";

const meSchema = z.object({
  user: z.object({ name: z.string(), email: z.string() }),
});
const videoPageSchema = z.object({
  videos: z.array(z.object({ id: z.string(), originalFilename: z.string() })),
  nextCursor: z.string().nullable(),
});
const summarySchema = z.object({
  videos: z.number(),
  processing: z.number(),
  credits: z.object({ available: z.number() }),
});

const origin = "http://localhost:3000";
const password = "a sufficiently long test passphrase";
let database: MongoMemoryReplSet;
let connection: Connection;
let server: Server;
let directory: string;
let url: string;
let instance: Awaited<ReturnType<typeof createApp>>;

before(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { version: "8.2.2" },
    replSet: { count: 1 },
  });
});
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "clipvelto-auth-"));
  const uri = database.getUri(`test-${randomUUID()}`);
  const env = parseEnv({
    NODE_ENV: "test",
    MONGODB_URI: uri,
    BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
    BETTER_AUTH_URL: origin,
    MAIL_DIRECTORY: directory,
  });
  connection = await connectDatabase(uri);
  instance = await createApp(connection, env);
  server = await new Promise<Server>((resolve) => {
    const running = instance.app.listen(0, "127.0.0.1", () => resolve(running));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  if (instance) await instance.mailer.drain();
  if (connection) {
    await connection.dropDatabase();
    await connection.close();
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});
after(async () => {
  await database?.stop();
});

function request(
  path: string,
  body?: unknown,
  cookie = "",
  extra: Record<string, string> = {},
) {
  return fetch(`${url}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin,
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
}
function cookieFrom(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}
async function capturedMail(email: string, subject: string) {
  await instance.mailer.drain();
  const files = (await readdir(directory)).sort();
  const messages = await Promise.all(
    files.map(
      async (file) =>
        JSON.parse(await readFile(join(directory, file), "utf8")) as {
          to: string;
          subject: string;
          text: string;
        },
    ),
  );
  const message = messages
    .reverse()
    .find((item) => item.to === email && item.subject.includes(subject));
  assert.ok(message, `Expected captured ${subject} email`);
  return message;
}
async function mailFor(email: string, subject: string) {
  const message = await capturedMail(email, subject);
  const link = message.text.match(/https?:\/\/[^\s]+/u)?.[0];
  assert.ok(link);
  return new URL(link);
}
async function otpFor(email: string) {
  const message = await capturedMail(email, "verification code");
  const otp = message.text.match(/\b\d{6}\b/u)?.[0];
  assert.ok(otp);
  return otp;
}
async function verifyEmail(email: string) {
  assert.equal((await request("/api/auth/email-otp/send-verification-otp", { email, type: "email-verification" })).status, 200);
  const otp = await otpFor(email);
  assert.equal((await request("/api/auth/email-otp/verify-email", { email, otp })).status, 200);
}
async function verifiedAccount(email = `${randomUUID()}@example.test`) {
  const signup = await request("/api/auth/sign-up/email", {
    name: "Test Creator",
    email,
    password,
    callbackURL: "/sign-in?verified=1",
  });
  assert.equal(signup.status, 200, await signup.clone().text());
  const { user } = (await signup.json()) as { user: { id: string } };
  await verifyEmail(email);
  const login = await request("/api/auth/sign-in/email", { email, password });
  assert.equal(login.status, 200, await login.clone().text());
  return { email, id: user.id, cookie: cookieFrom(login), login };
}

test("protected endpoints reject guests and forged sessions", async () => {
  for (const path of ["/api/v1/me", "/api/v1/dashboard", "/api/v1/videos"]) {
    assert.equal((await request(path)).status, 401);
    assert.equal(
      (await request(path, undefined, "clipvelto.session_token=forged")).status,
      401,
    );
  }
  assert.equal((await request("/api/health")).status, 200);
});

test("verification gates login, cookies are HttpOnly, profile persists, and logout revokes", async () => {
  const email = "verify@example.test";
  assert.equal(
    (
      await request("/api/auth/sign-up/email", {
        name: "Creator",
        email,
        password,
        callbackURL: "/sign-in",
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/auth/sign-in/email", { email, password })).status,
    403,
  );
  await verifyEmail(email);
  const login = await request("/api/auth/sign-in/email", { email, password });
  assert.equal(login.status, 200);
  const cookie = cookieFrom(login);
  const setCookie = login.headers.getSetCookie().join(";");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//i);
  const account = await connection
    .db!.collection("account")
    .findOne({ providerId: "credential" });
  assert.ok(account?.password);
  assert.notEqual(account.password, password);
  assert.equal(
    (await request("/api/auth/update-user", { name: " " }, cookie)).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/api/auth/update-user",
        { name: "Updated Creator" },
        cookie,
      )
    ).status,
    200,
  );
  const me = meSchema.parse(
    await (await request("/api/v1/me", undefined, cookie)).json(),
  );
  assert.equal(me.user.name, "Updated Creator");
  assert.equal((await request("/api/auth/sign-out", {}, cookie)).status, 200);
  assert.equal((await request("/api/v1/me", undefined, cookie)).status, 401);
});

test("reset is neutral for unknown accounts, revokes sessions, and tokens cannot be reused", async () => {
  const user = await verifiedAccount();
  const known = await request("/api/auth/request-password-reset", {
    email: user.email,
    redirectTo: "/reset-password",
  });
  const unknown = await request("/api/auth/request-password-reset", {
    email: "unknown@example.test",
    redirectTo: "/reset-password",
  });
  assert.deepEqual(await known.json(), await unknown.json());
  const link = await mailFor(user.email, "Reset");
  const redirect = await request(link.pathname + link.search);
  assert.equal(redirect.status, 302);
  const token = new URL(
    redirect.headers.get("location")!,
    origin,
  ).searchParams.get("token");
  assert.ok(token);
  const newPassword = "a different long testing passphrase";
  assert.equal(
    (await request("/api/auth/reset-password", { token, newPassword })).status,
    200,
  );
  assert.equal(
    (await request("/api/v1/me", undefined, user.cookie)).status,
    401,
  );
  assert.equal(
    (await request("/api/auth/reset-password", { token, newPassword })).status,
    400,
  );
  assert.equal(
    (await request("/api/auth/sign-in/email", { email: user.email, password }))
      .status,
    401,
  );
  assert.equal(
    (
      await request("/api/auth/sign-in/email", {
        email: user.email,
        password: newPassword,
      })
    ).status,
    200,
  );
});

test("changing a password verifies the old password and ends other sessions", async () => {
  const user = await verifiedAccount();
  const other = await request("/api/auth/sign-in/email", {
    email: user.email,
    password,
  });
  const newPassword = "another strong testing passphrase";
  assert.equal(
    (
      await request(
        "/api/auth/change-password",
        {
          currentPassword: "wrong password",
          newPassword,
          revokeOtherSessions: true,
        },
        user.cookie,
      )
    ).status,
    400,
  );
  const result = await request(
    "/api/auth/change-password",
    { currentPassword: password, newPassword, revokeOtherSessions: true },
    user.cookie,
  );
  assert.equal(result.status, 200);
  assert.equal(
    (await request("/api/v1/me", undefined, cookieFrom(other))).status,
    401,
  );
  const currentCookie = cookieFrom(result) || user.cookie;
  assert.equal(
    (await request("/api/v1/me", undefined, currentCookie)).status,
    200,
  );
});

test("email changes require codes from both current and new inboxes", async () => {
  const user = await verifiedAccount();
  const newEmail = "new-address@example.test";
  await connection.collection("auth_email_limits").updateMany({}, { $set: { nextAllowedAt: new Date(0) } });
  assert.equal((await request("/api/auth/email-otp/send-verification-otp", { email: user.email, type: "email-verification" }, user.cookie)).status, 200);
  const currentOtp = await otpFor(user.email);
  assert.equal((await request("/api/auth/email-otp/request-email-change", { newEmail, otp: currentOtp }, user.cookie)).status, 200);
  assert.equal(meSchema.parse(await (await request("/api/v1/me", undefined, user.cookie)).json()).user.email, user.email);
  const otp = await otpFor(newEmail);
  assert.equal((await request("/api/auth/email-otp/change-email", { newEmail, otp }, user.cookie)).status, 200);
  const stored = await connection.db!.collection("user").findOne({ email: newEmail });
  assert.equal(stored?.emailVerified, true);
});

test("history pagination and summary are isolated to the signed-in owner", async () => {
  const a = await verifiedAccount();
  const b = await verifiedAccount();
  await instance.VideoModel.insertMany([
    {
      userId: a.id,
      title: "My podcast",
      originalFilename: "podcast.mp4",
      status: "uploaded",
    },
    {
      userId: a.id,
      title: "My tutorial",
      originalFilename: "tutorial.mp4",
      status: "queued",
    },
    {
      userId: a.id,
      title: "My interview",
      originalFilename: "interview.mp4",
      status: "completed",
    },
    {
      userId: b.id,
      title: "Someone else’s private video",
      originalFilename: "private.mp4",
      status: "processing",
    },
  ]);
  const first = videoPageSchema.parse(
    await (await request("/api/v1/videos?limit=2", undefined, a.cookie)).json(),
  );
  assert.equal(first.videos.length, 2);
  assert.ok(first.nextCursor);
  const second = videoPageSchema.parse(
    await (
      await request(
        `/api/v1/videos?limit=2&cursor=${first.nextCursor}`,
        undefined,
        a.cookie,
      )
    ).json(),
  );
  assert.equal(second.videos.length, 1);
  assert.equal(second.nextCursor, null);
  assert.equal(
    new Set([...first.videos, ...second.videos].map((video) => video.id)).size,
    3,
  );
  assert.ok(
    [...first.videos, ...second.videos].every(
      (video) => video.originalFilename !== "private.mp4",
    ),
  );
  assert.equal(
    (await request(`/api/v1/videos?userId=${b.id}`, undefined, a.cookie))
      .status,
    400,
  );
  assert.equal(
    (await request("/api/v1/videos?limit=999", undefined, a.cookie)).status,
    400,
  );
  assert.equal(
    (await request("/api/v1/videos?cursor=invalid", undefined, a.cookie))
      .status,
    400,
  );
  const summary = summarySchema.parse(
    await (await request("/api/v1/dashboard", undefined, a.cookie)).json(),
  );
  assert.equal(summary.videos, 3);
  assert.equal(summary.processing, 1);
  assert.equal(summary.credits.available, 15);
  assert.equal(
    (await request("/api/v1/videos", { title: "No upload API" }, a.cookie))
      .status,
    404,
  );
});

test("untrusted origins are rejected and forged forwarding headers cannot bypass rate limits", async () => {
  const user = await verifiedAccount();
  assert.equal(
    (
      await request(
        "/api/auth/update-user",
        { name: "Attacker" },
        user.cookie,
        { origin: "https://untrusted.example" },
      )
    ).status,
    403,
  );
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await request(
          "/api/auth/request-password-reset",
          { email: "unknown@example.test" },
          "",
          {
            "x-forwarded-for": `203.0.113.${i + 1}`,
            "x-clipvelto-client-ip": `203.0.113.${i + 1}`,
          },
        )
      ).status,
      200,
    );
  assert.equal(
    (
      await request(
        "/api/auth/request-password-reset",
        { email: "unknown@example.test" },
        "",
        { "x-forwarded-for": "198.51.100.1" },
      )
    ).status,
    429,
  );
});

test("configuration rejects insecure production setup and short secrets", () => {
  assert.throws(
    () =>
      parseEnv({
        NODE_ENV: "production",
        MONGODB_URI: database.getUri(),
        BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
        BETTER_AUTH_URL: "http://example.test",
      }),
    /Production authentication requires HTTPS/,
  );
  assert.throws(
    () =>
      parseEnv({ MONGODB_URI: database.getUri(), BETTER_AUTH_SECRET: "short" }),
    /Invalid backend configuration/,
  );
});

test("duplicate signup is rejected without a session and email codes are hashed, bounded and single-use", async () => {
  const email = "otp-security@example.test";
  const signup = { email, password, name: "Original Creator" };
  assert.equal((await request("/api/auth/sign-up/email", signup)).status, 200);
  const duplicate = await request("/api/auth/sign-up/email", { ...signup, name: "Duplicate", password: "another long passphrase" });
  assert.equal(duplicate.status, 422);
  assert.equal((await duplicate.json() as { code: string }).code, "EMAIL_ALREADY_REGISTERED");
  assert.equal(cookieFrom(duplicate), "");
  assert.equal(await connection.collection("session").countDocuments({}), 0);
  assert.equal(await connection.collection("user").countDocuments({ email }), 1);
  assert.equal((await connection.collection("user").findOne({ email }))?.name, signup.name);
  assert.equal((await request("/api/auth/sign-in/email", { email, password })).status, 403);
  assert.equal((await request("/api/auth/email-otp/send-verification-otp", { email, type: "email-verification" })).status, 200);
  const otp = await otpFor(email);
  const stored = await connection.collection("verification").findOne({ identifier: `email-verification-otp-${email}` });
  assert.ok(stored);
  assert.ok(!String(stored.value).includes(otp));
  assert.equal((await request("/api/auth/email-otp/send-verification-otp", { email, type: "email-verification" })).status, 429);
  const wrong = otp === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) {
    await assert.rejects(instance.auth.api.verifyEmailOTP({ body: { email, otp: wrong } }), error =>
      z.object({ body: z.object({ code: z.literal("INVALID_OTP") }) }).safeParse(error).success);
  }
  await assert.rejects(instance.auth.api.verifyEmailOTP({ body: { email, otp } }), error =>
    z.object({ body: z.object({ code: z.literal("TOO_MANY_ATTEMPTS") }) }).safeParse(error).success);
  assert.equal((await connection.collection("user").findOne({ email }))?.emailVerified, false);

  await connection.collection("auth_email_limits").updateMany({}, { $set: { nextAllowedAt: new Date(0) } });
  assert.equal((await request("/api/auth/email-otp/send-verification-otp", { email, type: "email-verification" })).status, 200);
  const latest = await otpFor(email);
  const verified = await request("/api/auth/email-otp/verify-email", { email, otp: latest });
  assert.equal(verified.status, 200);
  assert.equal(cookieFrom(verified), "");
  assert.equal((await request("/api/auth/email-otp/verify-email", { email, otp: latest })).status, 400);
});
