import { expect, test, type Locator, type Page } from "@playwright/test";

test("Tamawari stays device-only and reveals one physical instance without resizing it", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/?renderer=dom");
  await createBall(page, "🎂", "お宝\nお祝いのケーキ");
  await createBall(page, "石", "はずれ");
  await page.evaluate(() => {
    const ledger = JSON.parse(localStorage.getItem("happyBall.ledger.v1") ?? "{}");
    ledger.balls = ledger.balls.filter((ball: { title: string }) => ball.title === "🎂" || ball.title === "石");
    const treasure = ledger.balls.find((ball: { title: string }) => ball.title === "🎂");
    treasure.count = 2;
    treasure.emotionEcho = {
      recordedAt: treasure.updatedAt,
      date: treasure.date,
      time: treasure.time,
      subject: treasure.subject,
      issuerType: treasure.issuerType,
      count: 1,
      title: "以前の余韻",
      category: treasure.category,
      note: "",
      visibility: "open",
      visual: { ...treasure.visual, hue: 166, saturation: 48, lightness: 52 },
    };
    localStorage.setItem("happyBall.ledger.v1", JSON.stringify(ledger));
    const settings = JSON.parse(localStorage.getItem("happyBall.settings.v2") ?? "{}");
    settings.gravityEnabled = false;
    settings.linearDamping = 99;
    localStorage.setItem("happyBall.settings.v2", JSON.stringify(settings));
  });
  await page.reload();

  await page.locator("[data-calendar-open-panel='settings']").click();
  await page.locator(".tamawari-settings summary").click();
  await page.locator("#setting-tamawari-mode").click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("happyBall.devicePlayMode.v1"))).toBe("tamawari");
  const sharedSettings = await page.evaluate(() => JSON.parse(localStorage.getItem("happyBall.settings.v2") ?? "{}"));
  expect(sharedSettings.devicePlayMode).toBeUndefined();
  await page.locator(".dialog-close[data-close-panel]").click();
  await page.locator("[data-calendar-main]").click();

  const modeButton = page.locator("[data-toggle-play-modes]");
  await expect(modeButton).toHaveText("玉割");
  await expect(modeButton).not.toHaveClass(/is-on/);
  await expect(modeButton).toHaveAttribute("aria-pressed", "false");
  const readyModeBoxShadow = await modeButton.evaluate((element) => getComputedStyle(element).boxShadow);
  const treasureBefore = page.locator(".physics-ball[aria-label='🎂']").first();
  const missBefore = page.locator(".physics-ball[aria-label='石']");
  const treasureId = await treasureBefore.getAttribute("data-visual-ball-id");
  const missId = await missBefore.getAttribute("data-visual-ball-id");
  expect(treasureId).toBeTruthy();
  expect(missId).toBeTruthy();
  const positionIds = [treasureId!, missId!];
  await waitForBallPositionsToSettle(page, positionIds);
  const positionsBeforeStart = await readBallPositions(page, positionIds);
  await expect(treasureBefore).toHaveClass(/has-echo/);
  const sizeBefore = await treasureBefore.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  const treasureBackgroundBefore = await treasureBefore.locator(".ball-body").evaluate((element) => getComputedStyle(element).backgroundImage);

  await modeButton.click();
  await expect(page.locator(".tamawari-treasure-example", { hasText: "🎂" })).toBeVisible();
  await expect(page.locator(".tamawari-target-count")).toContainText("対象 3 個");
  await page.locator("[data-start-tamawari]").click();

  const field = page.locator("#ball-field");
  await expect(field).toHaveAttribute("data-runtime-physics-profile", "tamawari");
  await expect(field).toHaveAttribute("data-runtime-linear-damping", "100");
  await expect(modeButton).toHaveClass(/is-on/);
  await expect(modeButton).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => modeButton.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(readyModeBoxShadow);
  await expect(page.locator(".physics-ball[aria-label='伏せた玉']")).toHaveCount(3);
  await expect(page.locator("[data-open-panel='create']")).toBeDisabled();
  const storedPlayingSettings = await page.evaluate(() => JSON.parse(localStorage.getItem("happyBall.settings.v2") ?? "{}"));
  expect(storedPlayingSettings.linearDamping).not.toBe(100);

  const treasure = page.locator(`[data-visual-ball-id='${treasureId}']`);
  const positionsAfterStart = await readBallPositions(page, positionIds);
  expectBallPositionsClose(positionsAfterStart, positionsBeforeStart, 4, "starting Tamawari should preserve current positions");
  const sizePlaying = await treasure.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  expect(sizePlaying).toEqual(sizeBefore);
  await tapBall(treasure);
  await expect(treasure).toHaveClass(/tamawari-treasure/);
  await expect(treasure).toHaveClass(/has-tamawari-result-aura/);
  await expect(treasure).not.toHaveClass(/has-echo/);
  await expect(treasure).toHaveAttribute("aria-label", "🎂");
  await expect(treasure.locator(".ball-label")).toHaveText("🎂");
  const openedSize = await treasure.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  expect(openedSize).toEqual(sizeBefore);
  const treasureFilter = await treasure.evaluate((element) => getComputedStyle(element).filter);
  expect(treasureFilter).not.toContain("brightness");
  expect(treasureFilter).not.toContain("saturate");
  await expect.poll(() => treasure.locator(".ball-body").evaluate((element) => getComputedStyle(element).backgroundImage)).toBe(treasureBackgroundBefore);

  await tapBall(treasure);
  await expect(treasure).not.toHaveClass(/is-tamawari-open/);
  await expect(treasure).toHaveClass(/has-echo/);
  await expect(treasure).not.toHaveClass(/has-tamawari-result-aura/);
  await dragBall(treasure);
  await expect(treasure).not.toHaveClass(/is-tamawari-open/);

  const miss = page.locator(`[data-visual-ball-id='${missId}']`);
  await tapBall(miss);
  await expect(miss).toHaveClass(/tamawari-miss/);
  await expect(miss).not.toHaveClass(/has-echo|has-tamawari-result-aura/);
  await expect(miss).toHaveClass(/label-single-grapheme/);
  const missFilter = await miss.evaluate((element) => getComputedStyle(element).filter);
  expect(missFilter).not.toContain("brightness");
  expect(missFilter).not.toContain("saturate");
  await miss.evaluate((element) => { element.setAttribute("data-reset-identity", "same-instance"); });
  await modeButton.click();
  await expect(modeButton).toHaveClass(/is-on/);
  await expect(modeButton).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-reset-tamawari]").click();
  await expect(page.locator(".is-tamawari-open")).toHaveCount(0);
  await expect(miss).toHaveAttribute("data-reset-identity", "same-instance");
  await expect(treasure).toHaveClass(/has-echo/);
  await waitForBallPositionsToSettle(page, positionIds);
  const positionsBeforeEnd = await readBallPositions(page, positionIds);
  await page.locator("[data-end-tamawari]").click();
  await expect(field).toHaveAttribute("data-runtime-physics-profile", "normal");
  await expect(field).not.toHaveAttribute("data-runtime-linear-damping", "100");
  await expect(modeButton).not.toHaveClass(/is-on/);
  await expect(modeButton).toHaveAttribute("aria-pressed", "false");
  const positionsAfterEnd = await readBallPositions(page, positionIds);
  expectBallPositionsClose(positionsAfterEnd, positionsBeforeEnd, 4, "ending Tamawari should preserve current positions");
  await expect(page.locator("[data-open-panel='create']")).toBeEnabled();

  await page.reload();
  await page.locator("[data-calendar-main]").click();
  await expect(page.locator("[data-toggle-play-modes]")).toHaveText("玉割");
  await page.locator("[data-toggle-play-modes]").click();
  await expect(page.locator("[data-start-tamawari]")).toBeVisible();
});

