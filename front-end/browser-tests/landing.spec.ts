import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockTurnstile } from "./helpers/turnstile";

test.beforeEach(async ({ page }) => mockTurnstile(page));

for (const theme of ["light", "dark"] as const) {
  test(`${theme} theme is accessible and responsive`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.evaluate(() => document.fonts.ready);

    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const images = page.locator(".video-previews img");
      await expect(images).toHaveCount(3);
      expect(
        await images.evaluateAll((nodes) =>
          nodes.every(
            (node) =>
              (node as HTMLImageElement).complete &&
              (node as HTMLImageElement).naturalWidth > 0,
          ),
        ),
      ).toBe(true);
      const cards = await page.locator(".video-preview").evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return { width: rect.width, top: rect.top };
        }),
      );
      expect(cards[1].width).toBeGreaterThan(cards[0].width);
      expect(cards[1].top).toBeLessThan(cards[0].top);
      expect(cards[1].top).toBeLessThan(cards[2].top);
      if (width === 390 || width === 1440) {
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(result.violations).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(`${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
    expect(errors).toEqual([]);
  });
}

test("theme preference persists and system mode follows changes", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByRole("button", { name: "Choose color theme" }).click();
  await page.getByRole("menuitem", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Choose color theme" }).click();
  await page.getByRole("menuitem", { name: "System" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("mobile navigation closes after following a section link", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Pricing", exact: true }).click();
  await expect(nav).not.toBeVisible();
  await expect(page).toHaveURL(/#pricing$/);
  await expect(page.locator("#pricing")).toBeFocused();
});

test("availability dialogs close on Escape and restore focus", async ({
  page,
}) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Privacy", exact: true });
  await button.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Groq");
  await expect(dialog).toContainText("cookies");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(button).toBeFocused();
});

test("saved theme applies before hydration", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() =>
    localStorage.setItem("clipvelto-theme", "light"),
  );
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(250, 250, 248)",
  );
  await expect(
    page.locator('meta[name="theme-color"]').first(),
  ).toHaveAttribute("content", "#fafaf8");
});

test("the public trial focuses on a YouTube link without exposing workspace options", async ({
  page,
}) => {
  const sent: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method()))
      sent.push(request.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Your first clip. No signup needed.",
    }),
  ).toBeVisible();
  const field = page.getByLabel("YouTube video link", { exact: true });
  await field.fill("https://www.youtube.com/watch?v=YE7VzlLtp-4");
  await expect(
    page.getByRole("button", { name: "Create my free clip" }),
  ).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
  expect(sent).toEqual([]);
});

test("SEO and application assets resolve", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Clipvelto — Turn Long Videos into Shorts");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://clipvelto.com",
  );
  await expect(
    page.locator('meta[property="og:image"]').first(),
  ).toHaveAttribute("content", /https:\/\/clipvelto.com\/opengraph-image.png/);
  const schema = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(JSON.parse(schema || "{}")["@type"]).toBe("WebSite");
  for (const path of [
    "/robots.txt",
    "/sitemap.xml",
    "/favicon.ico",
    "/icon.svg",
    "/apple-icon.png",
    "/opengraph-image.png",
  ]) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
  }
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("https://clipvelto.com");
});
