import RAPIER from "@dimforge/rapier2d-compat";
import { renderCalendarOverlay, type CalendarOverlayMode } from "./calendar-renderers";
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
import { appendDescentToBall } from "./descent";
import { getDisplayDateRange, shiftDisplayAnchor, type DisplayMode } from "./display-period";
import {
  createVisibilitySafeSummaryLabel,
  createVisibilitySafeTitleLabel,
  getReceiptTitle,
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
import { visibilityValues, type BallDraft, type HappyBall, type LifecycleStatus, type NameBookEntry, type SendMode } from "./models";
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
import { capturePrimaryScreen, createMainPrimaryScreen, shouldMountPlayStage, type PrimaryScreenState } from "./screen-navigation";
import { createStartupScreenState } from "./startup-state";
import {
  addBall,
  clearBallData,
  createDefaultDraft,
  currentLocalTime,
  DEFAULT_SAMPLE_NAME,
  deleteBall,
  getPrimarySelfName,
  importNewAndReplaceBalls,
  importNewBalls,
  loadLedger,
  markReceiptCreated,
  MAX_NAME_BOOK_ENTRIES,
  refreshCreateDraftForOpen,
  resetNameBook,
  saveLedger,
  todayIsoDate,
  updateBall,
  updateBallLifecycleStatus,
  updateNameBook,
  type BallSaveMode,
} from "./storage";

const appRoot = getAppRoot();
const MIN_APP_VIEWPORT_HEIGHT = 320;

let ledger = loadLedger();
let appSettings: AppSettings = loadAppSettings();
const startupScreenState = createStartupScreenState(ledger.balls, todayIsoDate(), appSettings.startupScreen);
let draft = createDefaultDraft(getPrimarySelfName(ledger));
let editableCategories: CategoryColorPreset[] = loadCategoryColorPresets();
let selectedBallId: string | null = startupScreenState.selectedBallId;
let activeOverlay: ActiveOverlay = startupScreenState.startupScreen === "main" ? "none" : "calendar";
let displayMode: DisplayMode = "day";
let displayAnchorDate = startupScreenState.displayAnchorDate;
let calendarMonth = startupScreenState.calendarMonth;
let calendarMode: CalendarOverlayMode = startupScreenState.startupScreen === "calendarDayList" ? "dayList" : "month";
let subfeatureReturnScreen: PrimaryScreenState = createMainPrimaryScreen(calendarMonth, displayAnchorDate);
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
let ledgerListDateFilter: string | null = null;
let pendingCalendarDayListScrollTop: number | null = null;

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
  "descent-settings",
  "tuning-panel",
  "backup-settings",
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
            <button class="dock-symbol-button dock-create-button" type="button" data-open-panel="create" aria-label="玉を作る">＋</button>
            <span class="primary-screen-control-group" aria-label="主要3画面">
              <button class="calendar-main-ball-button is-primary-active ${appSettings.ballLabelMode !== "none" ? "is-label-on" : ""}" type="button" data-cycle-ball-label-mode aria-label="${escapeHtml(renderBallLabelModeCycleAriaLabel())}">
                <span class="calendar-main-ball-icon" aria-hidden="true"></span>
              </button>
              <button class="calendar-screen-button" type="button" data-open-panel="calendar" aria-label="カレンダー">
                ${renderCalendarScreenIcon()}
              </button>
              <button class="day-list-screen-button" type="button" data-open-calendar-day-list aria-label="玉リスト">
                <span class="day-list-screen-icon" aria-hidden="true"></span>
              </button>
            </span>
            <button type="button" data-cycle-display-mode aria-label="${escapeHtml(renderDisplayModeCycleAriaLabel())}">${renderDisplayModeCycleButtonText()}</button>
            <button class="dock-symbol-button dock-settings-button" type="button" data-open-panel="settings" aria-label="設定">⚙</button>
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
  if (shouldMountPlayStage({ activeOverlay, hasPendingDialog: Boolean(pendingUrlPacket || pendingJsonImport) })) {
    mountRapierStage(visibleBalls);
  }
  restorePendingCalendarDayListScroll();
}

