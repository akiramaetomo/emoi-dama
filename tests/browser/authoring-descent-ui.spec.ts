import { expect, test, type Page } from "@playwright/test";

test("create header submits while the memo remains focused on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();

  await page.locator("[data-calendar-open-panel='create']").click();
  const form = page.locator("#ball-form");
  await form.locator("input[name='title']").fill("上部から置いた玉");
  const memo = form.locator("textarea[name='note']");
  await memo.fill("IMEを閉じずに上部から確定");
  await memo.focus();
  await expect(memo).toBeFocused();
  await expect(page.locator(".floating-panel-create .panel-header-action")).toHaveText("玉を置く");

  await page.locator(".floating-panel-create .panel-header-action").click();
  await expect(page.locator("#ball-form")).toHaveCount(0);
  await expect.poll(() => readFirstStoredBall(page)).toMatchObject({
    title: "上部から置いた玉",
    note: "IMEを閉じずに上部から確定",
  });
});

test("descent deletion stays staged, blocks a new descent, cancels safely, then saves", async ({ page }) => {
  await page.goto("/");
  await createBall(page, "消去確認の玉");
  await seedTwoDescents(page);
  await page.reload();
  await openFirstBallEdit(page);

  await expect(page.locator("[data-descent-edit-item]")).toHaveCount(2);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('[data-descent-delete-record-id="descent_2"]').click();
  await expect(page.locator("[data-descent-edit-item]")).toHaveCount(1);
  await expect(page.locator("[data-edit-descent-feedback]")).toContainText("保存で確定します");

  await page.locator(".edit-descent-head .descend-ball").click();
  await expect(page.locator("[data-edit-descent-feedback]")).toHaveText("消去を保存してから降臨してください");

  await page.locator(".ball-edit-dialog .authoring-surface-header [data-dialog-close]").click();
  await expect(page.locator("[data-edit-unsaved-confirm]")).toBeVisible();
  await page.locator("[data-edit-discard-close]").click();
  await openFirstBallEdit(page);
  await expect(page.locator("[data-descent-edit-item]")).toHaveCount(2);

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('[data-descent-delete-record-id="descent_2"]').click();
  await page.locator('#ball-edit-form button[type="submit"]').click();
  await expect(page.locator("[data-edit-unsaved-confirm]")).toBeVisible();
  await page.locator("[data-edit-save-correction]").click();

  await expect(page.locator(".ball-detail-dialog")).toBeVisible();
  await expect(page.locator(".detail-descent-item")).toHaveCount(1);
  await expect(page.locator(".detail-descent-item")).toContainText("No.1");
  await expect(page.locator(".detail-descent-item")).not.toContainText("No.2");
  await expect.poll(() => readFirstStoredBall(page)).toMatchObject({
    descentBadgeCount: 1,
    isKamiBall: false,
  });
  await expect.poll(async () => (await readFirstStoredBall(page)).descents).toHaveLength(1);
  await expect.poll(() => readLatestActivityAction(page)).toBe("descent-delete");
});

test("a descent created in edit refreshes the underlying list before the modal closes", async ({ page }) => {
  await page.addInitScript(() => {
    const denied = { code: 1, message: "denied in test" };
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => error(denied as GeolocationPositionError),
        watchPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
          error(denied as GeolocationPositionError);
          return 1;
        },
        clearWatch: () => undefined,
      },
    });
  });
  await page.goto("/");
  await createBall(page, "星更新の玉");
  await openFirstBallEdit(page);
  await expect(page.locator(".edit-descent-empty")).toHaveText("降臨なし");

  page.on("dialog", (dialog) => dialog.accept(""));
  await page.locator(".edit-descent-head .descend-ball").click();
  await expect(page.locator("[data-descent-edit-item]")).toHaveCount(1);
  await expect(page.locator("[data-edit-descent-feedback]")).toContainText("仮降臨を記録しました");

  await page.locator(".ball-edit-dialog .authoring-surface-header [data-dialog-close]").click();
  await expect(page.locator(".ball-edit-dialog")).toHaveCount(0);
  await expect(page.locator(".calendar-day-descent-badge")).toHaveText("✦1");
});

async function createBall(page: Page, title: string): Promise<void> {
  await page.locator("[data-calendar-open-panel='create']").click();
  const form = page.locator("#ball-form");
  await form.locator("input[name='title']").fill(title);
  await form.evaluate((element: HTMLFormElement) => element.requestSubmit());
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
}

async function openFirstBallEdit(page: Page): Promise<void> {
  await page.locator("[data-calendar-open-panel='dayList']").click();
  await page.locator("[data-edit-ball-id]").first().click();
  await expect(page.locator(".ball-edit-dialog")).toBeVisible();
}

async function seedTwoDescents(page: Page): Promise<void> {
  await page.evaluate(() => {
    const stored = localStorage.getItem("happyBall.ledger.v1");
    if (!stored) {
      throw new Error("created ledger is missing");
    }
    const ledger = JSON.parse(stored);
    const ball = ledger.balls[0];
    ball.descents = [
      {
        id: "descent_1",
        sequence: 1,
        recordedAt: "2026-07-15T08:00:00.000Z",
        latitude: 35.681236,
        longitude: 139.767125,
        accuracyMeters: 12,
        badgeAwarded: true,
        memo: "GPSあり",
      },
      {
        id: "descent_2",
        sequence: 2,
        recordedAt: "2026-07-15T09:00:00.000Z",
        badgeAwarded: true,
        memo: "GPSなし",
      },
    ];
    ball.descentBadgeCount = 2;
    ball.isKamiBall = false;
    localStorage.setItem("happyBall.ledger.v1", JSON.stringify(ledger));
  });
}

async function readFirstStoredBall(page: Page): Promise<Record<string, any>> {
  return page.evaluate(() => {
    const stored = localStorage.getItem("happyBall.ledger.v1");
    return stored ? JSON.parse(stored).balls[0] : {};
  });
}

async function readLatestActivityAction(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const stored = localStorage.getItem("happyBall.activityLog.v1");
    return stored ? JSON.parse(stored).entries[0]?.action ?? null : null;
  });
}
