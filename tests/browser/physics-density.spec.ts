import { expect, test, type Page } from "@playwright/test";

test("standard-size balls use faithful Pixi without URL arguments", async ({ page }) => {
  await seedBalls(page, 20, true);
  await page.goto("/");
  await page.locator("[data-calendar-main]").click();

  const field = page.locator("#ball-field");
  await expect(field).toHaveAttribute("data-ball-renderer", "pixi");
  await expect(field).toHaveAttribute("data-ball-appearance", "faithful");
  expect(Number(await field.getAttribute("data-ball-diameter"))).toBeGreaterThan(12);
  await expect(field.locator("canvas.pixi-ball-canvas")).toBeVisible({ timeout: 20_000 });
});

test("an empty-world tap activates armed buoyancy without creating Parent", async ({ page }) => {
  await seedBalls(page, 1, true);
  await page.goto("/");
  await page.locator("[data-calendar-main]").click();
  const field = page.locator("#ball-field");
  await expect(field.locator("canvas.pixi-ball-canvas")).toBeVisible({ timeout: 20_000 });
  await page.locator("[data-toggle-play-modes]").click();
  await page.locator("[data-play-mode-disclosure='world'] summary").click();
  await page.locator("[data-play-gravity-mode='fixed-down']").click();
  await page.locator("[data-play-buoyancy-mode='on']").click();
  await page.locator("[data-toggle-play-modes]").click();
  const box = await field.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + 18, box!.y + box!.height * 0.55);
  await expect(field.locator(".parent-ball-actor")).toHaveCount(0);
  await expect.poll(async () => Number(await field.getAttribute("data-fluid-activation"))).toBeGreaterThan(0.5);
  await expect.poll(async () => Number(await field.getAttribute("data-fluid-activation")), { timeout: 5_000 }).toBe(0);
});

