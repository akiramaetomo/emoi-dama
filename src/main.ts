import RAPIER from "@dimforge/rapier2d-compat";
import { renderCalendarOverlay } from "./calendar-renderers";
import {
  loadCategoryColorPresets,
  resetCategoryColorPresets,
  saveCategoryColorPresets,
  type CategoryColorPreset,
} from "./categories";
import "./style.css";
import {
  type JsonImportReview,
} from "./json-transfer";
import {
  applyJsonImportReview,
  exportSelectedJson,
  readSelectedJsonImportSections,
  reviewJsonImportFile,
} from "./json-transfer-actions";
import { DeviceGravityController, requestDeviceGravityPermission } from "./device-gravity";
import { getDisplayDateRange, shiftDisplayAnchor, type DisplayMode } from "./display-period";
import {
  createVisibilitySafeSummaryLabel,
  createVisibilitySafeTitleLabel,
  receiptTitleLabels,
  renderBallDialog,
  renderReceiptDialog,
  renderReceiptQrDialog,
  type DialogRenderContext,
} from "./dialog-renderers";
import {
  renderBallEditDialog,
  renderCreateForm,
  type FormRenderContext,
} from "./form-renderers";
import { TinyImpactAudio } from "./impact-audio";
import {
  renderPendingJsonImportDialog,
  renderPendingUrlPacketDialog,
  renderSnoozedUrlPacketReminder,
} from "./import-dialog-renderers";
import { renderManualCopyDialog } from "./manual-copy-renderers";
import { visibilityValues, type BallDraft, type HappyBall, type NameBookEntry } from "./models";
import {
  createLinePacketImportUrl,
  createPacketImportUrl,
  parsePacketLocation,
  reviewPacketImport,
  type UrlPacketParseResult,
} from "./packet";
import { renderPanelOverlay } from "./overlay-renderers";
import { RapierStage, type PhysicsBallSnapshot, type VisualBallSource } from "./rapier-stage";
import { createReceiptImageBlob, createReceiptImageFileName } from "./receipt-image";
import {
  loadAppSettings,
  normalizeAppSettings,
  saveAppSettings,
  type AppSettings,
  type BallLabelMode,
} from "./settings";
import { bindSettingsPanelEvents } from "./settings-panel-events";
import {
  renderLedgerList,
  renderToolsPanel,
  type ToolsPanelRenderContext,
} from "./settings-renderers";
import {
  addBall,
  clearBallData,
  createDefaultDraft,
  DEFAULT_SAMPLE_NAME,
  deleteBall,
  getPrimarySelfName,
  importNewAndReplaceBalls,
  importNewBalls,
  loadLedger,
  markReceiptCreated,
  MAX_NAME_BOOK_ENTRIES,
  resetNameBook,
  todayIsoDate,
  updateBall,
  updateNameBook,
  type BallSaveMode,
} from "./storage";

const appRoot = getAppRoot();
const MIN_APP_VIEWPORT_HEIGHT = 320;

let ledger = loadLedger();
let draft = createDefaultDraft(getPrimarySelfName(ledger));
let appSettings: AppSettings;
let editableCategories: CategoryColorPreset[] = loadCategoryColorPresets();
let selectedBallId: string | null = ledger.balls[0]?.id ?? null;
let activeOverlay: ActiveOverlay = "none";
let displayMode: DisplayMode = "day";
let displayAnchorDate = ledger.balls[0]?.date ?? todayIsoDate();
let calendarMonth = createDefaultDraft().date.slice(0, 7);
let pendingUrlPacket: UrlPacketParseResult | null = parsePacketLocation(window.location.search, window.location.hash);
let snoozedUrlPacket: UrlPacketParseResult | null = null;
let pendingJsonImport: JsonImportReview | null = null;
let physicsStage: RapierStage | null = null;
const physicsSnapshots = new Map<string, PhysicsBallSnapshot>();
let openSettingsGroups: string[] = [];
let rapierReady = false;
let audioEngine: TinyImpactAudio;
let deviceGravity: DeviceGravityController;
let appViewportHeightFrame = 0;
let stageSwipeStart: { x: number; y: number; pointerId: number } | null = null;
let activeBallDialogEscapeHandler: (() => void) | null = null;
let createPromptDismissed = false;
let randomTextureVariables: Record<string, string> | null = null;

const BALL_DIALOG_ROOT_ID = "ball-dialog-root";
const RANDOM_TEXTURE_PROPERTY_NAMES = [
  "--texture-random-dot-1",
  "--texture-random-dot-2",
  "--texture-random-dot-3",
  "--texture-random-dot-4",
  "--texture-random-dot-5",
  "--texture-random-dot-6",
  "--texture-random-dot-7",
  "--texture-random-dot-8",
  "--texture-random-size-1",
  "--texture-random-size-2",
  "--texture-random-size-3",
  "--texture-random-size-4",
  "--texture-random-size-5",
  "--texture-random-size-6",
  "--texture-random-size-7",
  "--texture-random-size-8",
];
type ActiveOverlay = "none" | "create" | "list" | "settings" | "calendar";
const SETTINGS_GROUP_CLASSES = [
  "name-book-settings",
  "category-settings",
  "display-settings",
  "tuning-panel",
  "export-panel",
  "ball-management-panel",
  "app-about-panel",
];

