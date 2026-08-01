import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await seedSieveBalls(page);
  await page.goto("/");
  await expect(page.locator("#ball-field")).toHaveAttribute("data-visual-ball-count", "3");
});

test("ふるい分け follows Play, Calendar, and Ball List and resets after reload", async ({ page }) => {
  const storedBeforeSieve = await readLedgerSnapshot(page);
  await openSieve(page);
  await expect(page.locator("[data-ball-sieve-popover]:visible")).toBeVisible();
  await page.locator('[data-ball-sieve-popover]:visible [data-ball-sieve-preset="offered"]').click();

  await expectSievePreset(page, "供養済み", true);
  await expect(playSieveStatus(page)).toHaveText("ふるい分け：供養済み");
  await expect(page.locator("#ball-field")).toHaveAttribute("data-visual-ball-count", "2");
  expect(await readLedgerSnapshot(page)).toEqual(storedBeforeSieve);

  await page.locator("[data-open-panel='calendar']").click();
  await expectSievePreset(page, "供養済み", true);
  await expect(calendarSieveStatus(page)).toHaveText("ふるい分け：供養済み");
  await expectCalendarStatusStackNotToOverlap(page);
  await expectAdjacentFunctionButton(page, "[data-calendar-cycle-marker-mode]");
  await expect(page.locator(".calendar-cell.is-today")).toHaveAttribute("aria-label", /2玉/);

  await openSieve(page);
  await expect(page.locator("[data-calendar-marker-state]")).toBeHidden();
  await expect(page.locator(".calendar-ball-sieve-status-layer [data-ball-sieve-status]")).toBeHidden();
  await page.keyboard.press("Escape");

  await page.locator("[data-calendar-open-panel='dayList']").click();
  await expectSievePreset(page, "供養済み", true);
  await expect(calendarSieveStatus(page)).toHaveText("ふるい分け：供養済み");
  await expect(page.locator(".calendar-day-ball-item")).toHaveCount(2);
  await expect(page.locator(".calendar-day-ball-item.lifecycle-offered")).toHaveCount(2);
  await expect(page.locator('[data-lifecycle-action="restore"]')).toHaveCount(2);

  await openSieve(page);
  await page.locator('[data-ball-sieve-popover]:visible [data-ball-sieve-preset="descent"]').click();
  await expect(calendarSieveStatus(page)).toHaveText("ふるい分け：降臨");
  await expect(page.locator(".calendar-day-ball-item")).toHaveCount(2);
  await expect(page.locator(".calendar-day-ball-item.lifecycle-active")).toHaveCount(1);
  await expect(page.locator(".calendar-day-ball-item.lifecycle-offered")).toHaveCount(1);

  await page.locator("[data-calendar-main]").click();
  await expectSievePreset(page, "降臨", true);
  await expect(playSieveStatus(page)).toHaveText("ふるい分け：降臨");
  await expect(page.locator("#ball-field")).toHaveAttribute("data-visual-ball-count", "2");

  await page.reload();
  await expectSievePreset(page, "いつもの玉", false);
  await expect(playSieveStatus(page)).toHaveCount(0);
  await expect(page.locator("#ball-field")).toHaveAttribute("data-visual-ball-count", "3");

  await installEmptyReceivedWorkspace(page);
  await page.reload();
  await openSieve(page);
  await page.locator('[data-ball-sieve-popover]:visible [data-ball-sieve-preset="offered"]').click();
  await expect(page.locator("#ball-field")).toHaveAttribute("data-visual-ball-count", "2");
  await page.locator(".stage-topline [data-cycle-workspace]").click();
  await expectSievePreset(page, "供養済み", true);
  await expect(page.locator("#ball-field")).toHaveAttribute("data-visual-ball-count", "0");
  await expect(page.locator("#stage-title")).toContainText("供養済みの玉は、今はありません");
});

