import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
});

test("portrait phone hides only the visual today label", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const today = page.locator(".calendar-cell.is-today");
  await expect(today).toHaveCount(1);
  await expect(today).toHaveAttribute("aria-label", /本日/);

  const portrait = await today.evaluate((cell) => {
    const day = cell.querySelector<HTMLElement>(".calendar-day")!;
    const pseudo = getComputedStyle(cell, "::after");
    return {
      labelDisplay: pseudo.display,
      labelContent: pseudo.content,
      borderColor: getComputedStyle(cell).borderColor,
      boxShadow: getComputedStyle(cell).boxShadow,
      dayColor: getComputedStyle(day).color,
    };
  });
  expect(portrait.labelDisplay).toBe("none");
  expect(portrait.labelContent).toBe("none");
  expect(portrait.borderColor).toBe("rgba(240, 192, 111, 0.78)");
  expect(portrait.boxShadow).toContain("rgba(124, 222, 218");
  expect(portrait.dayColor).toBe("rgb(156, 243, 239)");

  await page.setViewportSize({ width: 640, height: 360 });
  const landscape = await today.evaluate((cell) => {
    const pseudo = getComputedStyle(cell, "::after");
    return { display: pseudo.display, content: pseudo.content };
  });
  expect(landscape.display).not.toBe("none");
  expect(landscape.content).toContain("本日");
});

test("iPad portrait and landscape center the full month header", async ({ page }) => {
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    const geometry = await page.locator(".calendar-month-head").evaluate((header) => {
      const wrapper = header.closest<HTMLElement>("[data-calendar-primary-header]")!;
      const rect = header.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      return {
        headerCenter: rect.left + rect.width / 2,
        wrapperCenter: wrapperRect.left + wrapperRect.width / 2,
        viewportCenter: window.innerWidth / 2,
        wrapperWidth: wrapperRect.width,
        headerWidth: rect.width,
        overflow: header.scrollWidth - header.clientWidth,
      };
    });
    expect(Math.abs(geometry.headerCenter - geometry.viewportCenter)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.wrapperCenter - geometry.viewportCenter)).toBeLessThanOrEqual(1);
    expect(geometry.wrapperWidth).toBeGreaterThan(geometry.headerWidth);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
  }
});