window.addEventListener("error", (event) => {
  showFatalError(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  showFatalError(event.reason);
});

window.addEventListener("keydown", handleDisplayNavigationKey);
installAppViewportHeightSync();
void boot();

function installAppViewportHeightSync(): void {
  syncAppViewportHeight();

  const queueSettlingSync = () => {
    queueAppViewportHeightSync();
    window.setTimeout(queueAppViewportHeightSync, 80);
    window.setTimeout(queueAppViewportHeightSync, 240);
  };

  window.visualViewport?.addEventListener("resize", queueSettlingSync, { passive: true });
  window.visualViewport?.addEventListener("scroll", queueAppViewportHeightSync, { passive: true });
  window.addEventListener("resize", queueSettlingSync, { passive: true });
  window.addEventListener("orientationchange", queueSettlingSync, { passive: true });
}

function queueAppViewportHeightSync(): void {
  if (appViewportHeightFrame !== 0) {
    return;
  }

  appViewportHeightFrame = window.requestAnimationFrame(() => {
    appViewportHeightFrame = 0;
    syncAppViewportHeight();
  });
}

function syncAppViewportHeight(): void {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return;
  }

  document.documentElement.style.setProperty(
    "--app-viewport-height",
    `${Math.max(MIN_APP_VIEWPORT_HEIGHT, Math.round(viewportHeight))}px`,
  );
}

async function boot(): Promise<void> {
  try {
    appRoot.innerHTML = `<main class="loading-shell">Rapierを起動しています...</main>`;
    await RAPIER.init();
    appSettings = loadAppSettings();
    audioEngine = new TinyImpactAudio();
    installAudioLifecycleHandlers();
    deviceGravity = new DeviceGravityController((gravity) => {
      physicsStage?.setGravityVector(gravity);
    });
    syncGravityController();
    rapierReady = true;
    render();
  } catch (error) {
    showFatalError(error);
  }
}

function installAudioLifecycleHandlers(): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      audioEngine.suspend();
    }
  });

  window.addEventListener("pagehide", () => {
    audioEngine.close();
  });
}

function render(): void {
  openSettingsGroups = activeOverlay === "settings" ? readOpenSettingsGroups() : [];
  if (physicsStage) {
    for (const snapshot of physicsStage.captureSnapshots()) {
      physicsSnapshots.set(snapshot.id, snapshot);
    }
  }
  closeBallDialog();
  const visibleBalls = getVisibleBalls();
  const selectedBall = visibleBalls.find((ball) => ball.id === selectedBallId) ?? visibleBalls[0] ?? null;
  selectedBallId = selectedBall?.id ?? null;

  physicsStage?.destroy();
  physicsStage = null;

  appRoot.innerHTML = `
    <main class="app-shell ball-world-shell">
      <section class="stage ${appSettings.ballLabelMode !== "none" ? "show-ball-labels" : ""} label-mode-${appSettings.ballLabelMode}" aria-label="えもい玉">
        <div class="stage-topline">
          <div>
            <h1 id="stage-title">${escapeHtml(selectedBall ? createVisibilitySafeSummaryLabel(selectedBall) : "今日のえもい玉は？")}</h1>
            <p class="stage-filter">${escapeHtml(renderDisplayRangeLabel())}</p>
          </div>
        </div>
        <div id="ball-field" class="ball-field texture-${appSettings.backgroundTexture}" aria-label="触って転がせるえもい玉"></div>
        <div class="world-control-dock">
          ${createPromptDismissed ? "" : `<p class="world-action-prompt">＋で玉を置きましょう</p>`}
          <div class="world-actions" aria-label="操作">
            <button type="button" data-open-panel="create" aria-label="玉を作る">＋</button>
            <button type="button" data-open-panel="calendar" aria-label="カレンダー">Cal</button>
            <div class="display-mode-control" role="group" aria-label="表示期間">
              ${renderDisplayModeButton("day", "日")}
              ${renderDisplayModeButton("week", "週")}
              ${renderDisplayModeButton("month", "月")}
            </div>
            <button type="button" id="label-toggle" class="${appSettings.ballLabelMode !== "none" ? "is-on" : ""}" aria-label="${renderBallLabelModeAriaLabel()}">${renderBallLabelModeButtonText()}</button>
            <button type="button" data-open-panel="settings" aria-label="設定">⚙</button>
          </div>
        </div>
      </section>
      ${renderActiveOverlay()}
      ${renderSnoozedUrlPacketReminder(snoozedUrlPacket)}
      ${renderPendingUrlPacketDialog(pendingUrlPacket, getImportDialogRenderContext())}
      ${renderPendingJsonImportDialog(pendingJsonImport, appSettings.emotionEchoStrength)}
    </main>
  `;

  applyBallFieldTextureSetting();
  bindEvents();
  mountRapierStage(visibleBalls);
}

function getVisibleBalls(): HappyBall[] {
  const range = getDisplayDateRange(displayMode, displayAnchorDate);
  return ledger.balls.filter((ball) => ball.date >= range.start && ball.date <= range.end);
}

function getDialogRenderContext(): DialogRenderContext {
  return {
    currentUrl: window.location.href,
    showMemoField: appSettings.showMemoField,
    emotionEchoStrength: appSettings.emotionEchoStrength,
  };
}

function getFormRenderContext(): FormRenderContext {
  return {
    categories: editableCategories,
    nameBook: ledger.ownerProfile.nameBook,
  };
}

function getToolsPanelRenderContext(): ToolsPanelRenderContext {
  return {
    appSettings,
    appVersion: __APP_VERSION__,
    categories: editableCategories,
    openSettingsGroups,
    nameBook: ledger.ownerProfile.nameBook,
    maxNameBookEntries: MAX_NAME_BOOK_ENTRIES,
    defaultSampleName: DEFAULT_SAMPLE_NAME,
  };
}

function readOpenSettingsGroups(): string[] {
  return Array.from(document.querySelectorAll<HTMLDetailsElement>(".floating-panel-settings details.settings-group[open]"))
    .map((details) => SETTINGS_GROUP_CLASSES.find((className) => details.classList.contains(className)))
    .slice(0, 1)
    .filter((className): className is string => Boolean(className));
}

function getImportDialogRenderContext() {
  return {
    localBalls: ledger.balls,
    dialogContext: getDialogRenderContext(),
    emotionEchoStrength: appSettings.emotionEchoStrength,
  };
}

