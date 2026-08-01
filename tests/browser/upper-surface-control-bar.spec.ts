import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
  await createBall(page, "上位バー確認玉");
});

test("Ball List detail reaches Play in one tap without rebuilding the Play canvas", async ({ page }) => {
  await page.locator("[data-calendar-main]").click();
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "play");
  await expect(page.locator(".ui-base-layer #ball-field canvas")).toHaveCount(1);

  await page.locator("[data-open-calendar-day-list]").click();
  await page.locator("[data-view-ball-id]").first().click();
  await expectUpperBar(page, "dayList", false);
  const pausedCanvas = page.locator(".ui-base-layer #ball-field canvas");
  await pausedCanvas.evaluate((element) => element.setAttribute("data-runtime-identity", "preserved"));
  await page.locator("[data-upper-control-target='play']").click();

  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "play");
  await expect(page.locator(".ball-detail-dialog")).toHaveCount(0);
  await expect(page.locator(".ui-base-layer #ball-field canvas")).toHaveAttribute("data-runtime-identity", "preserved");
});

test("detail and Settings expose direct destinations and create returns to its primary origin", async ({ page }) => {
  await openFirstBallDetail(page);
  await page.locator("[data-upper-control-target='calendar']").click();
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "calendar-month");

  await page.locator("[data-calendar-open-panel='dayList']").click();
  await page.locator("[data-view-ball-id]").first().click();
  await page.locator("[data-upper-control-target='settings']").click();
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "settings");
  await expectUpperBar(page, "dayList", true);

  const settingsPanel = page.locator(".floating-panel-settings");
  await settingsPanel.evaluate((element) => element.setAttribute("data-settings-identity", "same"));
  await page.locator("[data-upper-control-target='settings']").click();
  await expect(settingsPanel).toHaveAttribute("data-settings-identity", "same");

  await page.locator(".display-settings > summary").click();
  const memoSetting = page.locator("#setting-memo-field");
  const initialMemoSetting = await memoSetting.isChecked();
  await memoSetting.setChecked(!initialMemoSetting);
  await page.locator("[data-upper-control-target='dayList']").click();
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "calendar-day-list");

  await page.locator("[data-view-ball-id]").first().click();
  await page.locator("[data-upper-control-target='create']").click();
  await expect(page.locator("#ball-form")).toBeVisible();
  await page.locator(".floating-panel-create [data-close-panel]").first().click();
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "calendar-day-list");

  await page.locator("[data-view-ball-id]").first().click();
  await page.locator("[data-upper-control-target='create']").click();
  await page.locator("#ball-form input[name='title']").fill("上位バーから追加");
  await page.locator("#ball-form").evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "calendar-day-list");
  await expect(page.locator(".calendar-day-ball-title-row strong", { hasText: "上位バーから追加" })).toBeVisible();

  await page.locator("[data-calendar-open-panel='settings']").click();
  await expect(page.locator("#setting-memo-field")).toBeChecked({ checked: !initialMemoSetting });
  await page.locator("[data-upper-control-target='play']").click();
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "play");
});

test("edit navigation preserves or resolves the pending target through every close choice", async ({ page }) => {
  await openFirstBallEdit(page);
  await page.locator("[data-upper-control-target='calendar']").click();
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "calendar-month");

  await openFirstBallEdit(page);
  const title = page.locator("#ball-edit-form input[name='title']");
  await title.fill("破棄予定の入力");
  await page.locator("[data-upper-control-target='play']").click();
  await expect(page.locator("[data-edit-unsaved-confirm]")).toBeVisible();
  await expect.poll(() => page.locator(".ui-modal-layer").evaluate((element: HTMLElement) => element.inert)).toBe(true);
  await page.locator("[data-edit-continue]").click();
  await expect(title).toHaveValue("破棄予定の入力");

  await page.locator("[data-upper-control-target='play']").click();
  await expect(page.locator("[data-edit-unsaved-confirm]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-edit-unsaved-confirm]")).toHaveCount(0);
  await expect(title).toHaveValue("破棄予定の入力");

  await page.locator("[data-upper-control-target='play']").click();
  await page.locator("[data-edit-discard-close]").click();
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "play");
  await expect.poll(async () => (await readFirstStoredBall(page)).title).toBe("上位バー確認玉");

  await openFirstBallEdit(page);
  await page.locator("#ball-edit-form input[name='title']").fill("訂正後の入力");
  await page.locator("[data-upper-control-target='calendar']").click();
  await page.locator("[data-edit-save-correction]").click();
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "calendar-month");
  await expect.poll(async () => (await readFirstStoredBall(page)).title).toBe("訂正後の入力");

  await openFirstBallEdit(page);
  await page.locator("#ball-edit-form input[name='title']").fill("余韻保存後の入力");
  await page.locator("[data-upper-control-target='play']").click();
  await page.locator("[data-edit-save-echo]").click();
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "play");
  await expect.poll(() => readFirstStoredBall(page)).toMatchObject({
    title: "余韻保存後の入力",
    emotionEcho: { title: "訂正後の入力" },
  });
});

