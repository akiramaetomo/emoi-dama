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
  nextBallLabelMode,
} from "./ball-labels";
import { isBallLifecycleAction, resolveBallLifecycleTransition } from "./ball-lifecycle";
import {
  applyBallSieve,
  DEFAULT_BALL_SIEVE_PRESET,
  getBallSieveLabel,
  isBallSievePresetId,
  renderBallSieveEmptyMessage,
  type BallSievePresetId,
} from "./ball-sieve";
import {
  bindCreateAuthoringUiActions,
  bindEditAuthoringUiActions,
  bindEditSaveConfirmActions,
  hasBallEditFormChanged,
  readAuthoringDraft,
  readEditedDescentRecords,
  replaceAuthoringDescentHistory,
  updateAuthoringDescentButtonsBusy,
  type AuthoringDescentActionHandlers,
  type AuthoringDraftDefaults,
} from "./authoring-ui-actions";
import { renderCalendarOverlay, renderCalendarPrimaryParts, type CalendarRenderContext } from "./calendar-renderers";
import {
  loadCategoryColorPresets,
  normalizeCategoryColorPresets,
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
  downloadJsonFile,
  exportDeviceBackupJson,
  readSelectedJsonImportSections,
  reviewJsonImportFile,
} from "./json-transfer-actions";
import { DeviceGravityController, requestDeviceGravityPermission, type DeviceGravityDebugSnapshot } from "./device-gravity";
import {
  appendDescentToBall,
  applyDescentRecordsToBall,
  hasDescentPosition,
  type DescentPositionInput,
} from "./descent";
import { getDisplayDateRange, moveDisplayAnchorToCalendarMonth, shiftDisplayAnchor, type DisplayMode } from "./display-period";
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
  renderEditSaveModeConfirm,
  type FormRenderContext,
} from "./form-renderers";
import { hasBallDraftChanged } from "./form-interactions";
import { TinyImpactAudio } from "./impact-audio";
import {
  isDomRendererComparisonEnabled,
  isGravityDebugEnabled,
  isHandoffDebugEnabled,
  isUiDebugDiagnosticsEnabled,
} from "./development-diagnostics";
import { ImeViewportCoordinator } from "./ime-viewport-coordinator";
import { isGeolocationUnavailableError, isStaleGeolocationPositionError, readReliableCurrentPosition } from "./location";
import {
  renderPendingJsonImportDialog,
  renderPendingUrlPacketDialog,
  renderSnoozedUrlPacketReminder,
} from "./import-dialog-renderers";
import { renderManualCopyDialog } from "./manual-copy-renderers";
import { type BallDraft, type HappyBall, type HappyBallDescentRecord, type NameBookEntry, type SendMode } from "./models";
import { resolveFocusScrollDelta } from "./modal-interactions";
import {
  createLinePacketImportUrl,
  createPacketImportUrl,
  parsePacketLocation,
  reviewPacketImport,
  type HandoffOptions,
  type UrlPacketParseResult,
} from "./packet";
import { createPlayRenderPlan, denseDeviceLimit, limitVisualPopulation, type PopulationPlan } from "./play-population";
import { planPlayVisualSources } from "./play-visual-sources";
import {
  createInitialPlayJutsuState,
  reducePlayJutsuState,
  type PlayJutsuAction,
} from "./play-jutsu-state";
import type { PlayMenuPosition } from "./play-jutsu-menu";
import {
  bindPlayDisplayNavigationKeys,
  bindPlayDebugEventLogging,
  bindPlayUiActions,
  isPlayJutsuActive,
  nextPlayDisplayMode,
  renderPlayPopulationStatus,
  renderPlaySurface,
  updatePlayFragmentationStatus,
  updatePlaySelectedSummary,
  type PlayUiBinding,
} from "./play-ui";
import { LazyPixiBallStageRenderer } from "./lazy-pixi-ball-stage-renderer";
import { renderPanelOverlay } from "./overlay-renderers";
import { PhysicsRuntimeController } from "./physics-runtime-controller";
import { RapierStage, type PhysicsBallSnapshot, type VisualBallSource } from "./rapier-stage";
import { createReceiptImageBlob, createReceiptImageFileName } from "./receipt-image";
import {
  loadAppSettings,
  normalizeAppSettings,
  resetJutsuPhysicsSettings as resetJutsuPhysicsSettingsToDefault,
  resolvePhysicsProfileSettings,
  saveAppSettings,
  updatePhysicsProfileSettings,
  type AppSettings,
  type BallLabelMode,
  type PhysicsParameterSettings,
  type PhysicsSettingsProfile,
} from "./settings";
import { bindSettingsPanelEvents } from "./settings-panel-events";
import { hasAppSettingsRuntimeEffect, planAppSettingsRuntimeEffects } from "./settings-runtime-effects";
import {
  renderLedgerList,
  renderToolsPanel,
  type ToolsPanelRenderContext,
} from "./settings-renderers";
import { capturePrimaryScreen, createMainPrimaryScreen, type PrimaryScreenState } from "./screen-navigation";
import { SurfaceInteractionController } from "./surface-interaction-controller";
import { createStartupScreenState } from "./startup-state";
import { UiLayerHosts } from "./ui-layer-hosts";
import { UiDebugDiagnostics } from "./ui-debug-diagnostics";
import {
  isUpperSurfaceControlTarget,
  planEditUpperSurfaceNavigation,
  renderUpperSurfaceControlBar,
  type UpperSurfaceControlTarget,
  type UpperSurfacePrimaryTarget,
} from "./upper-surface-control-bar";
import {
  addBall,
  clearBallData,
  createDefaultDraft,
  createPendingBall,
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
  applyBallLifecycleAction,
  updateNameBook,
  type BallSaveMode,
} from "./storage";
import {
  addWorkspace,
  activateNextWorkspace,
  findWorkspaceBySourceId,
  getActiveWorkspace,
  getSelfWorkspace,
  getWorkspaceDisplayCode,
  isReceivedWorkspace,
  loadOrCreateWorkspaceStore,
  saveWorkspaceStore,
  replaceWorkspace,
  removeReceivedWorkspace,
  updateActiveWorkspaceSnapshot,
  updateSelfWorkspaceSnapshot,
  workspaceSnapshotFingerprint,
  type HappyBallWorkspaceStore,
} from "./workspace";
import {
  applyWorkspaceShareToExisting,
  countWorkspaceShareBalls,
  createWorkspaceFromShare,
  createWorkspaceShareBundle,
  reviewWorkspaceShare,
  selectWorkspaceShareBalls,
  type WorkspaceImportSelection,
  type WorkspaceSharePeriod,
} from "./workspace-transfer";
import { bindWorkspaceUiActions } from "./workspace-ui-actions";

const appRoot = getAppRoot();

const legacyLedger = loadLedger();
const legacyAppSettings = loadAppSettings();
const legacyCategories = loadCategoryColorPresets();
let workspaceStore: HappyBallWorkspaceStore = loadOrCreateWorkspaceStore({
  ledger: legacyLedger,
  categories: legacyCategories,
  appSettings: legacyAppSettings,
});
const legacySnapshot = {
  ledger: legacyLedger,
  categories: legacyCategories,
  appSettings: legacyAppSettings,
};
const legacyFingerprint = workspaceSnapshotFingerprint(legacySnapshot);
const storedSelf = getSelfWorkspace(workspaceStore);
const storedSelfFingerprint = workspaceSnapshotFingerprint(storedSelf);
if (!workspaceStore.selfLegacyFingerprint || workspaceStore.selfLegacyFingerprint !== legacyFingerprint) {
  workspaceStore = updateSelfWorkspaceSnapshot(workspaceStore, legacySnapshot);
  saveWorkspaceStore(workspaceStore);
} else if (storedSelfFingerprint !== workspaceStore.selfLegacyFingerprint) {
  saveLedger(storedSelf.ledger);
  saveCategoryColorPresets(storedSelf.categories);
  saveAppSettings(storedSelf.appSettings);
  workspaceStore = { ...workspaceStore, selfLegacyFingerprint: storedSelfFingerprint };
  saveWorkspaceStore(workspaceStore);
}
const initialWorkspace = getActiveWorkspace(workspaceStore);
let ledger = initialWorkspace.ledger;
let activityLog: ActivityLogEntry[] = loadActivityLog();
let appSettings: AppSettings = normalizeAppSettings(initialWorkspace.appSettings);
let editableCategories: CategoryColorPreset[] = normalizeCategoryColorPresets(initialWorkspace.categories);
const startupScreenSetting = getSelfWorkspace(workspaceStore).appSettings.startupScreen;
const startupScreenState = createStartupScreenState(ledger.balls, todayIsoDate(), startupScreenSetting);
let draft = createDefaultDraft(getPrimarySelfName(ledger));
let createDraftBeforeOpen: BallDraft | null = null;
let createAuthoringBall: HappyBall | null = null;
let selectedBallId: string | null = startupScreenState.selectedBallId;
let uiState: AppUiState = createInitialAppUiState(startupScreenState.startupScreen);
let displayMode: DisplayMode = "day";
let displayAnchorDate = startupScreenState.displayAnchorDate;
let calendarMonth = startupScreenState.calendarMonth;
let subfeatureReturnScreen: PrimaryScreenState = createMainPrimaryScreen(calendarMonth, displayAnchorDate);
let pendingUrlPacket: UrlPacketParseResult | null = parsePacketLocation(window.location.search, window.location.hash);
let snoozedUrlPacket: UrlPacketParseResult | null = null;
let pendingJsonImport: JsonImportReview | null = null;
let pendingWorkspaceImportTarget: string | null = null;
let physicsStage: RapierStage | null = null;
const physicsRuntime = new PhysicsRuntimeController<RapierStage>();
const physicsSnapshots = new Map<string, PhysicsBallSnapshot>();
let openSettingsGroups: string[] = [];
let physicsSettingsProfile: PhysicsSettingsProfile = "normal";
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
let randomTextureVariables: Record<string, string> | null = null;
let ledgerListDateFilter: string | null = null;
let pendingCalendarDayListScrollTop: number | null = null;
let pendingSettingsScrollTop: number | null = null;
const pendingDescentBallIds = new Set<string>();
let rendererFallbackToDom = false;
let rendererFallbackScheduled = false;
let playJutsuState = createInitialPlayJutsuState();
let playControlsOpen = false;
let playJutsuFeedback = "";
let playMenuPosition: PlayMenuPosition | null = null;
let playWorldDisclosureOpen = false;
let playParentDisclosureOpen = false;
let playUiBinding: PlayUiBinding | null = null;
let activeBallSieve: BallSievePresetId = DEFAULT_BALL_SIEVE_PRESET;
let ballSieveOpen = false;
let ballSieveFeedback = "";
let ballSieveTransitioning = false;
let ballSieveFeedbackTimer: number | null = null;
let ballSieveTransitionTimer: number | null = null;

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
  "physics-settings",
  "sound-settings",
  "workspace-management",
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