function renderDisplayModeButton(mode: DisplayMode, label: string): string {
  return `
    <button
      class="${displayMode === mode ? "is-on" : ""}"
      type="button"
      data-display-mode="${mode}"
      aria-label="${renderDisplayModeAriaLabel(mode)}"
      aria-pressed="${displayMode === mode ? "true" : "false"}"
    >${label}</button>
  `;
}

function renderDisplayModeAriaLabel(mode: DisplayMode): string {
  if (mode === "day") {
    return "選択した日の玉";
  }
  if (mode === "week") {
    return "選択した日を含む週の玉";
  }
  return "選択した日を含む月の玉";
}

function renderDisplayRangeLabel(): string {
  const range = getDisplayDateRange(displayMode, displayAnchorDate);
  if (displayMode === "day") {
    return `${displayAnchorDate} の玉`;
  }
  if (displayMode === "week") {
    return `${range.start} - ${range.end} の週`;
  }
  return `${displayAnchorDate.slice(0, 7)} の月`;
}

function renderBallLabelModeButtonText(): string {
  if (appSettings.ballLabelMode === "date") {
    return "日";
  }
  if (appSettings.ballLabelMode === "title") {
    return "題";
  }
  return "無";
}

function renderBallLabelModeAriaLabel(): string {
  if (appSettings.ballLabelMode === "date") {
    return "玉の文字表示: 日付";
  }
  if (appSettings.ballLabelMode === "title") {
    return "玉の文字表示: タイトル";
  }
  return "玉の文字表示: なし";
}

function renderActiveOverlay(): string {
  if (activeOverlay === "none") {
    return "";
  }

  if (activeOverlay === "calendar") {
    return renderCalendarOverlay({
      balls: ledger.balls,
      calendarMonth,
      selectedDate: displayAnchorDate,
      emotionEchoStrength: appSettings.emotionEchoStrength,
    });
  }

  if (activeOverlay === "create") {
    draft = { ...draft, date: displayAnchorDate };
    return renderPanelOverlay("玉を置く", renderCreateForm(draft, getFormRenderContext()), "create");
  }

  if (activeOverlay === "list") {
    return renderPanelOverlay("保存された玉", renderLedgerList(ledger.balls, selectedBallId), "list");
  }

  return renderPanelOverlay("設定とデータ", renderToolsPanel(getToolsPanelRenderContext()), "settings");
}

function shiftCurrentDisplayAnchor(delta: -1 | 1): void {
  displayAnchorDate = shiftDisplayAnchor(displayMode, displayAnchorDate, delta);
  calendarMonth = displayAnchorDate.slice(0, 7);
  draft = { ...draft, date: displayAnchorDate };
}

function showBallDialog(ballId: string): void {
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }

  closeBallDialog();
  const root = document.createElement("div");
  root.id = BALL_DIALOG_ROOT_ID;
  root.innerHTML = renderBallDialog(ball, getDialogRenderContext());
  document.body.appendChild(root);

  const backdrop = root.querySelector<HTMLElement>("[data-dialog-backdrop]");
  const closeButton = root.querySelector<HTMLButtonElement>("[data-dialog-close]");
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeBallDialog();
    }
  });
  closeButton?.addEventListener("click", closeBallDialog);
  root.querySelectorAll<HTMLButtonElement>("[data-dialog-edit-ball-id]").forEach((button) => {
    button.addEventListener("click", () => {
      showBallEditDialog(ballId);
    });
  });
  root.querySelector<HTMLButtonElement>("[data-dialog-receipt-ball-id]")?.addEventListener("click", () => {
    showReceiptDialog(ballId);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-detail-id-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest("div");
      const expanded = row?.classList.toggle("is-expanded-id") ?? false;
      button.textContent = expanded ? "省略" : "全表示";
    });
  });
  installBallDialogEscapeHandler(closeBallDialog);
  closeButton?.focus({ preventScroll: true });
}

function showReceiptDialog(ballId: string): void {
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }

  closeBallDialog();
  const root = document.createElement("div");
  root.id = BALL_DIALOG_ROOT_ID;
  root.innerHTML = renderReceiptDialog(ball, getDialogRenderContext());
  document.body.appendChild(root);

  const backdrop = root.querySelector<HTMLElement>("[data-dialog-backdrop]");
  const closeButton = root.querySelector<HTMLButtonElement>("[data-dialog-close]");
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeBallDialog();
    }
  });
  closeButton?.addEventListener("click", closeBallDialog);
  root.querySelector<HTMLButtonElement>("[data-dialog-back-to-ball-id]")?.addEventListener("click", () => {
    showBallDialog(ballId);
  });
  root.querySelector<HTMLButtonElement>("[data-show-ball-qr-id]")?.addEventListener("click", () => {
    showReceiptQrDialog(ballId);
  });
  root.querySelector<HTMLButtonElement>("[data-share-receipt-image-id]")?.addEventListener("click", () => {
    void shareReceiptImage(ballId);
  });
  root.querySelector<HTMLButtonElement>("[data-download-receipt-image-id]")?.addEventListener("click", () => {
    void downloadReceiptImage(ballId);
  });
  root.querySelector<HTMLButtonElement>("[data-copy-ball-url-id]")?.addEventListener("click", () => {
    void copyBallUrl(ballId);
  });
  root.querySelector<HTMLButtonElement>("[data-copy-ball-line-url-id]")?.addEventListener("click", () => {
    void copyBallLineUrl(ballId);
  });
  installBallDialogEscapeHandler(closeBallDialog);
  closeButton?.focus({ preventScroll: true });
}

