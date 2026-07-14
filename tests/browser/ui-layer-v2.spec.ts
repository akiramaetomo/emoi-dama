import { expect, test, type Locator } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app-build-badge")).toHaveCount(0);
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
});

test("formal release identifies 0.6.0 in Settings without a prerelease badge", async ({ page }) => {
  await page.locator("[data-calendar-open-panel='settings']").click();
  const about = page.locator(".app-about-panel");
  await about.locator("summary").click();
  await expect(about.locator("dd").nth(0)).toHaveText("0.6.0");
  await expect(about.locator("dd").nth(1)).toHaveText("0.6.0");
});

test("initial Calendar owns the viewport and keeps its dock visible", async ({ page }) => {
  const viewport = page.viewportSize();
  const dock = await page.locator(".calendar-control-dock").boundingBox();
  expect(viewport).not.toBeNull();
  expect(dock).not.toBeNull();
  expect(dock!.y).toBeGreaterThanOrEqual(0);
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(viewport!.height);

  const geometry = await page.evaluate(() => {
    const surface = document.querySelector<HTMLElement>("[data-calendar-primary-shell]")!;
    return {
      windowScrollY: window.scrollY,
      bodyScrollTop: document.scrollingElement?.scrollTop ?? -1,
      surfaceScrollTop: surface.scrollTop,
      surfaceClientHeight: surface.clientHeight,
      surfaceScrollHeight: surface.scrollHeight,
      primaryRoute: document.querySelector<HTMLElement>("#app")?.dataset.primaryRoute,
      playDockVisibility: getComputedStyle(document.querySelector<HTMLElement>(".world-control-dock")!).visibility,
      baseInert: document.querySelector<HTMLElement>(".ui-base-layer")!.inert,
    };
  });
  expect(geometry).toEqual({
    windowScrollY: 0,
    bodyScrollTop: 0,
    surfaceScrollTop: 0,
    surfaceClientHeight: geometry.surfaceScrollHeight,
    surfaceScrollHeight: geometry.surfaceScrollHeight,
    primaryRoute: "calendar-month",
    playDockVisibility: "hidden",
    baseInert: true,
  });
});

test("Calendar and Ball List switch on one tap with one persistent current item", async ({ page }) => {
  test.setTimeout(45_000);
  const month = page.locator("[data-calendar-open-panel='calendar']");
  const list = page.locator("[data-calendar-open-panel='dayList']");
  await month.evaluate((element) => { element.setAttribute("data-browser-test-identity", "persistent"); });

  for (let index = 0; index < 20; index += 1) {
    await list.click();
    await expect(page.locator(".screen-kicker", { hasText: "Ball List" })).toBeVisible();
    await expect(page.locator(".world-actions [aria-current='page']")).toHaveCount(1);
    await expect(list).toHaveAttribute("aria-current", "page");

    await month.click();
    await expect(page.locator(".screen-kicker", { hasText: "Calendar" })).toBeVisible();
    await expect(page.locator(".world-actions [aria-current='page']")).toHaveCount(1);
    await expect(month).toHaveAttribute("aria-current", "page");
  }

  await expect(month).toHaveAttribute("data-browser-test-identity", "persistent");

  await page.locator("[data-calendar-main]").click();
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "play");
  await expect(page.locator(".world-actions [aria-current='page']")).toHaveCount(1);
  await expect(page.locator(".ui-base-layer [data-cycle-ball-label-mode]")).toHaveAttribute("aria-current", "page");
});

test("uiDebug exposes viewport, app, and scroll-owner diagnostics without changing document geometry", async ({ page }) => {
  await page.goto("/?uiDebug=1");
  const overlay = page.locator("[data-ui-debug-overlay]");
  await expect(overlay).toContainText("UI DEBUG");
  await expect(overlay).toContainText("vv off");
  await expect(overlay).toContainText("UI DEBUG v0.6.0");
  await page.locator("[data-calendar-primary-body]").dispatchEvent("touchstart", {
    touches: [{ identifier: 1, clientX: 100, clientY: 200 }],
  });
  await expect(overlay).toContainText("owner div.calendar-primary-scroll");
  await expect.poll(() => page.evaluate(() => ({
    scrollY: window.scrollY,
    scrollTop: document.scrollingElement?.scrollTop,
    historyLength: window.__happyBallUiDebug?.getHistory().length,
  }))).toEqual({ scrollY: 0, scrollTop: 0, historyLength: expect.any(Number) });
});

test("non-editable surface text is not selectable and runtime faults do not destroy navigation", async ({ page }) => {
  const selectionStyle = await page.locator(".calendar-month-head h2").evaluate((element) => {
    const style = getComputedStyle(element);
    return style.userSelect || style.getPropertyValue("-webkit-user-select");
  });
  expect(selectionStyle).toBe("none");

  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("simulated browser-test fault") }));
  });
  await expect(page.locator(".runtime-fault-banner")).toContainText("画面操作は継続できます");

  await page.locator("[data-calendar-open-panel='dayList']").click();
  await expect(page.locator(".screen-kicker", { hasText: "Ball List" })).toBeVisible();
  await expect(page.locator(".error-shell")).toHaveCount(0);
});

test("create and edit share one folded thought-order field sequence", async ({ page }) => {
  await page.locator("[data-calendar-open-panel='create']").click();
  const createForm = page.locator("#ball-form");
  await expect(createForm.locator("[data-authoring-category-fold]")).not.toHaveAttribute("open", "");
  await expect(createForm.locator("textarea[name='note']")).toHaveCount(1);
  await expect.poll(() => followsAuthoringOrder(createForm)).toBe(true);
  await createForm.locator("input[name='title']").fill("aligned range");
  await createForm.evaluate((form: HTMLFormElement) => form.requestSubmit());
  await page.locator("[data-calendar-open-panel='dayList']").click();
  await page.locator("[data-edit-ball-id]").first().click();

  const form = page.locator("#ball-edit-form");
  await expect(form.locator("textarea[name='note']")).toHaveCount(1);
  await expect(form.locator("[data-authoring-category-fold]")).not.toHaveAttribute("open", "");
  await expect.poll(() => followsAuthoringOrder(form)).toBe(true);
});

async function followsAuthoringOrder(form: Locator): Promise<boolean> {
  return form.evaluate((element) => {
    const selectors = [
      "input[name='title']",
      "textarea[name='note']",
      "[data-authoring-category-fold]",
      "[data-authoring-datetime-group]",
      "[data-authoring-context-divider]",
      "input[name='subject']",
      "[data-ball-count-control]",
      "select[name='issuerType']",
      "select[name='visibility']",
    ];
    const fields = selectors.map((selector) => element.querySelector(selector));
    return fields.every((field, index) => (
      field !== null && (index === fields.length - 1 || Boolean(field.compareDocumentPosition(fields[index + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING))
    ));
  });
}