bindPlayDisplayNavigationKeys(
  window,
  () => uiState.primary === "play" && uiState.modals.length === 0,
  navigateDisplayPeriod,
);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && ballSieveOpen) {
    closeBallSieve();
  }
});
imeViewport.install();
interactionController.install();
if (isUiDebugDiagnosticsEnabled(window.location.search)) {
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
    } else if (appSettings.soundEnabled) {
      audioEngine.recoverExistingContext();
    }
  });

  window.addEventListener("pagehide", () => {
    audioEngine.close();
  });

  window.addEventListener("pageshow", () => {
    if (appSettings.soundEnabled) {
      audioEngine.recoverExistingContext();
    }
  });

  const recoverFromGesture = () => {
    if (appSettings.soundEnabled) {
      audioEngine.unlock();
    }
  };
  document.addEventListener("pointerdown", recoverFromGesture, { capture: true, passive: true });
  document.addEventListener("keydown", recoverFromGesture, { capture: true });
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

function persistActiveWorkspaceSnapshot(): void {
  const nextStore = updateActiveWorkspaceSnapshot(workspaceStore, {
    ledger,
    categories: editableCategories,
    appSettings,
  });
  if (nextStore === workspaceStore) {
    return;
  }
  saveWorkspaceStore(nextStore);
  workspaceStore = nextStore;
  syncSelfLegacySnapshot(workspaceStore);
}

function syncSelfLegacySnapshot(store: HappyBallWorkspaceStore): void {
  const self = getSelfWorkspace(store);
  saveLedger(self.ledger);
  saveCategoryColorPresets(self.categories);
  saveAppSettings(self.appSettings);
}

function renderWorkspaceScreenName(label: string, extraClass = ""): string {
  const received = isReceivedWorkspace(workspaceStore);
  const code = received ? getWorkspaceDisplayCode(workspaceStore, workspaceStore.activeWorkspaceId) : "";
  return `
    <button class="screen-kicker workspace-screen-name ${extraClass}${received ? " is-received" : ""}" type="button" data-cycle-workspace aria-label="次の利用環境へ切り替える">
      <span>${escapeHtml(label)}</span>${received ? `<small>ID=${escapeHtml(code)}</small>` : ""}
    </button>
  `;
}

function activateNextWorkspaceRuntime(): void {
  if (workspaceStore.workspaces.length < 2) {
    return;
  }
  persistActiveWorkspaceSnapshot();
  workspaceStore = activateNextWorkspace(workspaceStore);
  saveWorkspaceStore(workspaceStore);
  const workspace = getActiveWorkspace(workspaceStore);
  ledger = workspace.ledger;
  editableCategories = normalizeCategoryColorPresets(workspace.categories);
  appSettings = normalizeAppSettings(workspace.appSettings);
  selectedBallId = null;
  draft = createDefaultDraft(getPrimarySelfName(ledger));
  physicsSnapshots.clear();
  playJutsuState = createInitialPlayJutsuState();
  playControlsOpen = false;
  baseRenderSignature = "";
  syncGravityController();
  render();
}

function render(): void {
  persistActiveWorkspaceSnapshot();
  appRoot.classList.toggle("is-received-workspace", isReceivedWorkspace(workspaceStore));
  appRoot.classList.toggle("is-ball-sieve-open", ballSieveOpen);
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
  restorePendingSettingsScroll();
}

function getEffectiveBallLabelMode(): BallLabelMode {
  return appSettings.ballLabelMode;
}

function ensureBaseRendered(visibleBalls: HappyBall[], selectedBall: HappyBall | null): void {
  const ballLabelMode = getEffectiveBallLabelMode();
  const nextSignature = JSON.stringify({
    workspaceId: workspaceStore.activeWorkspaceId,
    balls: visibleBalls,
    selectedBallId,
    displayMode,
    displayAnchorDate,
    activeBallSieve,
    ballSieveFeedback,
    ballSieveTransitioning,
  });
  if (nextSignature === baseRenderSignature) {
    return;
  }
  baseRenderSignature = nextSignature;
  const visualPopulation = createVisualPopulation(visibleBalls);

  capturePhysicsSnapshotsSafely();
  physicsRuntime.destroy();
  physicsStage = null;
  playUiBinding?.disconnect();
  playUiBinding = null;

  uiHosts.renderBase(renderPlaySurface({
    ballLabelMode,
    backgroundTexture: appSettings.backgroundTexture,
    displayMode,
    displayAnchorDate,
    stageTitle: selectedBall
      ? createVisibilitySafeSummaryLabel(selectedBall)
      : activeBallSieve === "usual" ? "今日のえもい玉は？" : renderBallSieveEmptyMessage(activeBallSieve),
    workspaceScreenNameHtml: renderWorkspaceScreenName("Emotion Play", "play-screen-kicker"),
    gravityDebugHtml: renderGravityDebugPanel(),
    populationStatusHtml: renderPlayPopulationStatus(
      visualPopulation.displayedCount,
      visualPopulation.totalCount,
      visualPopulation.truncated,
    ),
    developmentDiagnostics: import.meta.env.DEV,
    jutsuState: playJutsuState,
    controlsOpen: playControlsOpen,
    jutsuFeedback: playJutsuFeedback,
    worldDisclosureOpen: playWorldDisclosureOpen,
    parentDisclosureOpen: playParentDisclosureOpen,
    ballSieve: {
      presetId: activeBallSieve,
      open: ballSieveOpen,
    },
    ballSieveFeedback,
    sieveTransitioning: ballSieveTransitioning,
  }));

  bindEvents(uiHosts.base);
  if (rapierReady) {
    mountRapierStage(visualPopulation);
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
    categories: editableCategories,
    shareBalls: ledger.balls,
    ballSieve: {
      presetId: activeBallSieve,
      open: ballSieveOpen,
    },
    ballSieveFeedback,
    sieveTransitioning: ballSieveTransitioning,
    emptyMessage: renderBallSieveEmptyMessage(activeBallSieve),
    workspaceDisplayCode: isReceivedWorkspace(workspaceStore)
      ? getWorkspaceDisplayCode(workspaceStore, workspaceStore.activeWorkspaceId)
      : null,
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
  const nextStatusLayer = template.content.querySelector<HTMLElement>(".calendar-ball-sieve-status-layer");
  const currentStatusLayer = surface.querySelector<HTMLElement>(".calendar-ball-sieve-status-layer");
  if (currentStatusLayer && nextStatusLayer) {
    currentStatusLayer.replaceWith(nextStatusLayer);
  }
  const nextDock = template.content.querySelector<HTMLElement>(".calendar-control-dock");
  const currentDock = surface.querySelector<HTMLElement>(".calendar-control-dock");
  if (currentDock && nextDock) {
    currentDock.replaceWith(nextDock);
    bindEvents(nextDock);
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
    createAuthoringBall ??= createPendingBall(ledger, draft, { categories: editableCategories });
    return renderPanelOverlay(
      "玉を置く",
      renderCreateForm(draft, getFormRenderContext(), createAuthoringBall),
      "create",
      { label: "保存", formId: "ball-form" },
    );
  }
  if (uiState.primary === "saved-list") {
    const managedBalls = getManagedBalls();
    const title = ledgerListDateFilter ? `${ledgerListDateFilter} の保存された玉` : "保存された玉";
    return renderPanelOverlay(
      title,
      renderLedgerList(managedBalls, selectedBallId, {
        dateFilter: ledgerListDateFilter,
        activityLog,
        categories: editableCategories,
      }),
      "list",
    );
  }
  return renderPanelOverlay(
    "設定とデータ",
    renderToolsPanel(getToolsPanelRenderContext()),
    "settings",
    undefined,
    renderCurrentUpperSurfaceControlBar(),
  );
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
    const root = uiHosts.replaceModal("json-import", renderPendingJsonImportDialog(
      pendingJsonImport,
      appSettings.emotionEchoStrength,
      editableCategories,
      getWorkspaceImportDialogContext(),
    ));
    bindEvents(root);
    installBallDialogEscapeHandler(() => {
      pendingJsonImport = null;
      pendingWorkspaceImportTarget = null;
      render();
    });
  }
}

