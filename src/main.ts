import RAPIER from "@dimforge/rapier2d-compat";
import {
  createAppUiSnapshot,
  createInitialAppUiState,
  isCalendarRoute,
  reduceAppUiState,
  type AppUiAction,
  type AppUiState,
  type PrimaryRoute,
} from "./app-ui-state";
import {
  createBallActivityInput,
  createBallActivitySnapshot,
  loadActivityLog,
  recordActivity,
  type ActivityLogEntry,
} from "./activity-log";
import {
  createBallDisplayLabel,
  nextBallLabelMode,
  renderBallLabelModeCycleAriaLabel,
  renderNextBallLabelModeIcon,
} from "./ball-labels";
import { bindBallCountSliderControls } from "./ball-count-slider";
import { renderCalendarOverlay, renderCalendarPrimaryParts, type CalendarRenderContext } from "./calendar-renderers";
import {
  loadCategoryColorPresets,
  resetCategoryColorPresets,
  saveCategoryColorPresets,
  type CategoryColorPreset,
} from "./categories";
import "./style.css";
import { createDebugLogFileName, DebugLogBuffer } from "./debug-log";
import {
  type JsonImportReview,
} from "./json-transfer";
import {
  applyJsonImportReview,
  exportSelectedJson,
  readSelectedJsonImportSections,
  reviewJsonImportFile,
} from "./json-transfer-actions";
import { DeviceGravityController, requestDeviceGravityPermission, type DeviceGravityDebugSnapshot } from "./device-gravity";
import {
  appendDescentToBall,
  applyDescentRecordsToBall,
  createGoogleMapsUrl,
  hasDescentPosition,
  normalizeDescentRecords,
  type DescentPositionInput,
} from "./descent";
import { getDisplayDateRange, getDisplayModeIconDotCount, moveDisplayAnchorToCalendarMonth, shiftDisplayAnchor, type DisplayMode } from "./display-period";
import {
  createVisibilitySafeSummaryLabel,
  getReceiptTitle,
  renderBallDialog,
  renderReceiptDialog,
  renderReceiptQrDialog,
  type DialogRenderContext,
} from "./dialog-renderers";
import {
  renderBallEditDialog,
  renderCreateForm,
  renderEditableDescentHistory,
  renderEditSaveModeConfirm,
  type FormRenderContext,
} from "./form-renderers";
import { resolveManualSubjectPreset, resolveNamePresetSelection } from "./form-interactions";
import { TinyImpactAudio } from "./impact-audio";
import { ImeViewportCoordinator } from "./ime-viewport-coordinator";
import { isGeolocationUnavailableError, isStaleGeolocationPositionError, readReliableCurrentPosition } from "./location";
import {
  renderPendingJsonImportDialog,
  renderPendingUrlPacketDialog,
  renderSnoozedUrlPacketReminder,
} from "./import-dialog-renderers";
import { renderManualCopyDialog } from "./manual-copy-renderers";
import { visibilityValues, type BallDraft, type HappyBall, type HappyBallDescentRecord, type IssuerType, type LifecycleStatus, type NameBookEntry, type SendMode } from "./models";
import { resolveFocusScrollDelta } from "./modal-interactions";
import {
  createLinePacketImportUrl,
  createPacketImportUrl,
  parsePacketLocation,
  reviewPacketImport,
  type HandoffOptions,
  type UrlPacketParseResult,
} from "./packet";
import { renderPanelOverlay } from "./overlay-renderers";
import { PhysicsRuntimeController } from "./physics-runtime-controller";
import { RapierStage, type PhysicsBallSnapshot, type VisualBallSource } from "./rapier-stage";
import { createReceiptImageBlob, createReceiptImageFileName } from "./receipt-image";
import {
  loadAppSettings,
  normalizeAppSettings,
  saveAppSettings,
  type AppSettings,
} from "./settings";
import { bindSettingsPanelEvents } from "./settings-panel-events";
import {
  renderLedgerList,
  renderToolsPanel,
  type ToolsPanelRenderContext,
} from "./settings-renderers";
import { capturePrimaryScreen, createMainPrimaryScreen, type PrimaryScreenState } from "./screen-navigation";
import { SurfaceInteractionController } from "./surface-interaction-controller";
import { createStartupScreenState } from "./startup-state";
import { UiLayerHosts } from "./ui-layer-hosts";
import { isUiDebugEnabled, UiDebugDiagnostics } from "./ui-debug-diagnostics";
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

let ledger = loadLedger();
let activityLog: ActivityLogEntry[] = loadActivityLog();
let appSettings: AppSettings = loadAppSettings();
const startupScreenState = createStartupScreenState(ledger.balls, todayIsoDate(), appSettings.startupScreen);
let draft = createDefaultDraft(getPrimarySelfName(ledger));
let editableCategories: CategoryColorPreset[] = loadCategoryColorPresets();
let selectedBallId: string | null = startupScreenState.selectedBallId;
let uiState: AppUiState = createInitialAppUiState(startupScreenState.startupScreen);
let displayMode: DisplayMode = "day";
let displayAnchorDate = startupScreenState.displayAnchorDate;
let calendarMonth = startupScreenState.calendarMonth;
let subfeatureReturnScreen: PrimaryScreenState = createMainPrimaryScreen(calendarMonth, displayAnchorDate);
let pendingUrlPacket: UrlPacketParseResult | null = parsePacketLocation(window.location.search, window.location.hash);
let snoozedUrlPacket: UrlPacketParseResult | null = null;
let pendingJsonImport: JsonImportReview | null = null;
let physicsStage: RapierStage | null = null;
const physicsRuntime = new PhysicsRuntimeController<RapierStage>();
const physicsSnapshots = new Map<string, PhysicsBallSnapshot>();
let openSettingsGroups: string[] = [];
let activityLogHelpOpen = false;
let rapierReady = false;
let audioEngine: TinyImpactAudio;
let deviceGravity: DeviceGravityController;
let latestGravityDebug: DeviceGravityDebugSnapshot | null = null;
const debugLog = new DebugLogBuffer(400);
let lastMotionDebugLogAt = 0;
let bootComplete = false;
let baseRenderSignature = "";
let activeBallDialogEscapeHandler: (() => void) | null = null;
let createPromptDismissed = false;
let randomTextureVariables: Record<string, string> | null = null;
let ledgerListDateFilter: string | null = null;
let pendingCalendarDayListScrollTop: number | null = null;
const pendingDescentBallIds = new Set<string>();

const uiHosts = new UiLayerHosts(appRoot, __APP_VERSION__);
const imeViewport = new ImeViewportCoordinator(appRoot, () => createAppUiSnapshot(uiState).editableSurface);
const interactionController = new SurfaceInteractionController(appRoot, () => createAppUiSnapshot(uiState).blocksBase);
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
const SETTINGS_GROUP_CLASSES = [
  "name-book-settings",
  "category-settings",
  "display-settings",
  "descent-settings",
  "tuning-panel",
  "backup-settings",
  "ball-management-panel",
  "activity-log-panel",
  "app-about-panel",
];