test("Jutsu state guards Parent splitting and buoyancy without rebuilding the Pixi canvas", async ({ page }) => {
  test.setTimeout(120_000);
  await seedBalls(page, 1, true);
  await page.goto("/");
  await page.locator("[data-calendar-main]").click();

  const field = page.locator("#ball-field");
  const canvas = field.locator("canvas.pixi-ball-canvas");
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await canvas.evaluate((element) => element.setAttribute("data-parent-split-canvas", "preserved"));

  await page.locator("[data-toggle-play-modes]").click();
  const fieldBoxBeforePopover = await field.boundingBox();
  const controlRegion = page.locator(".play-control-region");
  const controlBar = page.locator(".app-control-bar");
  const controlBox = await controlRegion.boundingBox();
  expect(fieldBoxBeforePopover).not.toBeNull();
  expect(controlBox).not.toBeNull();
  expect(Math.abs(fieldBoxBeforePopover!.y + fieldBoxBeforePopover!.height - controlBox!.y)).toBeLessThanOrEqual(1);
  expect(controlBox!.height).toBeLessThanOrEqual(76);
  await expect(page.locator(".play-world-region .play-world-guidance")).toHaveCount(0);
  await expect(controlBar.locator(".control-bar-left .dock-create-ball-icon")).toBeVisible();
  await expect(controlBar.locator(".primary-screen-control-group .play-triple-ball-icon")).toBeVisible();
  await expect(controlBar.locator(".control-bar-functions .dock-settings-button")).toBeVisible();
  expect(await controlBar.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("0px");
  await expect(page.locator("[data-toggle-play-modes]")).toHaveText("術");
  await expect(field).toHaveAttribute("data-play-buoyancy-mode", "off");
  await expect(field).toHaveAttribute("data-play-parent-split-mode", "off");
  await expect(page.locator("[data-play-buoyancy-mode='on']")).toBeDisabled();
  await expect(page.locator("[data-play-parent-split-mode='count-limit']")).toBeDisabled();
  await page.locator("[data-play-mode-disclosure='world'] summary").click();
  await page.locator("[data-play-gravity-mode='fixed-down']").click();
  await page.locator("[data-play-buoyancy-mode='on']").click();
  await expect(field).toHaveAttribute("data-play-gravity-mode", "fixed-down");
  await expect(field).toHaveAttribute("data-play-buoyancy-mode", "on");
  await page.locator("[data-play-gravity-mode='free']").click();
  await expect(field).toHaveAttribute("data-play-buoyancy-mode", "off");
  await expect(page.locator("[data-play-buoyancy-mode='on']")).toBeDisabled();
  await page.locator("[data-play-gravity-mode='fixed-down']").click();
  await page.locator("[data-play-buoyancy-mode='on']").click();
  const fieldBoxAfterModeChange = await field.boundingBox();
  expect(fieldBoxAfterModeChange).toEqual(fieldBoxBeforePopover);
  await page.locator("[data-play-mode-disclosure='parent'] summary").click();
  await page.locator("[data-play-parent-enabled='true']").click();
  await page.locator("[data-play-parent-split-mode='count-limit']").click();
  await expect(field).toHaveAttribute("data-play-interaction-mode", "parent");
  await expect(field).toHaveAttribute("data-play-parent-split-mode", "count-limit");
  await page.locator("[data-play-parent-enabled='false']").click();
  await expect(field).toHaveAttribute("data-play-parent-split-mode", "off");
  await expect(page.locator("[data-play-parent-split-mode='count-limit']")).toBeDisabled();
  await page.locator("[data-play-parent-enabled='true']").click();
  await page.locator("[data-play-parent-split-mode='count-limit']").click();
  await page.locator("[data-toggle-play-modes]").click();
  await expect(page.locator("[data-play-mode-popover]")).toBeHidden();
  const box = await field.boundingBox();
  expect(box).not.toBeNull();
  const parentStart = {
    x: box!.x + box!.width / 2,
    y: box!.y + Math.min(240, box!.height / 2),
  };
  const parentStartTarget = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return {
      tag: element?.tagName ?? null,
      className: element?.getAttribute("class") ?? null,
      reachesField: Boolean(element?.closest("#ball-field")),
    };
  }, parentStart);
  expect(parentStartTarget.reachesField, JSON.stringify(parentStartTarget)).toBe(true);
  await page.mouse.move(parentStart.x, parentStart.y);
  await page.mouse.down();
  await expect(field.locator(".parent-ball-actor")).toHaveCount(1);
  await expect.poll(async () => Number(await field.getAttribute("data-fluid-activation"))).toBeGreaterThan(0.9);
  const fluidVisual = await field.evaluate((element) => ({
    activation: getComputedStyle(element).getPropertyValue("--play-fluid-activation"),
    background: getComputedStyle(element, "::before").backgroundImage,
  }));
  expect(Number(fluidVisual.activation)).toBeGreaterThan(0.9);
  expect(fluidVisual.background).not.toBe("none");
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 80, { steps: 6 });
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 64, { steps: 12 });
  await page.mouse.up();

  await expect(page.locator("[data-fragmentation-status]")).toHaveText("分割中 2 / 元1玉", { timeout: 10_000 });
  await expect(canvas).toHaveAttribute("data-parent-split-canvas", "preserved");
  await expect(field.locator(".parent-ball-actor")).toHaveCount(0, { timeout: 5_000 });
  await expect.poll(async () => Number(await field.getAttribute("data-fluid-activation")), { timeout: 5_000 }).toBe(0);
  await expect(field).toHaveAttribute("data-ball-appearance", "faithful");

  await page.locator("[data-toggle-play-modes]").click();
  await expect(field).toHaveAttribute("data-play-gravity-mode", "fixed-down");
  await expect(field).toHaveAttribute("data-play-interaction-mode", "parent");

  const settingRounds = [
    { "setting-wall": "1", "setting-contact": "1", "setting-damping": "0" },
    { "setting-density-ratio": "1.5", "setting-class-damping-ratio": "0.5", "setting-class-buoyancy": "0.8" },
    { "setting-speed": "4500", "setting-gravity-strength": "3200", "setting-parent-lifetime": "8" },
  ];
  for (const settings of settingRounds) {
    await page.locator("[data-open-panel='settings']").click();
    await page.evaluate((updates) => {
      for (const [id, value] of Object.entries(updates)) {
        const input = document.querySelector<HTMLInputElement>(`#${id}`);
        if (!input) {
          throw new Error(`missing setting ${id}`);
        }
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, settings);
    await page.locator(".panel-backdrop-settings .dialog-close").click();
    await expect(canvas).toHaveAttribute("data-parent-split-canvas", "preserved");
    await expect(page.locator("[data-fragmentation-status]")).toHaveText("分割中 2 / 元1玉");
  }
});