function getVisibleBalls(): HappyBall[] {
  const range = getDisplayDateRange(displayMode, displayAnchorDate);
  return ledger.balls.filter((ball) => (
    ball.lifecycleStatus !== "offered" &&
    ball.date >= range.start &&
    ball.date <= range.end
  ));
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

function renderDisplayModeCycleButtonText(): string {
  if (displayMode === "day") {
    return "日";
  }
  if (displayMode === "week") {
    return "週";
  }
  return "月";
}

function renderCalendarScreenIcon(): string {
  return `
    <span class="calendar-screen-icon" aria-hidden="true">
      <svg viewBox="0 0 32 28" focusable="false">
        <rect class="calendar-icon-frame" x="2" y="2.5" width="28" height="24" rx="2.25"></rect>
        <circle class="calendar-icon-dot" cx="8.5" cy="13" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="13.5" cy="13" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="18.5" cy="13" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="23.5" cy="13" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="8.5" cy="17.25" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="13.5" cy="17.25" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="18.5" cy="17.25" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="23.5" cy="17.25" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="8.5" cy="21.5" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="13.5" cy="21.5" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="18.5" cy="21.5" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="23.5" cy="21.5" r="1.45"></circle>
      </svg>
    </span>
  `;
}

function renderDisplayModeCycleAriaLabel(): string {
  return `表示期間: ${renderDisplayModeCycleButtonText()}。押すと${renderDisplayModeName(nextDisplayMode(displayMode))}に切り替え`;
}

function renderDisplayModeName(mode: DisplayMode): string {
  if (mode === "day") {
    return "日";
  }
  if (mode === "week") {
    return "週";
  }
  return "月";
}

function renderBallLabelModeCycleAriaLabel(): string {
  return `玉の文字表示: ${renderBallLabelModeName(appSettings.ballLabelMode)}。押すと${renderBallLabelModeName(nextBallLabelMode(appSettings.ballLabelMode))}に切り替え`;
}

function renderBallLabelModeName(mode: BallLabelMode): string {
  if (mode === "date") {
    return "日付";
  }
  if (mode === "title") {
    return "題";
  }
  return "なし";
}

function renderActiveOverlay(): string {
  if (activeOverlay === "none") {
    return "";
  }

  if (activeOverlay === "calendar") {
    return renderCalendarOverlay({
      balls: getCalendarBalls(),
      dayListBalls: getCalendarDayListBalls(),
      calendarMonth,
      calendarMode,
      displayMode,
      selectedDate: displayAnchorDate,
      selectedBallId,
      emotionEchoStrength: appSettings.emotionEchoStrength,
    });
  }

  if (activeOverlay === "create") {
    return renderPanelOverlay("玉を置く", renderCreateForm(draft, getFormRenderContext()), "create");
  }

  if (activeOverlay === "list") {
    const managedBalls = getManagedBalls();
    const title = ledgerListDateFilter ? `${ledgerListDateFilter} の保存された玉` : "保存された玉";
    return renderPanelOverlay(
      title,
      renderLedgerList(managedBalls, selectedBallId, { dateFilter: ledgerListDateFilter }),
      "list",
    );
  }

  return renderPanelOverlay("設定とデータ", renderToolsPanel(getToolsPanelRenderContext()), "settings");
}

function prepareCreateDraftForOpen(): void {
  draft = refreshCreateDraftForOpen(draft, displayAnchorDate);
}

function getCalendarBalls(): HappyBall[] {
  return ledger.balls.filter((ball) => ball.lifecycleStatus !== "offered");
}

function getCalendarDayListBalls(): HappyBall[] {
  return ledger.balls.filter((ball) => ball.date === displayAnchorDate);
}

function getManagedBalls(): HappyBall[] {
  if (!ledgerListDateFilter) {
    return ledger.balls;
  }
  return ledger.balls.filter((ball) => ball.date === ledgerListDateFilter);
}

function shiftCurrentDisplayAnchor(delta: -1 | 1): void {
  displayAnchorDate = shiftDisplayAnchor(displayMode, displayAnchorDate, delta);
  calendarMonth = displayAnchorDate.slice(0, 7);
  draft = { ...draft, date: displayAnchorDate };
}

function shiftIsoDate(date: string, delta: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + delta);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

function captureCurrentPrimaryScreen(): PrimaryScreenState {
  return capturePrimaryScreen({
    activePrimarySurface: activeOverlay === "calendar" ? "calendar" : "main",
    calendarMode,
    calendarMonth,
    selectedDate: displayAnchorDate,
  });
}

function rememberSubfeatureReturnScreen(): void {
  subfeatureReturnScreen = captureCurrentPrimaryScreen();
}

function restoreSubfeatureReturnScreen(selectedDateOverride?: string): void {
  const nextDate = selectedDateOverride ?? subfeatureReturnScreen.selectedDate;
  displayAnchorDate = nextDate;
  draft = { ...draft, date: nextDate };

  if (subfeatureReturnScreen.kind === "main") {
    activeOverlay = "none";
    return;
  }

  activeOverlay = "calendar";
  calendarMode = subfeatureReturnScreen.kind === "calendarDayList" ? "dayList" : "month";
  calendarMonth = selectedDateOverride ? nextDate.slice(0, 7) : subfeatureReturnScreen.calendarMonth;
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
  root.querySelectorAll<HTMLButtonElement>("[data-dialog-receipt-ball-id]").forEach((button) => {
    button.addEventListener("click", () => {
      showReceiptDialog(ballId, readSendMode(button));
    });
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

function showReceiptDialog(ballId: string, sendMode: SendMode = "formal"): void {
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }

  closeBallDialog();
  const root = document.createElement("div");
  root.id = BALL_DIALOG_ROOT_ID;
  root.innerHTML = renderReceiptDialog(ball, getDialogRenderContext(), sendMode);
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
  root.querySelector<HTMLButtonElement>("[data-show-ball-qr-id]")?.addEventListener("click", (event) => {
    showReceiptQrDialog(ballId, readSendMode(event.currentTarget));
  });
  root.querySelector<HTMLButtonElement>("[data-share-receipt-image-id]")?.addEventListener("click", (event) => {
    void shareReceiptImage(ballId, readSendMode(event.currentTarget));
  });
  root.querySelector<HTMLButtonElement>("[data-download-receipt-image-id]")?.addEventListener("click", (event) => {
    void downloadReceiptImage(ballId, readSendMode(event.currentTarget));
  });
  root.querySelector<HTMLButtonElement>("[data-copy-ball-url-id]")?.addEventListener("click", (event) => {
    void copyBallUrl(ballId, readSendMode(event.currentTarget));
  });
  root.querySelector<HTMLButtonElement>("[data-copy-ball-line-url-id]")?.addEventListener("click", (event) => {
    void copyBallLineUrl(ballId, readSendMode(event.currentTarget));
  });
  installBallDialogEscapeHandler(closeBallDialog);
  closeButton?.focus({ preventScroll: true });
}

function showReceiptQrDialog(ballId: string, sendMode: SendMode = "formal"): void {
  ledger = markReceiptCreated(ledger, ballId);
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }
  updateReceiptCreatedIndicators(ball);

  closeBallDialog();
  const root = document.createElement("div");
  root.id = BALL_DIALOG_ROOT_ID;
  root.innerHTML = renderReceiptQrDialog(ball, getDialogRenderContext(), sendMode);
  document.body.appendChild(root);

  const backdrop = root.querySelector<HTMLElement>("[data-dialog-backdrop]");
  const closeButton = root.querySelector<HTMLButtonElement>("[data-dialog-close]");
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeBallDialog();
    }
  });
  closeButton?.addEventListener("click", closeBallDialog);
  root.querySelector<HTMLButtonElement>("[data-dialog-receipt-ball-id]")?.addEventListener("click", (event) => {
    showReceiptDialog(ballId, readSendMode(event.currentTarget));
  });
  root.querySelector<HTMLButtonElement>("[data-copy-ball-url-id]")?.addEventListener("click", (event) => {
    void copyBallUrl(ballId, readSendMode(event.currentTarget));
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
  bindLifecycleActionEvents(root);
  bindDeleteBallEvents(root);
  bindDescendBallEvents(root);
  bindNamePresetEvents(root);
  bindTimeControlEvents(root);
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
    next.time !== ball.time ||
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
        lifecycleStatus: ball.lifecycleStatus,
        descentBadgeCount: ball.descentBadgeCount ?? 0,
        isKamiBall: ball.isKamiBall === true,
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
      if (panel === "none") {
        activeOverlay = "none";
        render();
        return;
      }
      if (!isActiveOverlay(panel)) {
        return;
      }
      if (panel === "calendar") {
        calendarMonth = displayAnchorDate.slice(0, 7);
        calendarMode = "month";
      }
      if (panel === "create" || panel === "settings") {
        rememberSubfeatureReturnScreen();
      }
      if (panel === "create") {
        createPromptDismissed = true;
        prepareCreateDraftForOpen();
      }
      if (panel === "list" && activeOverlay !== "settings") {
        rememberSubfeatureReturnScreen();
      }
      activeOverlay = panel;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-cycle-display-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      displayMode = nextDisplayMode(displayMode);
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
      if (activeOverlay === "create" || activeOverlay === "settings" || activeOverlay === "list") {
        restoreSubfeatureReturnScreen();
      } else {
        activeOverlay = "none";
      }
      render();
    });
  });

  document.querySelector("[data-cycle-ball-label-mode]")?.addEventListener("click", () => {
    updateAppSettings({ ballLabelMode: nextBallLabelMode(appSettings.ballLabelMode) });
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-calendar-month]").forEach((button) => {
    button.addEventListener("click", () => {
      calendarMonth = button.dataset.calendarMonth || calendarMonth;
      calendarMode = "month";
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-calendar-shift-day]").forEach((button) => {
    button.addEventListener("click", () => {
      const delta = button.dataset.calendarShiftDay === "1" ? 1 : -1;
      displayAnchorDate = shiftIsoDate(displayAnchorDate, delta);
      calendarMonth = displayAnchorDate.slice(0, 7);
      draft = { ...draft, date: displayAnchorDate };
      calendarMode = "dayList";
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-open-calendar-day-list]").forEach((button) => {
    button.addEventListener("click", () => {
      calendarMonth = displayAnchorDate.slice(0, 7);
      calendarMode = "dayList";
      activeOverlay = "calendar";
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-filter-date]").forEach((button) => {
    button.addEventListener("click", () => {
      displayAnchorDate = button.dataset.filterDate ?? displayAnchorDate;
      if (displayAnchorDate) {
        draft = { ...draft, date: displayAnchorDate };
        calendarMonth = displayAnchorDate.slice(0, 7);
      }
      calendarMode = "dayList";
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-calendar-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.calendarView;
      if (view === "month" || view === "dayList") {
        calendarMode = view;
        render();
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-calendar-open-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = button.dataset.calendarOpenPanel;
      if (panel !== "create" && panel !== "settings" && panel !== "calendar" && panel !== "dayList") {
        return;
      }
      if (panel === "calendar" || panel === "dayList") {
        calendarMonth = displayAnchorDate.slice(0, 7);
        calendarMode = panel === "calendar" ? "month" : "dayList";
        activeOverlay = "calendar";
        render();
        return;
      }
      if (panel === "create") {
        rememberSubfeatureReturnScreen();
        createPromptDismissed = true;
        prepareCreateDraftForOpen();
      }
      if (panel === "settings") {
        rememberSubfeatureReturnScreen();
      }
      activeOverlay = panel;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-calendar-cycle-display-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      displayMode = nextDisplayMode(displayMode);
      draft = { ...draft, date: displayAnchorDate };
      activeOverlay = "none";
      render();
    });
  });

  document.querySelector("[data-calendar-main]")?.addEventListener("click", () => {
    activeOverlay = "none";
    render();
  });

  bindDisplaySwipeEvents();

  const form = document.querySelector<HTMLFormElement>("#ball-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    audioEngine.unlock();
    draft = readDraft(form);
    ledger = addBall(ledger, draft);
    selectedBallId = ledger.balls[0]?.id ?? null;
    displayMode = "day";
    restoreSubfeatureReturnScreen(draft.date);
    draft = { ...createDefaultDraft(getPrimarySelfName(ledger)), subject: draft.subject, issuerType: draft.issuerType };
    render();
  });

  form?.addEventListener("input", () => {
    draft = readDraft(form);
  });
  if (form) {
    bindTimeControlEvents(form);
  }

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

  document.querySelectorAll<HTMLButtonElement>("[data-view-ball-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.viewBallId;
      if (!id) {
        return;
      }
      selectedBallId = id;
      updateSelectedState();
      updateSelectedSummary();
      showBallDialog(id);
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

  document.querySelector("[data-clear-ledger-list-date]")?.addEventListener("click", () => {
    ledgerListDateFilter = null;
    render();
  });

  bindLifecycleActionEvents();
  bindDeleteBallEvents();
  bindDescendBallEvents();
}

function bindLifecycleActionEvents(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>("[data-lifecycle-ball-id][data-lifecycle-status]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.lifecycleBallId;
      const status = readLifecycleStatus(button.dataset.lifecycleStatus);
      if (!id || !status) {
        return;
      }
      const target = ledger.balls.find((ball) => ball.id === id);
      if (!target) {
        return;
      }
      if (status === "offered" && !confirm(`「${target.title}」を供養します。カレンダーとプレイ画面には表示されなくなります。実行しますか？`)) {
        return;
      }
      rememberCalendarDayListScroll(button);
      ledger = updateBallLifecycleStatus(ledger, id, status);
      selectedBallId = status === "offered" ? getVisibleBalls()[0]?.id ?? null : id;
      closeBallDialog();
      render();
    });
  });
}

