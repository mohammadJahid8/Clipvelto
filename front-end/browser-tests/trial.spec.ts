import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { mailCode } from "./helpers/mail";
import { mockTurnstile } from "./helpers/turnstile";

test("anonymous preview survives signup, charges the same allowance and unlocks private downloads", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.RUN_TRIAL_TESTS !== "1",
    "Enable isolated trial fixtures",
  );
  test.setTimeout(90000);
  await mockTurnstile(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#start");
  await page
    .getByLabel("YouTube video link")
    .fill("https://www.youtube.com/watch?v=jNQXAC9IVRw");
  await page.getByRole("button", { name: "Complete test human check" }).click();
  await page.getByRole("button", { name: "Create my free clip" }).click();
  const preview = page.getByLabel(/Watermarked preview:/);
  await expect(preview).toBeVisible({ timeout: 30000 });
  await expect
    .poll(() => preview.evaluate((video: HTMLVideoElement) => video.videoWidth))
    .toBe(720);
  const guestCookies = await page.context().cookies();
  expect(
    guestCookies.find((cookie) => cookie.name === "clipvelto-trial")?.httpOnly,
  ).toBe(true);
  await expect(page.getByRole("link", { name: "Download MP4" })).toHaveCount(0);
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("body")).toHaveCSS(
      "color",
      theme === "dark" ? "rgb(237, 239, 243)" : "rgb(23, 32, 25)",
    );
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(scan.violations).toEqual([]);
    await page.locator("#main-content").focus();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: testInfo.outputPath(`trial-${theme}.png`),
      fullPage: true,
    });
  }
  await page.reload();
  await expect(preview).toBeVisible();
  await page
    .getByRole("button", { name: "Save & unlock for free" })
    .click();
  const email = `${randomUUID()}@example.test`,
    password = "a long isolated trial passphrase";
  await page.getByLabel("Your name", { exact: true }).fill("Trial Creator");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verify your email." })).toBeVisible();
  await page.getByLabel("Verification code", { exact: true }).fill(await mailCode(email));
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Open your clips" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open your clips" }).click();
  await expect(page.getByRole("link", { name: "Download MP4" })).toBeVisible({
    timeout: 30000,
  });
  const userClip = page.locator("video").first();
  await expect
    .poll(() =>
      userClip.evaluate((video: HTMLVideoElement) => video.videoWidth),
    )
    .toBe(1080);
  const credits = await (await page.request.get("/api/v1/credits")).json();
  expect(credits.credits.used).toBeGreaterThan(0);
  expect(credits.credits.available + credits.credits.used).toBe(15);
  expect(credits.history).toHaveLength(1);
  await page.request.post("/api/v1/trial/claim", {
    headers: { origin: "http://localhost:3000" },
    data: {},
  });
  const again = await (await page.request.get("/api/v1/credits")).json();
  expect(again.credits.used).toBe(credits.credits.used);
  await page.goto("/");
  await expect(
    page
      .locator("header")
      .getByRole("link", { name: "Dashboard", exact: true }),
  ).toBeVisible();
});