test("供養済みを戻すと呼び出した景色から離れ、保存状態だけが更新される", async ({ page }) => {
  await openSieve(page);
  await page.locator('[data-ball-sieve-popover]:visible [data-ball-sieve-preset="offered"]').click();
  await page.locator("[data-open-calendar-day-list]").click();

  const target = page.locator(".calendar-day-ball-item", { hasText: "供養した手紙" });
  await target.locator('[data-lifecycle-action="restore"]').click();
  await expect(page.locator(".calendar-day-ball-item")).toHaveCount(1);
  await expect(calendarSieveStatus(page, "feedback")).toContainText("いつもの玉へ戻しました");

  const restored = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("happyBall.workspaces.v1") ?? "{}");
    const self = store.workspaces?.find((workspace: any) => workspace.role === "self");
    return self?.ledger?.balls?.find((ball: any) => ball.id === "sieve_offered_plain");
  });
  expect(restored.lifecycleStatus).toBe("active");
  expect(restored.title).toBe("供養した手紙");
  expect(restored.count).toBe(1);

  await page.locator("[data-calendar-main]").click();
  await expectSievePreset(page, "供養済み", true);
  await expect(page.locator("#ball-field")).toHaveAttribute("data-visual-ball-count", "1");
  await expect(playSieveStatus(page, "feedback")).toContainText("いつもの玉へ戻しました");
  await page.waitForTimeout(2700);
  await expect(playSieveStatus(page, "selection")).toHaveText("ふるい分け：供養済み");
});

test("ふるいボタンとポップオーバーはphone・iPad・desktopで正しく配置される", async ({ page }) => {
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await expectExistingDockButtonStyling(page);
    await expectSieveMatchesJutsuButton(page);
    await openSieve(page);
    const popover = page.locator("[data-ball-sieve-popover]:visible");
    const box = await popover.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    const options = popover.locator(".ball-sieve-option");
    await expect(options).toHaveCount(4);
    await expect(popover.locator(".ball-sieve-option-visual")).toHaveCount(4);
    const firstOptionBox = await options.first().boundingBox();
    expect(firstOptionBox).not.toBeNull();
    expect(firstOptionBox!.width).toBeGreaterThan(100);
    expect(firstOptionBox!.height).toBeGreaterThanOrEqual(50);
    const backdropBox = await page.locator("[data-close-ball-sieve]:visible").boundingBox();
    expect(backdropBox).not.toBeNull();
    expect(backdropBox!.x).toBe(0);
    expect(backdropBox!.y).toBe(0);
    expect(backdropBox!.width).toBe(viewport.width);
    expect(backdropBox!.height).toBe(viewport.height);
    const primaryGroupBox = await page.locator(".primary-screen-control-group:visible").boundingBox();
    const triggerBox = await activeSieveTrigger(page).boundingBox();
    expect(primaryGroupBox).not.toBeNull();
    expect(triggerBox).not.toBeNull();
    expect(triggerBox!.x).toBeGreaterThanOrEqual(primaryGroupBox!.x + primaryGroupBox!.width);
    expect(await activeSieveTrigger(page).evaluate((button) => button.closest(".primary-screen-control-group"))).toBeNull();
    await page.keyboard.press("Escape");
    await expect(activeSieveTrigger(page)).toBeFocused();
    await page.locator("[data-open-panel='calendar']").click();
    await expectAdjacentFunctionButton(page, "[data-calendar-cycle-marker-mode]");
    const calendarDockBox = await page.locator(".calendar-control-dock .world-actions").boundingBox();
    expect(calendarDockBox).not.toBeNull();
    expect(calendarDockBox!.x).toBeGreaterThanOrEqual(0);
    expect(calendarDockBox!.x + calendarDockBox!.width).toBeLessThanOrEqual(viewport.width);
    await page.locator("[data-calendar-main]").click();
  }
});

async function expectExistingDockButtonStyling(page: Page): Promise<void> {
  const styling = await page.evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)!;
      const style = getComputedStyle(element);
      return {
        width: element.getBoundingClientRect().width,
        borderWidth: style.borderTopWidth,
        borderRadius: style.borderTopLeftRadius,
        backgroundImage: style.backgroundImage,
      };
    };
    return {
      create: read(".dock-create-button"),
      primary: read(".primary-screen-control-group button"),
      settings: read(".dock-settings-button"),
    };
  });
  expect(styling.create.width).toBe(54);
  expect(styling.create.borderWidth).toBe("0px");
  expect(styling.create.borderRadius).toBe("0px");
  expect(styling.create.backgroundImage).toBe("none");
  expect(styling.primary.width).toBeGreaterThanOrEqual(48);
  expect(styling.primary.borderWidth).toBe("0px");
  expect(styling.settings.borderWidth).toBe("0px");
  expect(styling.settings.borderRadius).toBe("0px");
  expect(styling.settings.backgroundImage).toBe("none");
}

