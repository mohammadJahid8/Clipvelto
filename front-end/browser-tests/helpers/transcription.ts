import { expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

export async function verifyLocalTranscription(page: Page, testInfo: TestInfo) {
  if (process.env.RUN_GROQ_TESTS === "1")
    await expect(
      page.getByText("Audio is sent to Groq for transcription.", {
        exact: true,
      }),
    ).toBeVisible();
  await page
    .getByRole("button", { name: "Transcribe video", exact: true })
    .click();
  await expect(
    page.getByRole("list", { name: "Timestamped transcript" }),
  ).toContainText("short recording", { timeout: 60000 });
  await expect(
    page.getByText("Detected language: en", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download subtitles" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^transcript-.*\.srt$/);
  const subtitles = await readFile((await download.path())!, "utf8");
  expect(subtitles).toContain("short recording");
  expect(subtitles).toMatch(/\d\d:\d\d:\d\d,\d{3} -->/);
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const foreground =
      theme === "dark" ? "rgb(237, 239, 243)" : "rgb(23, 32, 25)";
    await expect(page.locator("body")).toHaveCSS("color", foreground);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await expect(
        page.getByRole("heading", { name: "Transcript", exact: true }),
      ).toHaveCSS("color", foreground);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (width !== 320) {
        await page.locator("#workspace-content").focus();
        await page.evaluate(() =>
          window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
        );
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
        await page.screenshot({
          path: testInfo.outputPath(`transcript-${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
  }
  await page.reload();
  await expect(
    page.getByRole("list", { name: "Timestamped transcript" }),
  ).toContainText("short recording");
}
