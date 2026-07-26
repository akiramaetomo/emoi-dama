import { expect, test } from "@playwright/test";

const LAB_STORAGE_KEY = "happyBall.dev.ballColorLab.v1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("happyBall.test.guard", JSON.stringify({ untouched: true }));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => { (window as Window & { __ballColorLabClipboard?: string }).__ballColorLabClipboard = text; } },
    });
  });
});

test("development lab renders all presets through faithful Pixi and selection is border-only", async ({ page }) => {
  await page.goto("/ball-color-lab.html");
  const cells = page.locator("[data-ball-color-index]");
  await expect(cells).toHaveCount(24);
  await expect(page.locator("[data-ball-color-cell-value]", { hasText: "RING" })).toHaveCount(6);
  await expect(page.locator("[data-ball-color-render-field]")).toHaveAttribute("data-ball-renderer", "pixi");
  await expect(page.locator("[data-ball-color-render-field]")).toHaveAttribute("data-ball-appearance", "faithful");
  await expect(page.locator("[data-ball-color-render-field] canvas.pixi-ball-canvas")).toHaveCount(1);
  await expect(page.locator("[data-ball-color-renderer-error]")).toBeEmpty();
  await expect(cells.nth(0)).toHaveAttribute("data-hue", "0");
  await expect(cells.nth(23)).toContainText("RING · 47/15/86");

  await cells.nth(3).click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const selectionStyle = await cells.nth(3).evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, boxShadow: style.boxShadow, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(selectionStyle.background).toBe("rgba(0, 0, 0, 0)");
  expect(selectionStyle.boxShadow).toBe("none");
  expect(selectionStyle.outlineStyle).toBe("solid");
  expect(selectionStyle.outlineWidth).toBe("2px");
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({ "happyBall.test.guard": JSON.stringify({ untouched: true }) });
});

test("live edits survive selection changes and checkpoint history supports selected and global undo/redo", async ({ page }) => {
  await page.goto("/ball-color-lab.html");
  const first = page.locator("[data-ball-color-index='0']");
  const second = page.locator("[data-ball-color-index='1']");
  await first.click();
  await page.locator("[data-channel-range='hue']").fill("21");
  await page.locator("[data-ball-color-control='saturation'] [data-step='-1']").click();
  await page.locator("[data-channel-number='lightness']").fill("60");
  await expect(first).toHaveClass(/is-dirty/);
  await expect(page.locator("[data-undo-all]")).toBeDisabled();
  await expect(page.locator("[data-copy-json]")).toBeDisabled();

  await second.click();
  await first.click();
  await expect(page.locator("[data-channel-number='hue']")).toHaveValue("21");
  await page.locator("[data-commit-selected]").click();
  await expect(first).not.toHaveClass(/is-dirty/);
  await expect(page.locator("[data-undo-selected]")).toBeEnabled();
  await page.locator("[data-undo-selected]").click();
  await expect(first).toHaveAttribute("data-hue", "0");
  await expect(page.locator("[data-redo-selected]")).toBeEnabled();
  await page.locator("[data-redo-selected]").click();
  await expect(first).toHaveAttribute("data-hue", "21");

  await second.click();
  await page.locator("[data-channel-number='hue']").fill("90");
  await first.click();
  await page.locator("[data-channel-number='saturation']").fill("60");
  await page.locator("[data-commit-all]").click();
  await page.locator("[data-undo-selected]").click();
  await expect(first).toHaveAttribute("data-saturation", "69");
  await page.locator("[data-undo-all]").click();
  await expect(second).toHaveAttribute("data-hue", "43");
  await page.locator("[data-redo-all]").click();
  await expect(second).toHaveAttribute("data-hue", "90");
  await expect(first).toHaveAttribute("data-saturation", "69");

  await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), LAB_STORAGE_KEY)).not.toBeNull();
  await page.reload();
  await expect(first).toHaveAttribute("data-hue", "21");
  await expect(second).toHaveAttribute("data-hue", "90");
  await expect(page.locator("[data-undo-all]")).toBeEnabled();
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({ "happyBall.test.guard": JSON.stringify({ untouched: true }) });
});

