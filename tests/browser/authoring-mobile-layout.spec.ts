import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
  await createBall(page);
});

test("create and edit fill portrait and touch-landscape phone viewports", async ({ page }) => {
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);

    await page.locator("[data-calendar-open-panel='create']").click();
    await expectPhoneAuthoringSurface(page, ".floating-panel-create", "玉を置く", viewport);
    await page.locator(".floating-panel-create .authoring-surface-header .dialog-close").click();

    await openFirstBallEdit(page);
    await expectPhoneAuthoringSurface(page, ".ball-edit-dialog", "玉を編集", viewport);
    await page.locator(".ball-edit-dialog .authoring-surface-header .dialog-close").click();
  }
});

test("create and edit keep iPad and desktop outer geometry", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);

    await page.locator("[data-calendar-open-panel='create']").click();
    await expectWideAuthoringSurface(page, ".floating-panel-create", "玉を置く");
    await page.locator(".floating-panel-create .authoring-surface-header .dialog-close").click();

    await openFirstBallEdit(page);
    await expectWideAuthoringSurface(page, ".ball-edit-dialog", "玉を編集");
    await page.locator(".ball-edit-dialog .authoring-surface-header .dialog-close").click();
  }
});

test("create and edit share inset fields without clipping iPad date or time", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });

  await page.locator("[data-calendar-open-panel='create']").click();
  await expectAuthoringVisualHierarchy(page, "#ball-form");
  await expectIpadDateContainment(page, "#ball-form", ".create-inline-field");
  await expectInsetLabelBehavior(page, "#ball-form", "input[name='title']", "タイトル", "新しいタイトル");
  await expectInsetLabelBehavior(page, "#ball-form", "textarea[name='note']", "メモ", "新しいメモ");
  await page.locator(".floating-panel-create .authoring-surface-header .dialog-close").click();

  await openFirstBallEdit(page);
  await expectAuthoringVisualHierarchy(page, "#ball-edit-form");
  await expectIpadDateContainment(page, "#ball-edit-form", ".edit-inline-field");
  const timeLayout = await page.locator("#ball-edit-form").evaluate((form) => {
    const group = form.querySelector<HTMLElement>("[data-authoring-datetime-group]")!;
    const control = form.querySelector<HTMLElement>(".edit-timestamp-field .timestamp-control")!;
    const time = form.querySelector<HTMLInputElement>("input[name='time']")!;
    const dateRow = form.querySelector<HTMLElement>("[data-authoring-datetime-group] > .edit-inline-field")!;
    const date = dateRow.querySelector<HTMLInputElement>("input[type='date']")!;
    const groupRect = group.getBoundingClientRect();
    const timeRect = time.getBoundingClientRect();
    const dateRect = date.getBoundingClientRect();
    const groupStyle = getComputedStyle(group);
    const groupContentRight = groupRect.right
      - Number.parseFloat(groupStyle.borderRightWidth)
      - Number.parseFloat(groupStyle.paddingRight);
    return {
      timeRightOverflow: timeRect.right - groupRect.right,
      controlOverflow: control.scrollWidth - control.clientWidth,
      dateColumns: getComputedStyle(dateRow).gridTemplateColumns,
      dateFontSize: getComputedStyle(date).fontSize,
      dateRightOverflow: dateRect.right - groupRect.right,
      dateContentRightOverflow: dateRect.right - groupContentRight,
      dateOverflow: date.scrollWidth - date.clientWidth,
    };
  });
  expect(timeLayout.timeRightOverflow).toBeLessThanOrEqual(0.5);
  expect(timeLayout.controlOverflow).toBeLessThanOrEqual(1);
  expect(timeLayout.dateColumns.startsWith("72px ")).toBe(true);
  expect(timeLayout.dateFontSize).toBe("16px");
  expect(timeLayout.dateRightOverflow).toBeLessThanOrEqual(0.5);
  expect(timeLayout.dateContentRightOverflow).toBeLessThanOrEqual(0.5);
  expect(timeLayout.dateOverflow).toBeLessThanOrEqual(1);

  await seedDescentAndReload(page);
  await openFirstBallEdit(page);
  for (const viewport of [{ width: 768, height: 1024 }, { width: 360, height: 640 }]) {
    await page.setViewportSize(viewport);
    const descent = await page.locator("#ball-edit-form").evaluate((form) => {
      const datetime = form.querySelector<HTMLElement>("[data-authoring-datetime-group]")!;
      const history = form.querySelector<HTMLElement>(".edit-descent-history")!;
      const sectionLabel = history.querySelector<HTMLElement>(".descent-section-label")!;
      const standardLabel = form.querySelector<HTMLElement>("[data-authoring-datetime-group] > label > span")!;
      const emptyLocation = history.querySelector<HTMLElement>(".edit-descent-location-row.is-empty-position")!;
      const item = emptyLocation.closest<HTMLElement>(".edit-descent-item")!;
      const memo = item.querySelector<HTMLElement>(".edit-descent-memo")!;
      const textarea = memo.querySelector<HTMLTextAreaElement>("textarea")!;
      const now = form.querySelector<HTMLElement>("[data-current-time-button]")!;
      const gps = item.querySelector<HTMLElement>("[data-descent-gps-record-id]")!;
      const map = history.querySelector<HTMLElement>(".edit-descent-location-row.has-position [data-descent-map-link]")!;
      const status = emptyLocation.querySelector<HTMLElement>("[data-descent-gps-status]")!;
      const clear = emptyLocation.querySelector<HTMLElement>("[data-descent-clear-gps-record-id]")!;
      const feedback = emptyLocation.querySelector<HTMLElement>("[data-descent-action-feedback]")!;
      const memoRect = memo.getBoundingClientRect();
      const textareaRect = textarea.getBoundingClientRect();
      const rowRect = emptyLocation.getBoundingClientRect();
      const statusRect = status.getBoundingClientRect();
      const gpsRect = gps.getBoundingClientRect();
      const clearRect = clear.getBoundingClientRect();
      const styleValues = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return [style.backgroundColor, style.borderColor, style.color];
      };
      return {
        historyBorder: getComputedStyle(history).borderTopWidth,
        itemBorder: getComputedStyle(item).borderTopWidth,
        matchingGroupBackground: getComputedStyle(history).backgroundColor === getComputedStyle(datetime).backgroundColor,
        matchingLabelSize: getComputedStyle(sectionLabel).fontSize === getComputedStyle(standardLabel).fontSize,
        matchingLabelWeight: getComputedStyle(sectionLabel).fontWeight === getComputedStyle(standardLabel).fontWeight,
        memoHeight: textareaRect.height,
        memoWidthDelta: Math.abs(textareaRect.width - memoRect.width),
        memoLeftDelta: Math.abs(textareaRect.left - memoRect.left),
        memoLabelOpacity: getComputedStyle(memo.querySelector<HTMLElement>(".authoring-inset-label")!).opacity,
        locationFlexWrap: getComputedStyle(emptyLocation).flexWrap,
        locationOverflow: emptyLocation.scrollWidth - emptyLocation.clientWidth,
        locationRightOverflow: Math.max(statusRect.right, gpsRect.right, clearRect.right) - rowRect.right,
        locationRowDelta: Math.max(
          Math.abs((statusRect.top + statusRect.height / 2) - (gpsRect.top + gpsRect.height / 2)),
          Math.abs((gpsRect.top + gpsRect.height / 2) - (clearRect.top + clearRect.height / 2)),
        ),
        feedbackDisplay: getComputedStyle(feedback).display,
        gpsPaletteMatches: JSON.stringify(styleValues(gps)) === JSON.stringify(styleValues(now)),
        mapPaletteMatches: JSON.stringify(styleValues(map)) === JSON.stringify(styleValues(now)),
      };
    });
    expect(descent.historyBorder).toBe("2px");
    expect(descent.itemBorder).toBe("2px");
    expect(descent.matchingGroupBackground).toBe(true);
    expect(descent.matchingLabelSize).toBe(true);
    expect(descent.matchingLabelWeight).toBe(true);
    expect(descent.memoHeight).toBeCloseTo(50, 0);
    expect(descent.memoWidthDelta).toBeLessThanOrEqual(0.5);
    expect(descent.memoLeftDelta).toBeLessThanOrEqual(0.5);
    expect(descent.memoLabelOpacity).toBe("1");
    expect(descent.locationFlexWrap).toBe("nowrap");
    expect(descent.locationOverflow).toBeLessThanOrEqual(1);
    expect(descent.locationRightOverflow).toBeLessThanOrEqual(0.5);
    expect(descent.locationRowDelta).toBeLessThanOrEqual(1);
    expect(descent.feedbackDisplay).toBe("none");
    expect(descent.gpsPaletteMatches).toBe(true);
    expect(descent.mapPaletteMatches).toBe(true);
  }
});