test("Jutsu presets, disabling, and ball reset preserve the runtime while restoring original instances", async ({ page }) => {
  await seedBalls(page, 1, true, 2);
  await page.goto("/");
  await page.locator("[data-calendar-main]").click();

  const field = page.locator("#ball-field");
  const canvas = field.locator("canvas.pixi-ball-canvas");
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await canvas.evaluate((element) => element.setAttribute("data-jutsu-canvas", "preserved"));
  await page.locator("[data-toggle-play-modes]").click();
  await page.locator("[data-apply-jutsu='count-limit']").click();

  await expect(field).toHaveAttribute("data-play-gravity-mode", "fixed-down");
  await expect(field).toHaveAttribute("data-play-buoyancy-mode", "on");
  await expect(field).toHaveAttribute("data-play-interaction-mode", "parent");
  await expect(field).toHaveAttribute("data-play-parent-split-mode", "off");
  await expect(page.locator("[data-play-jutsu-feedback]")).toContainText("1件を一段階分割しました（2→4玉）");
  await expect(page.locator("[data-fragmentation-status]")).toHaveText("分割中 4 / 元2玉");
  await expect(canvas).toHaveAttribute("data-jutsu-canvas", "preserved");

  await page.locator("[data-disable-play-jutsu]").click();
  await expect(field).toHaveAttribute("data-play-gravity-mode", "free");
  await expect(field).toHaveAttribute("data-play-buoyancy-mode", "off");
  await expect(field).toHaveAttribute("data-play-interaction-mode", "grab");
  await expect(field).toHaveAttribute("data-play-parent-split-mode", "off");
  await expect(page.locator("[data-fragmentation-status]")).toHaveText("分割中 4 / 元2玉");
  await expect(canvas).toHaveAttribute("data-jutsu-canvas", "preserved");

  for (let generation = 1; generation < 5; generation += 1) {
    await page.locator("[data-apply-jutsu='count-limit']").click();
  }
  await expect(page.locator("[data-fragmentation-status]")).toHaveText("分割中 64 / 元2玉");
  await page.locator("[data-reset-ball-jutsu]").click();
  await expect(page.locator("[data-play-jutsu-feedback]")).toContainText("2玉を再結合しました（64→2玉）");
  await expect(page.locator("[data-fragmentation-status]")).toHaveText("");
  await expect(canvas).toHaveAttribute("data-jutsu-canvas", "preserved");

  await page.locator("[data-reset-ball-jutsu]").click();
  await expect(page.locator("[data-play-jutsu-feedback]")).toHaveText("分割された玉はありません。");
});

