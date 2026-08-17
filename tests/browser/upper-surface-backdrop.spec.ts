import { expect, test } from "@playwright/test";

test("create, edit, and settings ignore backdrop dismissal", async ({ page }) => {
  await page.goto("/");

  await page.locator("[data-calendar-open-panel='create']").click();
  const createTitle = page.locator("#ball-form input[name='title']");
  await createTitle.fill("消してはいけない新しい玉");
  await page.locator(".panel-backdrop-create").click({ position: { x: 4, y: 4 } });
  await expect(page.locator(".floating-panel-create")).toBeVisible();
  await expect(page.locator("[data-create-discard-confirm]")).toHaveCount(0);
  await expect(createTitle).toHaveValue("消してはいけない新しい玉");
  await expect(createTitle).not.toBeFocused();

  await page.locator(".floating-panel-create .dialog-close").click();
  await expect(page.locator("[data-create-discard-confirm]")).toBeVisible();
  await page.locator("[data-create-continue]").click();
  await page.locator("#ball-form .authoring-bottom-actions [data-close-panel]").click();
  await expect(page.locator("[data-create-discard-confirm]")).toBeVisible();
  await page.locator("[data-create-discard-close]").click();

  await page.locator("[data-calendar-open-panel='create']").click();
  await page.locator("#ball-form input[name='title']").fill("編集対象の玉");
  await page.locator("#ball-form .panel-header-action, .floating-panel-create .panel-header-action").first().click();
  await page.locator("[data-calendar-open-panel='dayList']").click();
  await page.locator("[data-edit-ball-id]").first().click();

  const editTitle = page.locator("#ball-edit-form input[name='title']");
  await editTitle.fill("背景では閉じない編集");
  await page.locator(".ball-edit-dialog-backdrop").click({ position: { x: 4, y: 4 } });
  await expect(page.locator(".ball-edit-dialog")).toBeVisible();
  await expect(page.locator("[data-edit-unsaved-confirm]")).toHaveCount(0);
  await expect(editTitle).toHaveValue("背景では閉じない編集");
  await expect(editTitle).not.toBeFocused();

  await page.locator(".ball-edit-dialog .dialog-close").click();
  await expect(page.locator("[data-edit-unsaved-confirm]")).toBeVisible();
  await page.locator("[data-edit-discard-close]").click();

  await page.locator("[data-calendar-open-panel='settings']").click();
  await page.locator(".panel-backdrop-settings").click({ position: { x: 4, y: 4 } });
  await expect(page.locator(".floating-panel-settings")).toBeVisible();
  await page.locator(".floating-panel-settings .dialog-close").click();
  await expect(page.locator(".floating-panel-settings")).toHaveCount(0);
});
