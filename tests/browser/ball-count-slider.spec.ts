import { expect, test, type Locator, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app-build-badge")).toHaveCount(0);
});

test("create slider uses nine equal intervals and saves 1 2 5 10", async ({ page }) => {
  const cases = [
    { raw: 1, count: 1 },
    { raw: 2, count: 2 },
    { raw: 5, count: 5 },
    { raw: 10, count: 10 },
  ];

  for (const { raw, count } of cases) {
    await page.locator("[data-calendar-open-panel='create']").click();
    const form = page.locator("#ball-form");
    const range = form.locator("[data-ball-count-range]");
    await form.locator("input[name='title']").fill(`slider ${count}`);
    await setRangeValue(range, raw);
    await expect(form.locator("[data-ball-count-output]")).toHaveText(`${count}玉`);
    await expect(form.locator("input[name='count']")).toHaveValue(String(count));
    await expect(range).toHaveAttribute("aria-valuetext", `${count}玉`);
    await expect.poll(() => form.evaluate((node: HTMLFormElement) => new FormData(node).get("count"))).toBe(String(count));
    await form.evaluate((node: HTMLFormElement) => node.requestSubmit());
    await expect.poll(() => readNewestStoredCount(page)).toBe(count);
  }

  await page.locator("[data-calendar-open-panel='create']").click();
  const form = page.locator("#ball-form");
  const range = form.locator("[data-ball-count-range]");
  await expect(range).toHaveAttribute("min", "1");
  await expect(range).toHaveAttribute("max", "10");
  await expect(form.locator("[data-ball-count-tick]")).toHaveCount(10);
  await expect(form.locator("[data-ball-count-tick='0']")).toHaveCount(0);

  await setRangeValue(range, 5);
  const alignment = await form.evaluate((node) => {
    const track = node.querySelector<HTMLElement>("[data-ball-count-track]")!.getBoundingClientRect();
    const tick = node.querySelector<HTMLElement>("[data-ball-count-tick='5']")!.getBoundingClientRect();
    const output = node.querySelector<HTMLElement>("[data-ball-count-output]")!.getBoundingClientRect();
    return {
      expectedTickCenter: track.left + track.width * (4 / 9),
      tickCenter: tick.left + tick.width / 2,
      outputRight: output.right,
      trackLeft: track.left,
      outputCenterY: output.top + output.height / 2,
      trackCenterY: track.top + track.height / 2,
    };
  });
  expect(Math.abs(alignment.expectedTickCenter - alignment.tickCenter)).toBeLessThanOrEqual(2);
  expect(alignment.outputRight).toBeLessThan(alignment.trackLeft);
  expect(Math.abs(alignment.outputCenterY - alignment.trackCenterY)).toBeLessThanOrEqual(8);
  expect(await range.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("none");
  const visualStyle = await form.evaluate((node) => {
    const output = node.querySelector<HTMLElement>("[data-ball-count-output]")!;
    const track = node.querySelector<HTMLElement>("[data-ball-count-track]")!;
    const rail = node.querySelector<HTMLElement>(".ball-count-rail")!;
    const thumb = node.querySelector<HTMLElement>(".ball-count-thumb-core")!;
    const tick = node.querySelector<HTMLElement>("[data-ball-count-tick='1']")!;
    const emphasizedTick = node.querySelector<HTMLElement>("[data-ball-count-tick='5']")!;
    return {
      outputColor: getComputedStyle(output).color,
      trackTouchAction: getComputedStyle(track).touchAction,
      railHeight: getComputedStyle(rail).height,
      railBackground: getComputedStyle(rail).backgroundColor,
      thumbWidth: getComputedStyle(thumb).width,
      thumbBackground: getComputedStyle(thumb).backgroundColor,
      tickColor: getComputedStyle(tick).color,
      emphasizedTickColor: getComputedStyle(emphasizedTick).color,
    };
  });
  expect(visualStyle).toEqual({
    outputColor: "rgb(255, 244, 222)",
    trackTouchAction: "pan-y",
    railHeight: "6px",
    railBackground: "rgba(145, 170, 162, 0.28)",
    thumbWidth: "24px",
    thumbBackground: "rgb(111, 141, 131)",
    tickColor: "rgba(184, 216, 206, 0.72)",
    emphasizedTickColor: "rgba(214, 231, 223, 0.88)",
  });

  await range.focus();
  await page.keyboard.press("ArrowRight");
  await expect(form.locator("input[name='count']")).toHaveValue("6");
  await tapTrackAtFraction(page, form.locator("[data-ball-count-track]"), 1);
  await expect(form.locator("input[name='count']")).toHaveValue("6");
  await dragTrackAcross(page, form.locator("[data-ball-count-track]"));
  await expect(form.locator("input[name='count']")).toHaveValue("6");
  await form.locator("[data-ball-count-tick='10']").click();
  await expect(form.locator("input[name='count']")).toHaveValue("6");
  await expect(page.locator("html")).toHaveJSProperty("scrollTop", 0);
});

test("create and edit sliders change count without root scroll", async ({ page }) => {
  await page.locator("[data-calendar-open-panel='create']").click();
  const createForm = page.locator("#ball-form");
  await createForm.locator("input[name='title']").fill("slider drag");
  await dragThumbToFraction(
    page,
    createForm.locator("[data-ball-count-thumb]"),
    createForm.locator("[data-ball-count-track]"),
    4 / 9,
  );
  await expect(createForm.locator("input[name='count']")).toHaveValue("5");
  await expectRootScrollZero(page);
  await createForm.evaluate((node: HTMLFormElement) => node.requestSubmit());
  await expect.poll(() => readNewestStoredCount(page)).toBe(5);

  await page.locator("[data-calendar-open-panel='dayList']").click();
  await page.locator("[data-edit-ball-id]").first().click();
  const editForm = page.locator("#ball-edit-form");
  await expect(editForm.locator("[data-ball-count-range]")).toHaveValue("5");
  await tapTrackAtFraction(page, editForm.locator("[data-ball-count-track]"), 0.9);
  await expect(editForm.locator("input[name='count']")).toHaveValue("5");
  await dragThumbToFraction(
    page,
    editForm.locator("[data-ball-count-thumb]"),
    editForm.locator("[data-ball-count-track]"),
    1 / 9,
  );
  await expect(editForm.locator("input[name='count']")).toHaveValue("2");
  await expect.poll(() => editForm.evaluate((node: HTMLFormElement) => new FormData(node).get("count"))).toBe("2");
  await expectRootScrollZero(page);
  await editForm.evaluate((node: HTMLFormElement) => node.requestSubmit());
  await page.locator("[data-edit-save-correction]").click();
  await expect.poll(() => readNewestStoredCount(page)).toBe(2);
});

test("legacy 11 12 and 99 remain unchanged until explicit conversion", async ({ page }) => {
  await seedLegacyCounts(page, [11, 12, 99]);
  await page.reload();
  await expect(page.locator(".app-build-badge")).toHaveCount(0);
  await page.locator("[data-calendar-open-panel='dayList']").click();

  for (const count of [11, 12, 99]) {
    await page.locator(`[data-edit-ball-id='legacy_${count}']`).click();
    const form = page.locator("#ball-edit-form");
    await expect(form.locator("[data-ball-count-legacy]")).toContainText(`既存値 ${count}玉`);
    await expect(form.locator("[data-ball-count-slider]")).toBeHidden();
    await expect(form.locator("input[name='count']")).toHaveValue(String(count));
    await form.locator("input[name='title']").fill(`legacy ${count} updated`);
    await form.evaluate((node: HTMLFormElement) => node.requestSubmit());
    await page.locator("[data-edit-save-correction]").click();
    await expect.poll(() => readStoredCount(page, `legacy_${count}`)).toBe(count);
    await page.locator("[data-dialog-close]").click();
  }

  await page.locator("[data-edit-ball-id='legacy_12']").click();
  const form = page.locator("#ball-edit-form");
  await form.locator("[data-ball-count-convert]").click();
  await expect(form.locator("[data-ball-count-legacy]")).toBeHidden();
  await expect(form.locator("[data-ball-count-slider]")).toBeVisible();
  await expect(form.locator("[data-ball-count-range]")).toHaveValue("10");
  await expect(form.locator("input[name='count']")).toHaveValue("10");
  await setRangeValue(form.locator("[data-ball-count-range]"), 5);
  await form.evaluate((node: HTMLFormElement) => node.requestSubmit());
  await page.locator("[data-edit-save-correction]").click();
  await expect.poll(() => readStoredCount(page, "legacy_12")).toBe(5);
});

async function setRangeValue(range: Locator, raw: number): Promise<void> {
  await range.evaluate((node: HTMLInputElement, value) => {
    node.value = String(value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, raw);
}

async function dragThumbToFraction(page: Page, thumb: Locator, track: Locator, fraction: number): Promise<void> {
  await thumb.scrollIntoViewIfNeeded();
  const thumbBox = await thumb.boundingBox();
  const trackBox = await track.boundingBox();
  expect(thumbBox).not.toBeNull();
  expect(trackBox).not.toBeNull();
  const startX = thumbBox!.x + thumbBox!.width / 2;
  const startY = thumbBox!.y + thumbBox!.height / 2;
  const targetX = trackBox!.x + trackBox!.width * fraction;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(targetX, startY, { steps: 8 });
  await page.mouse.up();
}

async function tapTrackAtFraction(page: Page, track: Locator, fraction: number): Promise<void> {
  await track.scrollIntoViewIfNeeded();
  const box = await track.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * fraction;
  const y = box!.y + box!.height / 2;
  await page.mouse.click(x, y);
}

async function dragTrackAcross(page: Page, track: Locator): Promise<void> {
  await track.scrollIntoViewIfNeeded();
  const box = await track.boundingBox();
  expect(box).not.toBeNull();
  const y = box!.y + box!.height / 2;
  await page.mouse.move(box!.x + box!.width * 0.7, y);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.9, y + 30, { steps: 6 });
  await page.mouse.up();
}

async function expectRootScrollZero(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    windowY: window.scrollY,
    documentY: document.scrollingElement?.scrollTop ?? -1,
  }))).toEqual({ windowY: 0, documentY: 0 });
}