test("upper surfaces keep one internal scroll owner above an in-viewport dock", async ({ page }) => {
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);

    await openFirstBallDetail(page);
    await expectUpperSurfaceGeometry(page, ".ball-detail-backdrop", ".ball-detail-dialog", viewport);
    await page.locator(".detail-surface-header [data-dialog-edit-ball-id]").click();
    await expectUpperSurfaceGeometry(page, ".ball-edit-dialog-backdrop", ".ball-edit-dialog", viewport);
    await page.locator("[data-upper-control-target='settings']").click();
    await expectUpperSurfaceGeometry(page, ".panel-backdrop-settings", ".floating-panel-settings", viewport);
    await page.locator("[data-upper-control-target='dayList']").click();
  }
});

async function createBall(page: Page, title: string): Promise<void> {
  await page.locator("[data-calendar-open-panel='create']").click();
  const form = page.locator("#ball-form");
  await form.locator("input[name='title']").fill(title);
  await form.evaluate((element: HTMLFormElement) => element.requestSubmit());
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
}

async function openFirstBallDetail(page: Page): Promise<void> {
  if (await page.locator("#app").getAttribute("data-primary-route") !== "calendar-day-list") {
    const playList = page.locator("[data-open-calendar-day-list]");
    if (await playList.isVisible()) {
      await playList.click();
    } else {
      await page.locator("[data-calendar-open-panel='dayList']").click();
    }
  }
  await page.locator("[data-view-ball-id]").first().click();
  await expect(page.locator(".ball-detail-dialog")).toBeVisible();
}

async function openFirstBallEdit(page: Page): Promise<void> {
  if (await page.locator("#app").getAttribute("data-primary-route") !== "calendar-day-list") {
    const playList = page.locator("[data-open-calendar-day-list]");
    if (await playList.isVisible()) {
      await playList.click();
    } else {
      await page.locator("[data-calendar-open-panel='dayList']").click();
    }
  }
  await page.locator("[data-edit-ball-id]").first().click();
  await expect(page.locator(".ball-edit-dialog")).toBeVisible();
}

async function expectUpperBar(page: Page, current: "play" | "calendar" | "dayList", settingsActive: boolean): Promise<void> {
  const bar = page.locator(".upper-surface-actions");
  await expect(bar).toBeVisible();
  await expect(bar.locator("[data-upper-control-target]")).toHaveCount(5);
  await expect(bar.locator(`[data-upper-control-target='${current}']`)).toHaveAttribute("aria-current", "page");
  await expect(bar.locator("[data-upper-control-target='settings']")).toHaveAttribute("aria-pressed", String(settingsActive));
  await expect(bar.locator("[data-toggle-play-modes], [data-toggle-ball-sieve], [data-calendar-cycle-marker-mode]")).toHaveCount(0);
}

async function expectUpperSurfaceGeometry(
  page: Page,
  backdropSelector: string,
  shellSelector: string,
  viewport: { width: number; height: number },
): Promise<void> {
  const geometry = await page.locator(backdropSelector).evaluate((backdrop, shellSelectorValue) => {
    const shell = backdrop.querySelector<HTMLElement>(shellSelectorValue)!;
    const dock = backdrop.querySelector<HTMLElement>(".upper-surface-control-dock")!;
    const owners = Array.from(backdrop.querySelectorAll<HTMLElement>("[data-scroll-owner]"))
      .filter((element) => getComputedStyle(element).display !== "none");
    const backdropRect = backdrop.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    return {
      backdropLeft: backdropRect.left,
      backdropRight: backdropRect.right,
      dockLeft: dockRect.left,
      dockRight: dockRect.right,
      dockBottom: dockRect.bottom,
      shellBottom: shellRect.bottom,
      dockTop: dockRect.top,
      ownerCount: owners.length,
      documentScrollY: window.scrollY,
    };
  }, shellSelector);
  expect(geometry.backdropLeft).toBeGreaterThanOrEqual(-0.5);
  expect(geometry.backdropRight).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(geometry.dockLeft).toBeGreaterThanOrEqual(-0.5);
  expect(geometry.dockRight).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(geometry.dockBottom).toBeLessThanOrEqual(viewport.height + 0.5);
  expect(geometry.dockBottom).toBeGreaterThanOrEqual(viewport.height - 1.5);
  expect(geometry.shellBottom).toBeLessThanOrEqual(geometry.dockTop + 0.5);
  expect(geometry.ownerCount).toBe(1);
  expect(geometry.documentScrollY).toBe(0);
}

async function readFirstStoredBall(page: Page): Promise<Record<string, any>> {
  return page.evaluate(() => {
    const stored = localStorage.getItem("happyBall.ledger.v1");
    return stored ? JSON.parse(stored).balls[0] : {};
  });
}