function bindDeleteBallEvents(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>("[data-delete-ball-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteBallId;
      if (!id) {
        return;
      }
      const target = ledger.balls.find((ball) => ball.id === id);
      if (!target || !confirm(`「${target.title}」をお焚上します。保存データから削除され、バックアップがない限り戻せません。実行しますか？`)) {
        return;
      }
      rememberCalendarDayListScroll(button);
      ledger = deleteBall(ledger, id);
      selectedBallId = getVisibleBalls()[0]?.id ?? ledger.balls[0]?.id ?? null;
      closeBallDialog();
      render();
    });
  });
}

function bindDescendBallEvents(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>("[data-descend-ball-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.descendBallId;
      const target = ledger.balls.find((ball) => ball.id === id);
      if (!target) {
        return;
      }
      requestDescendLocation(target);
    });
  });
}

function rememberCalendarDayListScroll(source: Element): void {
  const scroller = source.closest<HTMLElement>(".calendar-day-list-body");
  if (!scroller) {
    return;
  }
  pendingCalendarDayListScrollTop = scroller.scrollTop;
}

function restorePendingCalendarDayListScroll(): void {
  if (pendingCalendarDayListScrollTop === null) {
    return;
  }

  const scrollTop = pendingCalendarDayListScrollTop;
  pendingCalendarDayListScrollTop = null;
  const scroller = document.querySelector<HTMLElement>(".calendar-day-list-body");
  if (!scroller) {
    return;
  }

  const restore = () => {
    scroller.scrollTop = Math.min(scrollTop, scroller.scrollHeight);
  };
  restore();
  requestAnimationFrame(restore);
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

async function shareReceiptImage(ballId: string, sendMode: SendMode = "formal"): Promise<void> {
  const prepared = prepareReceiptImageBall(ballId);
  if (!prepared) {
    return;
  }

  const { ball } = prepared;
  const receiptTitle = getReceiptTitle(ball, sendMode);
  const fileName = createReceiptImageFileName(ball, sendMode);
  const blob = await createReceiptImageBlob(ball, getReceiptImageContext(), sendMode);
  const file = new File([blob], fileName, { type: "image/png" });

  try {
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      throw new Error("File sharing is unavailable.");
    }
    await navigator.share({
      files: [file],
      title: `えもい玉 ${receiptTitle}`,
      text: `${receiptTitle}です。`,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    downloadBlob(blob, fileName);
    alert("この端末では直接共有できなかったため、画像として保存しました。LINEで画像添付してください。");
  }
}

async function downloadReceiptImage(ballId: string, sendMode: SendMode = "formal"): Promise<void> {
  const prepared = prepareReceiptImageBall(ballId);
  if (!prepared) {
    return;
  }

  const blob = await createReceiptImageBlob(prepared.ball, getReceiptImageContext(), sendMode);
  downloadBlob(blob, createReceiptImageFileName(prepared.ball, sendMode));
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

async function copyBallUrl(ballId: string, sendMode: SendMode = "formal"): Promise<void> {
  ledger = markReceiptCreated(ledger, ballId);
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }
  updateReceiptCreatedIndicators(ball);

  const url = createPacketImportUrl(ball, window.location.href, sendMode);
  await copyTextWithFallback(url, "玉URLをコピーしました。");
}

async function copyBallLineUrl(ballId: string, sendMode: SendMode = "formal"): Promise<void> {
  ledger = markReceiptCreated(ledger, ballId);
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }
  updateReceiptCreatedIndicators(ball);

  const url = createLinePacketImportUrl(ball, window.location.href, sendMode);
  await copyTextWithFallback(url, "LINE用の玉URLをコピーしました。");
}

function updateReceiptCreatedIndicators(ball: HappyBall): void {
  if (!ball.receiptCreatedAt) {
    return;
  }

  document.querySelectorAll<HTMLElement>("[data-receipt-status-ball-id]").forEach((element) => {
    if (element.dataset.receiptStatusBallId === ball.id) {
      element.textContent = "準備済み";
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

function readLifecycleStatus(value: string | undefined): LifecycleStatus | null {
  return value === "active" || value === "archived" || value === "memorial" || value === "offered" ? value : null;
}

function requestDescendLocation(ball: HappyBall): void {
  if (!navigator.geolocation) {
    alert("この端末では位置情報を取得できません。");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const memo = window.prompt("降臨メモ（任意・80文字まで）", "") ?? "";
      const result = appendDescentToBall(
        ball,
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        },
        appSettings.descentMinDistanceMeters,
        memo,
      );
      if (!result.ok) {
        alert(`まだ近すぎるため、再降臨できません。\n直近の降臨地から約${Math.round(result.distanceFromPreviousMeters)}mです。\n設定距離: ${result.requiredDistanceMeters}m`);
        return;
      }
      ledger = {
        ...ledger,
        balls: ledger.balls.map((item) => item.id === ball.id ? result.ball : item),
        updatedAt: result.ball.updatedAt,
      };
      saveLedger(ledger);
      const latitude = result.record.latitude.toFixed(5);
      const longitude = result.record.longitude.toFixed(5);
      alert(`「${ball.title}」に第${result.record.sequence}回の降臨を記録しました。\n現在地: ${latitude}, ${longitude}`);
      render();
    },
    () => {
      alert("位置情報を取得できませんでした。");
    },
    { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
  );
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

function nextDisplayMode(mode: DisplayMode): DisplayMode {
  if (mode === "day") {
    return "week";
  }
  if (mode === "week") {
    return "month";
  }
  return "day";
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

function readSendMode(target: EventTarget | null): SendMode {
  return target instanceof HTMLElement && target.dataset.sendMode === "casual" ? "casual" : "formal";
}

function bindTimeControlEvents(root: ParentNode = document): void {
  root.querySelectorAll<HTMLInputElement>("input[name='timeEnabled']").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const form = checkbox.closest("form");
      const timeInput = form?.querySelector<HTMLInputElement>("input[name='time']");
      if (!form || !timeInput) {
        return;
      }

      timeInput.disabled = !checkbox.checked;
      if (checkbox.checked && !timeInput.value) {
        timeInput.value = currentLocalTime();
      }
      if (form.id === "ball-form") {
        draft = readDraft(form);
      }
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-current-time-button]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.closest("form");
      const checkbox = form?.querySelector<HTMLInputElement>("input[name='timeEnabled']");
      const timeInput = form?.querySelector<HTMLInputElement>("input[name='time']");
      if (!form || !checkbox || !timeInput) {
        return;
      }

      checkbox.checked = true;
      timeInput.disabled = false;
      timeInput.value = currentLocalTime();
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      timeInput.dispatchEvent(new Event("input", { bubbles: true }));
      timeInput.dispatchEvent(new Event("change", { bubbles: true }));
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
  const timeEnabled = data.get("timeEnabled") === "on";
  return {
    date: String(data.get("date") || draft.date),
    time: timeEnabled ? String(data.get("time") || currentLocalTime()) : undefined,
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
  return ball.lifecycleStatus !== "archived" && Boolean(ball.emotionEcho) && appSettings.emotionEchoStrength !== "off";
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