test.describe("fine-pointer desktop", () => {
  test.use({ hasTouch: false });

  test("a short landscape desktop window does not become a phone authoring surface", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator("[data-calendar-open-panel='create']").click();
    await expectWideAuthoringSurface(page, ".floating-panel-create", "玉を置く");
  });
});

async function createBall(page: Page): Promise<void> {
  await page.locator("[data-calendar-open-panel='create']").click();
  const form = page.locator("#ball-form");
  await form.locator("input[name='title']").fill("authoring layout fixture");
  await form.evaluate((element: HTMLFormElement) => element.requestSubmit());
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
}

async function openFirstBallEdit(page: Page): Promise<void> {
  await page.locator("[data-calendar-open-panel='dayList']").click();
  await page.locator("[data-edit-ball-id]").first().click();
  await expect(page.locator(".ball-edit-dialog")).toBeVisible();
}

async function expectIpadDateContainment(page: Page, formSelector: string, rowClass: string): Promise<void> {
  const metrics = await page.locator(formSelector).evaluate((form, expectedRowClass) => {
    const group = form.querySelector<HTMLElement>("[data-authoring-datetime-group]")!;
    const dateRow = group.querySelector<HTMLElement>(`:scope > ${expectedRowClass}`)!;
    const date = dateRow.querySelector<HTMLInputElement>("input[type='date']")!;
    const groupRect = group.getBoundingClientRect();
    const dateRect = date.getBoundingClientRect();
    const groupStyle = getComputedStyle(group);
    const groupContentRight = groupRect.right
      - Number.parseFloat(groupStyle.borderRightWidth)
      - Number.parseFloat(groupStyle.paddingRight);
    return {
      contentRightOverflow: dateRect.right - groupContentRight,
      rowOverflow: dateRow.scrollWidth - dateRow.clientWidth,
      dateOverflow: date.scrollWidth - date.clientWidth,
    };
  }, rowClass);

  expect(metrics.contentRightOverflow).toBeLessThanOrEqual(0.5);
  expect(metrics.rowOverflow).toBeLessThanOrEqual(1);
  expect(metrics.dateOverflow).toBeLessThanOrEqual(1);
}

