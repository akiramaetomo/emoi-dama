import { expect, test, type Page } from "@playwright/test";

test("normal and jutsu physics remain independent, persist, and reset only the jutsu profile", async ({ page }) => {
  await openPhysicsSettings(page);

  const normalGravity = page.locator("#setting-gravity-strength");
  await expect(normalGravity).toHaveValue("4000");
  await expect(page.locator("[data-physics-settings-profile='normal']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#reset-jutsu-physics")).toHaveCount(0);

  await page.locator("[data-physics-settings-profile='jutsu']").click();
  await expect(page.locator(".physics-settings")).toHaveAttribute("open", "");
  await expect(page.locator("[data-physics-settings-profile='jutsu']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#setting-wall")).toHaveValue("0.85");
  await expect(page.locator("#setting-contact")).toHaveValue("0.6");
  await expect(page.locator("#setting-gravity-strength")).toHaveValue("1000");
  await expect(page.locator("#setting-parent-diameter")).toHaveValue("100");
  await expect(page.locator("#setting-parent-lifetime")).toHaveValue("2");

  await page.locator("#setting-gravity-strength").evaluate((input: HTMLInputElement) => {
    input.value = "2220";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const storedAfterEdit = await readStoredSettings(page);
  expect(storedAfterEdit.gravityStrength).toBe(4000);
  expect(storedAfterEdit.jutsuPhysicsSettings.gravityStrength).toBe(2220);

  await page.reload();
  await openPhysicsSettings(page);
  await expect(page.locator("#setting-gravity-strength")).toHaveValue("4000");
  await page.locator("[data-physics-settings-profile='jutsu']").click();
  await expect(page.locator("#setting-gravity-strength")).toHaveValue("2220");

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#reset-jutsu-physics").click();
  await expect(page.locator("#setting-gravity-strength")).toHaveValue("1000");
  const storedAfterReset = await readStoredSettings(page);
  expect(storedAfterReset.gravityStrength).toBe(4000);
  expect(storedAfterReset.jutsuPhysicsSettings.gravityStrength).toBe(1000);
});

test("runtime automatically switches to the shared jutsu profile and back", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-calendar-main]").click();

  const field = page.locator("#ball-field");
  await expect(field).toHaveAttribute("data-runtime-physics-profile", "normal");
  await page.locator("[data-toggle-play-modes]").click();
  await page.locator("[data-play-mode-disclosure='world'] summary").click();
  await page.locator("[data-play-gravity-mode='fixed-down']").click();
  await expect(field).toHaveAttribute("data-runtime-physics-profile", "jutsu");

  await page.locator("[data-open-panel='settings']:visible").click();
  await page.locator(".physics-settings summary").click();
  await expect(page.locator("[data-physics-settings-profile='jutsu']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#setting-gravity-strength")).toHaveValue("1000");

  await page.locator("button[data-close-panel]").click();
  await page.locator("[data-disable-play-jutsu]").click();
  await expect(field).toHaveAttribute("data-runtime-physics-profile", "normal");
});

test("switching the tuning target preserves the Settings scroll position", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPhysicsSettings(page);

  const scroller = page.locator(".floating-panel-settings .app-modal-scroll");
  const jutsuButton = page.locator("[data-physics-settings-profile='jutsu']");
  await jutsuButton.evaluate((button) => button.scrollIntoView({ block: "center" }));
  const before = await scroller.evaluate((element) => element.scrollTop);
  expect(before).toBeGreaterThan(0);

  await jutsuButton.click();
  await expect.poll(async () => Math.abs(await scroller.evaluate((element) => element.scrollTop) - before)).toBeLessThanOrEqual(1);
  await expect(page.locator("#setting-wall")).toBeVisible();
});

async function openPhysicsSettings(page: Page): Promise<void> {
  if (page.url() === "about:blank") {
    await page.goto("/");
  }
  await page.locator("[data-open-panel='settings']:visible, [data-calendar-open-panel='settings']:visible").click();
  await page.locator(".physics-settings summary").click();
  await expect(page.locator(".physics-settings")).toHaveAttribute("open", "");
}

async function readStoredSettings(page: Page): Promise<Record<string, any>> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("happyBall.settings.v2") ?? "{}"));
}