window.addEventListener("error", (event) => {
  handleApplicationError(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  handleApplicationError(event.reason);
});

window.addEventListener("keydown", handleDisplayNavigationKey);
imeViewport.install();
interactionController.install();
if (isUiDebugEnabled()) {
  new UiDebugDiagnostics(appRoot, __APP_VERSION__).install();
}
void boot();

async function boot(): Promise<void> {
  try {
    uiHosts.renderBase(`<main class="loading-shell">Rapierを起動しています...</main>`);
    await RAPIER.init();
    audioEngine = new TinyImpactAudio();
    installAudioLifecycleHandlers();
    deviceGravity = new DeviceGravityController(
      (gravity) => {
        physicsStage?.setGravityVector(gravity);
      },
      (snapshot) => {
        latestGravityDebug = snapshot;
        appendGravityDebugLog(snapshot);
        updateGravityDebugPanel();
      },
    );
    syncGravityController();
    rapierReady = true;
    render();
    bootComplete = true;
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

function bindModalKeyboardFocusAssist(root: ParentNode = document): void {
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".app-modal-scroll input, .app-modal-scroll textarea").forEach((field) => {
    field.addEventListener("focus", () => {
      window.setTimeout(() => {
        const scrollRegion = field.closest<HTMLElement>(".app-modal-scroll");
        if (!scrollRegion) {
          return;
        }
        const regionRect = scrollRegion.getBoundingClientRect();
        const fieldRect = field.getBoundingClientRect();
        const delta = resolveFocusScrollDelta({
          regionTop: regionRect.top,
          regionBottom: regionRect.bottom,
          fieldTop: fieldRect.top,
          fieldBottom: fieldRect.bottom,
        });
        if (delta !== 0) {
          scrollRegion.scrollBy({ top: delta, behavior: "smooth" });
        }
      }, 180);
    });
  });
}

function render(): void {
  openSettingsGroups = uiState.primary === "settings" ? readOpenSettingsGroups() : [];
  clearModalLayers(false);
  const visibleBalls = getVisibleBalls();
  const selectedBall = visibleBalls.find((ball) => ball.id === selectedBallId) ?? visibleBalls[0] ?? null;
  selectedBallId = selectedBall?.id ?? null;
  ensureBaseRendered(visibleBalls, selectedBall);
  renderPrimarySurface();
  syncPendingImportSurface();
  uiHosts.renderTransient(renderSnoozedUrlPacketReminder(snoozedUrlPacket));
  bindEvents(uiHosts.transient);
  applyUiState();
  applyBallFieldTextureSetting();
  restorePendingCalendarDayListScroll();
}

function ensureBaseRendered(visibleBalls: HappyBall[], selectedBall: HappyBall | null): void {
  const nextSignature = JSON.stringify({
    balls: visibleBalls,
    selectedBallId,
    displayMode,
    displayAnchorDate,
    createPromptDismissed,
    settings: appSettings,
  });
  if (nextSignature === baseRenderSignature) {
    return;
  }
  baseRenderSignature = nextSignature;

  capturePhysicsSnapshotsSafely();
  physicsRuntime.destroy();
  physicsStage = null;

  uiHosts.renderBase(`
    <main class="app-shell ball-world-shell">
      <section class="stage ${appSettings.ballLabelMode !== "none" ? "show-ball-labels" : ""} label-mode-${appSettings.ballLabelMode}" aria-label="えもい玉">
        <div class="stage-topline">
          <div>
            <p class="screen-kicker play-screen-kicker">Emotion Play</p>
            ${renderPlayPeriodNav()}
            <h1 id="stage-title">${escapeHtml(selectedBall ? createVisibilitySafeSummaryLabel(selectedBall) : "今日のえもい玉は？")}</h1>
          </div>
        </div>
        <div id="ball-field" class="ball-field texture-${appSettings.backgroundTexture}" aria-label="触って転がせるえもい玉"></div>
        ${renderGravityDebugPanel()}
        <div class="world-control-dock">
          <p class="control-state-label play-display-state-label">${renderDisplayModeName(displayMode)}表示</p>
          ${createPromptDismissed ? "" : `<p class="world-action-prompt">＋で玉を置きましょう</p>`}
          <div class="world-actions" aria-label="操作">
            <button class="dock-symbol-button dock-create-button" type="button" data-open-panel="create" aria-label="玉を作る">＋</button>
            <span class="primary-screen-control-group" aria-label="主要3画面">
              <button class="calendar-main-ball-button is-primary-active ${appSettings.ballLabelMode !== "none" ? "is-label-on" : ""}" type="button" data-cycle-ball-label-mode aria-current="page" aria-label="${escapeHtml(renderBallLabelModeCycleAriaLabel(appSettings.ballLabelMode))}">
                ${renderNextBallLabelModeIcon(appSettings.ballLabelMode)}
              </button>
              <button class="calendar-screen-button" type="button" data-open-panel="calendar" aria-label="カレンダー">
                ${renderCalendarScreenIcon()}
              </button>
              <button class="day-list-screen-button" type="button" data-open-calendar-day-list aria-label="玉リスト">
                <span class="day-list-screen-icon" aria-hidden="true"></span>
              </button>
            </span>
            <button class="display-mode-next-button" type="button" data-cycle-display-mode aria-label="${escapeHtml(renderDisplayModeCycleAriaLabel())}">${renderDisplayModeCycleIcon(nextDisplayMode(displayMode))}</button>
            <button class="dock-symbol-button dock-settings-button" type="button" data-open-panel="settings" aria-label="設定">⚙</button>
          </div>
        </div>
      </section>
    </main>
  `);

  bindEvents(uiHosts.base);
  if (rapierReady) {
    mountRapierStage(visibleBalls);
  }
}

function renderPrimarySurface(): void {
  if (uiState.primary === "play") {
    uiHosts.clearPrimary();
    return;
  }

  if (isCalendarRoute(uiState.primary)) {
    const context = getCalendarRenderContext();
    const existing = uiHosts.primary.querySelector<HTMLElement>("[data-calendar-primary-shell]");
    if (existing) {
      updateCalendarPrimarySurface(existing, context);
      return;
    }
    const surface = uiHosts.renderPrimary(uiState.primary, renderCalendarOverlay(context));
    bindEvents(surface);
    return;
  }

  const surface = uiHosts.renderPrimary(uiState.primary, renderActivePrimaryPanel());
  bindEvents(surface);
  bindModalKeyboardFocusAssist(surface);
}

function getCalendarRenderContext(): CalendarRenderContext {
  return {
    balls: getCalendarBalls(),
    dayListBalls: getCalendarDayListBalls(),
    calendarMonth,
    calendarMode: uiState.primary === "calendar-day-list" ? "dayList" : "month",
    displayMode,
    selectedDate: displayAnchorDate,
    selectedBallId,
    emotionEchoStrength: appSettings.emotionEchoStrength,
    calendarMarkerMode: appSettings.calendarMarkerMode,
    activityLog,
  };
}

function updateCalendarPrimarySurface(surface: HTMLElement, context: CalendarRenderContext): void {
  const parts = renderCalendarPrimaryParts(context);
  const header = surface.querySelector<HTMLElement>("[data-calendar-primary-header]");
  const body = surface.querySelector<HTMLElement>("[data-calendar-primary-body]");
  if (!header || !body) {
    const replacement = uiHosts.renderPrimary(uiState.primary, renderCalendarOverlay(context));
    bindEvents(replacement);
    return;
  }

  header.innerHTML = parts.header;
  body.innerHTML = parts.body;
  body.className = `calendar-primary-scroll ${context.calendarMode === "dayList" ? "calendar-day-list-body" : "calendar-month-body"}`;
  surface.setAttribute("aria-label", context.calendarMode === "month" ? "カレンダー" : context.selectedDate);
  const monthButton = surface.querySelector<HTMLButtonElement>("[data-calendar-open-panel='calendar']");
  const listButton = surface.querySelector<HTMLButtonElement>("[data-calendar-open-panel='dayList']");
  setAriaCurrent(monthButton, context.calendarMode === "month");
  setAriaCurrent(listButton, context.calendarMode === "dayList");

  const template = document.createElement("template");
  template.innerHTML = renderCalendarOverlay(context);
  const nextState = template.content.querySelector<HTMLElement>("[data-calendar-marker-state]");
  const currentState = surface.querySelector<HTMLElement>("[data-calendar-marker-state]");
  if (currentState && nextState) {
    currentState.hidden = nextState.hidden;
    currentState.textContent = nextState.textContent;
  }
  const nextMarker = template.content.querySelector<HTMLButtonElement>("[data-calendar-cycle-marker-mode]");
  const currentMarker = surface.querySelector<HTMLButtonElement>("[data-calendar-cycle-marker-mode]");
  if (currentMarker && nextMarker) {
    currentMarker.hidden = nextMarker.hidden;
    currentMarker.innerHTML = nextMarker.innerHTML;
    currentMarker.setAttribute("aria-label", nextMarker.getAttribute("aria-label") ?? "玉表示を切り替え");
  }
  bindEvents(header);
  bindEvents(body);
}

function setAriaCurrent(button: HTMLButtonElement | null, current: boolean): void {
  if (!button) {
    return;
  }
  if (current) {
    button.setAttribute("aria-current", "page");
  } else {
    button.removeAttribute("aria-current");
  }
}

function renderActivePrimaryPanel(): string {
  if (uiState.primary === "create") {
    return renderPanelOverlay(
      "玉を置く",
      renderCreateForm(draft, getFormRenderContext()),
      "create",
      { label: "玉を置く", formId: "ball-form" },
    );
  }
  if (uiState.primary === "saved-list") {
    const managedBalls = getManagedBalls();
    const title = ledgerListDateFilter ? `${ledgerListDateFilter} の保存された玉` : "保存された玉";
    return renderPanelOverlay(
      title,
      renderLedgerList(managedBalls, selectedBallId, { dateFilter: ledgerListDateFilter, activityLog }),
      "list",
    );
  }
  return renderPanelOverlay("設定とデータ", renderToolsPanel(getToolsPanelRenderContext()), "settings");
}

function syncPendingImportSurface(): void {
  if (pendingUrlPacket) {
    dispatchUi({ type: "replace-modal", route: "url-import" }, false);
    const root = uiHosts.replaceModal("url-import", renderPendingUrlPacketDialog(pendingUrlPacket, getImportDialogRenderContext()));
    bindEvents(root);
    return;
  }
  if (pendingJsonImport) {
    dispatchUi({ type: "replace-modal", route: "json-import" }, false);
    const root = uiHosts.replaceModal("json-import", renderPendingJsonImportDialog(pendingJsonImport, appSettings.emotionEchoStrength));
    bindEvents(root);
  }
}

function dispatchUi(action: AppUiAction, apply = true): void {
  uiState = reduceAppUiState(uiState, action);
  if (apply) {
    applyUiState();
  }
}

function applyUiState(): void {
  const snapshot = createAppUiSnapshot(uiState);
  uiHosts.apply(snapshot);
  physicsRuntime.sync(snapshot.pausesPhysics);
  imeViewport.notifySurfaceChange();
}

function clearModalLayers(apply = true): void {
  uiHosts.clearConfirm();
  uiHosts.clearModals();
  dispatchUi({ type: "clear-modals" }, apply);
  document.removeEventListener("keydown", closeBallDialogOnEscape);
  activeBallDialogEscapeHandler = null;
}

function capturePhysicsSnapshotsSafely(): void {
  if (!physicsStage) {
    return;
  }
  try {
    for (const snapshot of physicsStage.captureSnapshots()) {
      physicsSnapshots.set(snapshot.id, snapshot);
    }
  } catch (error) {
    handlePhysicsFault(error);
  }
}

function getVisibleBalls(): HappyBall[] {
  const range = getDisplayDateRange(displayMode, displayAnchorDate);
  return ledger.balls.filter((ball) => (
    ball.lifecycleStatus !== "offered" &&
    ball.date >= range.start &&
    ball.date <= range.end
  ));
}

function renderGravityDebugPanel(): string {
  if (!appSettings.gravityDebugEnabled) {
    return "";
  }
  return `
    <aside class="gravity-debug-panel" aria-live="polite" aria-label="重力センサーデバッグ">
      <div class="gravity-debug-heading">Gravity debug</div>
      <pre data-gravity-debug-output>${escapeHtml(formatGravityDebugSnapshot(latestGravityDebug))}</pre>
      <div class="gravity-debug-actions">
        <button type="button" data-download-debug-log>ログJSON保存</button>
        <button type="button" data-copy-debug-log>ログコピー</button>
        <button type="button" data-clear-debug-log>ログ消去</button>
      </div>
    </aside>
  `;
}

function updateGravityDebugPanel(): void {
  if (!appSettings.gravityDebugEnabled) {
    return;
  }
  const output = document.querySelector<HTMLElement>("[data-gravity-debug-output]");
  if (!output) {
    return;
  }
  output.textContent = formatGravityDebugSnapshot(latestGravityDebug);
}

function formatGravityDebugSnapshot(snapshot: DeviceGravityDebugSnapshot | null): string {
  if (!snapshot) {
    return [
      `gravity: ${appSettings.gravityEnabled ? "waiting" : "off"}`,
      `angle: ${readCurrentScreenAngleForDebug()}deg`,
      `viewport: ${window.innerWidth}x${window.innerHeight}`,
    ].join("\n");
  }
  return [
    `src: ${snapshot.source} ${snapshot.used ? "used" : "skip"}`,
    `why: ${formatGravityDebugReason(snapshot.reason)}`,
    `angle: ${formatDebugNumber(snapshot.screenAngle, 0)} ${snapshot.orientationType}`,
    `viewport: ${formatDebugNumber(snapshot.viewport.width, 0)}x${formatDebugNumber(snapshot.viewport.height, 0)}`,
    `b/g/a: ${formatDebugNumber(snapshot.beta)} ${formatDebugNumber(snapshot.gamma)} ${formatDebugNumber(snapshot.alpha)}`,
    `m x/y/z: ${formatDebugNumber(snapshot.motionX)} ${formatDebugNumber(snapshot.motionY)} ${formatDebugNumber(snapshot.motionZ)}`,
    `raw x/y: ${formatDebugNumber(snapshot.rawGravity.x, 1)} ${formatDebugNumber(snapshot.rawGravity.y, 1)}`,
    `g x/y: ${formatDebugNumber(snapshot.gravity.x, 1)} ${formatDebugNumber(snapshot.gravity.y, 1)}`,
    `platform: ${snapshot.platform.name}`,
    `axis: ${snapshot.axisCorrection}`,
  ].join("\n");
}

function formatGravityDebugReason(reason: DeviceGravityDebugSnapshot["reason"]): string {
  switch (reason) {
    case "motion-2d":
      return "motion x/y";
    case "orientation-debug":
      return "orientation dbg";
    default:
      return reason;
  }
}

function readCurrentScreenAngleForDebug(): number {
  const orientation = screen.orientation?.angle;
  if (typeof orientation === "number") {
    return orientation;
  }
  const legacyOrientation = window.orientation;
  return typeof legacyOrientation === "number" ? legacyOrientation : 0;
}

function formatDebugNumber(value: number | null, digits = 2): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function getDialogRenderContext(): DialogRenderContext {
  return {
    currentUrl: window.location.href,
    showMemoField: appSettings.showMemoField,
    emotionEchoStrength: appSettings.emotionEchoStrength,
    includeDescentGpsInHandoff: appSettings.includeDescentGpsInHandoff,
    handoffDebugEnabled: new URLSearchParams(window.location.search).get("handoffDebug") === "1",
  };
}

function getHandoffOptions(sendMode: SendMode): HandoffOptions {
  return {
    sendMode,
    includeDescentGps: appSettings.includeDescentGpsInHandoff,
  };
}

function bindReceiptScrollAffordance(root: ParentNode): void {
  const scrollOwner = root.querySelector<HTMLElement>("[data-receipt-scroll-owner]");
  const cue = root.querySelector<HTMLElement>("[data-receipt-scroll-cue]");
  if (!scrollOwner || !cue) {
    return;
  }
  const update = () => {
    const overflows = scrollOwner.scrollHeight > scrollOwner.clientHeight + 2;
    const atBottom = scrollOwner.scrollTop + scrollOwner.clientHeight >= scrollOwner.scrollHeight - 3;
    cue.hidden = !overflows || atBottom;
  };
  scrollOwner.addEventListener("scroll", update, { passive: true });
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(update);
    observer.observe(scrollOwner);
  }
  requestAnimationFrame(update);
  window.setTimeout(update, 120);
}

function bindQrFailureDiagnostics(root: ParentNode, ball: HappyBall, sendMode: SendMode): void {
  root.querySelectorAll<HTMLElement>("[data-qr-generation-error]").forEach((failure) => {
    const diagnostic = {
      appVersion: __APP_VERSION__,
      timestamp: new Date().toISOString(),
      sendMode,
      includeDescentGps: appSettings.includeDescentGpsInHandoff,
      descentCount: ball.descents?.length ?? 0,
      inputCharacterCount: Number(failure.dataset.qrCharCount ?? 0),
      inputByteCount: Number(failure.dataset.qrByteCount ?? 0),
      stage: failure.dataset.qrStage ?? "unknown",
      errorCode: failure.dataset.qrErrorCode ?? "QR_GENERATION_FAILED",
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      browser: navigator.userAgent,
    };
    debugLog.append("handoff-qr-error", diagnostic);
    appendActivity(createBallActivityInput(ball, {
      action: "send-qr",
      sendMode,
      status: "failure",
      message: `${diagnostic.errorCode} ${diagnostic.stage}`,
    }));
    failure.querySelector<HTMLButtonElement>("[data-copy-qr-error]")?.addEventListener("click", () => {
      void copyTextWithFallback(JSON.stringify(diagnostic, null, 2), "エラー情報をコピーしました。");
    });
  });
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
    activityLog,
    openSettingsGroups,
    activityLogHelpOpen,
    nameBook: ledger.ownerProfile.nameBook,
    maxNameBookEntries: MAX_NAME_BOOK_ENTRIES,
    defaultSampleName: DEFAULT_SAMPLE_NAME,
  };
}