function showReceiptQrDialog(ballId: string): void {
  ledger = markReceiptCreated(ledger, ballId);
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }
  updateReceiptCreatedIndicators(ball);

  closeBallDialog();
  const root = document.createElement("div");
  root.id = BALL_DIALOG_ROOT_ID;
  root.innerHTML = renderReceiptQrDialog(ball, getDialogRenderContext());
  document.body.appendChild(root);

  const backdrop = root.querySelector<HTMLElement>("[data-dialog-backdrop]");
  const closeButton = root.querySelector<HTMLButtonElement>("[data-dialog-close]");
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeBallDialog();
    }
  });
  closeButton?.addEventListener("click", closeBallDialog);
  root.querySelector<HTMLButtonElement>("[data-dialog-receipt-ball-id]")?.addEventListener("click", () => {
    showReceiptDialog(ballId);
  });
  root.querySelector<HTMLButtonElement>("[data-copy-ball-url-id]")?.addEventListener("click", () => {
    void copyBallUrl(ballId);
  });
  installBallDialogEscapeHandler(closeBallDialog);
  closeButton?.focus({ preventScroll: true });
}

function showBallEditDialog(ballId: string): void {
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }

  closeBallDialog();
  const root = document.createElement("div");
  root.id = BALL_DIALOG_ROOT_ID;
  root.innerHTML = renderBallEditDialog(ball, getFormRenderContext());
  document.body.appendChild(root);

  const backdrop = root.querySelector<HTMLElement>("[data-dialog-backdrop]");
  const closeButtons = root.querySelectorAll<HTMLButtonElement>("[data-dialog-close]");
  const form = root.querySelector<HTMLFormElement>("#ball-edit-form");
  const requestClose = () => requestCloseBallEditDialog(root, form, ball);
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      requestClose();
    }
  });
  closeButtons.forEach((button) => button.addEventListener("click", requestClose));
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    requestSaveBallEditDialog(root, form, ball);
  });
  bindNamePresetEvents(root);
  installBallDialogEscapeHandler(requestClose);
  root.querySelector<HTMLButtonElement>("[data-dialog-close]")?.focus({ preventScroll: true });
}

function closeBallDialog(): void {
  document.querySelector(`#${BALL_DIALOG_ROOT_ID}`)?.remove();
  document.removeEventListener("keydown", closeBallDialogOnEscape);
  activeBallDialogEscapeHandler = null;
}

function closeBallDialogOnEscape(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    activeBallDialogEscapeHandler?.();
  }
}

function installBallDialogEscapeHandler(handler: () => void): void {
  document.removeEventListener("keydown", closeBallDialogOnEscape);
  activeBallDialogEscapeHandler = handler;
  document.addEventListener("keydown", closeBallDialogOnEscape);
}

function saveBallEditForm(form: HTMLFormElement | null, saveMode: BallSaveMode): void {
  const editingId = form?.dataset.editingBallId;
  if (!form || !editingId) {
    return;
  }
  ledger = updateBall(ledger, editingId, readDraft(form), saveMode);
  selectedBallId = editingId;
  render();
  showBallDialog(editingId);
}

function requestSaveBallEditDialog(root: HTMLElement, form: HTMLFormElement | null, originalBall: HappyBall): void {
  if (!form) {
    return;
  }
  if (!hasEditDraftChanged(originalBall, readDraft(form))) {
    closeBallDialog();
    showBallDialog(originalBall.id);
    return;
  }

  showEditSaveModeConfirm(root, form, "save");
}

function requestCloseBallEditDialog(root: HTMLElement, form: HTMLFormElement | null, originalBall: HappyBall): void {
  if (!form || !hasEditDraftChanged(originalBall, readDraft(form))) {
    closeBallDialog();
    return;
  }

  showEditSaveModeConfirm(root, form, "close");
}

function showEditSaveModeConfirm(root: HTMLElement, form: HTMLFormElement, reason: "save" | "close"): void {
  const existing = root.querySelector<HTMLDivElement>("[data-edit-unsaved-confirm]");
  if (existing) {
    existing.remove();
  }

  const confirmRoot = document.createElement("div");
  confirmRoot.className = "edit-unsaved-backdrop";
  confirmRoot.dataset.editUnsavedConfirm = "true";
  const isClose = reason === "close";
  confirmRoot.innerHTML = `
    <section class="edit-unsaved-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-unsaved-title">
      <h3 id="edit-unsaved-title">${isClose ? "保存しますか？" : "保存方法を選んでください"}</h3>
      <p>${isClose ? "変更した内容があります。" : "前の状態を余韻に残すか、訂正として保存できます。"}</p>
      <div class="edit-unsaved-actions">
        <button class="primary-action" type="button" data-edit-save-echo>${isClose ? "余韻として保存して閉じる" : "余韻として保存"}</button>
        <button class="ghost-action" type="button" data-edit-save-correction>${isClose ? "訂正として保存して閉じる" : "訂正として保存"}</button>
        <button class="ghost-action" type="button" data-edit-continue>編集を続ける</button>
        ${isClose ? `<button class="ghost-action danger-action" type="button" data-edit-discard-close>保存せず閉じる</button>` : ""}
      </div>
    </section>
  `;
  root.appendChild(confirmRoot);
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-save-echo]")?.addEventListener("click", () => {
    saveBallEditForm(form, "withEcho");
  });
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-save-correction]")?.addEventListener("click", () => {
    saveBallEditForm(form, "correction");
  });
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-continue]")?.addEventListener("click", () => {
    confirmRoot.remove();
  });
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-discard-close]")?.addEventListener("click", closeBallDialog);
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-save-echo]")?.focus({ preventScroll: true });
}

function hasEditDraftChanged(ball: HappyBall, next: BallDraft): boolean {
  return (
    next.date !== ball.date ||
    next.subject.trim() !== ball.subject ||
    next.issuerType !== ball.issuerType ||
    Number(next.count) !== ball.count ||
    next.title.trim() !== ball.title ||
    next.category.trim() !== ball.category ||
    next.note.trim() !== ball.note ||
    next.visibility !== ball.visibility
  );
}