test("Pixi temporarily replaces stored echo with the treasure result aura", async ({ page }) => {
  await page.goto("/");
  await createBall(page, "宝", "たから\nPixi光芒確認");
  await page.evaluate(() => {
    const ledger = JSON.parse(localStorage.getItem("happyBall.ledger.v1") ?? "{}");
    ledger.balls = ledger.balls.filter((ball: { title: string }) => ball.title === "宝");
    const treasure = ledger.balls[0];
    treasure.count = 1;
    treasure.emotionEcho = {
      recordedAt: treasure.updatedAt,
      date: treasure.date,
      time: treasure.time,
      subject: treasure.subject,
      issuerType: treasure.issuerType,
      count: 1,
      title: "元の余韻",
      category: treasure.category,
      note: "",
      visibility: "open",
      visual: { ...treasure.visual, hue: 166, saturation: 48, lightness: 52 },
    };
    localStorage.setItem("happyBall.ledger.v1", JSON.stringify(ledger));
    const settings = JSON.parse(localStorage.getItem("happyBall.settings.v2") ?? "{}");
    settings.linearDamping = 100;
    settings.emotionEchoStrength = "strong";
    localStorage.setItem("happyBall.settings.v2", JSON.stringify(settings));
    localStorage.setItem("happyBall.devicePlayMode.v1", "tamawari");
  });
  await page.reload();
  await page.locator("[data-calendar-main]").click();
  const field = page.locator("#ball-field");
  await expect(field).toHaveAttribute("data-ball-renderer", "pixi");
  const canvas = field.locator("canvas.pixi-ball-canvas");
  await expect(canvas).toHaveAttribute("data-visible-echo-count", "1");
  const diameterBefore = await field.getAttribute("data-ball-diameter");

  await page.locator("[data-toggle-play-modes]").click();
  await page.locator("[data-start-tamawari]").click();
  await tapPixiCenterBall(field, canvas);
  await expect(canvas).toHaveAttribute("data-visible-echo-count", "0");
  await expect(canvas).toHaveAttribute("data-visible-tamawari-aura-count", "1");
  await expect(canvas).toHaveAttribute("data-visible-ball-label-count", "1");
  await expect(field).toHaveAttribute("data-ball-diameter", diameterBefore ?? "");

  await tapPixiCenterBall(field, canvas);
  await expect(canvas).toHaveAttribute("data-visible-echo-count", "1");
  await expect(canvas).toHaveAttribute("data-visible-tamawari-aura-count", "0");
});

