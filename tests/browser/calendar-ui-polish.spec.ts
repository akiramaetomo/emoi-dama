import { expect, test } from "@playwright/test";

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