async function expectAuthoringVisualHierarchy(page: Page, selector: string): Promise<void> {
  const metrics = await page.locator(selector).evaluate((form) => {
    const primary = form.querySelector<HTMLElement>("[data-authoring-primary-fields]")!;
    const titleLabel = form.querySelector<HTMLElement>("[data-ball-authoring-title-field] > span")!;
    const titleInput = form.querySelector<HTMLInputElement>("input[name='title']")!;
    const memoLabel = form.querySelector<HTMLElement>("[data-ball-authoring-memo-field] > span")!;
    const memoInput = form.querySelector<HTMLTextAreaElement>("textarea[name='note']")!;
    const category = form.querySelector<HTMLElement>("[data-authoring-category-fold]")!;
    const datetime = form.querySelector<HTMLElement>("[data-authoring-datetime-group]")!;
    const divider = form.querySelector<HTMLElement>("[data-authoring-context-divider]")!;
    const titleField = titleInput.closest<HTMLElement>("[data-ball-authoring-title-field]")!;
    const memoField = memoInput.closest<HTMLElement>("[data-ball-authoring-memo-field]")!;
    const titleRect = titleInput.getBoundingClientRect();
    const titleFieldRect = titleField.getBoundingClientRect();
    const memoRect = memoInput.getBoundingClientRect();
    const memoFieldRect = memoField.getBoundingClientRect();
    return {
      primaryGap: getComputedStyle(primary).rowGap,
      titleBorder: getComputedStyle(titleInput).borderTopWidth,
      memoBorder: getComputedStyle(memoInput).borderTopWidth,
      categoryBorder: getComputedStyle(category).borderTopWidth,
      datetimeBorder: getComputedStyle(datetime).borderTopWidth,
      dividerHeight: getComputedStyle(divider).height,
      matchingMemoLabel: getComputedStyle(titleLabel).fontSize === getComputedStyle(memoLabel).fontSize
        && getComputedStyle(titleLabel).fontWeight === getComputedStyle(memoLabel).fontWeight
        && getComputedStyle(titleLabel).color === getComputedStyle(memoLabel).color,
      titleWidthDelta: Math.abs(titleRect.width - titleFieldRect.width),
      memoWidthDelta: Math.abs(memoRect.width - memoFieldRect.width),
    };
  });
  expect(metrics.primaryGap).toBe("6px");
  expect(metrics.titleBorder).toBe("2px");
  expect(metrics.memoBorder).toBe("2px");
  expect(metrics.categoryBorder).toBe("2px");
  expect(metrics.datetimeBorder).toBe("2px");
  expect(metrics.dividerHeight).toBe("2px");
  expect(metrics.matchingMemoLabel).toBe(true);
  expect(metrics.titleWidthDelta).toBeLessThanOrEqual(0.5);
  expect(metrics.memoWidthDelta).toBeLessThanOrEqual(0.5);
}

