import { expect, test, type Locator } from "@playwright/test";

test("screen names cycle a received workspace without adding a main control", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-calendar-primary-shell]")).toBeVisible();
  await page.evaluate(() => {
    const raw = localStorage.getItem("happyBall.workspaces.v1");
    if (!raw) {
      throw new Error("workspace store was not initialized");
    }
    const store = JSON.parse(raw);
    const self = store.workspaces[0];
    const received = {
      ...self,
      workspaceId: "workspace_abc12345678901234567890123456789",
      sourceWorkspaceId: "workspace_abc12345678901234567890123456789",
      role: "received",
      displayName: "父",
      ledger: {
        ...self.ledger,
        ledgerId: "ledger_received",
        ownerProfile: { name: "父", nameBook: [] },
        balls: [{
          id: "ball_received",
          date: new Date().toLocaleDateString("en-CA"),
          subject: "父",
          issuerType: "self",
          issuedBy: "父",
          enteredBy: "父",
          approvedBy: null,
          keepers: [],
          viewers: [],
          count: 1,
          title: "父の散歩",
          category: "父の日常",
          note: "",
          visibility: "open",
          visual: { hue: 180, saturation: 40, lightness: 50, kind: "filled", label: "散歩" },
          lifecycleStatus: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
      },
      categories: self.categories.map((category: any, index: number) => index === 12 ? { ...category, name: "父の日常" } : category),
      appSettings: { ...self.appSettings, maxSpeed: 1200, gravityEnabled: true },
      lastImportedAt: new Date().toISOString(),
    };
    store.workspaces.push(received);
    store.activeWorkspaceId = self.workspaceId;
    localStorage.setItem("happyBall.workspaces.v1", JSON.stringify(store));
  });
  await page.reload();

  const screenName = page.locator("[data-calendar-primary-header] [data-cycle-workspace]");
  await expect(screenName).toContainText("Calendar");
  await expectOriginalScreenKickerTypography(screenName);
  await expect(screenName).not.toContainText("ID=");

  await page.locator("[data-calendar-open-panel='dayList']").click();
  await expect(screenName).toContainText("Ball List");
  await expectOriginalScreenKickerTypography(screenName);
  await expect(page.locator(".workspace-share-panel > summary")).toHaveText("玉をまとめて送る");
  await expect(page.locator("#workspace-share-form")).toHaveCount(1);

  await screenName.click();
  await expect(screenName).toContainText("ID=ABC");
  await expect(screenName).toHaveClass(/is-received/);
  await expect(page.locator("#workspace-share-form")).toHaveCount(1);
  await expect(page.locator("[data-calendar-open-panel='create']")).toHaveCount(1);
  await expect(page.locator("[data-view-ball-id='ball_received']")).toBeVisible();
  await page.locator("[data-view-ball-id='ball_received']").click();
  await expect(page.locator("[data-dialog-edit-ball-id='ball_received']").first()).toBeVisible();
  await page.keyboard.press("Escape");
  const expectedSelfLegacyAfterReceivedCreate = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("happyBall.workspaces.v1") ?? "{}");
    return store.workspaces.find((workspace: any) => workspace.role === "self").ledger;
  });
  await page.locator("[data-calendar-open-panel='create']").click();
  await page.locator("#ball-form input[name='title']").fill("外部環境へ追加");
  await page.locator("#ball-form").evaluate((form: HTMLFormElement) => form.requestSubmit());
  const receivedCreateResult = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("happyBall.workspaces.v1") ?? "{}");
    const received = store.workspaces.find((workspace: any) => workspace.role === "received");
    return { ballCount: received.ledger.balls.length, title: received.ledger.balls[0].title };
  });
  expect(receivedCreateResult).toEqual({ ballCount: 2, title: "外部環境へ追加" });
  const legacyAfterReceivedCreate = await page.evaluate(() => JSON.parse(localStorage.getItem("happyBall.ledger.v1") ?? "null"));
  expect(legacyAfterReceivedCreate).toEqual(expectedSelfLegacyAfterReceivedCreate);

  const receivedColor = await screenName.evaluate((element) => getComputedStyle(element).color);
  expect(receivedColor).toBe("rgb(130, 221, 200)");

  await page.locator("[data-calendar-main]").click();
  const playScreenName = page.locator(".stage-topline [data-cycle-workspace]");
  await expect(playScreenName).toContainText("Emotion Play");
  await expect(playScreenName).toContainText("ID=ABC");

  const labelModeButton = page.locator("[data-cycle-ball-label-mode]");
  const pixiCanvas = page.locator(".pixi-ball-canvas");
  await expect(pixiCanvas).toBeVisible();
  const labelModeAriaBefore = await labelModeButton.getAttribute("aria-label");
  const rendererModeBefore = await pixiCanvas.getAttribute("data-ball-label-mode");
  const canvasBefore = await pixiCanvas.screenshot();
  await labelModeButton.click();
  await expect(labelModeButton).not.toHaveAttribute("aria-label", labelModeAriaBefore ?? "");
  await expect(pixiCanvas).not.toHaveAttribute("data-ball-label-mode", rendererModeBefore ?? "");
  const rendererModeAfter = await pixiCanvas.getAttribute("data-ball-label-mode");
  const visibleLabelCount = Number(await pixiCanvas.getAttribute("data-visible-ball-label-count"));
  expect(rendererModeAfter === "none" ? visibleLabelCount === 0 : visibleLabelCount > 0).toBe(true);
  expect(await pixiCanvas.screenshot()).not.toEqual(canvasBefore);
  const persistedReceivedMode = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("happyBall.workspaces.v1") ?? "{}");
    return store.workspaces.find((workspace: any) => workspace.role === "received")?.appSettings.ballLabelMode;
  });
  expect(persistedReceivedMode).toBe(rendererModeAfter);

  await playScreenName.click();
  await expect(playScreenName).not.toContainText("ID=");
  await expect(playScreenName).not.toHaveClass(/is-received/);
  await expectOriginalScreenKickerTypography(playScreenName);
  await expect(page.locator("[data-open-panel='create']")).toHaveCount(1);
});