function appendActivity(input: Parameters<typeof recordActivity>[0]): void {
  activityLog = recordActivity(input);
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

function renderPlayPeriodNav(): string {
  const displayModeName = renderDisplayModeName(displayMode);
  return `
    <div class="play-period-nav" aria-label="${escapeHtml(displayModeName)}表示の期間移動">
      <button class="calendar-nav play-period-nav-button" type="button" data-shift-display-period="-1" aria-label="前の${escapeHtml(displayModeName)}">‹</button>
      <p class="stage-filter">${escapeHtml(renderDisplayRangeLabel())}</p>
      <button class="calendar-nav play-period-nav-button" type="button" data-shift-display-period="1" aria-label="次の${escapeHtml(displayModeName)}">›</button>
    </div>
  `;
}

function renderCalendarScreenIcon(): string {
  return `
    <span class="calendar-screen-icon" aria-hidden="true">
      <svg viewBox="0 0 32 28" focusable="false">
        <rect class="calendar-icon-frame" x="2" y="2.5" width="28" height="24" rx="0.8"></rect>
        <line class="calendar-icon-bar" x1="12.75" y1="8" x2="19.25" y2="8"></line>
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
  return `表示期間: ${renderDisplayModeName(displayMode)}。押すと${renderNextDisplayModeName(displayMode)}に切り替え`;
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

function renderNextDisplayModeName(mode: DisplayMode): string {
  return renderDisplayModeName(nextDisplayMode(mode));
}

function renderDisplayModeCycleIcon(mode: DisplayMode): string {
  return `
    <span class="display-mode-icon display-mode-icon-${mode}" aria-hidden="true">
      ${Array.from({ length: getDisplayModeIconDotCount(mode) }, () => "<i></i>").join("")}
    </span>
  `;
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
    activePrimarySurface: isCalendarRoute(uiState.primary) ? "calendar" : "main",
    calendarMode: uiState.primary === "calendar-day-list" ? "dayList" : "month",
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
    dispatchUi({ type: "open-primary", route: "play" }, false);
    return;
  }

  dispatchUi({
    type: "open-primary",
    route: subfeatureReturnScreen.kind === "calendarDayList" ? "calendar-day-list" : "calendar-month",
  }, false);
  calendarMonth = selectedDateOverride ? nextDate.slice(0, 7) : subfeatureReturnScreen.calendarMonth;
}

function showBallDialog(ballId: string): void {
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }

  closeBallDialog(false);
  dispatchUi({ type: "replace-modal", route: "ball-detail" }, false);
  const root = uiHosts.replaceModal("ball-detail", renderBallDialog(ball, getDialogRenderContext()));
  applyUiState();

  const backdrop = root.querySelector<HTMLElement>("[data-dialog-backdrop]");
  const closeButton = root.querySelector<HTMLButtonElement>("[data-dialog-close]");
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeBallDialog();
    }
  });
  closeButton?.addEventListener("click", () => closeBallDialog());
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

  closeBallDialog(false);
  dispatchUi({ type: "replace-modal", route: "receipt" }, false);
  const root = uiHosts.replaceModal("receipt", renderReceiptDialog(ball, getDialogRenderContext(), sendMode));
  applyUiState();

  const backdrop = root.querySelector<HTMLElement>("[data-dialog-backdrop]");
  const closeButton = root.querySelector<HTMLButtonElement>("[data-dialog-close]");
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeBallDialog();
    }
  });
  closeButton?.addEventListener("click", () => closeBallDialog());
  root.querySelector<HTMLButtonElement>("[data-dialog-back-to-ball-id]")?.addEventListener("click", () => {
    showBallDialog(ballId);
  });
  root.querySelector<HTMLButtonElement>("[data-show-ball-qr-id]")?.addEventListener("click", (event) => {
    showReceiptQrDialog(ballId, readSendMode(event.currentTarget));
  });
  root.querySelector<HTMLButtonElement>("[data-share-receipt-image-id]")?.addEventListener("click", (event) => {
    void shareReceiptImage(ballId, readSendMode(event.currentTarget));
  });
  root.querySelector<HTMLButtonElement>("[data-copy-ball-url-id]")?.addEventListener("click", (event) => {
    void copyBallUrl(ballId, readSendMode(event.currentTarget));
  });
  root.querySelector<HTMLButtonElement>("[data-copy-ball-line-url-id]")?.addEventListener("click", (event) => {
    void copyBallLineUrl(ballId, readSendMode(event.currentTarget));
  });
  bindQrFailureDiagnostics(root, ball, sendMode);
  bindReceiptScrollAffordance(root);
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
  closeBallDialog(false);
  dispatchUi({ type: "replace-modal", route: "receipt-qr" }, false);
  const root = uiHosts.replaceModal("receipt-qr", renderReceiptQrDialog(ball, getDialogRenderContext(), sendMode));
  applyUiState();

  const backdrop = root.querySelector<HTMLElement>("[data-dialog-backdrop]");
  const closeButton = root.querySelector<HTMLButtonElement>("[data-dialog-close]");
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeBallDialog();
    }
  });
  closeButton?.addEventListener("click", () => closeBallDialog());
  root.querySelector<HTMLButtonElement>("[data-dialog-receipt-ball-id]")?.addEventListener("click", (event) => {
    showReceiptDialog(ballId, readSendMode(event.currentTarget));
  });
  root.querySelector<HTMLButtonElement>("[data-copy-ball-url-id]")?.addEventListener("click", (event) => {
    void copyBallUrl(ballId, readSendMode(event.currentTarget));
  });
  root.querySelector<HTMLButtonElement>("[data-copy-ball-line-url-id]")?.addEventListener("click", (event) => {
    void copyBallLineUrl(ballId, readSendMode(event.currentTarget));
  });
  if (root.querySelector("[data-qr-generation-error]")) {
    bindQrFailureDiagnostics(root, ball, sendMode);
  } else {
    appendActivity(createBallActivityInput(ball, { action: "send-qr", sendMode }));
  }
  installBallDialogEscapeHandler(closeBallDialog);
  closeButton?.focus({ preventScroll: true });
}

function showBallEditDialog(ballId: string): void {
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }

  closeBallDialog(false);
  dispatchUi({ type: "replace-modal", route: "ball-edit" }, false);
  const root = uiHosts.replaceModal("ball-edit", renderBallEditDialog(ball, getFormRenderContext()));
  applyUiState();

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
  bindBallCountSliderControls(root);
  bindEditDescentEvents(root);
  bindModalKeyboardFocusAssist(root);
  installBallDialogEscapeHandler(requestClose);
  root.querySelector<HTMLButtonElement>("[data-dialog-close]")?.focus({ preventScroll: true });
}

function closeBallDialog(apply = true): void {
  clearModalLayers(apply);
}

function closeBallDialogOnEscape(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    if (uiState.confirm) {
      uiHosts.clearConfirm();
      dispatchUi({ type: "close-confirm" });
      return;
    }
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
  const deletedDescents = readPendingDeletedDescents(form);
  ledger = updateBall(ledger, editingId, readDraft(form), saveMode);
  const editedBall = ledger.balls.find((ball) => ball.id === editingId);
  if (editedBall) {
    const updatedBall = applyDescentRecordsToBall(editedBall, readEditedDescentRecords(form));
    ledger = {
      ...ledger,
      balls: ledger.balls.map((ball) => ball.id === editingId ? updatedBall : ball),
      updatedAt: updatedBall.updatedAt,
    };
    saveLedger(ledger);
    for (const deleted of deletedDescents) {
      appendActivity(createBallActivityInput(updatedBall, {
        action: "descent-delete",
        descentSequence: deleted.sequence,
        message: deleted.id,
      }));
    }
  }
  selectedBallId = editingId;
  render();
  showBallDialog(editingId);
}

function requestSaveBallEditDialog(root: HTMLElement, form: HTMLFormElement | null, originalBall: HappyBall): void {
  if (!form) {
    return;
  }
  if (!hasEditFormChanged(originalBall, form)) {
    closeBallDialog();
    showBallDialog(originalBall.id);
    return;
  }

  showEditSaveModeConfirm(root, form, "save");
}

function requestCloseBallEditDialog(root: HTMLElement, form: HTMLFormElement | null, originalBall: HappyBall): void {
  if (!form || !hasEditFormChanged(originalBall, form)) {
    closeBallDialog();
    return;
  }

  showEditSaveModeConfirm(root, form, "close");
}

function showEditSaveModeConfirm(root: HTMLElement, form: HTMLFormElement, reason: "save" | "close"): void {
  uiHosts.clearConfirm();
  dispatchUi({ type: "open-confirm", route: "edit-save" }, false);
  const confirmRoot = uiHosts.renderConfirm(
    "edit-save",
    `<div class="edit-unsaved-backdrop" data-edit-unsaved-confirm>${renderEditSaveModeConfirm(reason)}</div>`,
  );
  applyUiState();
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-save-echo]")?.addEventListener("click", () => {
    saveBallEditForm(form, "withEcho");
  });
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-save-correction]")?.addEventListener("click", () => {
    saveBallEditForm(form, "correction");
  });
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-continue]")?.addEventListener("click", () => {
    uiHosts.clearConfirm();
    dispatchUi({ type: "close-confirm" });
    root.querySelector<HTMLButtonElement>("[data-dialog-close]")?.focus({ preventScroll: true });
  });
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-discard-close]")?.addEventListener("click", () => closeBallDialog());
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-save-correction]")?.focus({ preventScroll: true });
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

function hasEditFormChanged(ball: HappyBall, form: HTMLFormElement): boolean {
  const latestBall = ledger.balls.find((item) => item.id === ball.id) ?? ball;
  return hasEditDraftChanged(ball, readDraft(form)) || haveDescentRecordsChanged(latestBall.descents ?? [], readEditedDescentRecords(form));
}

function haveDescentRecordsChanged(previous: NonNullable<HappyBall["descents"]>, next: NonNullable<HappyBall["descents"]>): boolean {
  return JSON.stringify(previous) !== JSON.stringify(next);
}

function mountRapierStage(balls: HappyBall[]): void {
  const field = uiHosts.base.querySelector<HTMLDivElement>("#ball-field");
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
    handlePhysicsFault,
  );
  physicsRuntime.attach(physicsStage);
  installPlayDebugEventLogging(field);
}

function installPlayDebugEventLogging(field: HTMLElement): void {
  const logEvent = (event: Event) => {
    if (!appSettings.gravityDebugEnabled) {
      return;
    }
    debugLog.append(`play:${event.type}`, describeDebugEvent(event));
  };

  field.addEventListener("pointerdown", logEvent, { passive: true });
  field.addEventListener("pointermove", logEvent, { passive: true });
  field.addEventListener("pointerup", logEvent, { passive: true });
  field.addEventListener("pointercancel", logEvent, { passive: true });
  field.addEventListener("touchstart", logEvent, { passive: true });
  field.addEventListener("touchmove", logEvent, { passive: true });
  field.addEventListener("touchend", logEvent, { passive: true });
  field.addEventListener("touchcancel", logEvent, { passive: true });
  field.addEventListener("selectstart", logEvent);
  field.addEventListener("dragstart", logEvent);
  field.addEventListener("contextmenu", logEvent);
}

function appendGravityDebugLog(snapshot: DeviceGravityDebugSnapshot): void {
  if (!appSettings.gravityDebugEnabled) {
    return;
  }
  const now = Date.now();
  if (now - lastMotionDebugLogAt < 120) {
    return;
  }
  lastMotionDebugLogAt = now;
  debugLog.append("motion", {
    source: snapshot.source,
    reason: snapshot.reason,
    screenAngle: snapshot.screenAngle,
    orientationType: snapshot.orientationType,
    viewport: snapshot.viewport,
    beta: snapshot.beta,
    gamma: snapshot.gamma,
    alpha: snapshot.alpha,
    motion: {
      x: snapshot.motionX,
      y: snapshot.motionY,
      z: snapshot.motionZ,
    },
    rawGravity: snapshot.rawGravity,
    gravity: snapshot.gravity,
    platform: snapshot.platform,
    axisCorrection: snapshot.axisCorrection,
  }, now);
}

function describeDebugEvent(event: Event): Record<string, unknown> {
  const target = event.target instanceof HTMLElement ? event.target : null;
  return {
    eventType: event.type,
    target: target ? describeDebugTarget(target) : null,
    pointer: typeof PointerEvent !== "undefined" && event instanceof PointerEvent
      ? {
        pointerType: event.pointerType,
        isPrimary: event.isPrimary,
        clientX: Math.round(event.clientX),
        clientY: Math.round(event.clientY),
      }
      : null,
    touches: typeof TouchEvent !== "undefined" && event instanceof TouchEvent ? describeTouches(event) : null,
    selection: describeCurrentSelection(),
  };
}

function describeDebugTarget(target: HTMLElement): Record<string, unknown> {
  return {
    tagName: target.tagName.toLowerCase(),
    className: target.className,
    visualBallId: target.closest<HTMLElement>("[data-visual-ball-id]")?.dataset.visualBallId ?? null,
  };
}

function describeTouches(event: TouchEvent): Record<string, unknown> {
  return {
    touches: event.touches.length,
    changedTouches: event.changedTouches.length,
    firstTouch: event.touches[0] ? describeTouch(event.touches[0]) : null,
    firstChangedTouch: event.changedTouches[0] ? describeTouch(event.changedTouches[0]) : null,
  };
}

function describeTouch(touch: Touch): Record<string, number> {
  return {
    clientX: Math.round(touch.clientX),
    clientY: Math.round(touch.clientY),
  };
}

function describeCurrentSelection(): Record<string, unknown> {
  const selection = document.getSelection();
  return {
    type: selection?.type ?? null,
    textLength: selection?.toString().length ?? 0,
  };
}

function createDebugLogJson(): string {
  return JSON.stringify(debugLog.toPayload(createDebugLogContext()), null, 2);
}

function createDebugLogContext(): Record<string, unknown> {
  return {
    url: window.location.href,
    secureContext: window.isSecureContext,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      visualViewportWidth: window.visualViewport?.width ?? null,
      visualViewportHeight: window.visualViewport?.height ?? null,
      visualViewportOffsetLeft: window.visualViewport?.offsetLeft ?? null,
      visualViewportOffsetTop: window.visualViewport?.offsetTop ?? null,
      visualViewportScale: window.visualViewport?.scale ?? null,
    },
    ui: createAppUiSnapshot(uiState),
    imeActive: appRoot.dataset.imeActive === "true",
    screen: {
      width: screen.width,
      height: screen.height,
      orientationAngle: screen.orientation?.angle ?? null,
      orientationType: screen.orientation?.type ?? null,
    },
    gravityEnabled: appSettings.gravityEnabled,
    gravityDebugEnabled: appSettings.gravityDebugEnabled,
    latestGravityDebug,
  };
}

function downloadDebugLog(): void {
  const json = createDebugLogJson();
  try {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = createDebugLogFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    showManualCopyDialog(json);
  }
}

async function copyDebugLog(): Promise<void> {
  await copyTextWithFallback(createDebugLogJson(), "デバッグログJSONをコピーしました。");
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

function bindEvents(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>("[data-open-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = button.dataset.openPanel;
      if (panel === "none") {
        dispatchUi({ type: "open-primary", route: "play" }, false);
        render();
        return;
      }
      const route = primaryRouteFromPanel(panel);
      if (!route) {
        return;
      }
      if (panel === "calendar") {
        calendarMonth = displayAnchorDate.slice(0, 7);
      }
      if (panel === "create" || panel === "settings") {
        rememberSubfeatureReturnScreen();
      }
      if (panel === "create") {
        createPromptDismissed = true;
        prepareCreateDraftForOpen();
      }
      if (panel === "list" && uiState.primary !== "settings") {
        rememberSubfeatureReturnScreen();
      }
      dispatchUi({ type: "open-primary", route }, false);
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-cycle-display-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      displayMode = nextDisplayMode(displayMode);
      draft = { ...draft, date: displayAnchorDate };
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-shift-display-period]").forEach((button) => {
    button.addEventListener("click", () => {
      navigateDisplayPeriod(button.dataset.shiftDisplayPeriod === "1" ? 1 : -1);
    });
  });

  root.querySelectorAll<HTMLElement>("[data-close-panel]").forEach((element) => {
    element.addEventListener("click", (event) => {
      const isBackdrop = element.classList.contains("panel-backdrop");
      if (isBackdrop && event.target !== element) {
        return;
      }
      if (uiState.primary === "create" || uiState.primary === "settings" || uiState.primary === "saved-list") {
        restoreSubfeatureReturnScreen();
      } else {
        dispatchUi({ type: "open-primary", route: "play" }, false);
      }
      render();
    });
  });

  root.querySelector("[data-cycle-ball-label-mode]")?.addEventListener("click", () => {
    updateAppSettings({ ballLabelMode: nextBallLabelMode(appSettings.ballLabelMode) });
    render();
  });

  root.querySelector("[data-toggle-activity-log-help]")?.addEventListener("click", () => {
    activityLogHelpOpen = !activityLogHelpOpen;
    openSettingsGroups = readOpenSettingsGroups();
    render();
  });

  root.querySelector("[data-download-debug-log]")?.addEventListener("click", () => {
    downloadDebugLog();
  });

  root.querySelector("[data-copy-debug-log]")?.addEventListener("click", () => {
    void copyDebugLog();
  });

  root.querySelector("[data-clear-debug-log]")?.addEventListener("click", () => {
    debugLog.clear();
    debugLog.append("system", { message: "debug log cleared" });
    alert("デバッグログを消去しました。");
  });

  root.querySelectorAll<HTMLButtonElement>("[data-calendar-month]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextCalendarMonth = button.dataset.calendarMonth || calendarMonth;
      calendarMonth = nextCalendarMonth;
      displayAnchorDate = moveDisplayAnchorToCalendarMonth(displayAnchorDate, nextCalendarMonth);
      draft = { ...draft, date: displayAnchorDate };
      dispatchUi({ type: "open-primary", route: "calendar-month" }, false);
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-calendar-shift-day]").forEach((button) => {
    button.addEventListener("click", () => {
      const delta = button.dataset.calendarShiftDay === "1" ? 1 : -1;
      displayAnchorDate = shiftIsoDate(displayAnchorDate, delta);
      calendarMonth = displayAnchorDate.slice(0, 7);
      draft = { ...draft, date: displayAnchorDate };
      dispatchUi({ type: "open-primary", route: "calendar-day-list" }, false);
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-open-calendar-day-list]").forEach((button) => {
    button.addEventListener("click", () => {
      calendarMonth = displayAnchorDate.slice(0, 7);
      dispatchUi({ type: "open-primary", route: "calendar-day-list" }, false);
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-filter-date]").forEach((button) => {
    button.addEventListener("click", () => {
      displayAnchorDate = button.dataset.filterDate ?? displayAnchorDate;
      if (displayAnchorDate) {
        draft = { ...draft, date: displayAnchorDate };
        calendarMonth = displayAnchorDate.slice(0, 7);
      }
      dispatchUi({ type: "open-primary", route: "calendar-day-list" }, false);
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-calendar-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.calendarView;
      if (view === "month" || view === "dayList") {
        dispatchUi({ type: "open-primary", route: view === "month" ? "calendar-month" : "calendar-day-list" }, false);
        render();
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-calendar-open-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = button.dataset.calendarOpenPanel;
      if (panel !== "create" && panel !== "settings" && panel !== "calendar" && panel !== "dayList") {
        return;
      }
      if (panel === "calendar" || panel === "dayList") {
        calendarMonth = displayAnchorDate.slice(0, 7);
        dispatchUi({ type: "open-primary", route: panel === "calendar" ? "calendar-month" : "calendar-day-list" }, false);
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
      dispatchUi({ type: "open-primary", route: panel === "create" ? "create" : "settings" }, false);
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-calendar-cycle-display-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      displayMode = nextDisplayMode(displayMode);
      draft = { ...draft, date: displayAnchorDate };
      dispatchUi({ type: "open-primary", route: "play" }, false);
      render();
    });
  });

  root.querySelector("[data-calendar-cycle-marker-mode]")?.addEventListener("click", () => {
    updateAppSettings({ calendarMarkerMode: nextCalendarMarkerMode(appSettings.calendarMarkerMode) });
    render();
  });

  root.querySelector("[data-calendar-main]")?.addEventListener("click", () => {
    dispatchUi({ type: "open-primary", route: "play" }, false);
    render();
  });

  const form = root.querySelector<HTMLFormElement>("#ball-form");
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
    bindBallCountSliderControls(form);
  }

  bindSettingsGroupDisclosureEvents(root);
  bindPendingUrlPacketEvents(root);
  bindNamePresetEvents(root);
  bindSettingsPanelEvents({
    categories: editableCategories,
    maxNameBookEntries: MAX_NAME_BOOK_ENTRIES,
    root,
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

  root.querySelector("#clear-ball-data")?.addEventListener("click", () => {
    if (!confirm("保存された玉データをすべて消します。名前帳、アプリ設定、カテゴリ設定は残ります。実行しますか？")) {
      return;
    }
    appendActivity({
      action: "clear-ball-data",
      message: `${ledger.balls.length}件`,
    });
    ledger = clearBallData(ledger);
    selectedBallId = null;
    render();
  });

  root.querySelector("#export-json")?.addEventListener("click", () => {
    if (exportSelectedJson({ ledger, appSettings, categories: editableCategories, activityLog })) {
      appendActivity({ action: "json-export" });
    }
  });

  root.querySelector("#import-json")?.addEventListener("click", () => {
    root.querySelector<HTMLInputElement>("#import-json-file")?.click();
  });
  root.querySelector<HTMLInputElement>("#import-json-file")?.addEventListener("change", (event) => {
    const input = event.currentTarget;
    if (input instanceof HTMLInputElement) {
      void handleJsonImportFile(input);
    }
  });

  bindJsonImportEvents(root);

  root.querySelectorAll<HTMLButtonElement>("[data-select-ball-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedBallId = button.dataset.selectBallId ?? selectedBallId;
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-view-ball-id]").forEach((button) => {
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

  root.querySelectorAll<HTMLButtonElement>("[data-edit-ball-id]").forEach((button) => {
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

  root.querySelectorAll<HTMLButtonElement>("[data-copy-ball-url-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.copyBallUrlId;
      if (id) {
        void copyBallUrl(id);
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-copy-ball-line-url-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.copyBallLineUrlId;
      if (id) {
        void copyBallLineUrl(id);
      }
    });
  });

  root.querySelector("[data-clear-ledger-list-date]")?.addEventListener("click", () => {
    ledgerListDateFilter = null;
    render();
  });

  bindLifecycleActionEvents(root);
  bindDeleteBallEvents(root);
  bindDescendBallEvents(root);
}

function primaryRouteFromPanel(panel: string | undefined): PrimaryRoute | null {
  if (panel === "calendar") return "calendar-month";
  if (panel === "create") return "create";
  if (panel === "list") return "saved-list";
  if (panel === "settings") return "settings";
  return null;
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
      appendActivity(createBallActivityInput(target, {
        action: "lifecycle-change",
        previousLifecycleStatus: target.lifecycleStatus,
        lifecycleStatus: status,
      }));
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
      appendActivity(createBallActivityInput(target, {
        action: "delete-ball",
        ballSnapshot: createBallActivitySnapshot(target),
      }));
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
      const editForm = button.closest<HTMLFormElement>("#ball-edit-form");
      if (editForm?.querySelector("[data-deleted-descent-id]")) {
        const feedback = editForm.querySelector<HTMLElement>("[data-edit-descent-feedback]");
        if (feedback) {
          feedback.textContent = "消去を保存してから降臨してください";
        }
        return;
      }
      void requestDescendLocation(target, button);
    });
  });
}

function bindEditDescentEvents(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>("[data-descent-delete-record-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest<HTMLElement>("[data-descent-edit-item]");
      const form = item?.closest<HTMLFormElement>("#ball-edit-form");
      if (!item || !form) {
        return;
      }
      const id = readDescentField(item, "id");
      const sequence = readPositiveInteger(readDescentField(item, "sequence"), 1);
      if (!confirm(`No.${sequence}の降臨dataを消去します。\n降臨メモ、GPS情報、付与された星も消去されます。\n保存するまで確定しません。続けますか？`)) {
        return;
      }
      const marker = document.createElement("input");
      marker.type = "hidden";
      marker.dataset.deletedDescentId = id;
      marker.dataset.deletedDescentSequence = String(sequence);
      form.append(marker);
      item.remove();
      replaceEditableDescentHistory(form, readEditedDescentRecords(form), `No.${sequence}を消去予定です。保存で確定します`);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-descent-gps-record-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest<HTMLElement>("[data-descent-edit-item]");
      if (!item) {
        return;
      }
      void updateEditDescentGps(item, button);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-descent-clear-gps-record-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest<HTMLElement>("[data-descent-edit-item]");
      if (!item) {
        return;
      }
      writeDescentField(item, "latitude", "");
      writeDescentField(item, "longitude", "");
      writeDescentField(item, "accuracyMeters", "");
      writeDescentField(item, "distanceFromPreviousMeters", "");
      updateEditDescentGpsUi(item, null);
      updateDescentActionFeedback(item, "GPSを削除しました");
      recordEditDescentGpsActivity(item, "descent-gps-clear");
    });
  });
}

async function updateEditDescentGps(item: HTMLElement, button: HTMLButtonElement): Promise<void> {
  if (!navigator.geolocation) {
    alert(createGeolocationUnavailableMessage());
    return;
  }
  setButtonBusy(button, true, "位置確認中...");
  try {
    const position = await readCurrentPosition();
    const input = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
    };
    writeDescentField(item, "latitude", String(input.latitude));
    writeDescentField(item, "longitude", String(input.longitude));
    writeDescentField(item, "accuracyMeters", String(input.accuracyMeters));
    writeDescentField(item, "distanceFromPreviousMeters", "");
    updateEditDescentGpsUi(item, input);
    updateDescentActionFeedback(item, "GPS取得できました");
    recordEditDescentGpsActivity(item, "descent-gps-update");
  } catch (error) {
    alert(`位置情報を取得できませんでした。時間をおいて、同じ降臨カードからもう一度GPS取得を試せます。\n${formatGeolocationError(error)}`);
  } finally {
    setButtonBusy(button, false);
  }
}

function updateEditDescentGpsUi(item: HTMLElement, position: DescentPositionInput | null): void {
  const status = item.querySelector<HTMLElement>("[data-descent-gps-status]");
  const mapSlot = item.querySelector<HTMLElement>("[data-descent-map-link]");
  const locationRow = item.querySelector<HTMLElement>(".edit-descent-location-row");
  const clearButton = item.querySelector<HTMLButtonElement>("[data-descent-clear-gps-record-id]");
  const gpsButton = item.querySelector<HTMLButtonElement>("[data-descent-gps-record-id]");
  if (position) {
    locationRow?.classList.add("has-position");
    locationRow?.classList.remove("is-empty-position");
    const mapRecord = { latitude: position.latitude, longitude: position.longitude };
    if (status) {
      status.textContent = formatCoordinatesForUi(position.latitude, position.longitude);
    }
    if (mapSlot) {
      const href = createGoogleMapsUrl(mapRecord);
      mapSlot.outerHTML = `<a class="ghost-action quiet-accent-action detail-map-link" data-descent-map-link href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Google Maps</a>`;
    }
    if (clearButton) {
      clearButton.disabled = false;
    }
    if (gpsButton) {
      gpsButton.textContent = "GPS再取得";
    }
    return;
  }
  locationRow?.classList.add("is-empty-position");
  locationRow?.classList.remove("has-position");
  if (status) {
    status.textContent = "位置未取得";
  }
  if (mapSlot) {
    mapSlot.outerHTML = `<span data-descent-map-link></span>`;
  }
  if (clearButton) {
    clearButton.disabled = true;
  }
  if (gpsButton) {
    gpsButton.textContent = "GPS取得";
  }
}

function setButtonBusy(button: HTMLButtonElement, busy: boolean, busyText = "処理中..."): void {
  if (busy) {
    button.dataset.idleText = button.textContent ?? "";
    button.textContent = busyText;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    return;
  }
  button.textContent = button.dataset.idleText || button.textContent || "";
  button.disabled = false;
  button.removeAttribute("aria-busy");
  delete button.dataset.idleText;
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

function bindSettingsGroupDisclosureEvents(root: ParentNode): void {
  const groups = Array.from(root.querySelectorAll<HTMLDetailsElement>(".floating-panel-settings details.settings-group"));
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
  dispatchUi({ type: "open-primary", route: "play" }, false);
  render();
}

function bindJsonImportEvents(root: ParentNode): void {
  root.querySelector("#dismiss-json-import")?.addEventListener("click", () => {
    pendingJsonImport = null;
    render();
  });

  root.querySelector("#confirm-json-import")?.addEventListener("click", () => {
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

  appendActivity({
    action: "json-import",
    message: selectedSections.join(","),
  });
  pendingJsonImport = null;
  dispatchUi({ type: "open-primary", route: "play" }, false);
  render();
}

async function shareReceiptImage(ballId: string, sendMode: SendMode = "formal"): Promise<void> {
  const prepared = prepareReceiptImageBall(ballId);
  if (!prepared) {
    return;
  }

  const { ball } = prepared;
  const receiptTitle = getReceiptTitle(ball, sendMode);
  try {
    const fileName = createReceiptImageFileName(ball, sendMode);
    const blob = await createReceiptImageBlob(ball, getReceiptImageContext(), sendMode);
    const file = new File([blob], fileName, { type: "image/png" });
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      throw new Error("File sharing is unavailable.");
    }
    await navigator.share({
      files: [file],
      title: `えもい玉 ${receiptTitle}`,
      text: `${receiptTitle}です。`,
    });
    appendActivity(createBallActivityInput(ball, {
      action: "send-image-share",
      sendMode,
    }));
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    appendActivity(createBallActivityInput(ball, {
      action: "send-image-share",
      sendMode,
      status: "failure",
      message: "画像共有を利用できませんでした",
    }));
    const feedback = document.querySelector<HTMLElement>("[data-receipt-action-feedback]");
    if (feedback) {
      feedback.textContent = "この端末では画像共有を利用できません。端末の画面キャプチャをご利用ください。";
    } else {
      alert("この端末では画像共有を利用できません。端末の画面キャプチャをご利用ください。");
    }
  }
}

function updateDescentActionFeedback(item: HTMLElement, message: string): void {
  const feedback = item.querySelector<HTMLElement>("[data-descent-action-feedback]");
  if (feedback) {
    feedback.textContent = message;
  }
}

function recordEditDescentGpsActivity(item: HTMLElement, action: "descent-gps-update" | "descent-gps-clear"): void {
  const form = item.closest<HTMLFormElement>("#ball-edit-form");
  const ballId = form?.dataset.editingBallId;
  const ball = ballId ? ledger.balls.find((entry) => entry.id === ballId) : null;
  const sequence = readPositiveInteger(readDescentField(item, "sequence"), 1);
  if (!ball) {
    return;
  }
  appendActivity(createBallActivityInput(ball, {
    action,
    descentSequence: sequence,
  }));
}

function getReceiptImageContext() {
  return {
    currentUrl: window.location.href,
    showMemoField: appSettings.showMemoField,
    includeDescentGpsInHandoff: appSettings.includeDescentGpsInHandoff,
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

function bindPendingUrlPacketEvents(root: ParentNode): void {
  root.querySelector("#dismiss-url-packet")?.addEventListener("click", () => {
    if (pendingUrlPacket?.ok) {
      snoozedUrlPacket = pendingUrlPacket;
    }
    pendingUrlPacket = null;
    render();
  });

  root.querySelector("#clear-url-packet")?.addEventListener("click", () => {
    pendingUrlPacket = null;
    snoozedUrlPacket = null;
    clearLocationPacketParams();
    render();
  });

  root.querySelector("#show-snoozed-url-packet")?.addEventListener("click", () => {
    pendingUrlPacket = snoozedUrlPacket;
    snoozedUrlPacket = null;
    render();
  });

  root.querySelector("#clear-snoozed-url-packet")?.addEventListener("click", () => {
    pendingUrlPacket = null;
    snoozedUrlPacket = null;
    clearLocationPacketParams();
    render();
  });

  root.querySelector("#confirm-url-import")?.addEventListener("click", () => {
    if (!pendingUrlPacket?.ok) {
      return;
    }
    const review = reviewPacketImport(pendingUrlPacket.packet, ledger.balls);
    ledger = importNewBalls(ledger, review.newItems);
    for (const ball of review.newItems) {
      appendActivity(createBallActivityInput(ball, {
        action: "url-receive",
        sendMode: pendingUrlPacket.packet.sendMode ?? "formal",
      }));
    }
    selectedBallId = review.newItems[0]?.id ?? selectedBallId;
    displayAnchorDate = review.newItems[0]?.date ?? displayAnchorDate;
    displayMode = "day";
    dispatchUi({ type: "open-primary", route: "play" }, false);
    pendingUrlPacket = null;
    snoozedUrlPacket = null;
    clearLocationPacketParams();
    render();
  });

  root.querySelector("#replace-url-import")?.addEventListener("click", () => {
    if (!pendingUrlPacket?.ok) {
      return;
    }
    const review = reviewPacketImport(pendingUrlPacket.packet, ledger.balls);
    if (review.conflicts.length === 0) {
      return;
    }
    ledger = importNewAndReplaceBalls(ledger, review.newItems, review.conflicts);
    for (const ball of [...review.newItems, ...review.conflicts]) {
      appendActivity(createBallActivityInput(ball, {
        action: "url-replace-receive",
        sendMode: pendingUrlPacket.packet.sendMode ?? "formal",
      }));
    }
    selectedBallId = review.newItems[0]?.id ?? review.conflicts[0]?.id ?? selectedBallId;
    displayAnchorDate = review.newItems[0]?.date ?? review.conflicts[0]?.date ?? displayAnchorDate;
    displayMode = "day";
    dispatchUi({ type: "open-primary", route: "play" }, false);
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

  const url = createPacketImportUrl(ball, window.location.href, getHandoffOptions(sendMode));
  await copyTextWithFallback(url, "玉URLをコピーしました。");
  appendActivity(createBallActivityInput(ball, {
    action: "send-url",
    sendMode,
  }));
}

async function copyBallLineUrl(ballId: string, sendMode: SendMode = "formal"): Promise<void> {
  ledger = markReceiptCreated(ledger, ballId);
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }
  updateReceiptCreatedIndicators(ball);

  const url = createLinePacketImportUrl(ball, window.location.href, getHandoffOptions(sendMode));
  await copyTextWithFallback(url, "LINE用の玉URLをコピーしました。");
  appendActivity(createBallActivityInput(ball, {
    action: "send-line-url",
    sendMode,
  }));
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
  dispatchUi({ type: "push-modal", route: "manual-copy" }, false);
  const root = uiHosts.pushModal("manual-copy", renderManualCopyDialog(text));
  applyUiState();

  const close = () => {
    uiHosts.closeTopModal();
    dispatchUi({ type: "close-top-modal" });
  };
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

function handleDisplayNavigationKey(event: KeyboardEvent): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
    return;
  }
  if (uiState.primary !== "play" || uiState.modals.length > 0) {
    return;
  }
  if (isEditableKeyboardTarget(event.target)) {
    return;
  }
  event.preventDefault();
  navigateDisplayPeriod(event.key === "ArrowRight" ? 1 : -1);
}

function navigateDisplayPeriod(delta: -1 | 1): void {
  if (uiState.primary !== "play") {
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

function readLifecycleStatus(value: string | undefined): LifecycleStatus | null {
  return value === "active" || value === "archived" || value === "memorial" || value === "offered" ? value : null;
}

async function requestDescendLocation(ball: HappyBall, sourceButton?: HTMLButtonElement): Promise<void> {
  if (pendingDescentBallIds.has(ball.id)) {
    return;
  }

  const editForm = sourceButton?.closest<HTMLFormElement>("#ball-edit-form") ?? null;
  const memo = window.prompt("降臨メモ（任意・80文字まで）", "") ?? "";
  pendingDescentBallIds.add(ball.id);
  updateDescentButtonsBusy(ball.id, true, sourceButton);
  try {
    const position = await readCurrentPosition();
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
      const keepGpsless = confirm(`現在位置が前回地点から十分に離れたと確認できませんでした。\n直近の降臨地から約${Math.round(result.distanceFromPreviousMeters)}mです。\n設定距離: ${result.requiredDistanceMeters}m\nGPSなしの仮降臨として、メモと星を残しますか？`);
      if (keepGpsless) {
        saveGpslessDescent(ball, memo);
      }
      return;
    }
    saveDescentResult(ball, result.ball);
    appendActivity(createBallActivityInput(result.ball, {
      action: "descent-create",
      descentSequence: result.record.sequence,
      message: hasDescentPosition(result.record) ? "GPS取得成功" : "位置未取得",
    }));
    if (editForm) {
      refreshPersistentSurfacesAfterLedgerMutation();
      updateEditDialogAfterNewDescent(editForm, result.record, `GPS取得できました / No.${result.record.sequence}を記録しました`);
      return;
    }
    const locationText = hasDescentPosition(result.record)
      ? `現在地: ${formatCoordinatesForUi(result.record.latitude, result.record.longitude)}`
      : "現在地: 位置未取得";
    alert(`「${ball.title}」に第${result.record.sequence}回の降臨を記録しました。\n${locationText}`);
    render();
  } catch (error) {
    const errorDetail = formatGeolocationError(error);
    const detailText = errorDetail ? `\n${errorDetail}` : "";
    if (!confirm(`位置情報を取得できませんでした。${detailText}\nGPSなしの仮降臨として、メモと星を残しますか？`)) {
      return;
    }
    saveGpslessDescent(ball, memo, editForm);
  } finally {
    pendingDescentBallIds.delete(ball.id);
    updateDescentButtonsBusy(ball.id, false, sourceButton);
  }
}

function saveGpslessDescent(ball: HappyBall, memo: string, editForm: HTMLFormElement | null = null): void {
  const result = appendDescentToBall(ball, null, appSettings.descentMinDistanceMeters, memo);
  if (!result.ok) {
    return;
  }
  saveDescentResult(ball, result.ball);
  appendActivity(createBallActivityInput(result.ball, {
    action: "descent-create",
    descentSequence: result.record.sequence,
    message: "仮降臨",
  }));
  if (editForm) {
    refreshPersistentSurfacesAfterLedgerMutation();
    updateEditDialogAfterNewDescent(editForm, result.record, `仮降臨を記録しました / No.${result.record.sequence}`);
    return;
  }
  alert(`「${ball.title}」に第${result.record.sequence}回の仮降臨を記録しました。\n位置は後で編集画面から取得できます。`);
  render();
}

function updateEditDialogAfterNewDescent(form: HTMLFormElement, record: HappyBallDescentRecord, message: string): void {
  replaceEditableDescentHistory(form, [...readEditedDescentRecords(form), record], message);
}

function replaceEditableDescentHistory(form: HTMLFormElement, records: HappyBallDescentRecord[], message: string): void {
  const editingId = form.dataset.editingBallId;
  const ball = ledger.balls.find((item) => item.id === editingId);
  if (!ball) {
    return;
  }
  const displayBall = applyDescentRecordsToBall(ball, normalizeDescentRecords(records), ball.updatedAt);
  const template = document.createElement("template");
  template.innerHTML = renderEditableDescentHistory(displayBall).trim();
  const nextHistory = template.content.firstElementChild as HTMLElement | null;
  if (!nextHistory) {
    return;
  }
  const currentHistory = form.querySelector<HTMLElement>(".edit-descent-history");
  if (currentHistory) {
    currentHistory.replaceWith(nextHistory);
  } else {
    form.querySelector(".edit-lifecycle-actions")?.insertAdjacentElement("beforebegin", nextHistory);
  }
  bindDescendBallEvents(nextHistory);
  bindEditDescentEvents(nextHistory);
  const feedback = nextHistory.querySelector<HTMLElement>("[data-edit-descent-feedback]");
  if (feedback) {
    feedback.textContent = message;
  }
}

function refreshPersistentSurfacesAfterLedgerMutation(): void {
  const visibleBalls = getVisibleBalls();
  const selectedBall = visibleBalls.find((ball) => ball.id === selectedBallId) ?? visibleBalls[0] ?? null;
  ensureBaseRendered(visibleBalls, selectedBall);
  renderPrimarySurface();
  applyUiState();
  applyBallFieldTextureSetting();
}

function saveDescentResult(previousBall: HappyBall, nextBall: HappyBall): void {
  const latestBall = ledger.balls.find((item) => item.id === previousBall.id) ?? previousBall;
  const mergedBall = {
    ...latestBall,
    descents: nextBall.descents,
    descentBadgeCount: nextBall.descentBadgeCount,
    isKamiBall: nextBall.isKamiBall,
    updatedAt: nextBall.updatedAt,
  };
  ledger = {
    ...ledger,
    balls: ledger.balls.map((item) => item.id === previousBall.id ? mergedBall : item),
    updatedAt: mergedBall.updatedAt,
  };
  saveLedger(ledger);
}

function updateDescentButtonsBusy(ballId: string, busy: boolean, sourceButton?: HTMLButtonElement): void {
  document.querySelectorAll<HTMLButtonElement>("[data-descend-ball-id]").forEach((button) => {
    if (button.dataset.descendBallId !== ballId) {
      return;
    }
    if (busy) {
      button.dataset.idleText = button.textContent ?? "";
      button.textContent = button === sourceButton ? "位置確認中..." : "降臨中...";
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      return;
    }
    button.textContent = button.dataset.idleText || "降臨";
    button.disabled = false;
    button.removeAttribute("aria-busy");
    delete button.dataset.idleText;
  });
}

async function readCurrentPosition(): Promise<GeolocationPosition> {
  return readReliableCurrentPosition(navigator.geolocation);
}

function formatGeolocationError(error: unknown): string {
  if (isGeolocationUnavailableError(error)) {
    return createGeolocationUnavailableMessage();
  }
  if (isStaleGeolocationPositionError(error)) {
    return "取得した位置情報が古いため採用しませんでした。少し待ってから再取得できます。";
  }
  const code = readGeolocationErrorCode(error);
  if (code === 1) {
    return "ブラウザで位置情報が許可されていません。許可設定を確認してください。";
  }
  if (code === 2) {
    return "端末が現在位置を返せませんでした。屋外や窓際など、電波を拾いやすい場所で再取得できます。";
  }
  if (code === 3) {
    return "位置確認が時間切れになりました。少し待ってから再取得できます。";
  }
  return "";
}

function readGeolocationErrorCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  const code = (error as { code: unknown }).code;
  return typeof code === "number" && Number.isFinite(code) ? code : null;
}

function createGeolocationUnavailableMessage(): string {
  const contextHint = window.isSecureContext
    ? ""
    : "\nHTTPSまたはlocalhostのURLで開くと取得できる場合があります。";
  return `この端末またはブラウザでは位置情報を取得できません。${contextHint}`;
}

function formatCoordinatesForUi(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
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

function nextCalendarMarkerMode(mode: AppSettings["calendarMarkerMode"]): AppSettings["calendarMarkerMode"] {
  return mode === "spread" ? "meter" : "spread";
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
    const form = select.closest("form");
    const subjectInput = form?.querySelector<HTMLInputElement>("input[name='subject']");
    const issuerSelect = form?.querySelector<HTMLSelectElement>("select[name='issuerType']");

    select.addEventListener("change", () => {
      const selected = select.selectedOptions[0];
      const resolution = resolveNamePresetSelection({
        name: select.value,
        role: selected?.dataset.nameRole === "proxy" ? "proxy" : "self",
        issuerType: (issuerSelect?.value ?? "self") as IssuerType,
      });
      if (!form || !subjectInput || !resolution) {
        return;
      }

      subjectInput.value = resolution.subject;
      if (issuerSelect) {
        issuerSelect.value = resolution.issuerType;
      }

      if (form.id === "ball-form") {
        draft = readDraft(form);
      }
    });

    subjectInput?.addEventListener("input", () => {
      select.value = resolveManualSubjectPreset(subjectInput.value, select.value);
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

function readEditedDescentRecords(form: HTMLFormElement): HappyBallDescentRecord[] {
  return Array.from(form.querySelectorAll<HTMLElement>("[data-descent-edit-item]")).map((item, index) => {
    const record: HappyBallDescentRecord = {
      id: readDescentField(item, "id") || `edited_descent_${index + 1}`,
      sequence: readPositiveInteger(readDescentField(item, "sequence"), index + 1),
      recordedAt: readDescentField(item, "recordedAt") || new Date().toISOString(),
      badgeAwarded: readDescentField(item, "badgeAwarded") !== "false",
      memo: readDescentField(item, "memo"),
    };
    const latitude = readOptionalNumber(readDescentField(item, "latitude"));
    const longitude = readOptionalNumber(readDescentField(item, "longitude"));
    if (latitude !== undefined && longitude !== undefined) {
      record.latitude = latitude;
      record.longitude = longitude;
      record.accuracyMeters = readOptionalNumber(readDescentField(item, "accuracyMeters"));
      record.distanceFromPreviousMeters = readOptionalNumber(readDescentField(item, "distanceFromPreviousMeters"));
    }
    return record;
  });
}

function readPendingDeletedDescents(form: HTMLFormElement): Array<{ id: string; sequence: number }> {
  return Array.from(form.querySelectorAll<HTMLInputElement>("[data-deleted-descent-id]")).map((marker) => ({
    id: marker.dataset.deletedDescentId ?? "",
    sequence: readPositiveInteger(marker.dataset.deletedDescentSequence ?? "", 1),
  }));
}

function readDescentField(root: HTMLElement, field: string): string {
  const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-descent-field="${field}"]`);
  return input?.value ?? "";
}

