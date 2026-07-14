import { expect, test } from "@playwright/test";

test("candidate lab has one fixed body and an absolute app/layer hierarchy", async ({ page }) => {
  await page.goto("/viewport-lab.html?mode=candidate");
  await expect(page.locator(".lab-version")).toHaveText("v0.6.0");
  await expect(page.locator(".lab-meta-controls strong")).toHaveText("FIXED BODY + NO-PAN SUBTREE");

  const geometry = await page.evaluate(() => ({
    htmlPosition: getComputedStyle(document.documentElement).position,
    bodyPosition: getComputedStyle(document.body).position,
    rootPosition: getComputedStyle(document.querySelector<HTMLElement>("#viewport-lab")!).position,
    layerPositions: [...document.querySelectorAll<HTMLElement>(".lab-layer")].map((element) => getComputedStyle(element).position),
    documentScrollTop: document.scrollingElement?.scrollTop ?? -1,
    documentClientHeight: document.documentElement.clientHeight,
    documentScrollHeight: document.documentElement.scrollHeight,
    surfaceTouchAction: getComputedStyle(document.querySelector<HTMLElement>(".lab-primary-layer")!).touchAction,
    zeroOwnerRange: document.querySelector<HTMLElement>("[data-lab-owner='zero']")!.dataset.scrollRange,
    ownerTouchAction: getComputedStyle(document.querySelector<HTMLElement>("[data-lab-owner='zero']")!).touchAction,
    zeroOwnerButtonTouchAction: getComputedStyle(document.querySelector<HTMLElement>("[data-lab-owner='zero'] button")!).touchAction,
    interactionUserSelect: (() => {
      const style = getComputedStyle(document.querySelector<HTMLElement>(".lab-static-zone strong")!);
      return style.userSelect || style.getPropertyValue("-webkit-user-select");
    })(),
  }));

  expect(geometry).toEqual({
    htmlPosition: "static",
    bodyPosition: "fixed",
    rootPosition: "absolute",
    layerPositions: ["absolute", "absolute", "absolute"],
    documentScrollTop: 0,
    documentClientHeight: geometry.documentScrollHeight,
    documentScrollHeight: geometry.documentScrollHeight,
    surfaceTouchAction: "none",
    zeroOwnerRange: "zero",
    ownerTouchAction: "none",
    zeroOwnerButtonTouchAction: "none",
    interactionUserSelect: "none",
  });

  await page.evaluate(() => window.scrollTo(0, 84));
  await expect.poll(() => page.evaluate(() => ({
    windowScrollY: window.scrollY,
    documentScrollTop: document.scrollingElement?.scrollTop ?? -1,
  }))).toEqual({ windowScrollY: 0, documentScrollTop: 0 });
});

test("current and candidate lab modes remain visibly distinguishable", async ({ page }) => {
  await page.goto("/viewport-lab.html?mode=current");
  await expect(page.locator(".lab-version")).toHaveText("v0.6.0");
  await expect(page.locator(".lab-meta-controls strong")).toHaveText("MINIMAL CURRENT CONTROL");
  await expect(page.locator(".lab-meta-controls a")).toHaveAttribute("href", "./viewport-lab.html?mode=candidate");

  const structure = await page.evaluate(() => ({
    bodyPosition: getComputedStyle(document.body).position,
    rootPosition: getComputedStyle(document.querySelector<HTMLElement>("#viewport-lab")!).position,
    surfaceTouchAction: getComputedStyle(document.querySelector<HTMLElement>(".lab-primary-layer")!).touchAction,
  }));
  expect(structure).toEqual({ bodyPosition: "static", rootPosition: "fixed", surfaceTouchAction: "pan-y" });
  await expect(page.locator("[data-lab-owner='zero']")).toHaveAttribute("data-scroll-range", "zero");
  expect(await page.locator("[data-lab-owner='zero']").evaluate((element) => getComputedStyle(element).touchAction)).toBe("pan-y");
  expect(await page.locator("[data-lab-owner='zero'] button").first().evaluate((element) => getComputedStyle(element).touchAction)).toBe("manipulation");
});

test("candidate lab keeps route, internal scroll, modal input, and telemetry independent", async ({ page }) => {
  await page.goto("/viewport-lab.html?mode=candidate");
  await page.locator("[data-lab-route='list']").click();
  await expect(page.locator("[data-lab-route='list']")).toHaveAttribute("aria-current", "page");

  const owner = page.locator("[data-lab-owner='long']");
  await expect(owner).toHaveAttribute("data-scroll-range", "scrollable");
  expect(await owner.evaluate((element) => getComputedStyle(element).touchAction)).toBe("pan-y");
  expect(await owner.locator("button").first().evaluate((element) => getComputedStyle(element).touchAction)).toBe("manipulation");
  await owner.evaluate((element) => { element.scrollTop = 240; });
  await expect.poll(() => owner.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  await page.locator("[data-open-lab-modal]").click();
  await expect(page.locator(".lab-modal-panel")).toBeVisible();
  await page.locator(".lab-modal-panel textarea").focus();
  await expect(page.locator(".lab-modal-panel textarea")).toBeFocused();
  await expect(page.locator("[data-lab-telemetry]")).toContainText("VIEWPORT LAB v0.6.0 candidate");
  await expect(page.locator("[data-download-lab-log]")).toBeVisible();

  await page.locator("[data-close-lab-modal-button]").click();
  await expect(page.locator(".lab-modal-panel")).toHaveCount(0);
  await expect(page.locator("[data-lab-route='list']")).toHaveAttribute("aria-current", "page");
});
