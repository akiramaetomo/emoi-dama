import { expect, test, type Locator, type Page } from "@playwright/test";

test("calendar control bar reaches the viewport bottom", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const dock = page.locator(".calendar-control-dock");
  await expect(dock).toBeVisible();
  const box = await dock.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(800 - (box!.y + box!.height))).toBeLessThanOrEqual(1);
  expect(Math.abs(box!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(360 - (box!.x + box!.width))).toBeLessThanOrEqual(1);
});

test("primary controls are enlarged and the create/settings utilities stay inside the bar", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.locator("[data-calendar-main]").click();

  const pairs: Array<[Locator, Locator, number]> = [
    [page.locator("[data-cycle-ball-label-mode]"), page.locator("[data-cycle-ball-label-mode] .play-triple-ball-icon"), 30],
    [page.locator("[data-open-panel='calendar']"), page.locator("[data-open-panel='calendar'] .calendar-screen-icon"), 30],
    [page.locator("[data-open-calendar-day-list]"), page.locator("[data-open-calendar-day-list] .day-list-screen-icon"), 30],
  ];
  for (const [button, icon, size] of pairs) {
    await expectCenteredIcon(button, icon, size);
    const buttonBox = await button.boundingBox();
    expect(buttonBox!.width).toBeGreaterThanOrEqual(48);
    expect(buttonBox!.height).toBeGreaterThanOrEqual(48);
  }

  const createButton = page.locator("[data-open-panel='create']");
  const createAction = createButton.locator(".dock-create-action-icon");
  const createBall = createButton.locator(".dock-create-ball-icon");
  const createLabel = createButton.locator(".dock-create-label");
  await expect(createLabel).toHaveText("new");
  const createButtonBox = await createButton.boundingBox();
  const createActionBox = await createAction.boundingBox();
  const createBallBox = await createBall.boundingBox();
  const createLabelBox = await createLabel.boundingBox();
  expect(createButtonBox).not.toBeNull();
  expect(createActionBox).not.toBeNull();
  expect(createBallBox).not.toBeNull();
  expect(createLabelBox).not.toBeNull();
  expect(createButtonBox!.width).toBe(54);
  expect(createButtonBox!.height).toBe(54);
  expect(createBallBox!.width).toBe(40);
  expect(createBallBox!.height).toBe(40);
  expect(Math.abs((createButtonBox!.x + createButtonBox!.width / 2) - (createActionBox!.x + createActionBox!.width / 2))).toBeLessThanOrEqual(0.75);
  expect(createLabelBox!.y).toBeGreaterThanOrEqual(createBallBox!.y + createBallBox!.height - 2);
  expect(parseFloat(await createLabel.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(10);
  await expectCenteredIcon(
    createBall,
    page.locator("[data-open-panel='create'] .dock-create-ball-icon span"),
    14,
  );

  const triple = page.locator(".play-triple-ball-icon i");
  const tripleBoxes = await triple.evaluateAll((balls) => balls.map((ball) => {
    const rect = ball.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, background: getComputedStyle(ball).backgroundImage };
  }));
  expect(new Set(tripleBoxes.map((ball) => ball.background)).size).toBe(3);
  expect(Math.abs(tripleBoxes[0].y - tripleBoxes[2].y)).toBeLessThanOrEqual(0.5);
  expect(tripleBoxes[1].y - tripleBoxes[0].y).toBeGreaterThanOrEqual(14);
  expect(Math.abs((tripleBoxes[0].x + tripleBoxes[2].x + tripleBoxes[2].width) / 2 - (tripleBoxes[1].x + tripleBoxes[1].width / 2))).toBeLessThanOrEqual(1);

  for (const selector of ["[data-open-panel='create']", "[data-open-panel='settings']"]) {
    const style = await page.locator(selector).evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        borderWidth: computed.borderTopWidth,
        backgroundImage: computed.backgroundImage,
        backgroundColor: computed.backgroundColor,
      };
    });
    expect(style.borderWidth).toBe("0px");
    expect(style.backgroundImage).toBe("none");
    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  }

  const group = page.locator(".primary-screen-control-group");
  const groupStyle = await group.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      borderWidth: computed.borderTopWidth,
      backgroundColor: computed.backgroundColor,
      backgroundImage: computed.backgroundImage,
    };
  });
  expect(groupStyle.borderWidth).toBe("0px");
  expect(groupStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(groupStyle.backgroundImage).not.toBe("none");

  const playButton = page.locator("[data-cycle-ball-label-mode]");
  await expect(playButton).toHaveAttribute("aria-current", "page");
  const selectedStyle = await playButton.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundImage, shadow: computed.boxShadow };
  });
  expect(selectedStyle.background).not.toBe("none");
  expect(selectedStyle.shadow).not.toBe("none");
  expect(parseFloat(await page.locator("[data-open-panel='settings']").evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(28);
  await expect(page.locator(".app-control-bar .display-mode-next-button")).toHaveCount(0);
  await expect(page.locator(".play-world-guidance, .play-display-state-label, .world-action-prompt")).toHaveCount(0);

  const primaryBox = await group.boundingBox();
  const playModeBox = await page.locator("[data-toggle-play-modes]").boundingBox();
  const settingsBox = await page.locator("[data-open-panel='settings']").boundingBox();
  const barBox = await page.locator(".app-control-bar").boundingBox();
  expect(primaryBox).not.toBeNull();
  expect(playModeBox).not.toBeNull();
  expect(settingsBox).not.toBeNull();
  expect(barBox).not.toBeNull();
  expect(playModeBox!.x - (primaryBox!.x + primaryBox!.width)).toBeLessThanOrEqual(8);
  expect(Math.abs(settingsBox!.x + settingsBox!.width - (barBox!.x + barBox!.width))).toBeLessThanOrEqual(7);

  await page.locator("[data-open-panel='calendar']").click();
  const calendarShell = page.locator("[data-calendar-primary-shell]");
  const calendarPrimaryBox = await calendarShell.locator(".primary-screen-control-group").boundingBox();
  const markerModeBox = await calendarShell.locator("[data-calendar-cycle-marker-mode]").boundingBox();
  expect(calendarPrimaryBox).not.toBeNull();
  expect(markerModeBox).not.toBeNull();
  expect(markerModeBox!.x - (calendarPrimaryBox!.x + calendarPrimaryBox!.width)).toBeLessThanOrEqual(8);
});