async function createBall(page: Page, title: string, note: string): Promise<void> {
  await page.locator("[data-calendar-open-panel='create']").click();
  const form = page.locator("#ball-form");
  await form.locator("input[name='title']").fill(title);
  await form.locator("textarea[name='note']").fill(note);
  await form.evaluate((element: HTMLFormElement) => element.requestSubmit());
}

async function tapBall(ball: Locator): Promise<void> {
  const box = await ball.boundingBox();
  expect(box).not.toBeNull();
  const point = { clientX: box!.x + box!.width / 2, clientY: box!.y + box!.height / 2 };
  await ball.dispatchEvent("pointerdown", { ...point, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1 });
  await ball.dispatchEvent("pointerup", { ...point, pointerId: 1, pointerType: "mouse", button: 0, buttons: 0 });
}

async function dragBall(ball: Locator): Promise<void> {
  const box = await ball.boundingBox();
  expect(box).not.toBeNull();
  const start = { clientX: box!.x + box!.width / 2, clientY: box!.y + box!.height / 2 };
  const end = { clientX: start.clientX + 45, clientY: start.clientY + 20 };
  await ball.dispatchEvent("pointerdown", { ...start, pointerId: 2, pointerType: "mouse", button: 0, buttons: 1 });
  await ball.dispatchEvent("pointermove", { ...end, pointerId: 2, pointerType: "mouse", button: 0, buttons: 1 });
  await ball.dispatchEvent("pointerup", { ...end, pointerId: 2, pointerType: "mouse", button: 0, buttons: 0 });
}

async function tapPixiCenterBall(field: Locator, canvas: Locator): Promise<void> {
  const box = await field.boundingBox();
  expect(box).not.toBeNull();
  const point = { clientX: box!.x + box!.width / 2, clientY: box!.y + 80 };
  await canvas.dispatchEvent("pointerdown", { ...point, pointerId: 3, pointerType: "mouse", button: 0, buttons: 1 });
  await canvas.dispatchEvent("pointerup", { ...point, pointerId: 3, pointerType: "mouse", button: 0, buttons: 0 });
}

interface BallPosition {
  x: number;
  y: number;
}

async function readBallPositions(page: Page, ids: readonly string[]): Promise<Record<string, BallPosition>> {
  const positions: Record<string, BallPosition> = {};
  for (const id of ids) {
    const box = await page.locator(`[data-visual-ball-id='${id}']`).boundingBox();
    expect(box).not.toBeNull();
    positions[id] = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  }
  return positions;
}

async function waitForBallPositionsToSettle(page: Page, ids: readonly string[]): Promise<void> {
  let previous: Record<string, BallPosition> | null = null;
  await expect.poll(async () => {
    const current = await readBallPositions(page, ids);
    if (!previous) {
      previous = current;
      return Number.POSITIVE_INFINITY;
    }
    const distance = maxBallPositionDistance(current, previous, ids);
    previous = current;
    return distance;
  }, { timeout: 5_000, intervals: [100, 100, 150, 200] }).toBeLessThan(0.5);
}

function expectBallPositionsClose(
  actual: Record<string, BallPosition>,
  expected: Record<string, BallPosition>,
  tolerance: number,
  message: string,
): void {
  expect(maxBallPositionDistance(actual, expected, Object.keys(expected)), message).toBeLessThanOrEqual(tolerance);
}

function maxBallPositionDistance(
  actual: Record<string, BallPosition>,
  expected: Record<string, BallPosition>,
  ids: readonly string[],
): number {
  return Math.max(...ids.map((id) => Math.hypot(actual[id]!.x - expected[id]!.x, actual[id]!.y - expected[id]!.y)));
}
