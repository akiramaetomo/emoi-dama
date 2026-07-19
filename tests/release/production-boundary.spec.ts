import { expect, test } from "@playwright/test";

test("formal build exposes version 0.8.0 without development diagnostics", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("happyBall.settings.v2", JSON.stringify({ gravityDebugEnabled: true }));
  });
  await page.goto("./?uiDebug=1&handoffDebug=1&renderer=dom&pixiFail=1");
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
  await expect(page.locator(".app-build-badge")).toHaveCount(0);
  await expect(page.locator("[data-ui-debug-overlay]")).toHaveCount(0);

  await page.locator("[data-calendar-open-panel='settings']").click();
  await expect(page.locator("#setting-gravity-debug")).toHaveCount(0);
  const about = page.locator(".app-about-panel");
  await about.locator("summary").click();
  await expect(about.locator("dd").nth(0)).toHaveText("0.8.0");
  await expect(about.locator("dd").nth(1)).toHaveText("0.8.0");
  await page.getByRole("button", { name: "閉じる" }).click();

  await page.locator("[data-calendar-main]").click();
  await expect(page.locator("#ball-field")).toHaveAttribute("data-ball-renderer", "pixi");
  await expect(page.locator(".gravity-debug-panel")).toHaveCount(0);

  await page.locator("[data-open-panel='create']").click();
  const form = page.locator("#ball-form");
  await form.locator("input[name='title']").fill("production boundary");
  await form.evaluate((element: HTMLFormElement) => element.requestSubmit());
  await page.locator("[data-open-calendar-day-list]").click();
  await page.locator("[data-view-ball-id]").first().click();
  await page.locator("[data-dialog-receipt-ball-id]").first().click();
  await expect(page.locator(".handoff-debug-controls")).toHaveCount(0);
});
