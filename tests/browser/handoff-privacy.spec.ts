import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
});

test("GPS sharing requires confirmation, persists, and stays read-only in send UI", async ({ page }) => {
  await page.locator("[data-calendar-open-panel='settings']").click();
  await page.locator("details.descent-settings summary").click();
  const setting = page.locator("#setting-handoff-descent-gps");
  await expect(setting).not.toBeChecked();

  page.once("dialog", (dialog) => dialog.dismiss());
  await setting.click();
  await expect(setting).not.toBeChecked();

  page.once("dialog", (dialog) => dialog.accept());
  await setting.click();
  await expect(setting).toBeChecked();

  await page.reload();
  await page.setViewportSize({ width: 360, height: 640 });
  await createBallAndOpenDetail(page);
  await expect(page.locator(".detail-receipt-card .detail-card-label")).toHaveText("玉を送る");
  const privacyState = page.locator(".handoff-privacy-status");
  await expect(privacyState).toContainText("降臨GPS情報：ON");
  await expect(privacyState).toContainText("⚙「降臨」で設定可");
  await expect(privacyState.locator("input, button")).toHaveCount(0);
  await expect(privacyState.locator(".handoff-privacy-value")).toHaveClass(/is-on/);
  const privacyLayout = await page.locator(".detail-receipt-card").evaluate((card) => {
    const sendLabel = card.querySelector<HTMLElement>(".detail-card-label")!;
    const gpsLabel = card.querySelector<HTMLElement>(".handoff-privacy-label")!;
    const gpsValue = card.querySelector<HTMLElement>(".handoff-privacy-value")!;
    const helper = card.querySelector<HTMLElement>(".handoff-privacy-status small")!;
    const privacyStatus = card.querySelector<HTMLElement>(".handoff-privacy-status")!;
    const sendButton = card.querySelector<HTMLElement>("[data-send-mode='casual']")!;
    const cardRect = card.getBoundingClientRect();
    const gpsRect = gpsLabel.getBoundingClientRect();
    const helperRect = helper.getBoundingClientRect();
    return {
      sendFontSize: getComputedStyle(sendLabel).fontSize,
      sendWhiteSpace: getComputedStyle(sendLabel).whiteSpace,
      gpsFontSize: getComputedStyle(gpsLabel).fontSize,
      gpsValueColor: getComputedStyle(gpsValue).color,
      gpsWhiteSpace: getComputedStyle(gpsLabel).whiteSpace,
      helperText: helper.textContent,
      helperFontSize: getComputedStyle(helper).fontSize,
      helperWhiteSpace: getComputedStyle(helper).whiteSpace,
      helperGap: helperRect.left - gpsRect.right,
      cardRowGap: getComputedStyle(card).rowGap,
      privacyColumnGap: getComputedStyle(privacyStatus).columnGap,
      sendButtonBackground: getComputedStyle(sendButton).backgroundColor,
      sendButtonBorder: getComputedStyle(sendButton).borderColor,
      sendButtonColor: getComputedStyle(sendButton).color,
      helperFits: helperRect.right <= cardRect.right + 0.5,
      helperRowDelta: Math.abs((helperRect.top + helperRect.height / 2) - (gpsRect.top + gpsRect.height / 2)),
    };
  });
  expect(Number.parseFloat(privacyLayout.gpsFontSize)).toBeLessThan(Number.parseFloat(privacyLayout.sendFontSize));
  expect(privacyLayout.sendWhiteSpace).toBe("nowrap");
  expect(privacyLayout.gpsValueColor).toBe("rgb(243, 206, 105)");
  expect(privacyLayout.gpsWhiteSpace).toBe("nowrap");
  expect(privacyLayout.helperText).toBe("⚙「降臨」で設定可");
  expect(Number.parseFloat(privacyLayout.helperFontSize)).toBeCloseTo(12.8, 1);
  expect(privacyLayout.helperWhiteSpace).toBe("nowrap");
  expect(privacyLayout.helperGap).toBeGreaterThanOrEqual(4);
  expect(privacyLayout.helperGap).toBeLessThanOrEqual(6);
  expect(privacyLayout.privacyColumnGap).toBe("5px");
  expect(Number.parseFloat(privacyLayout.helperFontSize)).toBeLessThan(Number.parseFloat(privacyLayout.gpsFontSize));
  expect(privacyLayout.sendButtonBackground).toBe("rgba(255, 246, 218, 0.08)");
  expect(privacyLayout.sendButtonBorder).toBe("rgba(244, 215, 160, 0.24)");
  expect(privacyLayout.sendButtonColor).toBe("rgb(246, 223, 177)");
  expect(privacyLayout.cardRowGap).toBe("10px");
  expect(privacyLayout.helperFits).toBe(true);
  expect(privacyLayout.helperRowDelta).toBeLessThanOrEqual(1);

  for (const viewport of [{ width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    const wideLayout = await page.locator(".detail-receipt-card").evaluate((card) => {
      const helper = card.querySelector<HTMLElement>(".handoff-privacy-status small")!;
      return {
        cardRowGap: getComputedStyle(card).rowGap,
        helperFontSize: getComputedStyle(helper).fontSize,
      };
    });
    expect(wideLayout.cardRowGap).toBe("4px");
    expect(Number.parseFloat(wideLayout.helperFontSize)).toBeCloseTo(12.8, 1);
  }
  await page.setViewportSize({ width: 360, height: 640 });

  await page.locator("[data-dialog-receipt-ball-id][data-send-mode='formal']").click();
  await expect(page.getByRole("button", { name: "QRを大きく" })).toBeVisible();
  await expect(page.getByRole("button", { name: "画像で送る" })).toBeVisible();
  await expect(page.getByRole("button", { name: "画像保存" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "URLコピー" })).toHaveCount(0);
  await expect(page.locator(".receipt-gps-state")).toHaveText("降臨GPS あり");
  await expect(page.locator(".receipt-surface-header")).not.toContainText("お預け状");
  await expect(page.locator(".receipt-surface-header")).toContainText("戻る");
  await expectCompactReceiptHeader(page);
});

test("receipt keeps the QR in the 390x844 opening and cues overflow at 360x640", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createBallAndOpenDetail(page);
  await page.locator("[data-dialog-receipt-ball-id][data-send-mode='formal']").click();
  await expectCompactReceiptHeader(page);
  const qr = page.locator(".receipt-url .receipt-qr-code");
  await expect(qr).toBeVisible();
  const qrBox = await qr.boundingBox();
  expect(qrBox).not.toBeNull();
  expect(qrBox!.y + qrBox!.height).toBeLessThanOrEqual(844);

  await page.setViewportSize({ width: 360, height: 640 });
  await expectCompactReceiptHeader(page);
  const cue = page.locator("[data-receipt-scroll-cue]");
  await expect(cue).toBeVisible();
  await expect(cue).toHaveText("↓ 続く");
  await page.locator("[data-receipt-scroll-owner]").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect(cue).toBeHidden();
});

async function createBallAndOpenDetail(page: Page): Promise<void> {
  await page.locator("[data-calendar-open-panel='create']").click();
  const form = page.locator("#ball-form");
  await form.locator("input[name='title']").fill("QR privacy browser test");
  await form.evaluate((element: HTMLFormElement) => element.requestSubmit());
  await page.locator("[data-calendar-open-panel='dayList']").click();
  await page.locator("[data-view-ball-id]").first().click();
  await expect(page.locator(".detail-receipt-card")).toBeVisible();
}

async function expectCompactReceiptHeader(page: Page): Promise<void> {
  await expect.poll(() => page.locator(".receipt-dialog").evaluate((dialog) => {
    const header = dialog.querySelector<HTMLElement>(".receipt-surface-header")!;
    const scrollBody = dialog.querySelector<HTMLElement>("[data-receipt-scroll-owner]")!;
    const dialogStyle = getComputedStyle(dialog);
    const headerRect = header.getBoundingClientRect();
    const bodyRect = scrollBody.getBoundingClientRect();
    return {
      height: headerRect.height,
      paddingTop: dialogStyle.paddingTop,
      bodyGap: Math.abs(bodyRect.top - headerRect.bottom),
    };
  })).toEqual({
    height: expect.any(Number),
    paddingTop: "0px",
    bodyGap: 0,
  });
  const height = await page.locator(".receipt-surface-header").evaluate((header) => header.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(64);
}