test("compact Jutsu menu moves within the world and remembers its disclosures", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 648 });
  await seedBalls(page, 8, true);
  await page.goto("/");
  await page.locator("[data-calendar-main]").click();
  await page.locator("[data-toggle-play-modes]").click();

  const world = page.locator(".play-world-region");
  const menu = page.locator("[data-play-mode-popover]");
  const grip = page.locator("[data-play-mode-drag-grip]");
  await expect(menu).toBeVisible();
  await expect(page.getByText("術 Jutsu", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-play-mode-disclosure='world']")).not.toHaveAttribute("open", "");
  await expect(page.locator("[data-play-mode-disclosure='parent']")).not.toHaveAttribute("open", "");
  const initialMenuBox = await menu.boundingBox();
  const worldBox = await world.boundingBox();
  expect(initialMenuBox).not.toBeNull();
  expect(worldBox).not.toBeNull();
  expect(initialMenuBox!.width).toBeLessThanOrEqual(273);
  expect(initialMenuBox!.height).toBeLessThan(worldBox!.height * 0.55);
  expect(await menu.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("0px");
  expect(await menu.evaluate((element) => getComputedStyle(element).backdropFilter)).toBe("none");

  const periodBox = await page.locator(".play-period-mode-button").boundingBox();
  const initialGripBox = await grip.boundingBox();
  expect(periodBox).not.toBeNull();
  expect(initialGripBox).not.toBeNull();
  await page.mouse.move(initialGripBox!.x + initialGripBox!.width / 2, initialGripBox!.y + initialGripBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(periodBox!.x + periodBox!.width / 2, periodBox!.y + periodBox!.height / 2, { steps: 5 });
  await page.mouse.up();
  const overlappingGripBox = await grip.boundingBox();
  expect(overlappingGripBox).not.toBeNull();
  const overlapPoint = {
    x: Math.max(periodBox!.x, overlappingGripBox!.x) + 4,
    y: Math.max(periodBox!.y, overlappingGripBox!.y) + 4,
  };
  expect(overlapPoint.x).toBeLessThan(Math.min(periodBox!.x + periodBox!.width, overlappingGripBox!.x + overlappingGripBox!.width));
  expect(overlapPoint.y).toBeLessThan(Math.min(periodBox!.y + periodBox!.height, overlappingGripBox!.y + overlappingGripBox!.height));
  expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest("[data-play-mode-popover]")), overlapPoint)).toBe(true);
  const overlappedMenuX = await menu.getAttribute("data-menu-x");
  await page.mouse.move(overlapPoint.x, overlapPoint.y);
  await page.mouse.down();
  await page.mouse.move(overlapPoint.x + 20, overlapPoint.y + 16, { steps: 4 });
  await page.mouse.up();
  await expect(menu).not.toHaveAttribute("data-menu-x", overlappedMenuX ?? "");

  const gripBox = await grip.boundingBox();
  expect(gripBox).not.toBeNull();
  await page.mouse.move(gripBox!.x + gripBox!.width / 2, gripBox!.y + gripBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(worldBox!.x - 120, worldBox!.y - 120, { steps: 5 });
  await page.mouse.up();
  await expect(menu).toHaveAttribute("data-menu-x", "8");
  await expect(menu).toHaveAttribute("data-menu-y", "8");

  await page.locator("[data-play-mode-disclosure='world'] summary").click();
  await expect(page.locator("[data-play-mode-disclosure='world']")).toHaveAttribute("open", "");
  await page.locator("[data-toggle-play-modes]").click();
  await page.locator("[data-toggle-play-modes]").click();
  await expect(page.locator("[data-play-mode-disclosure='world']")).toHaveAttribute("open", "");

  await page.setViewportSize({ width: 320, height: 520 });
  await expect.poll(async () => {
    const bounds = await menu.boundingBox();
    const worldBounds = await world.boundingBox();
    if (!bounds || !worldBounds) return false;
    return bounds.x >= worldBounds.x + 7
      && bounds.y >= worldBounds.y + 7
      && bounds.x + bounds.width <= worldBounds.x + worldBounds.width - 7
      && bounds.y + bounds.height <= worldBounds.y + worldBounds.height - 7;
  }).toBe(true);
});

test("160 phone balls use faithful Pixi and route changes stay responsive", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 360, height: 648 });
  await seedBalls(page, 160, true);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await page.locator("[data-calendar-main]").click();

  const field = page.locator("#ball-field");
  await expect(field).toHaveAttribute("data-ball-renderer", "pixi");
  await expect(field).toHaveAttribute("data-ball-density", "normal");
  await expect(field).toHaveAttribute("data-ball-appearance", "faithful");
  expect(Number(await field.getAttribute("data-ball-diameter"))).toBeGreaterThan(12);
  await expect(field.locator("canvas.pixi-ball-canvas")).toBeVisible({ timeout: 20_000 });
  await field.locator("canvas.pixi-ball-canvas").evaluate((canvas) => {
    canvas.setAttribute("data-identity-check", "preserve-label-toggle");
  });
  await expect(field.locator(".physics-ball")).toHaveCount(0);
  await expect(page.locator(".play-population-status")).toHaveText("表示中 160 / 全160玉");
  const stacking = await field.evaluate((element) => ({
    canvas: getComputedStyle(element.querySelector("canvas.pixi-ball-canvas") as HTMLCanvasElement).zIndex,
    background: getComputedStyle(element, "::before").zIndex,
    watermark: getComputedStyle(element, "::after").zIndex,
  }));
  expect(stacking).toEqual({ canvas: "1", background: "0", watermark: "0" });

  for (let index = 0; index < 4; index += 1) {
    await page.locator("[data-cycle-ball-label-mode]").click();
    await expect(field.locator("canvas.pixi-ball-canvas")).toHaveAttribute("data-identity-check", "preserve-label-toggle");
  }

  await page.locator("[data-cycle-display-mode]").click();
  await page.locator("[data-cycle-display-mode]").click();
  await expect(field.locator("canvas.pixi-ball-canvas")).toBeVisible();

  const calendarTransitionMs = await clickAndMeasure(page, "[data-open-panel='calendar']");
  expect(calendarTransitionMs).toBeLessThan(250);
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "calendar-month");
  await page.locator("[data-calendar-main]").click();

  const createTransitionMs = await clickAndMeasure(page, "[data-open-panel='create']");
  expect(createTransitionMs).toBeLessThan(250);
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "create");
  await page.locator("button[data-close-panel]").click();

  const settingsTransitionMs = await clickAndMeasure(page, "[data-open-panel='settings']");
  expect(settingsTransitionMs).toBeLessThan(250);
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "settings");
  expect(pageErrors).toEqual([]);
});

