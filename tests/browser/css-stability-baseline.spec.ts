import { expect, test, type Locator, type Page } from "@playwright/test";

const BASELINE_TIME = new Date("2026-08-01T03:00:00.000Z");
const viewports = [
  { name: "phone", width: 360, height: 640 },
  { name: "ipad", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

for (const viewport of viewports) {
  test(`${viewport.name} static UI contract`, async ({ page }) => {
    test.setTimeout(45_000);
    await page.clock.setFixedTime(BASELINE_TIME);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.addStyleTag({ content: ".settings-brand-ball { animation: none !important; }" });
    await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();

    const baseline: Record<string, unknown> = {};
    baseline.calendar = await captureSurface(page, {
      shell: "[data-calendar-primary-shell]",
      header: "[data-calendar-primary-header]",
      previous: ".calendar-month-head .period-nav-button-previous",
      next: ".calendar-month-head .period-nav-button-next",
      body: "[data-calendar-primary-body]",
      grid: ".calendar-grid",
      statusLayer: ".calendar-ball-sieve-status-layer",
      dock: ".calendar-control-dock",
      actions: ".calendar-control-dock .world-actions",
    });

    await page.locator("[data-calendar-open-panel='create']").click();
    await expect(page.locator("#ball-form")).toBeVisible();
    baseline.createForm = await captureSurface(page, {
      backdrop: ".panel-backdrop-create",
      shell: ".floating-panel-create",
      header: ".floating-panel-create .authoring-surface-header",
      body: ".floating-panel-create [data-scroll-owner]",
      form: "#ball-form",
      title: "#ball-form [data-ball-authoring-title-field]",
      memo: "#ball-form [data-ball-authoring-memo-field]",
    });
    await page.locator("#ball-form input[name='title']").fill("CSS回帰基準");
    await page.locator("#ball-form textarea[name='note']").fill("公開版や通常利用データと分離した自動検証fixture");
    await page.locator("#ball-form").evaluate((form: HTMLFormElement) => form.requestSubmit());

    await page.locator("[data-calendar-open-panel='dayList']").click();
    await expect(page.locator(".calendar-day-ball-item")).toHaveCount(1);
    await expect(page.locator(".is-ball-sieve-transitioning")).toHaveCount(0);
    baseline.ballList = await captureSurface(page, {
      shell: "[data-calendar-primary-shell]",
      header: "[data-calendar-primary-header]",
      previous: ".calendar-day-list-head .period-nav-button-previous",
      next: ".calendar-day-list-head .period-nav-button-next",
      body: ".calendar-day-list-body",
      list: ".calendar-day-list-body .calendar-day-ball-list",
      card: ".calendar-day-ball-item",
      statusLayer: ".calendar-ball-sieve-status-layer",
      dock: ".calendar-control-dock",
    });

    await page.locator("[data-view-ball-id]").first().click();
    await expect(page.locator(".ball-detail-dialog")).toBeVisible();
    baseline.detailDialog = await captureSurface(page, {
      backdrop: ".ball-detail-backdrop",
      dialog: ".ball-detail-dialog",
      header: ".ball-detail-dialog .detail-surface-header",
      body: ".ball-detail-dialog [data-scroll-owner]",
      ball: ".ball-detail-dialog .dialog-ball",
      infoGrid: ".ball-detail-dialog .detail-card-grid",
      dock: ".ball-detail-backdrop .upper-surface-control-dock",
      actions: ".ball-detail-backdrop .upper-surface-actions",
    });
    await page.locator(".ball-detail-dialog [data-dialog-close]").click();

    await page.locator("[data-edit-ball-id]").first().click();
    await expect(page.locator(".ball-edit-dialog")).toBeVisible();
    baseline.editForm = await captureSurface(page, {
      backdrop: ".ball-edit-dialog-backdrop",
      dialog: ".ball-edit-dialog",
      header: ".ball-edit-dialog .edit-surface-header",
      body: ".ball-edit-dialog [data-scroll-owner]",
      form: "#ball-edit-form",
      title: "#ball-edit-form [data-ball-authoring-title-field]",
      memo: "#ball-edit-form [data-ball-authoring-memo-field]",
      dock: ".ball-edit-dialog-backdrop .upper-surface-control-dock",
      actions: ".ball-edit-dialog-backdrop .upper-surface-actions",
    });
    await page.locator(".ball-edit-dialog .dialog-close").click();

    await page.locator("[data-calendar-open-panel='settings']").click();
    await expect(page.locator(".floating-panel-settings")).toBeVisible();
    baseline.settings = await captureSurface(page, {
      backdrop: ".panel-backdrop-settings",
      shell: ".floating-panel-settings",
      header: ".floating-panel-settings .floating-panel-head",
      body: ".floating-panel-settings [data-scroll-owner]",
      brand: ".settings-brand-ball",
      cluster: ".settings-cluster",
      group: ".settings-group",
      dock: ".panel-backdrop-settings .upper-surface-control-dock",
      actions: ".panel-backdrop-settings .upper-surface-actions",
    });
    await page.locator(".panel-backdrop-settings [data-close-panel]").first().click();

    await page.locator("[data-calendar-main]").click();
    await expect(page.locator("#ball-field")).toBeVisible();
    await expect(page.locator(".pixi-ball-canvas")).toBeVisible();
    baseline.play = await captureSurface(page, {
      app: "#app",
      field: "#ball-field",
      canvas: ".pixi-ball-canvas",
      period: ".play-period-nav",
      statusLayer: ".play-ball-sieve-status-layer",
      dock: ".world-control-dock",
      actions: ".app-control-bar",
      primary: ".primary-screen-control-group",
      create: "[data-open-panel='create']",
      sieve: "[data-toggle-ball-sieve]",
      jutsu: "[data-toggle-play-modes]",
      settings: "[data-open-panel='settings']",
    });
    baseline.sieveInactive = await captureElement(page.locator("[data-toggle-ball-sieve]"));

    await page.locator("[data-toggle-ball-sieve]").click();
    await expect(page.locator("[data-ball-sieve-popover]:visible")).toBeVisible();
    baseline.sievePopover = await captureSurface(page, {
      backdrop: "[data-close-ball-sieve]:visible",
      popover: "[data-ball-sieve-popover]:visible",
      grid: "[data-ball-sieve-popover]:visible .ball-sieve-options",
      option: "[data-ball-sieve-popover]:visible .ball-sieve-option",
      optionVisual: "[data-ball-sieve-popover]:visible .ball-sieve-option-visual",
    });
    await page.locator('[data-ball-sieve-popover]:visible [data-ball-sieve-preset="offered"]').click();
    await expect(page.locator("[data-toggle-ball-sieve]")).toHaveAttribute("aria-pressed", "true");
    baseline.sieveActive = await captureElement(page.locator("[data-toggle-ball-sieve]"));
    baseline.sieveStatus = await captureElement(page.locator(".play-ball-sieve-status-layer [data-ball-sieve-status]"));

    expect(`${JSON.stringify(baseline, null, 2)}\n`).toMatchSnapshot(`${viewport.name}-static-ui.txt`);
  });
}

async function captureSurface(page: Page, selectors: Record<string, string>): Promise<Record<string, ElementContract>> {
  const entries = await Promise.all(Object.entries(selectors).map(async ([name, selector]) => {
    const locator = page.locator(selector).first();
    await expect(locator, `${name}: ${selector}`).toBeAttached();
    return [name, await captureElement(locator)] as const;
  }));
  return Object.fromEntries(entries);
}

interface ElementContract {
  rect: { x: number; y: number; width: number; height: number };
  style: Record<string, string>;
}

async function captureElement(locator: Locator): Promise<ElementContract> {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const round = (value: number): number => Math.round(value * 10) / 10;
    return {
      rect: {
        x: round(rect.x),
        y: round(rect.y),
        width: round(rect.width),
        height: round(rect.height),
      },
      style: {
        display: style.display,
        position: style.position,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        touchAction: style.touchAction,
        width: style.width,
        height: style.height,
        minWidth: style.minWidth,
        minHeight: style.minHeight,
        maxWidth: style.maxWidth,
        maxHeight: style.maxHeight,
        borderTopWidth: style.borderTopWidth,
        borderTopStyle: style.borderTopStyle,
        borderTopColor: style.borderTopColor,
        borderRadius: style.borderRadius,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        color: style.color,
        boxShadow: style.boxShadow,
        gridTemplateColumns: style.gridTemplateColumns,
        gridTemplateRows: style.gridTemplateRows,
        columnGap: style.columnGap,
        rowGap: style.rowGap,
        gap: style.gap,
        flexGrow: style.flexGrow,
        flexShrink: style.flexShrink,
        opacity: style.opacity,
        visibility: style.visibility,
        zIndex: style.zIndex,
      },
    };
  });
}