test("reset remains uncommitted, discard restores history, and committed output copies and downloads", async ({ page }) => {
  await page.goto("/ball-color-lab.html");
  const first = page.locator("[data-ball-color-index='0']");
  await first.click();
  await page.locator("[data-channel-number='hue']").fill("22");
  await page.locator("[data-commit-selected]").click();
  await page.locator("[data-reset-selected]").click();
  await expect(first).toHaveAttribute("data-hue", "0");
  await expect(first).toHaveClass(/is-dirty/);
  await page.locator("[data-discard-selected]").click();
  await expect(first).toHaveAttribute("data-hue", "22");

  await page.locator("[data-copy-json]").click();
  const jsonText = await page.evaluate(() => (window as Window & { __ballColorLabClipboard?: string }).__ballColorLabClipboard ?? "");
  const json = JSON.parse(jsonText) as { type: string; changes: Array<Record<string, unknown>> };
  expect(json.type).toBe("happy-ball-color-lab-diff");
  expect(json.changes).toEqual([{
    index: 0, name: "よろこび",
    before: { hue: 0, saturation: 70, lightness: 57 },
    after: { hue: 22, saturation: 70, lightness: 57 },
  }]);

  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-download-json]").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^happy-ball-color-diff-\d{8}-\d{6}\.json$/);

  await page.locator("[data-copy-typescript]").click();
  const typeScript = await page.evaluate(() => (window as Window & { __ballColorLabClipboard?: string }).__ballColorLabClipboard ?? "");
  expect(typeScript).toContain('name: "よろこび", tone: "bright", hue: 22, saturation: 70, lightness: 57, visualKind: "filled"');
  expect(typeScript.split("\n").filter((line) => line.trimStart().startsWith("{ name:")).length).toBe(24);
});

test("help explains markers and the explicit Codex handoff", async ({ page }) => {
  await page.goto("/ball-color-lab.html");
  await page.locator("[data-open-help]").click();
  const help = page.locator("[data-ball-color-help]");
  await expect(help).toBeVisible();
  await expect(help).toContainText("保存しただけではCodexは自動認識しません");
  await expect(help).toContainText("この差分を categories.ts へ反映");
  await expect(help).toContainText("docs/user_data/ball-color-lab/");
  await expect(help).toContainText("外周枠＝選択中");
  await page.locator("[data-close-help]").click();
  await expect(help).toBeHidden();
});

for (const viewport of [
  { name: "iPad portrait", width: 768, height: 1024, rows: 6, columns: 4 },
  { name: "iPad landscape", width: 1024, height: 768, rows: 4, columns: 6 },
  { name: "desktop", width: 1280, height: 800, rows: 4, columns: 6 },
]) {
  test(`${viewport.name} keeps all comparisons and history controls in one viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/ball-color-lab.html");
    await expect(page.locator("[data-ball-color-render-field]")).toHaveAttribute("data-ball-renderer", "pixi");
    const layout = await page.evaluate(() => {
      const cells = [...document.querySelectorAll<HTMLElement>("[data-ball-color-index]")];
      const rounded = (value: number) => Math.round(value);
      const editor = document.querySelector<HTMLElement>(".ball-color-lab-editor")!.getBoundingClientRect();
      return {
        rows: new Set(cells.map((cell) => rounded(cell.getBoundingClientRect().top))).size,
        columns: new Set(cells.map((cell) => rounded(cell.getBoundingClientRect().left))).size,
        allCellsInside: cells.every((cell) => { const rect = cell.getBoundingClientRect(); return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight; }),
        editorInside: editor.left >= 0 && editor.top >= 0 && editor.right <= innerWidth && editor.bottom <= innerHeight,
        documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight,
        viewportWidth: document.documentElement.clientWidth, viewportHeight: document.documentElement.clientHeight,
      };
    });
    expect(layout.rows).toBe(viewport.rows);
    expect(layout.columns).toBe(viewport.columns);
    expect(layout.allCellsInside).toBe(true);
    expect(layout.editorInside).toBe(true);
    expect(layout.documentWidth).toBe(layout.viewportWidth);
    expect(layout.documentHeight).toBe(layout.viewportHeight);
  });
}