test("rejected foreground query is ignored and keeps volumetric Pixi", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 360, height: 648 });
  await seedBalls(page, 160, true);
  await page.goto("/?echoComposite=foreground");
  await page.locator("[data-calendar-main]").click();

  const field = page.locator("#ball-field");
  await expect(field).toHaveAttribute("data-ball-renderer", "pixi");
  await expect(field).toHaveAttribute("data-ball-appearance", "faithful");
  await expect(field).not.toHaveAttribute("data-echo-composite", /.+/);
  await expect(page.locator(".play-population-status")).toHaveText(/160.*160/);
  await expect(field.locator("canvas.pixi-ball-canvas")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".runtime-fault-banner")).toHaveCount(0);
});

test("development DOM comparison caps the safe population at 120", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 648 });
  await seedBalls(page, 160, true);
  await page.goto("/?renderer=dom");
  await page.locator("[data-calendar-main]").click();

  const field = page.locator("#ball-field");
  await expect(field).toHaveAttribute("data-ball-renderer", "dom");
  await expect(field.locator(".physics-ball")).toHaveCount(120);
  await expect(page.locator(".play-population-status")).toHaveText(/120.*160/);
  await expect(field.locator("canvas.pixi-ball-canvas")).toHaveCount(0);
});

test("Pixi initialization failure rebuilds the newest 120 balls with DOM", async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __HAPPY_BALL_TEST_PIXI_FAULT__?: boolean }).__HAPPY_BALL_TEST_PIXI_FAULT__ = true;
  });
  await seedBalls(page, 160, true);
  await page.goto("/");
  await page.locator("[data-calendar-main]").click();

  const field = page.locator("#ball-field");
  await expect(field).toHaveAttribute("data-ball-renderer", "dom", { timeout: 20_000 });
  await expect(field).toHaveAttribute("data-renderer-fallback", "pixi-fault");
  await expect(field.locator(".physics-ball")).toHaveCount(120);
  await expect(page.locator(".play-population-status")).toHaveText(/120.*160/);
  await expect(page.locator(".runtime-fault-banner")).toHaveCount(0);
});

test("PC and iPad run 1000 newest physical balls for 30 seconds", async ({ page }) => {
  test.setTimeout(120_000);
  await seedBalls(page, 1005);
  await page.goto("/");
  await page.locator("[data-calendar-main]").click();

  const field = page.locator("#ball-field");
  await expect(field).toHaveAttribute("data-ball-renderer", "pixi");
  await expect(field.locator("canvas.pixi-ball-canvas")).toBeVisible({ timeout: 30_000 });
  const diameter = Number(await field.getAttribute("data-ball-diameter"));
  await expect(field).toHaveAttribute("data-ball-appearance", diameter <= 12 ? "dense-gloss" : "faithful");
  await expect(page.locator(".play-population-status")).toHaveText("表示中 1000 / 全1005玉");
  await page.waitForTimeout(30_000);

  const transitionMs = await clickAndMeasure(page, "[data-open-panel='calendar']");
  expect(transitionMs).toBeLessThan(250);
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "calendar-month");
  await expect(page.locator(".runtime-fault-banner")).toHaveCount(0);
});