function getWorkspaceImportDialogContext() {
  const workspaceShare = pendingJsonImport?.workspaceShare;
  if (!workspaceShare) {
    return undefined;
  }
  const active = getActiveWorkspace(workspaceStore);
  const matching = findWorkspaceBySourceId(workspaceStore, workspaceShare.bundle.sourceWorkspaceId);
  const targets = [{ value: active.workspaceId, label: `現在の利用環境：${active.displayName}` }];
  if (matching && matching.workspaceId !== active.workspaceId) {
    targets.push({ value: matching.workspaceId, label: `保存済み ID=${getWorkspaceDisplayCode(workspaceStore, matching.workspaceId)}：${matching.displayName}` });
  }
  if (!matching && workspaceStore.workspaces.length < 4) {
    targets.push({ value: "new", label: "新しい別利用環境" });
  }
  const selectedTarget = targets.some((target) => target.value === pendingWorkspaceImportTarget)
    ? pendingWorkspaceImportTarget!
    : matching?.workspaceId ?? active.workspaceId;
  const selectedWorkspace = selectedTarget === "new"
    ? null
    : workspaceStore.workspaces.find((workspace) => workspace.workspaceId === selectedTarget) ?? active;
  const selectedReview = reviewWorkspaceShare(workspaceShare.bundle, selectedWorkspace?.ledger.balls ?? [])?.review
    ?? workspaceShare.review;
  const existingNameIds = new Set(selectedWorkspace?.ledger.ownerProfile.nameBook.map((entry) => entry.id) ?? []);
  const missingNameCount = workspaceShare.bundle.ledger.ownerProfile.nameBook
    .filter((entry) => !existingNameIds.has(entry.id)).length;
  return {
    targets,
    selectedTarget,
    selectedReview,
    selectedTargetIsNew: selectedTarget === "new",
    missingNameCount,
    displayCode: matching
      ? getWorkspaceDisplayCode(workspaceStore, matching.workspaceId)
      : workspaceShare.bundle.sourceDisplayCode,
  };
}

function dispatchUi(action: AppUiAction, apply = true): void {
  const nextState = reduceAppUiState(uiState, action);
  if (createAppUiSnapshot(nextState).pausesPhysics) {
    physicsRuntime.sync(true);
  }
  uiState = nextState;
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
  return applyBallSieve(ledger.balls, activeBallSieve).filter((ball) => (
    ball.date >= range.start &&
    ball.date <= range.end
  ));
}

