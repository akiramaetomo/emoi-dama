import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true });

const detailTitle = "春風に託した大切な玉";
const longMemo = "長いメモでも枠の高さが内容に合わせて伸び、文字だけが外へはみ出さないことを確認します。".repeat(4);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
});

test("ball detail fills portrait and touch-landscape phone viewports", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await createBallAndOpenDetail(page);

  for (const viewport of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expectPhoneDetailLayout(page, viewport);
  }
});

test("ball detail keeps the existing iPad and desktop dialog geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await createBallAndOpenDetail(page);

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    const metrics = await readDetailMetrics(page);
    expect(metrics.dialog.width).toBeCloseTo(520, 0);
    expect(metrics.dialog.x).toBeGreaterThan(0);
    expect(metrics.dialog.y).toBeGreaterThan(0);
    expect(metrics.dialog.borderRadius).toBe("8px");
    expect(metrics.dialog.paddingLeft).toBe("20px");
    expect(metrics.header.controlsRowDelta).toBeLessThanOrEqual(4);
    expect(metrics.header.titleRowDelta).toBeLessThanOrEqual(4);
    expect(metrics.header.closeWidth).toBeCloseTo(48, 0);
    expect(metrics.header.closeRightInset).toBeCloseTo(21, 0);
    expect(metrics.ball.width).toBeCloseTo(82, 0);
    expect(metrics.ball.height).toBeCloseTo(82, 0);
    expect(metrics.ball.stackWidth).toBeCloseTo(98, 0);
    expect(metrics.ball.leftSpace).toBeGreaterThanOrEqual(15.5);
    expect(metrics.ball.topSpace).toBeGreaterThanOrEqual(17.5);
    expect(metrics.ball.echoFilter).toContain("blur(19px)");
    expect(metrics.badge.text).toBe("✦12");
    expect(metrics.badge.fontSize).toBe("13.44px");
    expect(metrics.badge.leftSpace).toBeGreaterThanOrEqual(7.5);
    expect(metrics.badge.topSpace).toBeGreaterThanOrEqual(7.5);
    expect(metrics.badge.rightOverflow).toBeLessThanOrEqual(0);
    expect(metrics.count.fontSize).toBe("16px");
    expect(metrics.feeling.rowGap).toBeCloseTo(2, 0);
  }
});

test.describe("fine-pointer desktop", () => {
  test.use({ hasTouch: false });

  test("a short landscape desktop window is not treated as a phone", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await createBallAndOpenDetail(page);
    const metrics = await readDetailMetrics(page);
    expect(metrics.pointerCoarse).toBe(false);
    expect(metrics.dialog.width).toBeCloseTo(520, 0);
    expect(metrics.dialog.x).toBeGreaterThan(0);
    expect(metrics.dialog.borderRadius).toBe("8px");
    expect(metrics.ball.stackWidth).toBeCloseTo(98, 0);
    expect(metrics.badge.leftSpace).toBeGreaterThanOrEqual(7.5);
    expect(metrics.badge.topSpace).toBeGreaterThanOrEqual(7.5);
    expect(metrics.feeling.rowGap).toBeCloseTo(2, 0);
  });
});

async function createBallAndOpenDetail(page: Page): Promise<void> {
  await page.locator("[data-calendar-open-panel='create']").click();
  const form = page.locator("#ball-form");
  await form.locator("input[name='title']").fill(detailTitle);
  await form.locator("textarea[name='note']").fill(longMemo);
  await form.evaluate((element: HTMLFormElement) => element.requestSubmit());
  await page.evaluate(() => {
    const storedLedger = localStorage.getItem("happyBall.ledger.v1");
    if (!storedLedger) {
      throw new Error("created ledger is missing");
    }
    const ledger = JSON.parse(storedLedger);
    const ball = ledger.balls[0];
    ball.count = 5;
    ball.descentBadgeCount = 12;
    ball.emotionEcho = {
      recordedAt: ball.updatedAt,
      date: ball.date,
      time: ball.time,
      subject: ball.subject,
      issuerType: ball.issuerType,
      count: ball.count,
      title: "ひとつ前の気持ち",
      category: "余韻",
      note: "",
      visibility: "open",
      visual: { hue: 166, saturation: 42, lightness: 48, kind: "ring", label: "余" },
    };
    localStorage.setItem("happyBall.ledger.v1", JSON.stringify(ledger));
    const storedSettings = localStorage.getItem("happyBall.settings.v2");
    const settings = storedSettings ? JSON.parse(storedSettings) : {};
    settings.emotionEchoStrength = "strong";
    localStorage.setItem("happyBall.settings.v2", JSON.stringify(settings));
  });
  await page.reload();
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
  await page.locator("[data-calendar-open-panel='dayList']").click();
  await page.locator("[data-view-ball-id]").first().click();
  await expect(page.locator(".ball-detail-dialog")).toBeVisible();
}

