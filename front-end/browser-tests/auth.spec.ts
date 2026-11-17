import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { mailCode } from "./helpers/mail";

test("registration, verification, dashboard, settings, logout, and password recovery", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const email = `${randomUUID()}@example.test`;
  const password = "my long browser testing passphrase";
  const changedPassword = "my changed browser testing passphrase";
  const resetPassword = "my reset browser testing passphrase";
  await page.goto("/sign-up");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Enter your name.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Browser Creator");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(
    page.getByRole("heading", { name: "Verify your email." }),
  ).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email address", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: /Resend in/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Local email testing" }),
  ).toContainText("npm run mail:latest");
  await page.reload();
  await expect(page.getByLabel("Email address", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Verification code", { exact: true }).fill(await mailCode(email));
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(page.getByText("Email verified. Sign in.")).toBeVisible();
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Browser." }),
  ).toBeVisible();
  const cookies = await page.context().cookies();
  expect(
    cookies.find((cookie) => cookie.name === "clipvelto.session_token")
      ?.httpOnly,
  ).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "session_token",
  );
  await expect(
    page.getByText("No credits have been issued or charged."),
  ).not.toBeVisible();
  await expect(
    page.getByText("Available credits", { exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page
      .locator("header")
      .getByRole("link", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("header").getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page
      .locator("header")
      .getByRole("link", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.goto("/dashboard");

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
        const scan = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(scan.violations).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(`dashboard-${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open workspace navigation" }).click();
  await page
    .getByRole("navigation", { name: "Mobile workspace navigation" })
    .getByRole("link", { name: "Settings" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Account settings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Mobile workspace navigation" }),
  ).not.toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Updated Creator");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Your profile has been updated.")).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page.getByLabel("New password", { exact: true }).fill(changedPassword);
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill(changedPassword);
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await expect(
    page.getByText(
      "Your password has been changed and other sessions have been signed out.",
    ),
  ).toBeVisible();
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
  await page.locator("#workspace-content").focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(
    page.getByRole("heading", { name: "Account settings" }),
  ).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath("settings-mobile.png"),
    fullPage: true,
  });
  await page.goto("/dashboard/billing");
  await expect(
    page.getByRole("heading", { name: "15 free minutes", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/dashboard/settings");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Reset your password." })).toBeVisible();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await page.getByLabel("Verification code", { exact: true }).fill(await mailCode(email, "Reset"));
  await page.getByLabel("New password", { exact: true }).fill(resetPassword);
  await page.getByLabel("Confirm password", { exact: true }).fill(resetPassword);
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByText("Password updated. Sign in.")).toBeVisible();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(resetPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Updated." }),
  ).toBeVisible();
});

test("auth pages are responsive, accessible, and excluded from indexing", async ({
  page,
}) => {
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    for (const path of [
      "/sign-in",
      "/sign-up",
      "/forgot-password",
      "/verify-email",
      "/reset-password",
    ]) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(scan.violations).toEqual([]);
    }
  }
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
});