function renderGravityDebugPanel(): string {
  if (!isGravityDebugEnabled(appSettings.gravityDebugEnabled)) {
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
  if (!isGravityDebugEnabled(appSettings.gravityDebugEnabled)) {
    return;
  }
  const output = document.querySelector<HTMLElement>("[data-gravity-debug-output]");
  if (!output) {
    return;
  }
  output.textContent = formatGravityDebugSnapshot(latestGravityDebug);
}

function syncGravityDebugPanelStructure(): void {
  const worldRegion = uiHosts.base.querySelector<HTMLElement>(".play-world-region");
  const existing = worldRegion?.querySelector<HTMLElement>(".gravity-debug-panel") ?? null;
  const gravityDebugEnabled = isGravityDebugEnabled(appSettings.gravityDebugEnabled);
  if (!worldRegion || (!gravityDebugEnabled && !existing)) {
    return;
  }
  if (!gravityDebugEnabled) {
    existing?.remove();
    return;
  }
  if (existing) {
    updateGravityDebugPanel();
    return;
  }
  const field = worldRegion.querySelector<HTMLElement>("#ball-field");
  field?.insertAdjacentHTML("afterend", renderGravityDebugPanel());
  const panel = worldRegion.querySelector<HTMLElement>(".gravity-debug-panel");
  if (panel) {
    bindEvents(panel);
  }
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
    handoffDebugEnabled: isHandoffDebugEnabled(window.location.search),
    categories: editableCategories,
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
    developmentToolsEnabled: import.meta.env.DEV,
    categories: editableCategories,
    activityLog,
    openSettingsGroups,
    activityLogHelpOpen,
    nameBook: ledger.ownerProfile.nameBook,
    maxNameBookEntries: MAX_NAME_BOOK_ENTRIES,
    defaultSampleName: DEFAULT_SAMPLE_NAME,
    physicsSettingsProfile,
    workspaces: workspaceStore.workspaces.map((workspace) => ({
      workspaceId: workspace.workspaceId,
      displayName: workspace.displayName,
      displayCode: getWorkspaceDisplayCode(workspaceStore, workspace.workspaceId),
      role: workspace.role,
      active: workspace.workspaceId === workspaceStore.activeWorkspaceId,
      ballCount: workspace.ledger.balls.length,
      lastImportedAt: workspace.lastImportedAt,
    })),
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

function prepareCreateDraftForOpen(): void {
  createDraftBeforeOpen = { ...draft };
  draft = refreshCreateDraftForOpen(draft, displayAnchorDate);
  createAuthoringBall = createPendingBall(ledger, draft, { categories: editableCategories });
}

function cancelCreateAuthoringSession(): void {
  if (createDraftBeforeOpen) {
    draft = createDraftBeforeOpen;
  }
  createDraftBeforeOpen = null;
  createAuthoringBall = null;
}

function getCalendarBalls(): HappyBall[] {
  return applyBallSieve(ledger.balls, activeBallSieve);
}

function getCalendarDayListBalls(): HappyBall[] {
  return applyBallSieve(ledger.balls, activeBallSieve).filter((ball) => ball.date === displayAnchorDate);
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

function resolveUpperSurfacePrimaryTarget(): UpperSurfacePrimaryTarget {
  if (uiState.primary === "play") {
    return "play";
  }
  if (uiState.primary === "calendar-month") {
    return "calendar";
  }
  if (uiState.primary === "calendar-day-list") {
    return "dayList";
  }
  if (subfeatureReturnScreen.kind === "calendarMonth") {
    return "calendar";
  }
  if (subfeatureReturnScreen.kind === "calendarDayList") {
    return "dayList";
  }
  return "play";
}

function renderCurrentUpperSurfaceControlBar(): string {
  return renderUpperSurfaceControlBar({
    currentPrimary: resolveUpperSurfacePrimaryTarget(),
    settingsActive: uiState.primary === "settings",
  });
}

function rememberUpperSurfacePrimaryOrigin(): void {
  if (uiState.primary === "play" || isCalendarRoute(uiState.primary)) {
    rememberSubfeatureReturnScreen();
  }
}

function navigateFromUpperSurfaceControlBar(target: UpperSurfaceControlTarget): void {
  if (target === "settings" && uiState.primary === "settings" && uiState.modals.length === 0) {
    return;
  }

  if (target === "create" || target === "settings") {
    rememberUpperSurfacePrimaryOrigin();
  }
  if (target === "create") {
    prepareCreateDraftForOpen();
  }
  if (target === "settings") {
    physicsSettingsProfile = isPlayJutsuActive(playJutsuState) ? "jutsu" : "normal";
  }
  if (target === "calendar" || target === "dayList") {
    calendarMonth = displayAnchorDate.slice(0, 7);
  }

  const route: PrimaryRoute = target === "play"
    ? "play"
    : target === "calendar"
      ? "calendar-month"
      : target === "dayList"
        ? "calendar-day-list"
        : target;
  dispatchUi({ type: "open-primary", route }, false);
  render();
}

function bindUpperSurfaceControlBarEvents(
  root: ParentNode,
  navigate: (target: UpperSurfaceControlTarget) => void = navigateFromUpperSurfaceControlBar,
): void {
  root.querySelectorAll<HTMLButtonElement>("[data-upper-control-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.upperControlTarget;
      if (isUpperSurfaceControlTarget(target)) {
        navigate(target);
      }
    });
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
  const root = uiHosts.replaceModal(
    "ball-detail",
    renderBallDialog(ball, getDialogRenderContext(), renderCurrentUpperSurfaceControlBar()),
  );
  applyUiState();
  bindUpperSurfaceControlBarEvents(root);

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
  ledger = markReceiptCreated(ledger, ballId, getActiveWorkspace(workspaceStore).role === "self");
  persistActiveWorkspaceSnapshot();
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
  const root = uiHosts.replaceModal(
    "ball-edit",
    renderBallEditDialog(ball, getFormRenderContext(), renderCurrentUpperSurfaceControlBar()),
  );
  applyUiState();

  const form = root.querySelector<HTMLFormElement>("#ball-edit-form");
  bindEditAuthoringUiActions(root, {
    ...createAuthoringDescentActionHandlers(),
    getDraftDefaults: getAuthoringDraftDefaults,
    getCurrentLocalTime: currentLocalTime,
    submit: (editForm) => requestSaveBallEditDialog(root, editForm, ball),
    close: (editForm) => requestCloseBallEditDialog(root, editForm, ball),
  });
  bindModalKeyboardFocusAssist(root);
  bindUpperSurfaceControlBarEvents(root, (target) => {
    requestNavigateFromBallEditDialog(root, form, ball, target);
  });
  installBallDialogEscapeHandler(() => {
    if (form) {
      requestCloseBallEditDialog(root, form, ball);
    }
  });
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

function saveBallEditForm(
  form: HTMLFormElement | null,
  saveMode: BallSaveMode,
  navigationTarget: UpperSurfaceControlTarget | null = null,
): void {
  const editingId = form?.dataset.editingBallId;
  if (!form || !editingId) {
    return;
  }
  const previousBall = ledger.balls.find((ball) => ball.id === editingId);
  if (!previousBall) {
    return;
  }
  const nextDescents = readEditedDescentRecords(form);
  ledger = updateBall(
    ledger,
    editingId,
    readAuthoringDraft(form, getAuthoringDraftDefaults()),
    saveMode,
    nextDescents,
    getActiveWorkspace(workspaceStore).role === "self",
    editableCategories,
  );
  const editedBall = ledger.balls.find((ball) => ball.id === editingId);
  if (editedBall) {
    recordStagedDescentActivities(previousBall.descents ?? [], editedBall);
  }
  selectedBallId = editingId;
  if (navigationTarget) {
    navigateFromUpperSurfaceControlBar(navigationTarget);
    return;
  }
  render();
  showBallDialog(editingId);
}

function recordStagedDescentActivities(previousRecords: HappyBallDescentRecord[], nextBall: HappyBall): void {
  const nextRecords = nextBall.descents ?? [];
  const previousById = new Map(previousRecords.map((record) => [record.id, record]));
  const nextById = new Map(nextRecords.map((record) => [record.id, record]));

  for (const record of previousRecords) {
    if (!nextById.has(record.id)) {
      appendActivity(createBallActivityInput(nextBall, {
        action: "descent-delete",
        descentSequence: record.sequence,
        message: record.id,
      }));
    }
  }

  for (const record of nextRecords) {
    const previous = previousById.get(record.id);
    if (!previous) {
      appendActivity(createBallActivityInput(nextBall, {
        action: "descent-create",
        descentSequence: record.sequence,
        message: hasDescentPosition(record) ? "GPS取得成功" : "仮降臨",
      }));
      continue;
    }

    const previousPosition = hasDescentPosition(previous)
      ? [previous.latitude, previous.longitude, previous.accuracyMeters]
      : null;
    const nextPosition = hasDescentPosition(record)
      ? [record.latitude, record.longitude, record.accuracyMeters]
      : null;
    if (JSON.stringify(previousPosition) !== JSON.stringify(nextPosition)) {
      appendActivity(createBallActivityInput(nextBall, {
        action: nextPosition ? "descent-gps-update" : "descent-gps-clear",
        descentSequence: record.sequence,
      }));
    }
  }
}

function requestSaveBallEditDialog(root: HTMLElement, form: HTMLFormElement | null, originalBall: HappyBall): void {
  if (!form) {
    return;
  }
  if (!hasBallEditFormChanged(originalBall, form, getAuthoringDraftDefaults())) {
    closeBallDialog();
    showBallDialog(originalBall.id);
    return;
  }

  if (!hasBallDraftChanged(originalBall, readAuthoringDraft(form, getAuthoringDraftDefaults()))) {
    saveBallEditForm(form, "correction");
    return;
  }

  showEditSaveModeConfirm(root, form, "save");
}

function requestCloseBallEditDialog(root: HTMLElement, form: HTMLFormElement | null, originalBall: HappyBall): void {
  if (!form || !hasBallEditFormChanged(originalBall, form, getAuthoringDraftDefaults())) {
    closeBallDialog();
    return;
  }

  showEditSaveModeConfirm(
    root,
    form,
    "close",
    !hasBallDraftChanged(originalBall, readAuthoringDraft(form, getAuthoringDraftDefaults())),
  );
}

function requestNavigateFromBallEditDialog(
  root: HTMLElement,
  form: HTMLFormElement | null,
  originalBall: HappyBall,
  target: UpperSurfaceControlTarget,
): void {
  const plan = planEditUpperSurfaceNavigation(
    Boolean(form && hasBallEditFormChanged(originalBall, form, getAuthoringDraftDefaults())),
    target,
  );
  if (plan.kind === "navigate") {
    navigateFromUpperSurfaceControlBar(plan.target);
    return;
  }

  if (!form) {
    return;
  }

  showEditSaveModeConfirm(
    root,
    form,
    "close",
    !hasBallDraftChanged(originalBall, readAuthoringDraft(form, getAuthoringDraftDefaults())),
    plan.pendingTarget,
  );
}

function showEditSaveModeConfirm(
  root: HTMLElement,
  form: HTMLFormElement,
  reason: "save" | "close",
  descentOnly = false,
  navigationTarget: UpperSurfaceControlTarget | null = null,
): void {
  uiHosts.clearConfirm();
  dispatchUi({ type: "open-confirm", route: "edit-save" }, false);
  const confirmRoot = uiHosts.renderConfirm(
    "edit-save",
    `<div class="edit-unsaved-backdrop" data-edit-unsaved-confirm>${renderEditSaveModeConfirm(reason, descentOnly)}</div>`,
  );
  applyUiState();
  bindEditSaveConfirmActions(confirmRoot, {
    saveWithEcho: () => saveBallEditForm(form, "withEcho", navigationTarget),
    saveCorrection: () => saveBallEditForm(form, "correction", navigationTarget),
    continueEditing: () => {
      uiHosts.clearConfirm();
      dispatchUi({ type: "close-confirm" });
      root.querySelector<HTMLButtonElement>("[data-dialog-close]")?.focus({ preventScroll: true });
    },
    discardAndClose: () => {
      if (navigationTarget) {
        navigateFromUpperSurfaceControlBar(navigationTarget);
      } else {
        closeBallDialog();
      }
    },
  });
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-save-correction]")?.focus({ preventScroll: true });
}

function mountRapierStage(population: PopulationPlan<VisualBallSource>): void {
  const field = uiHosts.base.querySelector<HTMLDivElement>("#ball-field");
  if (!field || !rapierReady) {
    return;
  }

  const rect = field.getBoundingClientRect();
  const rendererPreference = rendererFallbackToDom
    || isDomRendererComparisonEnabled(window.location.search)
    ? "dom"
    : "pixi";
  const runtimeSettings = getRuntimeAppSettings();
  const renderPlan = createPlayRenderPlan(
    rect.width,
    rect.height,
    population.displayedCount,
    appSettings.radius,
    rendererPreference,
  );
  const stageSources = population.displayed.map((source) => ({ ...source, radius: renderPlan.radius }));
  const renderer = renderPlan.renderer === "pixi"
    ? new LazyPixiBallStageRenderer(field, runtimeSettings, {
        densityMode: renderPlan.densityMode,
        appearanceProfile: renderPlan.appearanceProfile,
        onFallback: handleRendererFallback,
      })
    : undefined;
  field.dataset.ballRenderer = renderPlan.renderer;
  field.dataset.ballDensity = renderPlan.densityMode;
  field.dataset.ballAppearance = renderPlan.appearanceProfile;
  field.dataset.runtimePhysicsProfile = getRuntimePhysicsProfile();
  field.dataset.ballDiameter = (renderPlan.radius * 2).toFixed(2);
  field.dataset.rendererFallback = rendererFallbackToDom ? "pixi-fault" : "none";
  physicsStage = new RapierStage(
    field,
    stageSources,
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
    runtimeSettings,
    audioEngine,
    handlePhysicsFault,
    {
      radiusMode: renderPlan.radiusMode,
      renderer,
      gravityMode: playJutsuState.gravityMode,
      buoyancyMode: playJutsuState.buoyancyMode,
      interactionMode: playJutsuState.interactionMode,
      fragmentationMode: playJutsuState.fragmentationMode,
      parentSplitMode: playJutsuState.parentSplitMode,
      displayLimit: renderPlan.renderer === "dom" ? 120 : denseDeviceLimit(window.matchMedia("(max-width: 520px)").matches),
      onPopulationChange: (displayedCount, originalCount) => {
        updatePlayFragmentationStatus(uiHosts.base, import.meta.env.DEV, displayedCount, originalCount);
      },
      onBuoyancyActivationChange: (activation) => {
        field.style.setProperty("--play-fluid-activation", activation.toFixed(3));
        field.dataset.fluidActivation = activation.toFixed(3);
      },
    },
  );
  physicsRuntime.attach(physicsStage);
  bindPlayDebugEventLogging(
    field,
    import.meta.env.DEV,
    () => isGravityDebugEnabled(appSettings.gravityDebugEnabled),
    (eventType, details) => debugLog.append(`play:${eventType}`, details),
  );
}

function appendGravityDebugLog(snapshot: DeviceGravityDebugSnapshot): void {
  if (!isGravityDebugEnabled(appSettings.gravityDebugEnabled)) {
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
    gravityDebugEnabled: isGravityDebugEnabled(appSettings.gravityDebugEnabled),
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

function createVisualPopulation(balls: HappyBall[]): PopulationPlan<VisualBallSource> {
  const sources = planPlayVisualSources(
    balls,
    editableCategories,
    getEffectiveBallLabelMode(),
    appSettings.radius,
    appSettings.emotionEchoStrength,
    physicsSnapshots,
  );
  const useDomSafetyLimit = rendererFallbackToDom
    || isDomRendererComparisonEnabled(window.location.search);
  const likelyDense = sources.length > 120;
  const limit = useDomSafetyLimit
    ? 120
    : likelyDense
    ? denseDeviceLimit(window.matchMedia("(max-width: 520px)").matches)
    : 120;
  return limitVisualPopulation(sources, limit);
}

function syncPlayJutsuFeedback(): void {
  playUiBinding?.syncFeedback(playJutsuFeedback);
}

function dispatchPlayJutsu(action: PlayJutsuAction): void {
  playJutsuState = reducePlayJutsuState(playJutsuState, action);
  syncRuntimePhysicsSettings();
  physicsStage?.setPlayGravityMode(playJutsuState.gravityMode);
  physicsStage?.setBuoyancyMode(playJutsuState.buoyancyMode);
  physicsStage?.setInteractionMode(playJutsuState.interactionMode);
  physicsStage?.setParentSplitMode(playJutsuState.parentSplitMode);
  physicsStage?.setFragmentationMode(playJutsuState.fragmentationMode);
  playUiBinding?.syncModeControls(playControlsOpen, playJutsuState);
}

function syncBallLabelModeControls(): boolean {
  return playUiBinding?.syncBallLabelMode(getEffectiveBallLabelMode()) ?? false;
}

function syncBallVisualSourcesWithoutPhysicsRebuild(): boolean {
  if (!physicsStage) {
    return true;
  }
  const population = createVisualPopulation(getVisibleBalls());
  return physicsStage.updateVisualSources(population.displayed);
}

function updateSelectedState(): void {
  document.querySelectorAll(".ledger-item").forEach((item) => {
    const select = item.querySelector<HTMLElement>("[data-select-ball-id]");
    item.classList.toggle("is-selected", select?.dataset.selectBallId === selectedBallId);
  });
}

function updateSelectedSummary(): void {
  const selectedBall = getVisibleBalls().find((ball) => ball.id === selectedBallId) ?? null;
  updatePlaySelectedSummary(
    uiHosts.base,
    selectedBall
      ? createVisibilitySafeSummaryLabel(selectedBall)
      : activeBallSieve === "usual" ? "今日のえもい玉は？" : renderBallSieveEmptyMessage(activeBallSieve),
  );
}

function syncBallSieveOpenState(root: ParentNode = document): void {
  appRoot.classList.toggle("is-ball-sieve-open", ballSieveOpen);
  root.querySelectorAll<HTMLButtonElement>("[data-toggle-ball-sieve]").forEach((button) => {
    button.setAttribute("aria-expanded", String(ballSieveOpen));
  });
  root.querySelectorAll<HTMLElement>("[data-ball-sieve-popover]").forEach((popover) => {
    popover.hidden = !ballSieveOpen;
  });
  root.querySelectorAll<HTMLButtonElement>("[data-close-ball-sieve]").forEach((backdrop) => {
    backdrop.hidden = !ballSieveOpen;
  });
}

function closeBallSieve(): void {
  ballSieveOpen = false;
  syncBallSieveOpenState();
  document.querySelector<HTMLButtonElement>("[data-toggle-ball-sieve]")?.focus();
}

function startBallSieveTransition(): void {
  ballSieveTransitioning = true;
  if (ballSieveTransitionTimer !== null) {
    window.clearTimeout(ballSieveTransitionTimer);
  }
  ballSieveTransitionTimer = window.setTimeout(() => {
    ballSieveTransitioning = false;
    ballSieveTransitionTimer = null;
    document.querySelectorAll<HTMLElement>(".is-ball-sieve-transitioning").forEach((surface) => {
      surface.classList.remove("is-ball-sieve-transitioning");
    });
  }, 220);
}

function showBallSieveFeedback(message: string): void {
  ballSieveFeedback = message;
  if (ballSieveFeedbackTimer !== null) {
    window.clearTimeout(ballSieveFeedbackTimer);
  }
  ballSieveFeedbackTimer = window.setTimeout(() => {
    ballSieveFeedback = "";
    ballSieveFeedbackTimer = null;
    syncBallSieveStatusState();
  }, 2600);
}

function syncBallSieveStatusState(root: ParentNode = document): void {
  const message = activeBallSieve === "usual" ? "" : `ふるい分け：${getBallSieveLabel(activeBallSieve)}`;
  root.querySelectorAll<HTMLElement>("[data-ball-sieve-status]").forEach((status) => {
    status.textContent = ballSieveFeedback || message;
    status.hidden = !ballSieveFeedback && !message;
    status.dataset.ballSieveStatusKind = ballSieveFeedback ? "feedback" : "selection";
  });
}

function selectBallSieve(presetId: BallSievePresetId): void {
  ballSieveOpen = false;
  if (ballSieveFeedbackTimer !== null) {
    window.clearTimeout(ballSieveFeedbackTimer);
    ballSieveFeedbackTimer = null;
  }
  ballSieveFeedback = "";
  if (presetId === activeBallSieve) {
    syncBallSieveOpenState();
    syncBallSieveStatusState();
    return;
  }
  activeBallSieve = presetId;
  selectedBallId = null;
  startBallSieveTransition();
  render();
  document.querySelector<HTMLButtonElement>("[data-toggle-ball-sieve]")?.focus();
}

function openPanelFromUi(panel: string | undefined): void {
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
  if (panel === "settings") {
    physicsSettingsProfile = isPlayJutsuActive(playJutsuState) ? "jutsu" : "normal";
  }
  if (panel === "create") {
    prepareCreateDraftForOpen();
  }
  if (panel === "list" && uiState.primary !== "settings") {
    rememberSubfeatureReturnScreen();
  }
  dispatchUi({ type: "open-primary", route }, false);
  render();
}

function bindEvents(root: ParentNode): void {
  bindUpperSurfaceControlBarEvents(root);
  const binding = bindPlayUiActions(root, playMenuPosition, {
    toggleControls: () => {
      playControlsOpen = !playControlsOpen;
      playUiBinding?.syncModeControls(playControlsOpen, playJutsuState);
    },
    dispatchJutsu: (action) => {
      playJutsuFeedback = "";
      dispatchPlayJutsu(action);
      syncPlayJutsuFeedback();
    },
    applyJutsu: (mode) => {
      dispatchPlayJutsu({ type: "apply-technique", mode });
      const result = physicsStage?.applyJutsuFragmentation(mode);
      playJutsuFeedback = result?.status === "applied"
        ? `${result.splitRecordCount}件を一段階分割しました（${result.previousCount}→${result.nextCount}玉）`
        : result?.status === "blocked-limit"
          ? "表示上限を超えるため、分割しませんでした。"
          : "これ以上分割できる玉はありません。";
      syncPlayJutsuFeedback();
    },
    resetBallJutsu: () => {
      const result = physicsStage?.resetJutsuFragmentation();
      playJutsuFeedback = result?.status === "reset"
        ? `${result.resetGroupCount}玉を再結合しました（${result.previousCount}→${result.nextCount}玉）`
        : "分割された玉はありません。";
      syncPlayJutsuFeedback();
    },
    disableJutsu: () => {
      dispatchPlayJutsu({ type: "reset-normal" });
      playJutsuFeedback = "術を無効にしました。分割済みの玉は維持しています。";
      syncPlayJutsuFeedback();
    },
    cycleDisplayMode: () => {
      displayMode = nextPlayDisplayMode(displayMode);
      draft = { ...draft, date: displayAnchorDate };
      render();
    },
    shiftDisplayPeriod: navigateDisplayPeriod,
    cycleBallLabelMode: () => {
      updateAppSettings({ ballLabelMode: nextBallLabelMode(appSettings.ballLabelMode) });
    },
    openPanel: openPanelFromUi,
    openCalendarDayList: () => {
      calendarMonth = displayAnchorDate.slice(0, 7);
      dispatchUi({ type: "open-primary", route: "calendar-day-list" }, false);
      render();
    },
    changeMenuPosition: (position) => {
      playMenuPosition = position;
    },
    changeDisclosure: (disclosure, open) => {
      if (disclosure === "world") {
        playWorldDisclosureOpen = open;
      } else {
        playParentDisclosureOpen = open;
      }
    },
  });
  if (binding) {
    playUiBinding = binding;
  }
  root.querySelectorAll<HTMLButtonElement>("[data-toggle-ball-sieve]").forEach((button) => {
    button.addEventListener("click", () => {
      ballSieveOpen = !ballSieveOpen;
      syncBallSieveOpenState();
      if (ballSieveOpen) {
        button.closest<HTMLElement>("[data-ball-sieve-control]")
          ?.querySelector<HTMLButtonElement>(`[data-ball-sieve-preset="${activeBallSieve}"]`)
          ?.focus();
      }
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-ball-sieve-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const presetId = button.dataset.ballSievePreset;
      if (isBallSievePresetId(presetId)) {
        selectBallSieve(presetId);
      }
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-close-ball-sieve]").forEach((button) => {
    button.addEventListener("click", () => {
      closeBallSieve();
    });
  });
  bindWorkspaceUiActions({
    root,
    handlers: {
      cycleWorkspace: activateNextWorkspaceRuntime,
      exportWorkspaceSelection,
      syncWorkspaceShareFormState,
      openJsonImportFile: (input) => input.click(),
      importJsonFile: handleJsonImportFile,
      dismissJsonImport: dismissPendingJsonImport,
      confirmJsonImport: applyPendingJsonImport,
      changeWorkspaceDisplayName: changeWorkspaceDisplayName,
      deleteWorkspace: deleteWorkspaceRuntime,
      selectWorkspaceImportTarget: selectWorkspaceImportTarget,
      confirmWorkspaceImport: applyPendingWorkspaceImport,
      confirmDeviceBackupImport: applyPendingDeviceBackupImport,
      cancelWorkspaceImport: dismissPendingJsonImport,
      cancelDeviceBackupImport: cancelPendingDeviceBackupImport,
    },
  });
  root.querySelectorAll<HTMLButtonElement>("[data-open-panel]").forEach((button) => {
    if (button.closest(".ball-world-shell")) {
      return;
    }
    button.addEventListener("click", () => {
      openPanelFromUi(button.dataset.openPanel);
    });
  });

  root.querySelectorAll<HTMLElement>("[data-close-panel]").forEach((element) => {
    if (element.closest(".panel-backdrop-create")) {
      return;
    }
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
    if (button.closest(".ball-world-shell")) {
      return;
    }
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
        prepareCreateDraftForOpen();
      }
      if (panel === "settings") {
        rememberSubfeatureReturnScreen();
        physicsSettingsProfile = isPlayJutsuActive(playJutsuState) ? "jutsu" : "normal";
      }
      dispatchUi({ type: "open-primary", route: panel === "create" ? "create" : "settings" }, false);
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-calendar-cycle-display-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      displayMode = nextPlayDisplayMode(displayMode);
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

  bindCreateAuthoringUiActions(root, {
    ...createAuthoringDescentActionHandlers(),
    getDraftDefaults: getAuthoringDraftDefaults,
    getCurrentLocalTime: currentLocalTime,
    changeDraft: (nextDraft) => {
      draft = nextDraft;
    },
    submit: (_form, nextDraft, descents) => {
      audioEngine.unlock();
      draft = nextDraft;
      const pendingBall = createAuthoringBall ?? createPendingBall(ledger, draft, { categories: editableCategories });
      ledger = addBall(ledger, draft, {
        id: pendingBall.id,
        createdAt: pendingBall.createdAt,
        descents,
        persist: getActiveWorkspace(workspaceStore).role === "self",
        categories: editableCategories,
      });
      const savedBall = ledger.balls[0] ?? null;
      if (savedBall) {
        recordStagedDescentActivities([], savedBall);
      }
      selectedBallId = savedBall?.id ?? null;
      displayMode = "day";
      activeBallSieve = DEFAULT_BALL_SIEVE_PRESET;
      ballSieveOpen = false;
      showBallSieveFeedback("新しい玉を、いつもの景色へ置きました。");
      startBallSieveTransition();
      restoreSubfeatureReturnScreen(draft.date);
      draft = { ...createDefaultDraft(getPrimarySelfName(ledger)), subject: draft.subject, issuerType: draft.issuerType };
      createDraftBeforeOpen = null;
      createAuthoringBall = null;
      render();
    },
    cancel: () => {
      cancelCreateAuthoringSession();
      restoreSubfeatureReturnScreen();
      render();
    },
  });

  bindSettingsGroupDisclosureEvents(root);
  bindPendingUrlPacketEvents(root);
  bindSettingsPanelEvents({
    categories: editableCategories,
    maxNameBookEntries: MAX_NAME_BOOK_ENTRIES,
    physicsSettingsProfile,
    root,
    handlers: {
      unlockAudio: () => audioEngine.unlock(),
      toggleGravitySensor: () => {
        void toggleGravitySensor();
      },
      updateAppSettings,
      updatePhysicsSettings: updateSelectedPhysicsSettings,
      setPhysicsSettingsProfile: (profile) => {
        rememberSettingsScroll();
        physicsSettingsProfile = profile;
        render();
      },
      resetJutsuPhysicsSettings: resetJutsuPhysicsProfile,
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
    ledger = clearBallData(ledger, getActiveWorkspace(workspaceStore).role === "self");
    selectedBallId = null;
    render();
  });

  root.querySelector("#export-json")?.addEventListener("click", () => {
    persistActiveWorkspaceSnapshot();
    exportDeviceBackupJson(workspaceStore);
    appendActivity({ action: "json-export" });
  });

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

async function exportWorkspaceSelection(form: HTMLFormElement, mode: "share" | "download"): Promise<void> {
  const { from, to, balls } = readWorkspaceShareFormSelection(form);
  if (!from || !to || from > to) {
    alert("開始日と終了日を正しい順序で指定してください。");
    return;
  }
  if (balls.length === 0) {
    alert("指定期間に送る玉がありません。");
    return;
  }
  persistActiveWorkspaceSnapshot();
  const workspace = getActiveWorkspace(workspaceStore);
  const period: WorkspaceSharePeriod = {
    from,
    to,
    selection: "period",
  };
  const bundle = createWorkspaceShareBundle(
    workspace,
    balls,
    period,
    getWorkspaceDisplayCode(workspaceStore, workspace.workspaceId),
  );
  const fileName = createWorkspaceShareFileName(from, to, bundle.exportedAt);
  if (mode === "share") {
    const file = new File([`${JSON.stringify(bundle, null, 2)}\n`], fileName, { type: "application/json" });
    if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "えもい玉 利用環境" });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }
  }
  downloadJsonFile(bundle, fileName);
}

function readWorkspaceShareFormSelection(form: HTMLFormElement): {
  from: string;
  to: string;
  balls: HappyBall[];
} {
  const data = new FormData(form);
  const from = String(data.get("workspace-share-from") ?? "");
  const to = String(data.get("workspace-share-to") ?? "");
  return { from, to, balls: selectWorkspaceShareBalls(ledger.balls, from, to) };
}

function syncWorkspaceShareFormState(form: HTMLFormElement): void {
  const { balls } = readWorkspaceShareFormSelection(form);
  const targetCount = countWorkspaceShareBalls(balls);
  const count = form.querySelector<HTMLElement>("[data-workspace-share-count]");
  if (count) {
    count.textContent = `対象 ${targetCount}玉`;
  }
  form.querySelectorAll<HTMLButtonElement>("[data-workspace-share-mode]").forEach((button) => {
    button.disabled = balls.length === 0;
  });
}

function createWorkspaceShareFileName(from: string, to: string, exportedAt: string): string {
  const period = from === to ? from.replace(/-/g, "") : `${from.replace(/-/g, "")}-${to.replace(/-/g, "")}`;
  const stamp = exportedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "").replace("T", "-");
  return `emoi-dama-workspace-${period}-${stamp}.json`;
}

function primaryRouteFromPanel(panel: string | undefined): PrimaryRoute | null {
  if (panel === "calendar") return "calendar-month";
  if (panel === "create") return "create";
  if (panel === "list") return "saved-list";
  if (panel === "settings") return "settings";
  return null;
}

function bindLifecycleActionEvents(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>("[data-lifecycle-ball-id][data-lifecycle-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.lifecycleBallId;
      const action = button.dataset.lifecycleAction;
      if (!id || !isBallLifecycleAction(action)) {
        return;
      }
      const target = ledger.balls.find((ball) => ball.id === id);
      if (!target) {
        return;
      }
      const nextStatus = resolveBallLifecycleTransition(target.lifecycleStatus, action);
      if (!nextStatus) {
        return;
      }
      if (action === "offer" && !confirm(`「${target.title}」を供養します。「いつもの玉」から離れますが、「ふるい分け：供養済み」でいつでも呼び戻せます。実行しますか？`)) {
        return;
      }
      rememberCalendarDayListScroll(button);
      const nextLedger = applyBallLifecycleAction(
        ledger,
        id,
        action,
        getActiveWorkspace(workspaceStore).role === "self",
      );
      if (nextLedger === ledger) {
        return;
      }
      appendActivity(createBallActivityInput(target, {
        action: "lifecycle-change",
        previousLifecycleStatus: target.lifecycleStatus,
        lifecycleStatus: nextStatus,
      }));
      ledger = nextLedger;
      selectedBallId = id;
      if (action === "restore") {
        showBallSieveFeedback(`「${target.title}」をいつもの玉へ戻しました。`);
      }
      startBallSieveTransition();
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
      ledger = deleteBall(ledger, id, getActiveWorkspace(workspaceStore).role === "self");
      selectedBallId = getVisibleBalls()[0]?.id ?? ledger.balls[0]?.id ?? null;
      closeBallDialog();
      render();
    });
  });
}

function bindDescendBallEvents(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>("[data-descend-ball-id]").forEach((button) => {
    if (button.closest("[data-ball-authoring-form]")) {
      return;
    }
    button.addEventListener("click", () => {
      const id = button.dataset.descendBallId;
      const target = ledger.balls.find((ball) => ball.id === id) ?? null;
      if (!target) {
        return;
      }
      void requestDescendLocation(target, button);
    });
  });
}

function createWorkingAuthoringBall(form: HTMLFormElement): HappyBall | null {
  const records = readEditedDescentRecords(form);
  const nextDraft = readAuthoringDraft(form, getAuthoringDraftDefaults());
  if (form.dataset.authoringMode === "create") {
    const seed = createAuthoringBall ?? createPendingBall(ledger, nextDraft, { categories: editableCategories });
    createAuthoringBall = seed;
    return createPendingBall(ledger, nextDraft, {
      id: seed.id,
      createdAt: seed.createdAt,
      descents: records,
      categories: editableCategories,
    });
  }
  const ballId = form.dataset.editingBallId;
  const ball = ledger.balls.find((item) => item.id === ballId);
  return ball ? applyDescentRecordsToBall(ball, records, ball.updatedAt) : null;
}

function getAuthoringDraftDefaults(): AuthoringDraftDefaults {
  return {
    date: draft.date,
    subject: getPrimarySelfName(ledger) || DEFAULT_SAMPLE_NAME,
    currentTime: currentLocalTime(),
  };
}

function createAuthoringDescentActionHandlers(): AuthoringDescentActionHandlers {
  return {
    requestNewDescent: (form, button) => {
      const target = createWorkingAuthoringBall(form);
      if (target) {
        void requestDescendLocation(target, button);
      }
    },
    confirmDeleteDescent: (sequence) => confirm(
      `No.${sequence}の降臨dataを消去します。\n降臨メモ、GPS情報、付与された星も消去されます。\n保存するまで確定しません。続けますか？`,
    ),
    requestDescentPosition: requestAuthoringDescentPosition,
  };
}

async function requestAuthoringDescentPosition(): Promise<DescentPositionInput | null> {
  if (!navigator.geolocation) {
    alert(createGeolocationUnavailableMessage());
    return null;
  }
  try {
    const position = await readCurrentPosition();
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
    };
  } catch (error) {
    alert(`位置情報を取得できませんでした。時間をおいて、同じ降臨カードからもう一度GPS取得を試せます。\n${formatGeolocationError(error)}`);
    return null;
  }
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
  const review = await reviewJsonImportFile(input, getActiveWorkspace(workspaceStore).ledger);
  if (!review) {
    return;
  }

  pendingJsonImport = review;
  pendingWorkspaceImportTarget = null;
  dispatchUi({ type: "open-primary", route: "play" }, false);
  render();
}