function mountRapierStage(balls: HappyBall[]): void {
  const field = document.querySelector<HTMLDivElement>("#ball-field");
  if (!field || !rapierReady) {
    return;
  }

  physicsStage = new RapierStage(
    field,
    expandVisualBalls(balls),
    (ballId) => {
      selectedBallId = ballId;
      updateSelectedState();
      updateSelectedSummary();
    },
    (ballId) => {
      selectedBallId = ballId;
      updateSelectedState();
      updateSelectedSummary();
      showBallDialog(ballId);
    },
    appSettings,
    audioEngine,
  );
  physicsStage.start();
}

function expandVisualBalls(balls: HappyBall[]): VisualBallSource[] {
  return balls.flatMap((ball) => {
    const count = Math.max(1, Math.min(ball.count, 12));
    return Array.from({ length: count }, (_, index) => {
      const label = createBallDisplayLabel(ball, appSettings.ballLabelMode);
      return {
        id: `${ball.id}_${index}`,
        ballId: ball.id,
        hue: ball.visual.hue,
        saturation: ball.visual.saturation,
        lightness: ball.visual.lightness,
        visualKind: ball.visual.kind,
        echo: shouldShowEmotionEcho(ball) ? ball.emotionEcho?.visual ?? null : null,
        snapshot: physicsSnapshots.get(`${ball.id}_${index}`) ?? null,
        label,
        labelClass: createBallLabelClass(label),
        title: ball.title,
      };
    });
  });
}

function createBallDisplayLabel(ball: HappyBall, mode: BallLabelMode): string {
  if (mode === "date") {
    return formatBallDateLabel(ball.date);
  }
  if (mode === "title") {
    return createVisibilitySafeTitleLabel(ball);
  }
  return "";
}

function createBallLabelClass(label: string): string {
  const length = Array.from(label).length;
  if (length <= 4) {
    return "label-short";
  }
  if (length <= 8) {
    return "label-medium";
  }
  if (length <= 16) {
    return "label-long";
  }
  return "label-xlong";
}

function formatBallDateLabel(date: string): string {
  const [, month, day] = date.split("-");
  return month && day ? `${Number(month)}/${Number(day)}` : date;
}

function updateSelectedState(): void {
  document.querySelectorAll(".ledger-item").forEach((item) => {
    const select = item.querySelector<HTMLElement>("[data-select-ball-id]");
    item.classList.toggle("is-selected", select?.dataset.selectBallId === selectedBallId);
  });
}

function updateSelectedSummary(): void {
  const selectedBall = getVisibleBalls().find((ball) => ball.id === selectedBallId) ?? null;
  const title = document.querySelector<HTMLElement>("#stage-title");
  if (title) {
    title.textContent = selectedBall ? createVisibilitySafeSummaryLabel(selectedBall) : "今日のえもい玉は？";
  }
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-open-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = button.dataset.openPanel;
      if (!isActiveOverlay(panel)) {
        return;
      }
      if (panel === "calendar") {
        calendarMonth = displayAnchorDate.slice(0, 7);
      }
      if (panel === "create") {
        createPromptDismissed = true;
      }
      activeOverlay = panel;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-display-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = readDisplayMode(button.dataset.displayMode);
      if (!mode) {
        return;
      }
      displayMode = mode;
      draft = { ...draft, date: displayAnchorDate };
      render();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-close-panel]").forEach((element) => {
    element.addEventListener("click", (event) => {
      const isBackdrop = element.classList.contains("panel-backdrop");
      if (isBackdrop && event.target !== element) {
        return;
      }
      activeOverlay = "none";
      render();
    });
  });

  document.querySelector("#label-toggle")?.addEventListener("click", () => {
    updateAppSettings({ ballLabelMode: nextBallLabelMode(appSettings.ballLabelMode) });
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-calendar-month]").forEach((button) => {
    button.addEventListener("click", () => {
      calendarMonth = button.dataset.calendarMonth || calendarMonth;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-filter-date]").forEach((button) => {
    button.addEventListener("click", () => {
      displayAnchorDate = button.dataset.filterDate ?? displayAnchorDate;
      displayMode = "day";
      if (displayAnchorDate) {
        draft = { ...draft, date: displayAnchorDate };
      }
      activeOverlay = "none";
      render();
    });
  });

  bindDisplaySwipeEvents();

  const form = document.querySelector<HTMLFormElement>("#ball-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    audioEngine.unlock();
    draft = readDraft(form);
    ledger = addBall(ledger, draft);
    selectedBallId = ledger.balls[0]?.id ?? null;
    displayAnchorDate = draft.date;
    displayMode = "day";
    activeOverlay = "none";
    draft = { ...createDefaultDraft(getPrimarySelfName(ledger)), subject: draft.subject, issuerType: draft.issuerType };
    render();
  });

  form?.addEventListener("input", () => {
    draft = readDraft(form);
  });

  bindSummaryActionEvents();
  bindSettingsGroupDisclosureEvents();
  bindPendingUrlPacketEvents();
  bindNamePresetEvents();
  bindSettingsPanelEvents({
    categories: editableCategories,
    maxNameBookEntries: MAX_NAME_BOOK_ENTRIES,
    handlers: {
      unlockAudio: () => audioEngine.unlock(),
      toggleGravitySensor: () => {
        void toggleGravitySensor();
      },
      updateAppSettings,
      saveCategories: applyCategorySettings,
      resetCategories: resetCategorySettings,
      saveNameBook: applyNameBookSettings,
      resetNameBook: resetNameBookSettings,
    },
  });

  document.querySelector("#clear-ball-data")?.addEventListener("click", () => {
    if (!confirm("保存された玉データをすべて消します。名前帳、アプリ設定、カテゴリ設定は残ります。実行しますか？")) {
      return;
    }
    ledger = clearBallData(ledger);
    selectedBallId = null;
    render();
  });

  document.querySelector("#export-json")?.addEventListener("click", () => {
    exportSelectedJson({ ledger, appSettings, categories: editableCategories });
  });

  document.querySelector("#import-json")?.addEventListener("click", () => {
    document.querySelector<HTMLInputElement>("#import-json-file")?.click();
  });
  document.querySelector<HTMLInputElement>("#import-json-file")?.addEventListener("change", (event) => {
    const input = event.currentTarget;
    if (input instanceof HTMLInputElement) {
      void handleJsonImportFile(input);
    }
  });

  bindJsonImportEvents();

  document.querySelectorAll<HTMLButtonElement>("[data-select-ball-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedBallId = button.dataset.selectBallId ?? selectedBallId;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-edit-ball-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.editBallId;
      if (!id) {
        return;
      }
      selectedBallId = id;
      updateSelectedState();
      updateSelectedSummary();
      showBallEditDialog(id);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-copy-ball-url-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.copyBallUrlId;
      if (id) {
        void copyBallUrl(id);
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-copy-ball-line-url-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.copyBallLineUrlId;
      if (id) {
        void copyBallLineUrl(id);
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-delete-ball-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteBallId;
      if (!id) {
        return;
      }
      const target = ledger.balls.find((ball) => ball.id === id);
      if (!target || !confirm(`「${target.title}」を削除しますか？`)) {
        return;
      }
      ledger = deleteBall(ledger, id);
      selectedBallId = ledger.balls[0]?.id ?? null;
      render();
    });
  });
}