test("Calendar and Ball List share centered Play-shaped date navigation", async ({ page }) => {
  await page.locator("[data-calendar-main]").click();
  const playBackground = await page.locator("[data-shift-display-period='-1']").evaluate((button) => (
    getComputedStyle(button).backgroundColor
  ));
  expect(playBackground).toBe("rgba(66, 115, 101, 0.16)");
  await page.locator("[data-open-panel='calendar']").click();

  for (const viewport of [
    { width: 360, height: 640 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await expectDateNavigationGeometry(page, ".calendar-month-head", viewport.width);
    await page.locator("[data-calendar-open-panel='dayList']").click();
    await expectDateNavigationGeometry(page, ".calendar-day-list-head", viewport.width);
    await page.locator("[data-calendar-open-panel='calendar']").click();
  }

  const monthHeading = page.locator(".calendar-month-head h2");
  const initialMonth = await monthHeading.textContent();
  await page.locator("[data-calendar-month]").first().click();
  await expect(monthHeading).not.toHaveText(initialMonth ?? "");

  await page.locator("[data-calendar-open-panel='dayList']").click();
  const dayHeading = page.locator(".calendar-day-list-head h2");
  const initialDay = await dayHeading.textContent();
  await page.locator("[data-calendar-shift-day='1']").click();
  await expect(dayHeading).not.toHaveText(initialDay ?? "");
});

test("phone and iPad keep lifecycle actions readable without adding an action row", async ({ page }) => {
  await page.locator("[data-calendar-open-panel='create']").click();
  await page.locator("#ball-form input[name='title']").fill("管理ボタン確認");
  await page.locator("#ball-form").evaluate((form: HTMLFormElement) => form.requestSubmit());

  for (const viewport of [
    { width: 360, height: 640 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await page.locator("[data-calendar-open-panel='dayList']").click();
    const metrics = await page.locator(".calendar-day-ball-item").first().evaluate((card) => {
      const actions = card.querySelector<HTMLElement>(".calendar-day-ball-actions")!;
      const edit = actions.querySelector<HTMLElement>(".edit-ball")!;
      const lifecycle = actions.querySelector<HTMLElement>(".lifecycle-ball")!;
      const deletion = actions.querySelector<HTMLElement>(".delete-ball")!;
      const buttons = [...actions.querySelectorAll<HTMLElement>("button")];
      return {
        actionHeight: actions.getBoundingClientRect().height,
        tallestButton: Math.max(...buttons.map((button) => button.getBoundingClientRect().height)),
        lifecycleFontSize: Number.parseFloat(getComputedStyle(lifecycle).fontSize),
        editFontSize: Number.parseFloat(getComputedStyle(edit).fontSize),
        lifecycleOverflow: lifecycle.scrollWidth - lifecycle.clientWidth,
        deletionOverflow: deletion.scrollWidth - deletion.clientWidth,
      };
    });
    expect(metrics.actionHeight - metrics.tallestButton).toBeLessThanOrEqual(1);
    expect(metrics.lifecycleFontSize).toBeGreaterThan(metrics.editFontSize);
    expect(metrics.lifecycleOverflow).toBeLessThanOrEqual(1);
    expect(metrics.deletionOverflow).toBeLessThanOrEqual(1);

    await page.locator("[data-calendar-open-panel='calendar']").click();
  }
});

async function expectDateNavigationGeometry(page: Page, headerSelector: string, viewportWidth: number): Promise<void> {
  const header = page.locator(headerSelector);
  const previous = header.locator(".period-nav-button-previous");
  const next = header.locator(".period-nav-button-next");
  await expect(previous).toHaveAttribute("aria-label", /前/);
  await expect(next).toHaveAttribute("aria-label", /次/);
  await expect(previous.locator("svg.period-chevron path")).toHaveCount(1);
  await expect(next.locator("svg.period-chevron path")).toHaveCount(1);

  const metrics = await header.evaluate((element) => {
    const previousButton = element.querySelector<HTMLElement>(".period-nav-button-previous")!;
    const heading = element.querySelector<HTMLElement>(".screen-heading-block")!;
    const nextButton = element.querySelector<HTMLElement>(".period-nav-button-next")!;
    const headerRect = element.getBoundingClientRect();
    const previousRect = previousButton.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    const nextRect = nextButton.getBoundingClientRect();
    const style = getComputedStyle(previousButton);
    return {
      headerCenter: headerRect.left + headerRect.width / 2,
      previousWidth: previousRect.width,
      previousHeight: previousRect.height,
      nextWidth: nextRect.width,
      nextHeight: nextRect.height,
      leftGap: headingRect.left - previousRect.right,
      rightGap: nextRect.left - headingRect.right,
      leftDistance: headingRect.left + headingRect.width / 2 - (previousRect.left + previousRect.width / 2),
      rightDistance: nextRect.left + nextRect.width / 2 - (headingRect.left + headingRect.width / 2),
      borderRadius: style.borderRadius,
      backgroundColor: style.backgroundColor,
    };
  });

  expect(Math.abs(metrics.headerCenter - viewportWidth / 2)).toBeLessThanOrEqual(1);
  expect(metrics.previousWidth).toBe(44);
  expect(metrics.previousHeight).toBe(44);
  expect(metrics.nextWidth).toBe(44);
  expect(metrics.nextHeight).toBe(44);
  expect(metrics.leftGap).toBeCloseTo(10, 1);
  expect(metrics.rightGap).toBeCloseTo(10, 1);
  expect(metrics.leftDistance).toBeCloseTo(metrics.rightDistance, 1);
  expect(metrics.borderRadius).toBe("12px");
  expect(metrics.backgroundColor).toBe("rgba(66, 115, 101, 0.24)");
}