test("narrow phones cap dense physics at 500 newest balls", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 360, height: 480 });
  await seedBalls(page, 505);
  await page.goto("/");
  await page.locator("[data-calendar-main]").click();

  const field = page.locator("#ball-field");
  await expect(field).toHaveAttribute("data-ball-density", "dense");
  await expect(field).toHaveAttribute("data-ball-appearance", "dense-gloss");
  expect(Number(await field.getAttribute("data-ball-diameter"))).toBeLessThanOrEqual(12);
  await expect(field.locator("canvas.pixi-ball-canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".play-population-status")).toHaveText("表示中 500 / 全505玉");
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(field).toHaveAttribute("data-ball-appearance", "faithful");
  expect(Number(await field.getAttribute("data-ball-diameter"))).toBeGreaterThan(12);
  await page.setViewportSize({ width: 360, height: 480 });
  await expect(field).toHaveAttribute("data-ball-appearance", "dense-gloss");
  const transitionMs = await clickAndMeasure(page, "[data-open-panel='settings']");
  expect(transitionMs).toBeLessThan(250);
  await expect(page.locator("#app")).toHaveAttribute("data-primary-route", "settings");
  await expect(page.locator(".runtime-fault-banner")).toHaveCount(0);
});

test("Pixi uses native DPR up to three without changing the CSS ball diameter", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 648 }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  await seedBalls(page, 160);
  await page.goto("/");
  await page.locator("[data-calendar-main]").click();

  const field = page.locator("#ball-field");
  await expect(field).toHaveAttribute("data-ball-appearance", "faithful");
  await expect(field).toHaveAttribute("data-pixi-resolution", "3.00");
  const canvasScale = await field.locator("canvas.pixi-ball-canvas").evaluate((canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    return canvas.width / rect.width;
  });
  expect(canvasScale).toBeCloseTo(3, 1);
  await context.close();
});

async function seedBalls(page: Page, count: number, withEcho = false, instancesPerRecord = 1): Promise<void> {
  await page.addInitScript(({ ballCount, seedEcho, recordCount }) => {
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    const balls = Array.from({ length: ballCount }, (_, index) => ({
      id: `density_${String(index).padStart(4, "0")}`,
      date,
      subject: "密度テスト",
      issuerType: "self",
      issuedBy: "密度テスト",
      enteredBy: "密度テスト",
      approvedBy: null,
      keepers: [],
      viewers: [],
      count: recordCount,
      title: `密度玉 ${index}`,
      category: "日常",
      note: "",
      visibility: "open",
      visual: {
        hue: (index * 37) % 360,
        saturation: 68,
        lightness: 58,
        label: "日常",
        kind: index % 9 === 0 ? "ring" : "filled",
      },
      lifecycleStatus: "active",
      emotionEcho: seedEcho ? {
        recordedAt: now.toISOString(),
        date,
        subject: "echo source",
        issuerType: "self",
        count: 1,
        title: `echo ${index}`,
        category: "echo",
        note: "",
        visibility: "open",
        visual: {
          hue: (index * 37 + 42) % 360,
          saturation: 62,
          lightness: 54,
          label: "echo",
          kind: index % 9 === 0 ? "ring" : "filled",
        },
      } : undefined,
      createdAt: new Date(now.getTime() + index).toISOString(),
      updatedAt: now.toISOString(),
    }));
    localStorage.setItem("happyBall.ledger.v1", JSON.stringify({
      v: 1,
      type: "happy-ball-ledger",
      ledgerId: "ledger_density_test",
      ownerProfile: { name: "密度テスト", nameBook: [] },
      balls,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }));
    if (seedEcho) {
      localStorage.setItem("happyBall.settings.v2", JSON.stringify({ emotionEchoStrength: "medium" }));
    }
  }, { ballCount: count, seedEcho: withEcho, recordCount: instancesPerRecord });
}

async function clickAndMeasure(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((element: HTMLElement) => {
    const startedAt = performance.now();
    element.click();
    return performance.now() - startedAt;
  });
}