function bindSummaryActionEvents(): void {
  document.querySelectorAll<HTMLButtonElement>(".summary-action").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });
}

function bindSettingsGroupDisclosureEvents(): void {
  const groups = Array.from(document.querySelectorAll<HTMLDetailsElement>(".floating-panel-settings details.settings-group"));
  groups.forEach((group) => {
    group.addEventListener("toggle", () => {
      if (!group.open) {
        openSettingsGroups = readOpenSettingsGroups();
        return;
      }
      for (const otherGroup of groups) {
        if (otherGroup !== group) {
          otherGroup.open = false;
        }
      }
      openSettingsGroups = readOpenSettingsGroups();
    });
  });
}

async function handleJsonImportFile(input: HTMLInputElement): Promise<void> {
  const review = await reviewJsonImportFile(input, ledger);
  if (!review) {
    return;
  }

  pendingJsonImport = review;
  activeOverlay = "none";
  render();
}

function bindJsonImportEvents(): void {
  document.querySelector("#dismiss-json-import")?.addEventListener("click", () => {
    pendingJsonImport = null;
    render();
  });

  document.querySelector("#confirm-json-import")?.addEventListener("click", () => {
    applyPendingJsonImport();
  });
}

function applyPendingJsonImport(): void {
  if (!pendingJsonImport || pendingJsonImport.error) {
    return;
  }

  const selectedSections = readSelectedJsonImportSections();

  if (selectedSections.length === 0) {
    alert("読み込む内容を選んでください。");
    return;
  }

  const result = applyJsonImportReview(pendingJsonImport, selectedSections, { ledger, selectedBallId });
  ledger = result.ledger;
  selectedBallId = result.selectedBallId;

  if (result.appSettings) {
    appSettings = result.appSettings;
    saveAppSettings(appSettings);
  }

  if (result.categories) {
    editableCategories = saveCategoryColorPresets(result.categories);
  }

  pendingJsonImport = null;
  activeOverlay = "none";
  render();
}

async function shareReceiptImage(ballId: string): Promise<void> {
  const prepared = prepareReceiptImageBall(ballId);
  if (!prepared) {
    return;
  }

  const { ball } = prepared;
  const fileName = createReceiptImageFileName(ball);
  const blob = await createReceiptImageBlob(ball, getReceiptImageContext());
  const file = new File([blob], fileName, { type: "image/png" });

  try {
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      throw new Error("File sharing is unavailable.");
    }
    await navigator.share({
      files: [file],
      title: `えもい玉 ${receiptTitleLabels[ball.issuerType]}`,
      text: `${receiptTitleLabels[ball.issuerType]}です。`,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    downloadBlob(blob, fileName);
    alert("この端末では直接共有できなかったため、画像として保存しました。LINEで画像添付してください。");
  }
}

async function downloadReceiptImage(ballId: string): Promise<void> {
  const prepared = prepareReceiptImageBall(ballId);
  if (!prepared) {
    return;
  }

  const blob = await createReceiptImageBlob(prepared.ball, getReceiptImageContext());
  downloadBlob(blob, createReceiptImageFileName(prepared.ball));
}

function getReceiptImageContext() {
  return {
    currentUrl: window.location.href,
    showMemoField: appSettings.showMemoField,
  };
}

function prepareReceiptImageBall(ballId: string): { ball: HappyBall } | null {
  ledger = markReceiptCreated(ledger, ballId);
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return null;
  }
  updateReceiptCreatedIndicators(ball);
  return { ball };
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function bindPendingUrlPacketEvents(): void {
  document.querySelector("#dismiss-url-packet")?.addEventListener("click", () => {
    if (pendingUrlPacket?.ok) {
      snoozedUrlPacket = pendingUrlPacket;
    }
    pendingUrlPacket = null;
    render();
  });

  document.querySelector("#clear-url-packet")?.addEventListener("click", () => {
    pendingUrlPacket = null;
    snoozedUrlPacket = null;
    clearLocationPacketParams();
    render();
  });

  document.querySelector("#show-snoozed-url-packet")?.addEventListener("click", () => {
    pendingUrlPacket = snoozedUrlPacket;
    snoozedUrlPacket = null;
    render();
  });

  document.querySelector("#clear-snoozed-url-packet")?.addEventListener("click", () => {
    pendingUrlPacket = null;
    snoozedUrlPacket = null;
    clearLocationPacketParams();
    render();
  });

  document.querySelector("#confirm-url-import")?.addEventListener("click", () => {
    if (!pendingUrlPacket?.ok) {
      return;
    }
    const review = reviewPacketImport(pendingUrlPacket.packet, ledger.balls);
    ledger = importNewBalls(ledger, review.newItems);
    selectedBallId = review.newItems[0]?.id ?? selectedBallId;
    displayAnchorDate = review.newItems[0]?.date ?? displayAnchorDate;
    displayMode = "day";
    activeOverlay = "none";
    pendingUrlPacket = null;
    snoozedUrlPacket = null;
    clearLocationPacketParams();
    render();
  });

  document.querySelector("#replace-url-import")?.addEventListener("click", () => {
    if (!pendingUrlPacket?.ok) {
      return;
    }
    const review = reviewPacketImport(pendingUrlPacket.packet, ledger.balls);
    if (review.conflicts.length === 0) {
      return;
    }
    ledger = importNewAndReplaceBalls(ledger, review.newItems, review.conflicts);
    selectedBallId = review.newItems[0]?.id ?? review.conflicts[0]?.id ?? selectedBallId;
    displayAnchorDate = review.newItems[0]?.date ?? review.conflicts[0]?.date ?? displayAnchorDate;
    displayMode = "day";
    activeOverlay = "none";
    pendingUrlPacket = null;
    snoozedUrlPacket = null;
    clearLocationPacketParams();
    render();
  });
}

async function copyBallUrl(ballId: string): Promise<void> {
  ledger = markReceiptCreated(ledger, ballId);
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }
  updateReceiptCreatedIndicators(ball);

  const url = createPacketImportUrl(ball, window.location.href);
  await copyTextWithFallback(url, "玉URLをコピーしました。");
}