function dismissPendingJsonImport(): void {
  pendingJsonImport = null;
  pendingWorkspaceImportTarget = null;
  render();
}

function cancelPendingDeviceBackupImport(): void {
  pendingJsonImport = null;
  render();
}

function changeWorkspaceDisplayName(workspaceId: string, inputValue: string): string | undefined {
  const workspace = workspaceStore.workspaces.find((item) => item.workspaceId === workspaceId);
  const displayName = inputValue.trim().slice(0, 24);
  if (!workspace || workspace.role !== "received" || !displayName) {
    return workspace?.displayName ?? "";
  }
  const nextStore = replaceWorkspace(workspaceStore, { ...workspace, displayName, updatedAt: new Date().toISOString() });
  if (commitWorkspaceStore(nextStore)) {
    render();
  }
  return undefined;
}

function deleteWorkspaceRuntime(workspaceId: string): void {
  const workspace = workspaceStore.workspaces.find((item) => item.workspaceId === workspaceId);
  if (!workspace || workspace.role !== "received" || !confirm(`「${workspace.displayName}」の利用環境を削除します。バックアップがない限り戻せません。実行しますか？`)) {
    return;
  }
  const nextStore = removeReceivedWorkspace(workspaceStore, workspace.workspaceId);
  if (commitWorkspaceStore(nextStore)) {
    selectedBallId = null;
    render();
  }
}