async function expectSieveMatchesJutsuButton(page: Page): Promise<void> {
  const styles = await page.evaluate(() => {
    const sieve = document.querySelector<HTMLElement>("[data-toggle-ball-sieve]")!;
    const icon = sieve.querySelector<HTMLElement>(".ball-sieve-trigger-icon")!;
    const jutsu = document.querySelector<HTMLElement>("[data-toggle-play-modes]")!;
    const sieveStyle = getComputedStyle(sieve);
    const jutsuStyle = getComputedStyle(jutsu);
    const sieveBox = sieve.getBoundingClientRect();
    const jutsuBox = jutsu.getBoundingClientRect();
    return {
      inFunctionGroup: sieve.closest(".control-bar-functions") !== null,
      gap: jutsuBox.left - sieveBox.right,
      sieve: {
        width: sieveBox.width,
        height: sieveBox.height,
        backgroundImage: sieveStyle.backgroundImage,
        borderColor: sieveStyle.borderTopColor,
        boxShadow: sieveStyle.boxShadow,
        color: sieveStyle.color,
      },
      jutsu: {
        width: jutsuBox.width,
        height: jutsuBox.height,
        backgroundImage: jutsuStyle.backgroundImage,
        borderColor: jutsuStyle.borderTopColor,
        boxShadow: jutsuStyle.boxShadow,
        color: jutsuStyle.color,
      },
      iconColor: getComputedStyle(icon).color,
    };
  });
  expect(styles.inFunctionGroup).toBe(true);
  expect(styles.gap).toBeGreaterThanOrEqual(0);
  expect(styles.gap).toBeLessThanOrEqual(4.1);
  expect(styles.sieve).toEqual(styles.jutsu);
  expect(styles.iconColor).toBe(styles.jutsu.color);
}

async function expectAdjacentFunctionButton(page: Page, functionSelector: string): Promise<void> {
  const sieveBox = await activeSieveTrigger(page).boundingBox();
  const functionBox = await page.locator(`${functionSelector}:visible`).boundingBox();
  expect(sieveBox).not.toBeNull();
  expect(functionBox).not.toBeNull();
  expect(functionBox!.x - (sieveBox!.x + sieveBox!.width)).toBeGreaterThanOrEqual(0);
  expect(functionBox!.x - (sieveBox!.x + sieveBox!.width)).toBeLessThanOrEqual(4.1);
}

test("ふるい状態と一時完了文言はツールバーと物理フィールドの寸法を変えない", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.locator(".pixi-ball-canvas")).toBeVisible();
  const baseline = await readPlayGeometry(page);

  await openSieve(page);
  await page.locator('[data-ball-sieve-popover]:visible [data-ball-sieve-preset="offered"]').click();
  await expect(playSieveStatus(page)).toHaveText("ふるい分け：供養済み");
  expect(await readPlayGeometry(page)).toEqual(baseline);

  await page.locator("[data-open-calendar-day-list]").click();
  const calendarBeforeFeedback = await readCalendarGeometry(page);
  await page.locator(".calendar-day-ball-item", { hasText: "供養した手紙" }).locator('[data-lifecycle-action="restore"]').click();
  await expect(calendarSieveStatus(page, "feedback")).toContainText("いつもの玉へ戻しました");
  expect(await readCalendarGeometry(page)).toEqual(calendarBeforeFeedback);

  await page.locator("[data-calendar-main]").click();
  expect(await readPlayGeometry(page)).toEqual(baseline);
  await expectParentInsideField(page);
  await page.waitForTimeout(2700);
  expect(await readPlayGeometry(page)).toEqual(baseline);
  await expect(playSieveStatus(page, "selection")).toHaveText("ふるい分け：供養済み");
});

function activeSieveTrigger(page: Page) {
  return page.locator("[data-toggle-ball-sieve]:visible");
}