async function copyBallLineUrl(ballId: string): Promise<void> {
  ledger = markReceiptCreated(ledger, ballId);
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }
  updateReceiptCreatedIndicators(ball);

  const url = createLinePacketImportUrl(ball, window.location.href);
  await copyTextWithFallback(url, "LINE用の玉URLをコピーしました。");
}

function updateReceiptCreatedIndicators(ball: HappyBall): void {
  if (!ball.receiptCreatedAt) {
    return;
  }

  document.querySelectorAll<HTMLElement>("[data-receipt-status-ball-id]").forEach((element) => {
    if (element.dataset.receiptStatusBallId === ball.id) {
      element.textContent = "作成済み";
    }
  });
  document.querySelectorAll<HTMLElement>("[data-receipt-thumb-ball-id]").forEach((element) => {
    if (element.dataset.receiptThumbBallId === ball.id) {
      element.hidden = false;
    }
  });
}

async function copyTextWithFallback(text: string, successMessage: string): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API is unavailable.");
    }
    await navigator.clipboard.writeText(text);
    alert(successMessage);
    return;
  } catch {
    if (copyTextWithLegacySelection(text)) {
      alert(successMessage);
      return;
    }

    showManualCopyDialog(text);
  }
}

function copyTextWithLegacySelection(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  textarea.remove();
  if (previousRange && selection) {
    selection.removeAllRanges();
    selection.addRange(previousRange);
  }
  return copied;
}

function showManualCopyDialog(text: string): void {
  const root = document.createElement("div");
  root.id = "manual-copy-root";
  root.innerHTML = renderManualCopyDialog(text);
  document.body.appendChild(root);

  const close = () => root.remove();
  const textarea = root.querySelector<HTMLTextAreaElement>(".manual-copy-text");
  root.querySelector("[data-manual-copy-close]")?.addEventListener("click", close);
  root.querySelector("[data-manual-copy-backdrop]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      close();
    }
  });
  textarea?.focus({ preventScroll: true });
  textarea?.select();
}

function clearLocationPacketParams(): void {
  const params = new URLSearchParams(location.search);
  params.delete("import");
  params.delete("ball");
  params.delete("openExternalBrowser");
  const search = params.toString();
  history.replaceState(null, document.title, `${location.pathname}${search ? `?${search}` : ""}`);
}

function bindDisplaySwipeEvents(): void {
  const field = document.querySelector<HTMLElement>("#ball-field");
  if (!field) {
    return;
  }

  field.addEventListener("pointerdown", (event) => {
    if (isBallInteractionTarget(event.target)) {
      stageSwipeStart = null;
      return;
    }
    stageSwipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  });

  field.addEventListener("pointerup", (event) => {
    if (!stageSwipeStart || stageSwipeStart.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - stageSwipeStart.x;
    const deltaY = event.clientY - stageSwipeStart.y;
    stageSwipeStart = null;
    if (Math.abs(deltaX) < 72 || Math.abs(deltaY) > 64) {
      return;
    }
    navigateDisplayPeriod(deltaX < 0 ? 1 : -1);
  });

  field.addEventListener("pointercancel", () => {
    stageSwipeStart = null;
  });
}

function isBallInteractionTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(".physics-ball"));
}

function handleDisplayNavigationKey(event: KeyboardEvent): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
    return;
  }
  if (activeOverlay !== "none" || document.querySelector(`#${BALL_DIALOG_ROOT_ID}`)) {
    return;
  }
  if (isEditableKeyboardTarget(event.target)) {
    return;
  }
  event.preventDefault();
  navigateDisplayPeriod(event.key === "ArrowRight" ? 1 : -1);
}

function navigateDisplayPeriod(delta: -1 | 1): void {
  if (activeOverlay !== "none") {
    return;
  }
  shiftCurrentDisplayAnchor(delta);
  render();
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest("input, textarea, select, button, [contenteditable='true']"));
}

function isActiveOverlay(value: string | undefined): value is ActiveOverlay {
  return value === "create" || value === "list" || value === "settings" || value === "calendar";
}

function readDisplayMode(value: string | undefined): DisplayMode | null {
  return value === "day" || value === "week" || value === "month" ? value : null;
}

