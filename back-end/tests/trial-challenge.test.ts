import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "../src/config/env.js";
import { verifyTrialChallenge } from "../src/modules/trials/trial-routes.js";
const env = parseEnv({
  MONGODB_URI: "mongodb://localhost/test",
  BETTER_AUTH_SECRET: "isolated-server-side-challenge-validation-secret",
  BETTER_AUTH_URL: "https://clipvelto.example",
  TURNSTILE_SECRET_KEY: "isolated-secret",
});
test("Turnstile validation checks server-side success, hostname and action and fails closed", async () => {
  const original = globalThis.fetch;
  try {
    for (const [body, expected] of [
      [{ success: true, hostname: "clipvelto.example", action: "trial" }, true],
      [
        { success: false, hostname: "clipvelto.example", action: "trial" },
        false,
      ],
      [{ success: true, hostname: "attacker.example", action: "trial" }, false],
      [
        { success: true, hostname: "clipvelto.example", action: "other" },
        false,
      ],
      [{ success: true }, false],
    ] as const) {
      globalThis.fetch = async (input, options) => {
        assert.equal(
          input,
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        );
        assert.equal(options?.method, "POST");
        assert.deepEqual(JSON.parse(options?.body as string), {
          secret: env.TURNSTILE_SECRET_KEY,
          response: "token",
        });
        return Response.json(body);
      };
      assert.equal(await verifyTrialChallenge(env, "token"), expected);
    }
    globalThis.fetch = async () => {
      throw new Error("network unavailable");
    };
    assert.equal(await verifyTrialChallenge(env, "token"), false);
    globalThis.fetch = async () => new Response("not json");
    assert.equal(await verifyTrialChallenge(env, "token"), false);
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    assert.equal(await verifyTrialChallenge(env, "token"), false);
  } finally {
    globalThis.fetch = original;
  }
});