function playSieveStatus(page: Page, kind?: "feedback" | "selection") {
  const suffix = kind ? `[data-ball-sieve-status-kind="${kind}"]` : "[data-ball-sieve-status]";
  return page.locator(`.play-ball-sieve-status-layer ${suffix}:visible`);
}

function calendarSieveStatus(page: Page, kind?: "feedback" | "selection") {
  const suffix = kind ? `[data-ball-sieve-status-kind="${kind}"]` : "[data-ball-sieve-status]";
  return page.locator(`.calendar-ball-sieve-status-layer ${suffix}:visible`);
}

async function expectSievePreset(page: Page, label: string, pressed: boolean): Promise<void> {
  await expect(activeSieveTrigger(page)).toHaveAttribute("aria-label", `ふるい分け：${label}`);
  await expect(activeSieveTrigger(page)).toHaveAttribute("aria-pressed", String(pressed));
  if (pressed) {
    await expect(activeSieveTrigger(page)).toHaveClass(/is-active/);
    await expect(activeSieveTrigger(page)).toHaveClass(/is-on/);
  } else {
    await expect(activeSieveTrigger(page)).not.toHaveClass(/is-active/);
    await expect(activeSieveTrigger(page)).not.toHaveClass(/is-on/);
  }
}

async function expectCalendarStatusStackNotToOverlap(page: Page): Promise<void> {
  const markerBox = await page.locator("[data-calendar-marker-state]:visible").boundingBox();
  const sieveBox = await calendarSieveStatus(page).boundingBox();
  const overlayBox = await page.locator(".calendar-overlay").boundingBox();
  const headerBox = await page.locator("[data-calendar-primary-header]").boundingBox();
  const bodyBox = await page.locator("[data-calendar-primary-body]").boundingBox();
  const dockBox = await page.locator(".calendar-control-dock").boundingBox();
  const gridColumns = await page.locator(".calendar-overlay").evaluate((overlay) => getComputedStyle(overlay).gridTemplateColumns);
  expect(markerBox).not.toBeNull();
  expect(sieveBox).not.toBeNull();
  expect(overlayBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(bodyBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  expect(gridColumns.trim().split(/\s+/)).toHaveLength(1);
  expect(headerBox!.width).toBeGreaterThan(overlayBox!.width * 0.9);
  expect(bodyBox!.width).toBeGreaterThan(overlayBox!.width * 0.9);
  expect(dockBox!.width).toBeGreaterThan(overlayBox!.width * 0.95);
  expect(sieveBox!.y).toBeGreaterThanOrEqual(markerBox!.y + markerBox!.height);
  expect(sieveBox!.y + sieveBox!.height).toBeLessThanOrEqual(bodyBox!.y + bodyBox!.height);
  expect(sieveBox!.y + sieveBox!.height).toBeGreaterThan(bodyBox!.y + bodyBox!.height - 100);
}

async function readPlayGeometry(page: Page) {
  return page.evaluate(() => {
    const field = document.querySelector<HTMLElement>("#ball-field")!;
    const world = document.querySelector<HTMLElement>(".play-world-region")!.getBoundingClientRect();
    const controls = document.querySelector<HTMLElement>(".play-control-region")!.getBoundingClientRect();
    const canvas = document.querySelector<HTMLElement>(".pixi-ball-canvas")!;
    return {
      world: { top: world.top, bottom: world.bottom, height: world.height },
      field: { top: field.offsetTop, height: field.offsetHeight },
      controls: { top: controls.top, bottom: controls.bottom, height: controls.height },
      canvas: { top: canvas.offsetTop, height: canvas.offsetHeight },
      seam: controls.top - world.bottom,
    };
  });
}

async function readCalendarGeometry(page: Page) {
  return page.evaluate(() => {
    const controls = document.querySelector<HTMLElement>(".calendar-control-dock")!.getBoundingClientRect();
    return {
      controls: { top: controls.top, bottom: controls.bottom, height: controls.height },
    };
  });
}

async function expectParentInsideField(page: Page): Promise<void> {
  const field = page.locator("#ball-field");
  await page.locator("[data-toggle-play-modes]").click();
  await page.locator("[data-play-mode-disclosure='parent'] summary").click();
  await page.locator("[data-play-parent-enabled='true']").click();
  await page.locator("[data-toggle-play-modes]").click();
  const box = await field.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  const actor = field.locator(".parent-ball-actor");
  await expect(actor).toHaveCount(1);
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 2, { steps: 8 });
  await expect.poll(async () => {
    const actorBox = await actor.boundingBox();
    return actorBox ? actorBox.y + actorBox.height <= box!.y + box!.height + 1 : false;
  }).toBe(true);
  await page.mouse.up();
}

async function openSieve(page: Page): Promise<void> {
  const trigger = activeSieveTrigger(page);
  if (await trigger.getAttribute("aria-expanded") !== "true") {
    await trigger.click();
  }
}

async function readLedgerSnapshot(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem("happyBall.workspaces.v1") ?? "");
}