async function readNewestStoredCount(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const value = localStorage.getItem("happyBall.ledger.v1");
    return value ? (JSON.parse(value).balls[0]?.count ?? null) : null;
  });
}

async function readStoredCount(page: Page, id: string): Promise<number | null> {
  return page.evaluate((ballId) => {
    const value = localStorage.getItem("happyBall.ledger.v1");
    const balls = value ? JSON.parse(value).balls : [];
    return balls.find((ball: { id: string; count: number }) => ball.id === ballId)?.count ?? null;
  }, id);
}

async function seedLegacyCounts(page: Page, counts: number[]): Promise<void> {
  await page.evaluate((values) => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const timestamp = now.toISOString();
    localStorage.setItem("happyBall.ledger.v1", JSON.stringify({
      v: 1,
      type: "happy-ball-ledger",
      ledgerId: "ledger_slider_legacy",
      ownerProfile: {
        name: "エモ次郎",
        nameBook: [{ id: "person_emojirou", name: "エモ次郎", role: "self" }],
      },
      balls: values.map((count) => ({
        id: `legacy_${count}`,
        date,
        time: "12:00",
        subject: "エモ次郎",
        issuerType: "self",
        issuedBy: "エモ次郎",
        enteredBy: "エモ次郎",
        approvedBy: null,
        keepers: ["エモ次郎"],
        viewers: [],
        count,
        title: `legacy ${count}`,
        category: "日常",
        note: "",
        visibility: "open",
        visual: { hue: 34, saturation: 68, lightness: 58, kind: "filled", label: `legacy ${count}` },
        lifecycleStatus: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
  }, counts);
}