function nextBallLabelMode(mode: BallLabelMode): BallLabelMode {
  if (mode === "none") {
    return "date";
  }
  if (mode === "date") {
    return "title";
  }
  return "none";
}

async function toggleGravitySensor(): Promise<void> {
  audioEngine.unlock();
  if (appSettings.gravityEnabled) {
    updateAppSettings({ gravityEnabled: false });
    render();
    return;
  }

  const granted = await requestDeviceGravityPermission();
  if (!granted) {
    alert("この端末またはブラウザでは重力センサーを有効にできませんでした。");
    return;
  }

  updateAppSettings({ gravityEnabled: true });
  render();
}

function syncGravityController(): void {
  if (!deviceGravity) {
    return;
  }
  deviceGravity.updateStrength(appSettings.gravityStrength);
  if (appSettings.gravityEnabled) {
    deviceGravity.start();
  } else {
    deviceGravity.stop();
    physicsStage?.setGravityVector({ x: 0, y: 0 });
  }
}

function applyCategorySettings(nextCategories: CategoryColorPreset[]): CategoryColorPreset[] {
  editableCategories = saveCategoryColorPresets(nextCategories);
  return editableCategories;
}

function resetCategorySettings(): void {
  editableCategories = resetCategoryColorPresets();
  render();
}

function applyNameBookSettings(entries: NameBookEntry[]): NameBookEntry[] {
  const previousDefaultName = getPrimarySelfName(ledger);
  ledger = updateNameBook(ledger, entries);
  const nextDefaultName = getPrimarySelfName(ledger);
  if (!draft.subject.trim() || draft.subject === previousDefaultName || draft.subject === "自分") {
    draft = { ...draft, subject: nextDefaultName };
  }
  return ledger.ownerProfile.nameBook;
}

function resetNameBookSettings(): void {
  const previousDefaultName = getPrimarySelfName(ledger);
  ledger = resetNameBook(ledger);
  const nextDefaultName = getPrimarySelfName(ledger);
  if (!draft.subject.trim() || draft.subject === previousDefaultName || draft.subject === "自分") {
    draft = { ...draft, subject: nextDefaultName };
  }
  render();
}

function bindNamePresetEvents(root: ParentNode = document): void {
  root.querySelectorAll<HTMLSelectElement>("[data-name-preset]").forEach((select) => {
    select.addEventListener("change", () => {
      const selected = select.selectedOptions[0];
      const name = select.value.trim();
      const role = selected?.dataset.nameRole;
      const form = select.closest("form");
      const subjectInput = form?.querySelector<HTMLInputElement>("input[name='subject']");
      const issuerSelect = form?.querySelector<HTMLSelectElement>("select[name='issuerType']");
      if (!form || !subjectInput || !name) {
        return;
      }

      subjectInput.value = name;
      if (role === "proxy") {
        if (issuerSelect) {
          issuerSelect.value = "proxy";
        }
      } else if (issuerSelect?.value === "proxy") {
        issuerSelect.value = "self";
      }

      if (form.id === "ball-form") {
        draft = readDraft(form);
      }
    });
  });
}

function updateAppSettings(patch: Partial<AppSettings>): void {
  appSettings = normalizeAppSettings({ ...appSettings, ...patch });
  saveAppSettings(appSettings);
  syncGravityController();
  applyBallFieldTextureSetting();
  physicsStage?.updateSettings(appSettings);
}

function applyBallFieldTextureSetting(): void {
  const field = document.querySelector<HTMLElement>("#ball-field");
  if (!field) {
    return;
  }
  field.classList.remove("texture-grid", "texture-paper", "texture-grain", "texture-mist", "texture-random");
  field.classList.add(`texture-${appSettings.backgroundTexture}`);
  if (appSettings.backgroundTexture !== "random") {
    randomTextureVariables = null;
    clearRandomTextureVariables(field);
    return;
  }

  randomTextureVariables ??= createRandomTextureVariables();
  for (const [property, value] of Object.entries(randomTextureVariables)) {
    field.style.setProperty(property, value);
  }
}

function clearRandomTextureVariables(field: HTMLElement): void {
  for (const property of RANDOM_TEXTURE_PROPERTY_NAMES) {
    field.style.removeProperty(property);
  }
}

function createRandomTextureVariables(): Record<string, string> {
  const variables: Record<string, string> = {};
  for (let index = 1; index <= 8; index += 1) {
    variables[`--texture-random-dot-${index}`] = `${randomInteger(8, 92)}% ${randomInteger(10, 90)}%`;
    variables[`--texture-random-size-${index}`] = `${randomInteger(28, 76)}px ${randomInteger(31, 82)}px`;
  }
  return variables;
}

function randomInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function readDraft(form: HTMLFormElement): BallDraft {
  const data = new FormData(form);
  return {
    date: String(data.get("date") || draft.date),
    subject: String(data.get("subject") || getPrimarySelfName(ledger) || DEFAULT_SAMPLE_NAME),
    issuerType: readUnion(data.get("issuerType"), ["self", "assisted", "proxy"], "self"),
    count: Number(data.get("count") || 1),
    title: String(data.get("title") || ""),
    category: String(data.get("category") || "日常"),
    note: String(data.get("note") || ""),
    visibility: readUnion(data.get("visibility"), visibilityValues, "open"),
  };
}

function readUnion<const T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function shouldShowEmotionEcho(ball: HappyBall): boolean {
  return Boolean(ball.emotionEcho) && appSettings.emotionEchoStrength !== "off";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getAppRoot(): HTMLDivElement {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("App root was not found.");
  }
  return root;
}

function showFatalError(error: unknown): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  appRoot.innerHTML = `
    <main class="loading-shell error-shell">
      <div>
        <strong>起動に失敗しました</strong>
        <pre>${escapeHtml(message)}</pre>
      </div>
    </main>
  `;
}