test("workspace management renames and deletes an external-origin environment", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("happyBall.workspaces.v1") ?? "{}");
    const self = store.workspaces[0];
    store.workspaces.push({
      ...self,
      workspaceId: "workspace_manage00000000000000000000000000",
      sourceWorkspaceId: "workspace_manage00000000000000000000000000",
      role: "received",
      displayName: "変更前",
      ledger: {
        ...self.ledger,
        ledgerId: "ledger_manage000000000000000000000000000",
        ownerProfile: { name: "変更前", nameBook: [] },
        balls: [],
      },
    });
    localStorage.setItem("happyBall.workspaces.v1", JSON.stringify(store));
  });
  await page.reload();
  await page.locator("[data-calendar-open-panel='settings']").click();
  await page.locator(".workspace-management > summary").click();

  const nameInput = page.locator("[data-workspace-display-name]");
  await expect(nameInput).toHaveValue("変更前");
  await nameInput.fill("変更後");
  await nameInput.press("Tab");
  await expect.poll(() => page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("happyBall.workspaces.v1") ?? "{}");
    return store.workspaces.find((workspace: any) => workspace.role === "received")?.displayName;
  })).toBe("変更後");

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("[data-delete-workspace-id]").click();
  await expect(page.locator("[data-workspace-display-name]")).toHaveCount(0);
  expect(await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("happyBall.workspaces.v1") ?? "{}");
    return store.workspaces.some((workspace: any) => workspace.role === "received");
  })).toBe(false);
});