async function expectPhoneDetailLayout(
  page: Page,
  viewport: { width: number; height: number },
): Promise<void> {
  const scrollBody = page.locator(".ball-detail-dialog > [data-scroll-owner]");
  await scrollBody.evaluate((element) => {
    element.scrollTop = 0;
  });
  const beforeScroll = await readDetailMetrics(page);

  expect(beforeScroll.pointerCoarse).toBe(true);
  expect(beforeScroll.dialog.x).toBeCloseTo(0, 0);
  expect(beforeScroll.dialog.y).toBeCloseTo(0, 0);
  expect(beforeScroll.dialog.width).toBeCloseTo(viewport.width, 0);
  expect(beforeScroll.dialog.height).toBeCloseTo(viewport.height, 0);
  expect(beforeScroll.dialog.borderRadius).toBe("0px");
  expect(beforeScroll.dialog.backgroundAlpha).toBeGreaterThan(0);
  expect(beforeScroll.dialog.backgroundAlpha).toBeLessThan(1);
  expect(beforeScroll.header.controlsRowDelta).toBeLessThanOrEqual(1);
  expect(beforeScroll.header.titleRowDelta).toBeLessThanOrEqual(1);
  expect(beforeScroll.header.closeWidth).toBeCloseTo(40, 0);
  expect(beforeScroll.header.closeRightInset).toBeGreaterThanOrEqual(11);
  expect(beforeScroll.header.bodyOverlap).toBeLessThanOrEqual(0);
  expect(beforeScroll.title.lines).toBe(1);
  expect(beforeScroll.date.lines).toBe(1);
  expect(beforeScroll.date.whiteSpace).toBe("nowrap");
  expect(beforeScroll.ball.width).toBeCloseTo(68, 0);
  expect(beforeScroll.ball.height).toBeCloseTo(68, 0);
  expect(beforeScroll.ball.stackWidth).toBeCloseTo(84, 0);
  expect(beforeScroll.ball.leftSpace).toBeGreaterThanOrEqual(15.5);
  expect(beforeScroll.ball.topSpace).toBeGreaterThanOrEqual(17.5);
  expect(beforeScroll.ball.echoOpacity).toBe("1");
  expect(beforeScroll.ball.echoFilter).toContain("blur(19px)");
  expect(beforeScroll.badge.text).toBe("✦12");
  expect(beforeScroll.badge.fontSize).toBe("13.44px");
  expect(beforeScroll.badge.leftSpace).toBeGreaterThanOrEqual(7.5);
  expect(beforeScroll.badge.topSpace).toBeGreaterThanOrEqual(7.5);
  expect(beforeScroll.badge.rightOverflow).toBeLessThanOrEqual(0);
  expect(beforeScroll.count.text).toBe("5玉");
  expect(beforeScroll.count.fontSize).toBe("16px");
  expect(beforeScroll.memo.sectionHeight).toBeGreaterThan(104);
  expect(beforeScroll.memo.contentBottom).toBeLessThanOrEqual(beforeScroll.memo.sectionBottom + 0.5);
  expect(beforeScroll.memo.contentScrollHeight).toBeLessThanOrEqual(beforeScroll.memo.contentClientHeight + 1);
  expect(beforeScroll.feeling.rowGap).toBeCloseTo(2, 0);
  expect(beforeScroll.feeling.firstRowHeight).toBeGreaterThanOrEqual(34);
  expect(beforeScroll.feeling.firstRowHeight).toBeLessThan(40);

  await scrollBody.evaluate((element) => {
    element.scrollTop = Math.min(160, element.scrollHeight - element.clientHeight);
  });
  const afterScroll = await readDetailMetrics(page);
  expect(afterScroll.header.top).toBeCloseTo(beforeScroll.header.top, 0);
}