function selectWorkspaceImportTarget(workspaceId: string): void {
  pendingWorkspaceImportTarget = workspaceId;
  render();
}

function applyPendingJsonImport(): void {
  if (!pendingJsonImport || pendingJsonImport.error) {
    return;
  }
  if (pendingJsonImport.workspaceShare) {
    return;
  }
  const selectedSections = readSelectedJsonImportSections();

  if (selectedSections.length === 0) {
    alert("読み込む内容を選んでください。");
    return;
  }

  if (selectedSections.includes("ledger") && pendingJsonImport.workspaceStore) {
    const restored = pendingJsonImport.workspaceStore;
    const restoredSelf = getSelfWorkspace(restored);
    const selfActiveStore = {
      ...restored,
      activeWorkspaceId: restoredSelf.workspaceId,
      selfLegacyFingerprint: workspaceSnapshotFingerprint({ ledger, categories: editableCategories, appSettings }),
    };
    if (!commitWorkspaceStore(selfActiveStore)) {
      return;
    }
    pendingJsonImport = null;
    dispatchUi({ type: "open-primary", route: "play" }, false);
    render();
    return;
  }

  const result = applyJsonImportReview(pendingJsonImport, selectedSections, {
    ledger,
    selectedBallId,
    persistLegacyLedger: getActiveWorkspace(workspaceStore).role === "self",
  });
  ledger = result.ledger;
  selectedBallId = result.selectedBallId;

  if (result.appSettings) {
    applyAppSettings(result.appSettings);
  }

  if (result.categories) {
    editableCategories = getActiveWorkspace(workspaceStore).role === "self"
      ? saveCategoryColorPresets(result.categories)
      : normalizeCategoryColorPresets(result.categories);
  }

  appendActivity({
    action: "json-import",
    message: selectedSections.join(","),
  });
  pendingJsonImport = null;
  dispatchUi({ type: "open-primary", route: "play" }, false);
  render();
}