test("workspace import review can be cancelled without any storage mutation", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-calendar-open-panel='settings']").click();
  const storeBefore = await page.evaluate(() => localStorage.getItem("happyBall.workspaces.v1"));
  const payload = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("happyBall.workspaces.v1") ?? "{}");
    const self = store.workspaces[0];
    const now = new Date().toISOString();
    const repeatedBall = {
      id: "ball_feed000000000000000000000000000000",
      date: "2026-07-26",
      subject: "受信テスト",
      issuerType: "self",
      issuedBy: "受信テスト",
      enteredBy: "受信テスト",
      approvedBy: null,
      keepers: [],
      viewers: [],
      count: 1,
      title: "まだ保存しない玉",
      category: "日常",
      note: "",
      visibility: "open",
      visual: { hue: 30, saturation: 40, lightness: 50, kind: "filled", label: "確認" },
      lifecycleStatus: "active",
      createdAt: now,
      updatedAt: now,
    };
    return {
      v: 1,
      type: "happy-ball-workspace-share",
      sourceWorkspaceId: "workspace_feed0000000000000000000000000000",
      bundleId: "bundle_feed000000000000000000000000000000",
      sourceDisplayCode: "FEE",
      sourceDisplayName: "受信テスト",
      exportedAt: now,
      period: { from: "2026-07-26", to: "2026-07-26", selection: "period" },
      ledger: {
        ...self.ledger,
        ledgerId: "ledger_feed0000000000000000000000000000",
        ownerProfile: { name: "受信テスト", nameBook: [] },
        balls: Array.from({ length: 30 }, () => ({ ...repeatedBall })),
      },
      categories: self.categories,
      appSettings: self.appSettings,
    };
  });

  await page.locator("#import-json-file").setInputFiles({
    name: "workspace.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  await expect(page.locator(".workspace-import-dialog")).toBeVisible();
  await expect(page.locator(".workspace-import-dialog")).toContainText("まだ保存データは変更されていません");
  await expect(page.locator(".workspace-import-dialog")).toContainText(/29\s+登録済み/);
  expect(await page.evaluate(() => localStorage.getItem("happyBall.workspaces.v1"))).toBe(storeBefore);

  await page.locator("#dismiss-json-import").click();
  await expect(page.locator(".workspace-import-dialog")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("happyBall.workspaces.v1"))).toBe(storeBefore);

  const file = { name: "workspace.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(payload)) };
  await page.locator("[data-open-panel='settings']").click();
  await page.locator("#import-json-file").setInputFiles(file);
  await expect(page.locator(".workspace-import-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".workspace-import-dialog")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("happyBall.workspaces.v1"))).toBe(storeBefore);

  await page.locator("[data-open-panel='settings']").click();
  await page.locator("#import-json-file").setInputFiles(file);
  await expect(page.locator(".workspace-import-dialog")).toBeVisible();
  await page.locator("[data-cancel-workspace-import]").click({ position: { x: 4, y: 4 } });
  await expect(page.locator(".workspace-import-dialog")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("happyBall.workspaces.v1"))).toBe(storeBefore);
});

test("the primary Ball List downloads an inclusive period without an arbitrary-ball list", async ({ page }) => {
  await page.goto("/");
  const dates = await page.evaluate(() => {
    const raw = localStorage.getItem("happyBall.workspaces.v1");
    if (!raw) {
      throw new Error("workspace store was not initialized");
    }
    const store = JSON.parse(raw);
    const self = store.workspaces.find((workspace: any) => workspace.role === "self");
    const localDate = (date: Date) => date.toLocaleDateString("en-CA");
    const base = new Date();
    const previousDate = new Date(base);
    previousDate.setDate(base.getDate() - 1);
    const nextDate = new Date(base);
    nextDate.setDate(base.getDate() + 1);
    const outsideDate = new Date(base);
    outsideDate.setDate(base.getDate() + 2);
    const previous = localDate(previousDate);
    const today = localDate(base);
    const next = localDate(nextDate);
    const outside = localDate(outsideDate);
    const now = new Date().toISOString();
    const makeBall = (id: string, date: string, count: number, lifecycleStatus: string) => ({
      id,
      date,
      subject: self.ledger.ownerProfile.name,
      issuerType: "self",
      issuedBy: self.ledger.ownerProfile.name,
      enteredBy: self.ledger.ownerProfile.name,
      approvedBy: null,
      keepers: [],
      viewers: [],
      count,
      title: `共有導線テスト ${date}`,
      category: "日常",
      note: "",
      visibility: "open",
      visual: { hue: 30, saturation: 40, lightness: 50, kind: "filled", label: "共有" },
      lifecycleStatus,
      createdAt: now,
      updatedAt: now,
    });
    self.ledger.balls = [
      makeBall("ball_share_previous00000000000000000000", previous, 2, "active"),
      makeBall("ball_share_today000000000000000000000", today, 1, "archived"),
      makeBall("ball_share_next0000000000000000000000", next, 3, "offered"),
      makeBall("ball_share_outside0000000000000000000", outside, 9, "active"),
    ];
    localStorage.setItem("happyBall.workspaces.v1", JSON.stringify(store));
    localStorage.setItem("happyBall.ledger.v1", JSON.stringify(self.ledger));
    return { previous, today, next };
  });
  await page.reload();
  await page.locator("[data-calendar-open-panel='dayList']").click();
  await page.locator(".workspace-share-panel > summary").click();
  await expect(page.locator("[name='workspace-share-from']")).toHaveValue(dates.today);
  await expect(page.locator("[name='workspace-share-to']")).toHaveValue(dates.today);
  await expect(page.locator("[data-workspace-share-count]")).toHaveText("対象 1玉");
  await expect(page.locator("[name='workspace-share-ball']")).toHaveCount(0);
  await expect(page.locator(".workspace-share-ball-options")).toHaveCount(0);
  await expect(page.getByText("玉を選んだ場合", { exact: false })).toHaveCount(0);

  await page.locator("[name='workspace-share-from']").fill(dates.next);
  await page.locator("[name='workspace-share-to']").fill(dates.previous);
  await expect(page.locator("[data-workspace-share-count]")).toHaveText("対象 0玉");
  await expect(page.locator("[data-workspace-share-mode='share']")).toBeDisabled();
  await expect(page.locator("[data-workspace-share-mode='download']")).toBeDisabled();

  await page.locator("[name='workspace-share-from']").fill(dates.previous);
  await page.locator("[name='workspace-share-to']").fill(dates.next);
  await expect(page.locator("[data-workspace-share-count]")).toHaveText("対象 6玉");
  await expect(page.locator("[data-workspace-share-mode='share']")).toBeEnabled();
  await expect(page.locator("[data-workspace-share-mode='download']")).toBeEnabled();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("[data-workspace-share-mode='download']").click(),
  ]);
  const stream = await download.createReadStream();
  if (!stream) {
    throw new Error("workspace share download stream was unavailable");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(payload.type).toBe("happy-ball-workspace-share");
  expect(payload.period).toEqual({ from: dates.previous, to: dates.next, selection: "period" });
  expect(payload.ledger.balls).toHaveLength(3);
  expect(payload.ledger.balls.map((ball: any) => ball.date).sort()).toEqual([dates.previous, dates.today, dates.next].sort());
  expect(payload.ledger.balls.map((ball: any) => ball.lifecycleStatus).sort()).toEqual(["active", "archived", "offered"]);
  expect(payload.ledger.ownerProfile).toBeTruthy();
  expect(Array.isArray(payload.categories)).toBe(true);
  expect(payload.appSettings).toBeTruthy();
  expect(payload.activityLog).toBeUndefined();
});