async function readDetailMetrics(page: Page) {
  return page.locator(".ball-detail-dialog").evaluate((dialog) => {
    const countTextLines = (element: HTMLElement): number => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const lineTops = Array.from(range.getClientRects(), (rect) => Math.round(rect.top * 10) / 10);
      return new Set(lineTops).size;
    };
    const header = dialog.querySelector<HTMLElement>(".detail-surface-header")!;
    const screenName = header.querySelector<HTMLElement>(".detail-screen-name")!;
    const edit = header.querySelector<HTMLElement>(".detail-edit-top")!;
    const close = header.querySelector<HTMLElement>(".dialog-close")!;
    const body = dialog.querySelector<HTMLElement>(":scope > [data-scroll-owner]")!;
    const ballStack = dialog.querySelector<HTMLElement>(".dialog-ball-stack")!;
    const ball = ballStack.querySelector<HTMLElement>(".dialog-ball")!;
    const badge = ball.querySelector<HTMLElement>(".compact-descent-badge")!;
    const count = ballStack.querySelector<HTMLElement>(".detail-ball-count-under-icon")!;
    const title = dialog.querySelector<HTMLElement>("#ball-dialog-title")!;
    const date = dialog.querySelector<HTMLElement>(".dialog-title-block > span")!;
    const memo = dialog.querySelector<HTMLElement>(".dialog-memo")!;
    const memoContent = memo.querySelector<HTMLElement>("p")!;
    const feelingRows = Array.from(dialog.querySelectorAll<HTMLElement>(".detail-feeling-card .detail-info-row"));
    const dialogRect = dialog.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const screenNameRect = screenName.getBoundingClientRect();
    const editRect = edit.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const ballStackRect = ballStack.getBoundingClientRect();
    const ballRect = ball.getBoundingClientRect();
    const badgeRect = badge.getBoundingClientRect();
    const memoRect = memo.getBoundingClientRect();
    const memoContentRect = memoContent.getBoundingClientRect();
    const firstFeelingRect = feelingRows[0].getBoundingClientRect();
    const secondFeelingRect = feelingRows[1].getBoundingClientRect();
    const backgroundNumbers = getComputedStyle(dialog).backgroundColor.match(/[\d.]+/g) ?? [];
    const backgroundAlpha = backgroundNumbers.length >= 4 ? Number(backgroundNumbers[3]) : 1;
    const echoStyle = getComputedStyle(ball, "::before");

    return {
      pointerCoarse: matchMedia("(pointer: coarse)").matches,
      dialog: {
        x: dialogRect.x,
        y: dialogRect.y,
        width: dialogRect.width,
        height: dialogRect.height,
        borderRadius: getComputedStyle(dialog).borderRadius,
        paddingLeft: getComputedStyle(dialog).paddingLeft,
        backgroundAlpha,
      },
      header: {
        top: headerRect.top,
        closeWidth: closeRect.width,
        closeRightInset: dialogRect.right - closeRect.right,
        controlsRowDelta: Math.abs(
          (editRect.top + editRect.height / 2) - (closeRect.top + closeRect.height / 2),
        ),
        titleRowDelta: Math.abs(
          (screenNameRect.top + screenNameRect.height / 2) - (closeRect.top + closeRect.height / 2),
        ),
        bodyOverlap: headerRect.bottom - bodyRect.top,
      },
      title: { lines: countTextLines(title) },
      date: {
        lines: countTextLines(date),
        whiteSpace: getComputedStyle(date).whiteSpace,
      },
      ball: {
        width: ballRect.width,
        height: ballRect.height,
        stackWidth: ballStackRect.width,
        leftSpace: ballRect.left - bodyRect.left,
        topSpace: ballRect.top - bodyRect.top,
        echoOpacity: echoStyle.opacity,
        echoFilter: echoStyle.filter,
      },
      badge: {
        text: badge.textContent,
        fontSize: getComputedStyle(badge).fontSize,
        leftSpace: badgeRect.left - bodyRect.left,
        topSpace: badgeRect.top - bodyRect.top,
        rightOverflow: badgeRect.right - bodyRect.right,
      },
      count: {
        text: count.textContent,
        fontSize: getComputedStyle(count).fontSize,
      },
      memo: {
        sectionHeight: memoRect.height,
        sectionBottom: memoRect.bottom,
        contentBottom: memoContentRect.bottom,
        contentScrollHeight: memoContent.scrollHeight,
        contentClientHeight: memoContent.clientHeight,
      },
      feeling: {
        rowGap: secondFeelingRect.top - firstFeelingRect.bottom,
        firstRowHeight: firstFeelingRect.height,
      },
    };
  });
}
