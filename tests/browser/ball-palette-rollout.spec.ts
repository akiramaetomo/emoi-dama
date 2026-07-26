import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
});

test("stored legacy snapshots render with the current palette in calendar and Play", async ({ page }) => {
  await createDailyBall(page);
  const storedBefore = await page.evaluate(() => {
    const raw = localStorage.getItem("happyBall.ledger.v1");
    if (!raw) {
      throw new Error("ledger fixture was not saved");
    }
    const ledger = JSON.parse(raw);
    ledger.balls[0].visual = {
      ...ledger.balls[0].visual,
      hue: 9,
      saturation: 9,
      lightness: 9,
      kind: "ring",
    };
    localStorage.setItem("happyBall.ledger.v1", JSON.stringify(ledger));
    return JSON.stringify(ledger.balls[0].visual);
  });

  await page.goto("/?renderer=dom");
  const calendarBall = page.locator(".calendar-cell .mini-ball").first();
  await expect(calendarBall).toBeVisible();
  await expectCurrentDailyVisual(calendarBall);

  await page.locator("[data-calendar-main]").click();
  const playBall = page.locator(".physics-ball").first();
  await expect(playBall).toBeVisible();
  await expectCurrentDailyVisual(playBall);

  const storedAfter = await page.evaluate(() => {
    const ledger = JSON.parse(localStorage.getItem("happyBall.ledger.v1") ?? "{}");
    return JSON.stringify(ledger.balls?.[0]?.visual);
  });
  expect(storedAfter).toBe(storedBefore);
});

test("category palette groups families and selects with ball ring plus text only", async ({ page }) => {
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.locator("[data-calendar-open-panel='create']").click();
    await page.locator("[data-authoring-category-fold] > summary").click();

    const tones = page.locator(".category-tone");
    await expect(tones).toHaveCount(4);
    const toneStyle = await tones.first().evaluate((element) => {
      const style = getComputedStyle(element);
      return { borderWidth: style.borderWidth, overflow: element.scrollWidth - element.clientWidth };
    });
    expect(toneStyle.borderWidth).toBe("2px");
    expect(toneStyle.overflow).toBeLessThanOrEqual(1);

    const selected = page.locator(".category-option:has(input:checked)");
    const selectedStyle = await selected.evaluate((element) => {
      const option = getComputedStyle(element);
      const swatch = getComputedStyle(element.querySelector<HTMLElement>(".category-swatch")!);
      const label = getComputedStyle(element.querySelector<HTMLElement>(".category-option-label")!);
      return {
        borderWidth: option.borderWidth,
        backgroundColor: option.backgroundColor,
        minHeight: Number.parseFloat(option.minHeight),
        swatchOutlineWidth: swatch.outlineWidth,
        labelColor: label.color,
      };
    });
    expect(selectedStyle.borderWidth).toBe("0px");
    expect(selectedStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(selectedStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(selectedStyle.swatchOutlineWidth).toBe("2px");
    expect(selectedStyle.labelColor).toBe("rgb(255, 215, 140)");

    const second = page.locator(".category-option").nth(1);
    await second.click();
    await expect(second.locator("input")).toBeChecked();
    await expect(second.locator(".category-swatch")).toHaveCSS("outline-width", "2px");
    await expect(page.locator(".authoring-surface")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    await page.locator(".floating-panel-create .dialog-close").click();
  }
});

async function createDailyBall(page: Page): Promise<void> {
  await page.locator("[data-calendar-open-panel='create']").click();
  await page.locator("#ball-form input[name='title']").fill("旧snapshot確認");
  await page.locator("#ball-form").evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
}

async function expectCurrentDailyVisual(locator: ReturnType<Page["locator"]>): Promise<void> {
  await expect(locator).toHaveClass(/is-filled-ball/);
  const variables = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      hue: style.getPropertyValue("--ball-hue").trim(),
      saturation: style.getPropertyValue("--ball-saturation").trim(),
      lightness: style.getPropertyValue("--ball-lightness").trim(),
    };
  });
  expect(variables).toEqual({ hue: "92", saturation: "22%", lightness: "54%" });
}
