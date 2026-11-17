import type { Page } from "@playwright/test";

export async function mockTurnstile(page: Page) {
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?*",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `window.turnstile = {
      render: function(element, options) {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = 'Complete test human check';
        button.onclick = function() { options.callback('valid-browser-' + crypto.randomUUID()); };
        element.appendChild(button); return 'test-widget';
      }, reset: function() {}, remove: function() {}
    };`,
      }),
  );
}
