import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { mailCode } from "./helpers/mail";
import { verifyLocalTranscription } from "./helpers/transcription";

test("private upload, interrupted transfer retry, validation status, invalid media, and removal", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(120000);
  const localTranscription =
    process.env.RUN_GROQ_TESTS === "1" ||
    process.env.RUN_LOCAL_TRANSCRIPTION_TESTS === "1" ||
    process.env.RUN_MEDIA_TESTS === "1";
  const email = `${randomUUID()}@example.test`;
  const password = "a memorable browser upload passphrase";
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: "http://localhost:3000" },
    data: {
      name: "Video Creator",
      email,
      password,
      callbackURL: "/sign-in?verified=1",
    },
  });
  expect(signup.ok()).toBe(true);
  const sent = await page.request.post("/api/auth/email-otp/send-verification-otp", { headers: { origin: "http://localhost:3000" }, data: { email, type: "email-verification" } });
  expect(sent.ok()).toBe(true);
  const verified = await page.request.post("/api/auth/email-otp/verify-email", { headers: { origin: "http://localhost:3000" }, data: { email, otp: await mailCode(email) } });
  expect(verified.ok()).toBe(true);
  await page.goto("/sign-in");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Video." }),
  ).toBeVisible();
  await page.goto("/dashboard/upload");
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("body")).toHaveCSS(
      "color",
      theme === "dark" ? "rgb(237, 239, 243)" : "rgb(23, 32, 25)",
    );
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      if (width !== 320) {
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(`youtube-${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
  }
  await page.getByRole("tab", { name: "From device" }).click();
  await expect(
    page.getByRole("button", { name: "Choose a video", exact: true }),
  ).toBeEnabled();
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("body")).toHaveCSS(
      "color",
      theme === "dark" ? "rgb(237, 239, 243)" : "rgb(23, 32, 25)",
    );
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      if (width === 390 || width === 1440) {
        await expect(
          page.getByRole("heading", { name: "Start with your video." }),
        ).toHaveCSS(
          "color",
          theme === "dark" ? "rgb(237, 239, 243)" : "rgb(23, 32, 25)",
        );
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(result.violations).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(`upload-${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const file = page.getByLabel("Select source video");
  await file.setInputFiles(
    fileURLToPath(
      new URL(
        localTranscription
          ? "../../back-end/tests/fixtures/spoken-video.webm"
          : "../../back-end/tests/fixtures/short-video.webm",
        import.meta.url,
      ),
    ),
  );
  await page.getByRole("radio", { name: "Add captions", exact: true }).check();
  await page.getByRole("button", { name: "Upload video", exact: true }).click();
  await expect(
    page.getByText("Confirm you own this video or have permission to use it.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  let failTransfer = true;
  await page.route("**/clipvelto-local/staging/**", async (route) => {
    if (route.request().method() === "PUT" && failTransfer) {
      failTransfer = false;
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Upload video", exact: true }).click();
  await expect(
    page.getByText(
      "The upload connection was interrupted. Check your connection and try again.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Upload video", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/videos\/[a-f0-9]{24}$/);
  await expect(
    page.getByRole("heading", { name: "Your video is uploaded and checked." }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("160 × 90", { exact: true })).toBeVisible();
  if (localTranscription) {
    await verifyLocalTranscription(page, testInfo);
    await page.setViewportSize({ width: 390, height: 844 });
  }
  const validVideoUrl = page.url();
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
  await page.locator("#workspace-content").focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("uploaded-video-mobile.png"),
    fullPage: true,
  });
  if (process.env.RUN_MEDIA_TESTS === "1") {
    await page
      .getByRole("button", { name: "Create clips", exact: true })
      .click();
    await expect(page.getByRole("link", { name: "Download MP4" })).toBeVisible({
      timeout: 30000,
    });
    const preview = page.locator(".clip-preview video");
    await expect(preview).toBeVisible();
    await expect
      .poll(() =>
        preview.evaluate((element: HTMLVideoElement) => element.readyState),
      )
      .toBeGreaterThanOrEqual(1);
    await preview.evaluate(async (element: HTMLVideoElement) => {
      element.muted = true;
      await element.play();
    });
    await expect
      .poll(() =>
        preview.evaluate((element: HTMLVideoElement) => element.currentTime),
      )
      .toBeGreaterThan(0);
    await preview.evaluate((element: HTMLVideoElement) => {
      element.pause();
      element.currentTime = 3;
    });
    await expect
      .poll(() =>
        preview.evaluate((element: HTMLVideoElement) => element.seeking),
      )
      .toBe(false);
    await expect
      .poll(() =>
        preview.evaluate((element: HTMLVideoElement) => element.currentTime),
      )
      .toBeGreaterThanOrEqual(3);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.locator("#workspace-content").focus();
    await page.evaluate(() =>
      window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
    );
    await page.screenshot({
      path: testInfo.outputPath("generated-clips-mobile.png"),
      fullPage: true,
    });
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("body")).toHaveCSS(
        "color",
        theme === "dark" ? "rgb(237, 239, 243)" : "rgb(23, 32, 25)",
      );
      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          )
          .toBe(true);
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(`clip-preview-${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download MP4" }).click();
    expect((await downloadPromise).suggestedFilename()).toMatch(/\.mp4$/);
  } else
    await expect(
      page.getByRole("button", { name: "Create clips", exact: true }),
    ).toBeDisabled();
  const guest = await context.browser()!.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(validVideoUrl);
  await expect(guestPage).toHaveURL(/\/sign-in$/);
  await guest.close();
  await page.goto("/dashboard/videos");
  await expect(
    page.getByRole("link", {
      name: localTranscription ? "spoken-video" : "short-video",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/dashboard/upload");
  if (process.env.RUN_MEDIA_TESTS === "1") {
    await page
      .getByLabel("YouTube video or livestream URL")
      .fill("https://www.youtube.com/live/YE7VzlLtp-4");
    await page.getByLabel("Video shape").selectOption("16:9");
    await page
      .getByRole("radio", { name: "No added captions", exact: true })
      .check();
    await page.getByLabel("Live capture length").selectOption("60");
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Import from YouTube", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Your video is uploaded and checked.",
      }),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      page.getByRole("heading", { name: "Test live window", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Create clips", exact: true })
      .click();
    await expect(page.getByRole("link", { name: "Download MP4" })).toBeVisible({
      timeout: 30000,
    });
    await expect
      .poll(() =>
        page
          .locator(".clip-preview video")
          .evaluate(
            (video: HTMLVideoElement) =>
              `${video.videoWidth}x${video.videoHeight}`,
          ),
      )
      .toBe("1920x1080");
    await page.goto("/dashboard/upload");
  }
  await page.getByRole("tab", { name: "From device" }).click();
  await expect(
    page.getByRole("button", { name: "Choose a video", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Select source video").setInputFiles({
    name: "not-a-video.webm",
    mimeType: "video/webm",
    buffer: Buffer.from("Not a video, despite its extension."),
  });
  await page
    .getByRole("radio", { name: "No added captions", exact: true })
    .check();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Upload video", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/videos\/[a-f0-9]{24}$/);
  await expect(
    page.getByRole("heading", { name: "Checks failed", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: "Retry checks" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Remove video", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove video", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/videos$/);
  await expect(
    page.getByRole("link", { name: "not-a-video", exact: true }),
  ).toHaveCount(0);
});