function writeDescentField(root: HTMLElement, field: string, value: string): void {
  const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-descent-field="${field}"]`);
  if (input) {
    input.value = value;
  }
}

function readPositiveInteger(value: string, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.floor(number)) : fallback;
}

function readOptionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
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
  uiHosts.clearPrimary();
  uiHosts.clearModals();
  uiHosts.clearConfirm();
  uiHosts.renderBase(`
    <main class="loading-shell error-shell">
      <div>
        <strong>起動に失敗しました</strong>
        <pre>${escapeHtml(message)}</pre>
      </div>
    </main>
  `);
}

function handleApplicationError(error: unknown): void {
  if (!bootComplete) {
    showFatalError(error);
    return;
  }
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  debugLog.append("runtime-error", { message });
  console.error("Application runtime error was contained.", error);
  uiHosts.renderTransient(`
    <aside class="runtime-fault-banner" role="status">
      <strong>一部の処理を停止しました</strong>
      <span>画面操作は継続できます。</span>
    </aside>
  `, true);
}

function handlePhysicsFault(error: unknown): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  debugLog.append("physics-error", { message });
  console.error("Physics was frozen after a contained fault.", error);
  uiHosts.renderTransient(`
    <aside class="runtime-fault-banner" role="status">
      <strong>玉の動きを停止しました</strong>
      <span>画面操作と保存データは継続して利用できます。</span>
    </aside>
  `, true);
}