async function expectInsetLabelBehavior(
  page: Page,
  formSelector: string,
  inputSelector: string,
  placeholder: string,
  value: string,
): Promise<void> {
  const input = page.locator(`${formSelector} ${inputSelector}`);
  const field = input.locator("xpath=..");
  const label = field.locator(".authoring-inset-label");
  await input.fill("");
  await input.blur();
  await expect(input).toHaveAttribute("placeholder", placeholder);
  await expect.poll(() => label.evaluate((element) => getComputedStyle(element).opacity)).toBe("0");
  await expect.poll(() => input.evaluate((element: HTMLInputElement | HTMLTextAreaElement) => element.labels?.length ?? 0)).toBe(1);
  await input.focus();
  await expect.poll(() => label.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  await input.fill(value);
  await input.blur();
  await expect.poll(() => label.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
}

async function seedDescentAndReload(page: Page): Promise<void> {
  await page.evaluate(() => {
    const storedLedger = localStorage.getItem("happyBall.ledger.v1");
    if (!storedLedger) {
      throw new Error("created ledger is missing");
    }
    const ledger = JSON.parse(storedLedger);
    const ball = ledger.balls[0];
    ball.descents = [{
      id: "descent_visual_hierarchy_positioned",
      sequence: 1,
      recordedAt: ball.updatedAt,
      latitude: 35.681236,
      longitude: 139.767125,
      accuracyMeters: 12,
      distanceFromPreviousMeters: 0,
      badgeAwarded: true,
      memo: "位置ありの降臨メモ",
    }, {
      id: "descent_visual_hierarchy_empty",
      sequence: 2,
      recordedAt: ball.updatedAt,
      badgeAwarded: true,
      memo: "位置なしの降臨メモ",
    }];
    ball.descentBadgeCount = 2;
    localStorage.setItem("happyBall.ledger.v1", JSON.stringify(ledger));
  });
  await page.reload();
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
}

async function expectPhoneAuthoringSurface(
  page: Page,
  selector: string,
  expectedTitle: string,
  viewport: { width: number; height: number },
): Promise<void> {
  const metrics = await readAuthoringMetrics(page, selector);
  expect(metrics.title).toBe(expectedTitle);
  expect(metrics.pointerCoarse).toBe(true);
  expect(metrics.surface.x).toBeCloseTo(0, 0);
  expect(metrics.surface.y).toBeCloseTo(0, 0);
  expect(metrics.surface.width).toBeCloseTo(viewport.width, 0);
  expect(metrics.surface.height).toBeCloseTo(viewport.height, 0);
  expect(metrics.surface.borderRadius).toBe("0px");
  expect(metrics.surface.paddingLeft).toBeGreaterThanOrEqual(12);
  expect(metrics.surface.backgroundAlpha).toBeCloseTo(0.9, 2);
  expect(metrics.header.closeWidth).toBeCloseTo(40, 0);
  expect(metrics.header.rowDelta).toBeLessThanOrEqual(1);
  expect(metrics.header.titleCenterDelta).toBeLessThanOrEqual(1);
  expect(metrics.header.closeRightInset).toBeGreaterThanOrEqual(11.5);
  expect(metrics.header.bodyOverlap).toBeLessThanOrEqual(0);
  expect(metrics.scrollOwnerCount).toBe(1);
  await expectAuthoringVisualHierarchy(page, `${selector} form`);
}

async function expectWideAuthoringSurface(page: Page, selector: string, expectedTitle: string): Promise<void> {
  const metrics = await readAuthoringMetrics(page, selector);
  expect(metrics.title).toBe(expectedTitle);
  expect(metrics.surface.width).toBeCloseTo(520, 0);
  expect(metrics.surface.x).toBeGreaterThan(0);
  expect(metrics.surface.y).toBeGreaterThan(0);
  expect(metrics.surface.borderRadius).toBe("8px");
  expect(metrics.surface.paddingLeft).toBeCloseTo(20, 0);
  expect(metrics.header.closeWidth).toBeCloseTo(48, 0);
  expect(metrics.header.rowDelta).toBeLessThanOrEqual(1);
  expect(metrics.header.titleCenterDelta).toBeLessThanOrEqual(1);
  expect(metrics.header.bodyOverlap).toBeLessThanOrEqual(0);
  expect(metrics.scrollOwnerCount).toBe(1);
  await expectAuthoringVisualHierarchy(page, `${selector} form`);
}

async function readAuthoringMetrics(page: Page, selector: string) {
  return page.locator(selector).evaluate((surface) => {
    const header = surface.querySelector<HTMLElement>(".authoring-surface-header")!;
    const title = header.querySelector<HTMLElement>("h2")!;
    const close = header.querySelector<HTMLElement>(".dialog-close")!;
    const body = surface.querySelector<HTMLElement>(":scope > [data-scroll-owner]")!;
    const surfaceRect = surface.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const backgroundNumbers = getComputedStyle(surface).backgroundColor.match(/[\d.]+/g) ?? [];
    return {
      title: title.textContent?.trim(),
      pointerCoarse: matchMedia("(pointer: coarse)").matches,
      scrollOwnerCount: surface.querySelectorAll(":scope > [data-scroll-owner]").length,
      surface: {
        x: surfaceRect.x,
        y: surfaceRect.y,
        width: surfaceRect.width,
        height: surfaceRect.height,
        borderRadius: getComputedStyle(surface).borderRadius,
        paddingLeft: Number.parseFloat(getComputedStyle(surface).paddingLeft),
        backgroundAlpha: backgroundNumbers.length >= 4 ? Number(backgroundNumbers[3]) : 1,
      },
      header: {
        closeWidth: closeRect.width,
        closeRightInset: surfaceRect.right - closeRect.right,
        rowDelta: Math.abs(
          (titleRect.top + titleRect.height / 2) - (closeRect.top + closeRect.height / 2),
        ),
        titleCenterDelta: Math.abs(
          (titleRect.left + titleRect.width / 2) - (surfaceRect.left + surfaceRect.width / 2),
        ),
        bodyOverlap: headerRect.bottom - bodyRect.top,
      },
    };
  });
}