function applyPendingWorkspaceImport(selection: WorkspaceImportSelection): void {
  const workspaceShare = pendingJsonImport?.workspaceShare;
  if (!workspaceShare) {
    return;
  }
  persistActiveWorkspaceSnapshot();
  const context = getWorkspaceImportDialogContext();
  if (!context) {
    return;
  }
  const importedAt = new Date().toISOString();
  if (context.selectedTarget === "new") {
    const nextStore = addWorkspace(workspaceStore, createWorkspaceFromShare(workspaceShare.bundle, importedAt));
    if (!nextStore || !commitWorkspaceStore(nextStore)) {
      if (!nextStore) {
        alert("利用環境の保存枠がいっぱいです。既存の利用環境を整理してから再度お試しください。");
      }
      return;
    }
    finishWorkspaceImport(workspaceShare.bundle.ledger.balls.length, 0, 0, workspaceShare.rejectedItemCount);
    return;
  }

  const target = workspaceStore.workspaces.find((workspace) => workspace.workspaceId === context.selectedTarget);
  if (!target) {
    return;
  }
  const result = applyWorkspaceShareToExisting(target, workspaceShare.bundle, selection, importedAt);
  if (!result.changed || !commitWorkspaceStore(replaceWorkspace(workspaceStore, result.workspace))) {
    return;
  }
  finishWorkspaceImport(
    result.addedCount,
    result.duplicateCount,
    result.conflictCount,
    workspaceShare.rejectedItemCount,
    result.replacedConflictCount,
  );
}

function applyPendingDeviceBackupImport(): void {
  const backup = pendingJsonImport?.deviceBackup;
  if (!backup) {
    return;
  }
  const restoredSelf = getSelfWorkspace(backup);
  const restoredStore: HappyBallWorkspaceStore = {
    ...backup,
    activeWorkspaceId: restoredSelf.workspaceId,
    selfLegacyFingerprint: workspaceSnapshotFingerprint({ ledger, categories: editableCategories, appSettings }),
  };
  if (!commitWorkspaceStore(restoredStore)) {
    return;
  }
  selectedBallId = null;
  pendingJsonImport = null;
  pendingWorkspaceImportTarget = null;
  dispatchUi({ type: "open-primary", route: "play" }, false);
  render();
  alert(`端末全体を復元しました。\n利用環境 ${restoredStore.workspaces.length}件`);
}

function commitWorkspaceStore(nextStore: HappyBallWorkspaceStore): boolean {
  try {
    saveWorkspaceStore(nextStore);
  } catch {
    alert("保存容量が不足したため、何も変更しませんでした。");
    return false;
  }
  workspaceStore = nextStore;
  syncSelfLegacySnapshot(workspaceStore);
  const active = getActiveWorkspace(workspaceStore);
  ledger = active.ledger;
  editableCategories = normalizeCategoryColorPresets(active.categories);
  appSettings = normalizeAppSettings(active.appSettings);
  baseRenderSignature = "";
  return true;
}

