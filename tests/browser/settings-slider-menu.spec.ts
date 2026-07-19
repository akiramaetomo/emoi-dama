import { expect, test, type Locator, type Page } from "@playwright/test";

test("physics and sound settings are separate exclusive groups in the accepted order", async ({ page }) => {
  await openSettings(page);

  const physics = page.locator("details.physics-settings");
  const sound = page.locator("details.sound-settings");
  await expect(physics.locator("h2")).toHaveText("物理パラメータ");
  await expect(sound.locator("h2")).toHaveText("サウンド");

  const order = await page.locator("details.settings-group").evaluateAll((groups) => groups.map((group) => group.className));
  expect(order.findIndex((classes) => classes.includes("physics-settings"))).toBeLessThan(
    order.findIndex((classes) => classes.includes("sound-settings")),
  );

  await physics.locator("summary").click();
  await expect(physics).toHaveAttribute("open", "");
  await expect(physics.locator(".tuning-section").nth(0)).toContainText("重力センサー");
  await expect(physics.locator(".tuning-section").nth(0)).toContainText("センサー値表示");
  await expect(physics.locator(".tuning-section").nth(1).locator("h3")).toHaveText("世界の物理");
  await expect(physics.locator(".tuning-section").nth(2).locator("h3")).toHaveText("玉・親玉の性質");

  await sound.locator("summary").click();
  await expect(sound).toHaveAttribute("open", "");
  await expect(physics).not.toHaveAttribute("open", "");
});

test("Settings uses three tinted two-pixel clusters instead of individual cards", async ({ page }) => {
  await openSettings(page);
  const clusters = page.locator(".settings-cluster");
  await expect(clusters).toHaveCount(3);
  await expect(clusters.locator(":scope > .settings-cluster-title")).toHaveText(["玉の仕立て", "玉のふるまい", "管理"]);
  await expect(clusters.nth(0).locator(":scope > details.settings-group")).toHaveCount(4);
  await expect(clusters.nth(1).locator(":scope > details.settings-group")).toHaveCount(2);
  await expect(clusters.nth(2).locator(":scope > details.settings-group")).toHaveCount(4);

  const clusterStyles = await clusters.evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node);
    return {
      borderWidth: style.borderTopWidth,
      borderRadius: style.borderRadius,
      backgroundColor: style.backgroundColor,
    };
  }));
  expect(clusterStyles.every((style) => style.borderWidth === "2px" && style.borderRadius === "8px")).toBe(true);
  expect(new Set(clusterStyles.map((style) => style.backgroundColor)).size).toBe(3);

  const itemStyle = await page.locator("details.name-book-settings").evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      borderWidth: style.borderLeftWidth,
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
    };
  });
  expect(itemStyle).toEqual({ borderWidth: "0px", backgroundColor: "rgba(0, 0, 0, 0)", boxShadow: "none" });
  await expect(page.locator("details.category-settings")).toHaveCSS("border-top-width", "1px");

  const tailoringItem = page.locator("details.name-book-settings");
  const behaviorItem = page.locator("details.physics-settings");
  await tailoringItem.locator("summary").click();
  await expect(tailoringItem).toHaveAttribute("open", "");
  await behaviorItem.locator("summary").click();
  await expect(behaviorItem).toHaveAttribute("open", "");
  await expect(tailoringItem).not.toHaveAttribute("open", "");
});

test("Settings clusters fit phone iPad and PC widths without horizontal overflow", async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await openSettings(page);
    const fit = await page.locator(".floating-panel-settings").evaluate((panel) => {
      const panelRect = panel.getBoundingClientRect();
      const clusters = Array.from(panel.querySelectorAll<HTMLElement>(".settings-cluster"));
      return {
        panelOverflow: panel.scrollWidth - panel.clientWidth,
        clusterOverflow: clusters.map((cluster) => {
          const rect = cluster.getBoundingClientRect();
          return Math.max(0, panelRect.left - rect.left, rect.right - panelRect.right, cluster.scrollWidth - cluster.clientWidth);
        }),
      };
    });
    expect(fit.panelOverflow).toBeLessThanOrEqual(1);
    expect(fit.clusterOverflow.every((overflow) => overflow <= 1)).toBe(true);
  }
});

test("the animated Settings brand ball keeps top clearance at its highest point", async ({ page }) => {
  await openSettings(page);
  const clearance = await page.locator(".settings-brand-ball").evaluate((ball) => {
    const element = ball as HTMLElement;
    element.style.animation = "none";
    element.style.translate = "6px -10px";
    const ballRect = element.getBoundingClientRect();
    const scrollerRect = element.closest(".app-modal-scroll")!.getBoundingClientRect();
    return ballRect.top - scrollerRect.top;
  });
  expect(clearance).toBeGreaterThanOrEqual(1);
});