test("PC and iPad keep readable sharing dates inside separate columns", async ({ page }, testInfo) => {
  const isIpadWebKit = testInfo.project.name === "webkit";
  const viewports = isIpadWebKit
    ? [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]
    : [{ width: 1280, height: 800 }];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator("[data-calendar-open-panel='dayList']").click();
    await page.locator(".workspace-share-panel > summary").click();

    const panelBox = await page.locator(".workspace-share-panel").boundingBox();
    const from = page.locator("[name='workspace-share-from']");
    const to = page.locator("[name='workspace-share-to']");
    const [fromBox, toBox, fromLabelBox, toLabelBox] = await Promise.all([
      from.boundingBox(),
      to.boundingBox(),
      from.locator("..").boundingBox(),
      to.locator("..").boundingBox(),
    ]);
    expect(panelBox).not.toBeNull();
    expect(fromBox).not.toBeNull();
    expect(toBox).not.toBeNull();
    expect(fromLabelBox).not.toBeNull();
    expect(toLabelBox).not.toBeNull();
    expect(fromBox!.x).toBeGreaterThanOrEqual(panelBox!.x);
    expect(toBox!.x + toBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width);
    expect(fromBox!.x + fromBox!.width).toBeLessThan(toBox!.x);
    expect(Math.abs(fromBox!.y - toBox!.y)).toBeLessThanOrEqual(1);
    expect(fromBox!.x).toBeGreaterThanOrEqual(fromLabelBox!.x);
    expect(fromBox!.x + fromBox!.width).toBeLessThanOrEqual(fromLabelBox!.x + fromLabelBox!.width);
    expect(toBox!.x).toBeGreaterThanOrEqual(toLabelBox!.x);
    expect(toBox!.x + toBox!.width).toBeLessThanOrEqual(toLabelBox!.x + toLabelBox!.width);
    expect(parseFloat(await from.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(19);
    expect(parseFloat(await to.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(19);
  }
});

test("phone sharing keeps each readable date row horizontal and action text on one line", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.locator("[data-calendar-open-panel='dayList']").click();
  await page.locator(".workspace-share-panel > summary").click();

  for (const name of ["workspace-share-from", "workspace-share-to"]) {
    const input = page.locator(`[name='${name}']`);
    const label = input.locator("..");
    const text = label.locator("span");
    const [inputBox, textBox] = await Promise.all([input.boundingBox(), text.boundingBox()]);
    expect(inputBox).not.toBeNull();
    expect(textBox).not.toBeNull();
    expect(Math.abs((inputBox!.y + inputBox!.height / 2) - (textBox!.y + textBox!.height / 2))).toBeLessThan(4);
    expect(inputBox!.x).toBeGreaterThan(textBox!.x + textBox!.width);
    expect(parseFloat(await input.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(19);
  }

  const shareAction = page.locator("[data-workspace-share-mode='share']");
  const actionStyle = await shareAction.evaluate((element) => {
    const style = getComputedStyle(element);
    return { whiteSpace: style.whiteSpace, fontSize: Number.parseFloat(style.fontSize), clientHeight: element.clientHeight, scrollHeight: element.scrollHeight };
  });
  expect(actionStyle.whiteSpace).toBe("nowrap");
  expect(actionStyle.fontSize).toBeLessThanOrEqual(13.5);
  expect(actionStyle.scrollHeight).toBeLessThanOrEqual(actionStyle.clientHeight);
});

test("device backup has no export checkboxes and restores only after confirmation", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-calendar-open-panel='settings']").click();
  await page.locator(".workspace-management > summary").click();
  await expect(page.locator(".workspace-management")).toContainText("利用環境（β版）");
  await expect(page.locator(".workspace-management")).toContainText(/自分 \/ ID=[A-Z0-9]{3,8} \/ \d+件/);
  await expect(page.locator(".workspace-management")).toContainText("編集・削除の扱いを相手と確認してください");
  await page.locator(".backup-settings > summary").click();
  await expect(page.locator("[name='export-section']")).toHaveCount(0);
  await expect(page.locator(".backup-settings")).toContainText("玉、設定（環境データ含む）を保存します。");
  await expect(page.locator(".backup-settings")).not.toContainText("操作ログと開発用データは含みません");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#export-json").click(),
  ]);
  const stream = await download.createReadStream();
  if (!stream) {
    throw new Error("device backup download stream was unavailable");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(payload.type).toBe("happy-ball-device-backup");
  expect(payload.workspaceStore.workspaces.length).toBeGreaterThan(0);
  expect(payload.activityLog).toBeUndefined();

  const self = payload.workspaceStore.workspaces.find((workspace: any) => workspace.role === "self");
  self.displayName = "復元確認";
  const restoreFile = { name: "device-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(payload)) };
  const storeBefore = await page.evaluate(() => localStorage.getItem("happyBall.workspaces.v1"));
  const activityBefore = await page.evaluate(() => localStorage.getItem("happyBall.activityLog.v1"));
  await page.locator("#import-json-file").setInputFiles(restoreFile);
  await expect(page.getByRole("heading", { name: "端末全体を復元しますか" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("happyBall.workspaces.v1"))).toBe(storeBefore);
  await page.locator("#dismiss-json-import").click();
  expect(await page.evaluate(() => localStorage.getItem("happyBall.workspaces.v1"))).toBe(storeBefore);

  await page.locator("[data-open-panel='settings']").click();
  await page.locator(".backup-settings > summary").click();
  await page.locator("#import-json-file").setInputFiles(restoreFile);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#confirm-device-backup-import").click();
  const restoredStore = await page.evaluate(() => JSON.parse(localStorage.getItem("happyBall.workspaces.v1") ?? "{}"));
  expect(restoredStore.workspaces.find((workspace: any) => workspace.role === "self").displayName).toBe("復元確認");
  expect(await page.evaluate(() => localStorage.getItem("happyBall.activityLog.v1"))).toBe(activityBefore);
});

test("workspace import applies through both separate and self routes", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-calendar-open-panel='settings']").click();
  const payload = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("happyBall.workspaces.v1") ?? "{}");
    const self = store.workspaces.find((workspace: any) => workspace.role === "self");
    const now = new Date().toISOString();
    return {
      v: 1,
      type: "happy-ball-workspace-share",
      sourceWorkspaceId: "workspace_apply000000000000000000000000000",
      bundleId: "bundle_apply000000000000000000000000000000",
      sourceDisplayCode: "APP",
      sourceDisplayName: "取込テスト",
      exportedAt: now,
      period: { from: "2026-07-26", to: "2026-07-26", selection: "period" },
      ledger: {
        ...self.ledger,
        ledgerId: "ledger_apply0000000000000000000000000000",
        ownerProfile: { name: "取込テスト", nameBook: [] },
        balls: [{
          id: "ball_apply00000000000000000000000000000",
          date: "2026-07-26",
          subject: "取込テスト",
          issuerType: "self",
          issuedBy: "取込テスト",
          enteredBy: "取込テスト",
          approvedBy: null,
          keepers: [],
          viewers: [],
          count: 1,
          title: "取込経路の確認",
          category: "取込カテゴリ",
          note: "",
          visibility: "open",
          visual: { hue: 190, saturation: 44, lightness: 52, kind: "filled", label: "取込" },
          lifecycleStatus: "active",
          createdAt: now,
          updatedAt: now,
        }],
      },
      categories: self.categories.map((category: any, index: number) => index === 0 ? { ...category, name: "取込カテゴリ" } : category),
      appSettings: { ...self.appSettings, maxSpeed: 1234 },
    };
  });
  const file = { name: "workspace-apply.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(payload)) };

  await page.locator("#import-json-file").setInputFiles(file);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("input[name='workspace-import-target'][value='new']").check();
  await page.locator("#confirm-workspace-import").click();
  await expect(page.locator(".workspace-import-dialog")).toHaveCount(0);
  const afterSeparate = await page.evaluate(() => JSON.parse(localStorage.getItem("happyBall.workspaces.v1") ?? "{}"));
  const received = afterSeparate.workspaces.find((workspace: any) => workspace.role === "received");
  const selfAfterSeparate = afterSeparate.workspaces.find((workspace: any) => workspace.role === "self");
  expect(received.ledger.balls).toHaveLength(1);
  expect(received.categories[0].name).toBe("取込カテゴリ");
  expect(received.appSettings.maxSpeed).toBe(1234);
  expect(selfAfterSeparate.ledger.balls).toHaveLength(0);

  await page.locator("[data-open-panel='settings']").click();
  await page.locator("#import-json-file").setInputFiles(file);
  const repeatTargets = page.locator("input[name='workspace-import-target']");
  await expect(repeatTargets).toHaveCount(2);
  await expect(repeatTargets.nth(1)).toBeChecked();
  await repeatTargets.first().check();
  await expect(page.locator("input[name='workspace-import-option'][value='newBalls']")).toBeChecked();
  for (const option of ["nameBook", "categories", "appSettings"]) {
    await expect(page.locator(`input[name='workspace-import-option'][value='${option}']`)).not.toBeChecked();
  }
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#confirm-workspace-import").click();
  await expect(page.locator(".workspace-import-dialog")).toHaveCount(0);
  const afterSelf = await page.evaluate(() => JSON.parse(localStorage.getItem("happyBall.workspaces.v1") ?? "{}"));
  const selfAfterMerge = afterSelf.workspaces.find((workspace: any) => workspace.role === "self");
  const receivedAfterMerge = afterSelf.workspaces.find((workspace: any) => workspace.role === "received");
  expect(selfAfterMerge.ledger.balls).toHaveLength(1);
  expect(selfAfterMerge.ledger.balls[0].provenance.sourceWorkspaceId).toBe(payload.sourceWorkspaceId);
  expect(selfAfterMerge.ledger.ownerProfile).toEqual(selfAfterSeparate.ledger.ownerProfile);
  expect(selfAfterMerge.categories).toEqual(selfAfterSeparate.categories);
  expect(selfAfterMerge.appSettings).toEqual(selfAfterSeparate.appSettings);
  expect(receivedAfterMerge.ledger.balls).toHaveLength(1);

  const conflictPayload = {
    ...payload,
    bundleId: "bundle_apply_conflict0000000000000000000000",
    ledger: {
      ...payload.ledger,
      balls: [{ ...payload.ledger.balls[0], title: "合意して上書き" }],
    },
  };
  await page.locator("[data-open-panel='settings']").click();
  await page.locator("#import-json-file").setInputFiles({
    name: "workspace-conflict.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(conflictPayload)),
  });
  await page.locator("input[name='workspace-import-target']").first().check();
  const conflictOption = page.locator("input[name='workspace-import-option'][value='conflicts']");
  await expect(conflictOption).toBeVisible();
  await expect(conflictOption).not.toBeChecked();
  await expect(page.locator("#confirm-workspace-import")).toBeDisabled();
  await conflictOption.check();
  await expect(page.locator("#confirm-workspace-import")).toBeEnabled();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#confirm-workspace-import").click();
  const afterConflict = await page.evaluate(() => JSON.parse(localStorage.getItem("happyBall.workspaces.v1") ?? "{}"));
  expect(afterConflict.workspaces.find((workspace: any) => workspace.role === "self").ledger.balls[0].title).toBe("合意して上書き");
});

async function expectOriginalScreenKickerTypography(locator: Locator): Promise<void> {
  const typography = await locator.evaluate((element) => {
    const reference = document.createElement("p");
    reference.className = Array.from(element.classList)
      .filter((className) => className !== "workspace-screen-name" && className !== "is-received")
      .join(" ");
    reference.textContent = element.querySelector("span")?.textContent ?? element.textContent;
    reference.style.position = "absolute";
    reference.style.visibility = "hidden";
    element.parentElement?.append(reference);
    const read = (target: Element) => {
      const style = getComputedStyle(target);
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing,
        lineHeight: style.lineHeight,
        textTransform: style.textTransform,
        textShadow: style.textShadow,
      };
    };
    const result = { actual: read(element), reference: read(reference) };
    reference.remove();
    return result;
  });
  expect(typography.actual).toEqual(typography.reference);
}