test("period label cycles display mode and symmetric SVG chevrons shift the period", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("[data-calendar-main]").click();

  const modeButton = page.locator(".play-period-nav [data-cycle-display-mode]");
  await expect(modeButton).toHaveAttribute("aria-label", /表示期間: 日/);
  await expect(modeButton).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
  expect(parseFloat(await modeButton.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(18);
  const translucentControls = page.locator(".play-period-nav button");
  for (const control of await translucentControls.all()) {
    const style = await control.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        borderWidth: computed.borderTopWidth,
        backgroundImage: computed.backgroundImage,
        backgroundColor: computed.backgroundColor,
      };
    });
    expect(style.borderWidth).toBe("1px");
    expect(style.backgroundImage).toBe("none");
    expect(style.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  }

  const previous = page.locator("[data-shift-display-period='-1']");
  const next = page.locator("[data-shift-display-period='1']");
  const previousIcon = previous.locator("svg.period-chevron");
  const nextIcon = next.locator("svg.period-chevron");
  await expect(previous).toHaveText("");
  await expect(next).toHaveText("");
  expect(await previousIcon.locator("path").getAttribute("d")).toBe(await nextIcon.locator("path").getAttribute("d"));
  for (const control of [previous, next]) {
    const box = await control.boundingBox();
    const iconBox = await control.locator("svg").boundingBox();
    expect(box).not.toBeNull();
    expect(iconBox).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs((box!.x + box!.width / 2) - (iconBox!.x + iconBox!.width / 2))).toBeLessThanOrEqual(0.75);
    expect(Math.abs((box!.y + box!.height / 2) - (iconBox!.y + iconBox!.height / 2))).toBeLessThanOrEqual(0.75);
  }

  const initialRange = (await modeButton.textContent())?.trim();
  await modeButton.click();
  await expect(page.locator(".play-period-nav [data-cycle-display-mode]")).toHaveAttribute("aria-label", /表示期間: 週/);
  const weekRange = (await page.locator(".play-period-mode-button").textContent())?.trim();
  expect(weekRange).not.toBe(initialRange);
  expect(weekRange).toMatch(/^\d{4}-\d{2}-\d{2} – \d{2}-\d{2}$/);
  expect(weekRange).not.toMatch(/[の玉週月]/);
  const weekBox = await page.locator(".play-period-mode-button").boundingBox();
  expect(weekBox).not.toBeNull();
  expect(weekBox!.height).toBe(44);
  await page.locator("[data-shift-display-period='1']").click();
  await expect(page.locator(".play-period-mode-button")).not.toHaveText(weekRange ?? "");
  await page.locator(".play-period-mode-button").click();
  await expect(page.locator(".play-period-mode-button")).toHaveText(/^\d{4}-\d{2}$/);
});

async function expectCenteredIcon(button: Locator, icon: Locator, size: number): Promise<void> {
  const buttonBox = await button.boundingBox();
  const iconBox = await icon.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(iconBox).not.toBeNull();
  expect(iconBox!.width).toBeCloseTo(size, 0);
  expect(iconBox!.height).toBeCloseTo(size, 0);
  expect(Math.abs((buttonBox!.x + buttonBox!.width / 2) - (iconBox!.x + iconBox!.width / 2))).toBeLessThanOrEqual(0.75);
  expect(Math.abs((buttonBox!.y + buttonBox!.height / 2) - (iconBox!.y + iconBox!.height / 2))).toBeLessThanOrEqual(0.75);
}