async function seedSieveBalls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    const stamp = now.toISOString();
    const previousDay = new Date(now);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDate = [
      previousDay.getFullYear(),
      String(previousDay.getMonth() + 1).padStart(2, "0"),
      String(previousDay.getDate()).padStart(2, "0"),
    ].join("-");
    const makeBall = (id: string, title: string, lifecycleStatus: string, descents: any[] = []) => ({
      id,
      date,
      subject: "ふるい分けテスト",
      issuerType: "self",
      issuedBy: "ふるい分けテスト",
      enteredBy: "ふるい分けテスト",
      approvedBy: null,
      keepers: [],
      viewers: [],
      count: 1,
      title,
      category: "日常",
      note: "元の内容を維持",
      visibility: "open",
      visual: { hue: 42, saturation: 62, lightness: 58, kind: "filled", label: "ふる" },
      lifecycleStatus,
      descents,
      descentBadgeCount: descents.length,
      isKamiBall: false,
      createdAt: stamp,
      updatedAt: stamp,
    });
    const descent = (id: string, withGps: boolean) => ({
      id,
      sequence: 1,
      recordedAt: stamp,
      badgeAwarded: true,
      memo: withGps ? "GPSあり" : "GPSなし",
      ...(withGps ? { latitude: 35.6812, longitude: 139.7671 } : {}),
    });
    const balls = [
      makeBall("sieve_active_plain", "今日のいつもの玉", "active"),
      makeBall("sieve_archived_plain", "しまっている玉", "archived"),
      makeBall("sieve_offered_plain", "供養した手紙", "offered"),
      makeBall("sieve_active_descent", "GPSあり降臨", "active", [descent("descent_gps", true)]),
      makeBall("sieve_offered_descent", "GPSなし供養降臨", "offered", [descent("descent_no_gps", false)]),
      { ...makeBall("sieve_offered_previous", "昨日の供養済み", "offered"), date: previousDate },
    ];
    localStorage.setItem("happyBall.ledger.v1", JSON.stringify({
      v: 1,
      type: "happy-ball-ledger",
      ledgerId: "ledger_sieve_browser",
      ownerProfile: { name: "ふるい分けテスト", nameBook: [] },
      balls,
      createdAt: stamp,
      updatedAt: stamp,
    }));
    localStorage.setItem("happyBall.settings.v2", JSON.stringify({ startupScreen: "main" }));
  });
}

async function installEmptyReceivedWorkspace(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("happyBall.workspaces.v1") ?? "{}");
    const self = store.workspaces?.find((workspace: any) => workspace.role === "self");
    if (!self) {
      throw new Error("self workspace was not initialized");
    }
    store.workspaces = store.workspaces.filter((workspace: any) => workspace.workspaceId !== "workspace_sieve_received");
    store.workspaces.push({
      ...self,
      workspaceId: "workspace_sieve_received",
      sourceWorkspaceId: "workspace_sieve_received",
      role: "received",
      displayName: "思い出の庭",
      ledger: {
        ...self.ledger,
        ledgerId: "ledger_sieve_received",
        ownerProfile: { name: "思い出の庭", nameBook: [] },
        balls: [],
      },
      lastImportedAt: new Date().toISOString(),
    });
    store.activeWorkspaceId = self.workspaceId;
    localStorage.setItem("happyBall.workspaces.v1", JSON.stringify(store));
  });
}