test("settings ranges ignore track presses while keeping thumb and keyboard input", async ({ page }) => {
  await openSettings(page);
  await page.locator("details.physics-settings summary").click();
  const range = page.locator<HTMLInputElement>("#setting-wall");
  await expect(range).toBeVisible();
  await expect(range).toHaveCSS("touch-action", "pan-y");

  const initialValue = await range.inputValue();
  const geometry = await readRangeGeometry(range);
  const trackX = geometry.ratio < 0.5 ? geometry.right - 2 : geometry.left + 2;
  await page.mouse.click(trackX, geometry.centerY);
  await expect(range).toHaveValue(initialValue);

  if (test.info().project.name === "webkit") {
    await page.touchscreen.tap(trackX, geometry.centerY);
    await expect(range).toHaveValue(initialValue);
  }

  await page.mouse.move(geometry.thumbX, geometry.centerY);
  await page.mouse.down();
  await page.mouse.move(geometry.thumbX - 50, geometry.centerY, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => range.inputValue()).not.toBe(initialValue);

  const draggedValue = await range.inputValue();
  await range.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => range.inputValue()).not.toBe(draggedValue);
});

test("a track touch keeps its value through delayed iPad input change and click events", async ({ page }) => {
  await openSettings(page);
  await page.locator("details.physics-settings summary").click();
  const range = page.locator<HTMLInputElement>("#setting-wall");
  const initialValue = await range.inputValue();
  const initialLabel = await page.locator("#setting-wall-value").textContent();
  const geometry = await readRangeGeometry(range);
  const trackX = geometry.ratio < 0.5 ? geometry.right - 2 : geometry.left + 2;

  await range.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 7,
    isPrimary: true,
    clientX: trackX,
    clientY: geometry.centerY,
  });
  await range.dispatchEvent("pointerup", {
    pointerType: "touch",
    pointerId: 7,
    isPrimary: true,
    clientX: trackX,
    clientY: geometry.centerY,
  });
  await page.waitForTimeout(80);

  const lateEventResult = await range.evaluate((input: HTMLInputElement) => {
    const attemptedValue = input.min;
    input.value = attemptedValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const afterInput = input.value;
    input.value = attemptedValue;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    const afterChange = input.value;
    input.value = attemptedValue;
    const clickAllowed = input.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return { afterInput, afterChange, afterClick: input.value, clickAllowed };
  });

  expect(lateEventResult).toEqual({
    afterInput: initialValue,
    afterChange: initialValue,
    afterClick: initialValue,
    clickAllowed: false,
  });
  await expect(page.locator("#setting-wall-value")).toHaveText(initialLabel ?? "");
});

test("settings tuning rows use the shared compact scale", async ({ page }) => {
  await openSettings(page);
  await page.locator("details.physics-settings summary").click();
  const metrics = await page.locator("#setting-wall").evaluate((input) => {
    const control = input.closest<HTMLElement>(".range-control")!;
    const section = input.closest<HTMLElement>(".tuning-section")!;
    const heading = section.querySelector<HTMLElement>("h3")!;
    return {
      controlFont: getComputedStyle(control).fontSize,
      headingFont: getComputedStyle(heading).fontSize,
      gap: getComputedStyle(section).gap,
      padding: getComputedStyle(section).padding,
      rangeWidth: input.getBoundingClientRect().width,
      sectionWidth: section.getBoundingClientRect().width,
    };
  });
  expect(parseFloat(metrics.controlFont)).toBeCloseTo(16.32, 1);
  expect(parseFloat(metrics.headingFont)).toBeCloseTo(16.8, 1);
  expect(metrics.gap).toBe("8px");
  expect(metrics.padding).toBe("8px");
  expect(metrics.rangeWidth / (metrics.sectionWidth - 16)).toBeCloseTo(0.92, 2);
});

test("every native settings range receives the thumb-only interaction policy", async ({ page }) => {
  await openSettings(page);
  const ranges = page.locator(".floating-panel-settings .range-control input[type='range']");
  await expect(ranges).toHaveCount(15);
  for (let index = 0; index < await ranges.count(); index += 1) {
    await expect(ranges.nth(index)).toHaveCSS("touch-action", "pan-y");
  }
});

async function openSettings(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("[data-open-panel='settings']:visible, [data-calendar-open-panel='settings']:visible").click();
  await expect(page.locator(".floating-panel-settings")).toBeVisible();
}

async function readRangeGeometry(range: Locator): Promise<{
  left: number;
  right: number;
  centerY: number;
  thumbX: number;
  ratio: number;
}> {
  return range.evaluate((input: HTMLInputElement) => {
    const rect = input.getBoundingClientRect();
    const min = Number(input.min);
    const max = Number(input.max);
    const ratio = (Number(input.value) - min) / (max - min);
    return {
      left: rect.left,
      right: rect.right,
      centerY: rect.top + rect.height / 2,
      thumbX: rect.left + rect.width * ratio,
      ratio,
    };
  });
}