function finishWorkspaceImport(newCount: number, duplicateCount: number, conflictCount: number, rejectedCount: number, replacedCount = 0): void {
  appendActivity({
    action: "json-import",
    message: `新規${newCount} / 登録済み${duplicateCount} / 競合${conflictCount} / 上書き${replacedCount} / 読取不可${rejectedCount}`,
  });
  pendingJsonImport = null;
  pendingWorkspaceImportTarget = null;
  dispatchUi({ type: "open-primary", route: "play" }, false);
  render();
  alert(`読み込み結果\n新規 ${newCount}件\n登録済み ${duplicateCount}件\n競合 ${conflictCount}件\n上書き ${replacedCount}件\n読取不可 ${rejectedCount}件`);
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

function getReceiptImageContext() {
  return {
    currentUrl: window.location.href,
    showMemoField: appSettings.showMemoField,
    includeDescentGpsInHandoff: appSettings.includeDescentGpsInHandoff,
    categories: editableCategories,
  };
}

function prepareReceiptImageBall(ballId: string): { ball: HappyBall } | null {
  ledger = markReceiptCreated(ledger, ballId, getActiveWorkspace(workspaceStore).role === "self");
  persistActiveWorkspaceSnapshot();
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
    ledger = importNewBalls(ledger, review.newItems, getActiveWorkspace(workspaceStore).role === "self");
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
    ledger = importNewAndReplaceBalls(ledger, review.newItems, review.conflicts, getActiveWorkspace(workspaceStore).role === "self");
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
  ledger = markReceiptCreated(ledger, ballId, getActiveWorkspace(workspaceStore).role === "self");
  persistActiveWorkspaceSnapshot();
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
  ledger = markReceiptCreated(ledger, ballId, getActiveWorkspace(workspaceStore).role === "self");
  persistActiveWorkspaceSnapshot();
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

function navigateDisplayPeriod(delta: -1 | 1): void {
  if (uiState.primary !== "play") {
    return;
  }
  shiftCurrentDisplayAnchor(delta);
  render();
}

async function requestDescendLocation(ball: HappyBall, sourceButton?: HTMLButtonElement): Promise<void> {
  if (pendingDescentBallIds.has(ball.id)) {
    return;
  }

  const authoringForm = sourceButton?.closest<HTMLFormElement>("[data-ball-authoring-form]") ?? null;
  const memo = window.prompt("降臨メモ（任意・80文字まで）", "") ?? "";
  pendingDescentBallIds.add(ball.id);
  updateAuthoringDescentButtonsBusy(document, ball.id, true, sourceButton);
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
        saveGpslessDescent(ball, memo, authoringForm);
      }
      return;
    }
    if (authoringForm) {
      updateAuthoringAfterNewDescent(authoringForm, result.record, `GPS取得できました / No.${result.record.sequence}を保存予定です`);
      return;
    }
    saveDescentResult(ball, result.ball);
    appendActivity(createBallActivityInput(result.ball, {
      action: "descent-create",
      descentSequence: result.record.sequence,
      message: hasDescentPosition(result.record) ? "GPS取得成功" : "位置未取得",
    }));
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
    saveGpslessDescent(ball, memo, authoringForm);
  } finally {
    pendingDescentBallIds.delete(ball.id);
    updateAuthoringDescentButtonsBusy(document, ball.id, false, sourceButton);
  }
}

function saveGpslessDescent(ball: HappyBall, memo: string, authoringForm: HTMLFormElement | null = null): void {
  const result = appendDescentToBall(ball, null, appSettings.descentMinDistanceMeters, memo);
  if (!result.ok) {
    return;
  }
  if (authoringForm) {
    updateAuthoringAfterNewDescent(authoringForm, result.record, `仮降臨を保存予定です / No.${result.record.sequence}`);
    return;
  }
  saveDescentResult(ball, result.ball);
  appendActivity(createBallActivityInput(result.ball, {
    action: "descent-create",
    descentSequence: result.record.sequence,
    message: "仮降臨",
  }));
  alert(`「${ball.title}」に第${result.record.sequence}回の仮降臨を記録しました。\n位置は後で編集画面から取得できます。`);
  render();
}

function updateAuthoringAfterNewDescent(form: HTMLFormElement, record: HappyBallDescentRecord, message: string): void {
  replaceAuthoringDescentHistory(
    form,
    [...readEditedDescentRecords(form), record],
    message,
    createAuthoringDescentActionHandlers(),
  );
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
  if (getActiveWorkspace(workspaceStore).role === "self") {
    saveLedger(ledger);
  }
  persistActiveWorkspaceSnapshot();
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
  editableCategories = getActiveWorkspace(workspaceStore).role === "self"
    ? saveCategoryColorPresets(nextCategories)
    : normalizeCategoryColorPresets(nextCategories);
  persistActiveWorkspaceSnapshot();
  return editableCategories;
}

function resetCategorySettings(): void {
  editableCategories = getActiveWorkspace(workspaceStore).role === "self"
    ? resetCategoryColorPresets()
    : normalizeCategoryColorPresets([]);
  persistActiveWorkspaceSnapshot();
  render();
}

function applyNameBookSettings(entries: NameBookEntry[]): NameBookEntry[] {
  const previousDefaultName = getPrimarySelfName(ledger);
  ledger = updateNameBook(ledger, entries, getActiveWorkspace(workspaceStore).role === "self");
  const nextDefaultName = getPrimarySelfName(ledger);
  if (!draft.subject.trim() || draft.subject === previousDefaultName || draft.subject === "自分") {
    draft = { ...draft, subject: nextDefaultName };
  }
  persistActiveWorkspaceSnapshot();
  return ledger.ownerProfile.nameBook;
}

function resetNameBookSettings(): void {
  const previousDefaultName = getPrimarySelfName(ledger);
  ledger = resetNameBook(ledger, getActiveWorkspace(workspaceStore).role === "self");
  const nextDefaultName = getPrimarySelfName(ledger);
  if (!draft.subject.trim() || draft.subject === previousDefaultName || draft.subject === "自分") {
    draft = { ...draft, subject: nextDefaultName };
  }
  persistActiveWorkspaceSnapshot();
  render();
}

function readSendMode(target: EventTarget | null): SendMode {
  return target instanceof HTMLElement && target.dataset.sendMode === "casual" ? "casual" : "formal";
}

function updateAppSettings(patch: Partial<AppSettings>): void {
  applyAppSettings(normalizeAppSettings({ ...appSettings, ...patch }));
}

function applyAppSettings(nextSettings: AppSettings): void {
  const plan = planAppSettingsRuntimeEffects(appSettings, nextSettings);
  if (!plan.persist) {
    return;
  }

  appSettings = nextSettings;
  if (getActiveWorkspace(workspaceStore).role === "self") {
    saveAppSettings(appSettings);
  }
  persistActiveWorkspaceSnapshot();
  if (hasAppSettingsRuntimeEffect(plan, "sync-gravity")) {
    syncGravityController();
  }
  if (hasAppSettingsRuntimeEffect(plan, "sync-texture")) {
    applyBallFieldTextureSetting();
  }
  if (hasAppSettingsRuntimeEffect(plan, "sync-runtime-settings")) {
    syncRuntimePhysicsSettings();
  }
  if (hasAppSettingsRuntimeEffect(plan, "sync-debug-panel")) {
    syncGravityDebugPanelStructure();
  }

  const labelControlsUpdated = !hasAppSettingsRuntimeEffect(plan, "sync-ball-label-controls")
    || syncBallLabelModeControls();
  const visualSourcesUpdated = !hasAppSettingsRuntimeEffect(plan, "sync-ball-visual-sources")
    || syncBallVisualSourcesWithoutPhysicsRebuild();
  if (!labelControlsUpdated || !visualSourcesUpdated) {
    baseRenderSignature = "";
    render();
  }
}

function updateSelectedPhysicsSettings(
  profile: PhysicsSettingsProfile,
  patch: Partial<PhysicsParameterSettings>,
): void {
  applyAppSettings(updatePhysicsProfileSettings(appSettings, profile, patch));
}

function resetJutsuPhysicsProfile(): void {
  rememberSettingsScroll();
  applyAppSettings(resetJutsuPhysicsSettingsToDefault(appSettings));
  render();
}

function getRuntimeAppSettings(): AppSettings {
  return resolvePhysicsProfileSettings(appSettings, getRuntimePhysicsProfile());
}

function rememberSettingsScroll(): void {
  const scroller = document.querySelector<HTMLElement>(".floating-panel-settings .app-modal-scroll");
  pendingSettingsScrollTop = scroller?.scrollTop ?? null;
}

function restorePendingSettingsScroll(): void {
  if (pendingSettingsScrollTop === null) {
    return;
  }
  const scrollTop = pendingSettingsScrollTop;
  pendingSettingsScrollTop = null;
  const scroller = document.querySelector<HTMLElement>(".floating-panel-settings .app-modal-scroll");
  if (!scroller) {
    return;
  }
  const restore = () => {
    scroller.scrollTop = Math.min(scrollTop, scroller.scrollHeight);
  };
  restore();
  requestAnimationFrame(restore);
}

function getRuntimePhysicsProfile(): PhysicsSettingsProfile {
  return isPlayJutsuActive(playJutsuState) ? "jutsu" : "normal";
}

function syncRuntimePhysicsSettings(): void {
  physicsStage?.updateSettings(getRuntimeAppSettings());
  const field = uiHosts.base.querySelector<HTMLElement>("#ball-field");
  if (field) {
    field.dataset.runtimePhysicsProfile = getRuntimePhysicsProfile();
  }
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

function handleRendererFallback(error: unknown): void {
  if (rendererFallbackToDom || rendererFallbackScheduled) {
    return;
  }
  rendererFallbackScheduled = true;
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  debugLog.append("renderer-fallback", { from: "pixi", to: "dom", message });
  console.warn("Pixi renderer failed; rebuilding the Play surface with the DOM safety renderer.", error);
  queueMicrotask(() => {
    rendererFallbackScheduled = false;
    rendererFallbackToDom = true;
    baseRenderSignature = "";
    render();
  });
}
