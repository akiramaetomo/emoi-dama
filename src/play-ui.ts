import { renderBallLabelModeCycleAriaLabel } from "./ball-labels.js";
import { renderBallSieveControl, renderBallSieveStatus, type BallSieveUiState } from "./ball-sieve-ui.js";
import {
  renderCalendarScreenIcon,
  renderCreateBallIcon,
  renderPlayScreenIcon,
} from "./control-bar-icons.js";
import { getDisplayDateRange, type DisplayMode } from "./display-period.js";
import { renderPeriodChevronIcon } from "./period-navigation.js";
import {
  clampPlayMenuPosition,
  createInitialPlayMenuPosition,
  type PlayMenuPosition,
} from "./play-jutsu-menu.js";
import type { PlayJutsuAction, PlayJutsuState } from "./play-jutsu-state.js";
import type { BackgroundTexture, BallLabelMode } from "./settings.js";

export type PlayDisclosure = "world" | "parent";

export interface PlayUiRenderContext {
  ballLabelMode: BallLabelMode;
  backgroundTexture: BackgroundTexture;
  displayMode: DisplayMode;
  displayAnchorDate: string;
  stageTitle: string;
  workspaceScreenNameHtml: string;
  gravityDebugHtml: string;
  populationStatusHtml: string;
  developmentDiagnostics: boolean;
  jutsuState: PlayJutsuState;
  controlsOpen: boolean;
  jutsuFeedback: string;
  worldDisclosureOpen: boolean;
  parentDisclosureOpen: boolean;
  ballSieve: BallSieveUiState;
  ballSieveFeedback: string;
  sieveTransitioning: boolean;
}

export interface PlayUiActionHandlers {
  toggleControls: () => void;
  dispatchJutsu: (action: PlayJutsuAction) => void;
  applyJutsu: (mode: "fill" | "count-limit") => void;
  resetBallJutsu: () => void;
  disableJutsu: () => void;
  cycleDisplayMode: () => void;
  shiftDisplayPeriod: (delta: -1 | 1) => void;
  cycleBallLabelMode: () => void;
  openPanel: (panel: string) => void;
  openCalendarDayList: () => void;
  changeMenuPosition: (position: PlayMenuPosition) => void;
  changeDisclosure: (disclosure: PlayDisclosure, open: boolean) => void;
}

export interface PlayUiBinding {
  disconnect: () => void;
  syncBallLabelMode: (mode: BallLabelMode) => boolean;
  syncFeedback: (feedback: string) => void;
  syncModeControls: (controlsOpen: boolean, jutsuState: PlayJutsuState) => void;
}

export function renderPlaySurface(context: PlayUiRenderContext): string {
  const ballLabelMode = context.ballLabelMode;
  return `
    <main class="app-shell ball-world-shell">
      <section class="stage ${ballLabelMode !== "none" ? "show-ball-labels" : ""} label-mode-${ballLabelMode}${context.sieveTransitioning ? " is-ball-sieve-transitioning" : ""}" aria-label="えもい玉">
        <div class="stage-topline">
          <div>
            ${context.workspaceScreenNameHtml}
            ${renderPlayPeriodNav(context.displayMode, context.displayAnchorDate)}
            <h1 id="stage-title">${escapeHtml(context.stageTitle)}</h1>
            ${context.populationStatusHtml}
            ${context.developmentDiagnostics ? `<p class="play-fragmentation-status" data-fragmentation-status aria-live="polite"></p>` : ""}
          </div>
        </div>
        <div class="play-world-region">
          <div id="ball-field" class="ball-field texture-${context.backgroundTexture}" aria-label="触って転がせるえもい玉"></div>
          ${context.gravityDebugHtml}
          ${renderPlayModePopover(context)}
          <div class="ball-sieve-status-layer play-ball-sieve-status-layer">
            ${renderBallSieveStatus({ presetId: context.ballSieve.presetId, feedback: context.ballSieveFeedback })}
          </div>
        </div>
        <div class="play-control-region">
          <div class="world-control-dock">
            <div class="world-actions app-control-bar" aria-label="コントロールバー">
            <span class="control-bar-left">
              <button class="dock-symbol-button dock-create-button" type="button" data-open-panel="create" aria-label="玉を作る">${renderCreateBallIcon()}</button>
            </span>
            <span class="primary-screen-control-group" aria-label="主要3画面">
              <button class="calendar-main-ball-button ${ballLabelMode !== "none" ? "is-label-on" : ""}" type="button" data-cycle-ball-label-mode aria-current="page" aria-label="${escapeHtml(renderBallLabelModeCycleAriaLabel(ballLabelMode))}">
                ${renderPlayScreenIcon()}
              </button>
              <button class="calendar-screen-button" type="button" data-open-panel="calendar" aria-label="カレンダー">
                ${renderCalendarScreenIcon()}
              </button>
              <button class="day-list-screen-button" type="button" data-open-calendar-day-list aria-label="玉リスト">
                <span class="day-list-screen-icon" aria-hidden="true"></span>
              </button>
            </span>
            <span class="control-bar-functions primary-screen-functions">
              ${renderBallSieveControl(context.ballSieve)}
              <button class="play-mode-button ${isPlayJutsuActive(context.jutsuState) ? "is-on" : ""}" type="button" data-toggle-play-modes aria-expanded="${context.controlsOpen}">術</button>
              <button class="dock-symbol-button dock-settings-button" type="button" data-open-panel="settings" aria-label="設定">⚙</button>
            </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  `;
}

export function renderPlayPopulationStatus(
  displayedCount: number,
  totalCount: number,
  truncated: boolean,
): string {
  if (!truncated && totalCount <= 120) {
    return "";
  }
  return `<p class="play-population-status" aria-live="polite">表示中 ${displayedCount} / 全${totalCount}玉</p>`;
}

export function renderPlayDisplayRangeLabel(mode: DisplayMode, anchorDate: string): string {
  const range = getDisplayDateRange(mode, anchorDate);
  if (mode === "day") {
    return anchorDate;
  }
  if (mode === "week") {
    return `${range.start} – ${range.end.slice(5)}`;
  }
  return anchorDate.slice(0, 7);
}

export function renderPlayDisplayModeName(mode: DisplayMode): string {
  if (mode === "day") {
    return "日";
  }
  if (mode === "week") {
    return "週";
  }
  return "月";
}

export function nextPlayDisplayMode(mode: DisplayMode): DisplayMode {
  if (mode === "day") {
    return "week";
  }
  if (mode === "week") {
    return "month";
  }
  return "day";
}

export function isPlayJutsuActive(state: PlayJutsuState): boolean {
  return state.gravityMode === "fixed-down"
    || state.buoyancyMode === "on"
    || state.interactionMode === "parent"
    || state.parentSplitMode !== "off";
}

export function bindPlayUiActions(
  root: ParentNode,
  initialMenuPosition: PlayMenuPosition | null,
  handlers: PlayUiActionHandlers,
): PlayUiBinding | null {
  const playSurface = root.querySelector<HTMLElement>(".ball-world-shell");
  if (!playSurface) {
    return null;
  }

  playSurface.querySelector<HTMLButtonElement>("[data-toggle-play-modes]")?.addEventListener("click", handlers.toggleControls);

  playSurface.querySelectorAll<HTMLButtonElement>("[data-play-gravity-mode]").forEach((button) => {
    button.addEventListener("click", () => handlers.dispatchJutsu({
      type: "set-gravity",
      mode: button.dataset.playGravityMode === "fixed-down" ? "fixed-down" : "free",
    }));
  });
  playSurface.querySelectorAll<HTMLButtonElement>("[data-play-buoyancy-mode]").forEach((button) => {
    button.addEventListener("click", () => handlers.dispatchJutsu({
      type: "set-buoyancy",
      mode: button.dataset.playBuoyancyMode === "on" ? "on" : "off",
    }));
  });
  playSurface.querySelectorAll<HTMLButtonElement>("[data-play-parent-enabled]").forEach((button) => {
    button.addEventListener("click", () => handlers.dispatchJutsu({
      type: "set-parent",
      enabled: button.dataset.playParentEnabled === "true",
    }));
  });
  playSurface.querySelectorAll<HTMLButtonElement>("[data-play-parent-split-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const requestedMode = button.dataset.playParentSplitMode;
      handlers.dispatchJutsu({
        type: "set-parent-split",
        mode: requestedMode === "fill" ? "fill" : requestedMode === "count-limit" ? "count-limit" : "off",
      });
    });
  });
  playSurface.querySelectorAll<HTMLButtonElement>("[data-apply-jutsu]").forEach((button) => {
    button.addEventListener("click", () => handlers.applyJutsu(
      button.dataset.applyJutsu === "fill" ? "fill" : "count-limit",
    ));
  });
  playSurface.querySelector<HTMLButtonElement>("[data-reset-ball-jutsu]")?.addEventListener("click", handlers.resetBallJutsu);
  playSurface.querySelector<HTMLButtonElement>("[data-disable-play-jutsu]")?.addEventListener("click", handlers.disableJutsu);
  playSurface.querySelector<HTMLButtonElement>("[data-cycle-display-mode]")?.addEventListener("click", handlers.cycleDisplayMode);
  playSurface.querySelectorAll<HTMLButtonElement>("[data-shift-display-period]").forEach((button) => {
    button.addEventListener("click", () => handlers.shiftDisplayPeriod(
      button.dataset.shiftDisplayPeriod === "1" ? 1 : -1,
    ));
  });
  playSurface.querySelector<HTMLButtonElement>("[data-cycle-ball-label-mode]")?.addEventListener("click", handlers.cycleBallLabelMode);
  playSurface.querySelectorAll<HTMLButtonElement>("[data-open-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.openPanel) {
        handlers.openPanel(button.dataset.openPanel);
      }
    });
  });
  playSurface.querySelector<HTMLButtonElement>("[data-open-calendar-day-list]")?.addEventListener("click", handlers.openCalendarDayList);

  const popoverBinding = bindPlayModePopover(playSurface, initialMenuPosition, handlers);
  return {
    disconnect: popoverBinding.disconnect,
    syncBallLabelMode: (mode) => syncBallLabelModeControls(playSurface, mode),
    syncFeedback: (feedback) => syncPlayJutsuFeedback(playSurface, feedback),
    syncModeControls: (controlsOpen, jutsuState) => {
      syncPlayModeControls(playSurface, controlsOpen, jutsuState, popoverBinding.position);
    },
  };
}

export function bindPlayDisplayNavigationKeys(
  target: Pick<Window, "addEventListener">,
  canNavigate: () => boolean,
  navigate: (delta: -1 | 1) => void,
): void {
  target.addEventListener("keydown", (event: Event) => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key !== "ArrowLeft" && keyboardEvent.key !== "ArrowRight") {
      return;
    }
    if (!canNavigate() || isEditableKeyboardTarget(keyboardEvent.target)) {
      return;
    }
    keyboardEvent.preventDefault();
    navigate(keyboardEvent.key === "ArrowRight" ? 1 : -1);
  });
}

export function bindPlayDebugEventLogging(
  field: HTMLElement,
  developmentDiagnostics: boolean,
  shouldLog: () => boolean,
  log: (eventType: string, details: Record<string, unknown>) => void,
): void {
  if (!developmentDiagnostics) {
    return;
  }
  const logEvent = (event: Event) => {
    if (shouldLog()) {
      log(event.type, describeDebugEvent(event));
    }
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

export function updatePlayFragmentationStatus(
  root: ParentNode,
  developmentDiagnostics: boolean,
  displayedCount: number,
  originalCount: number,
): void {
  if (!developmentDiagnostics) {
    return;
  }
  const status = root.querySelector<HTMLElement>("[data-fragmentation-status]");
  if (status) {
    status.textContent = displayedCount > originalCount ? `分割中 ${displayedCount} / 元${originalCount}玉` : "";
  }
}

export function updatePlaySelectedSummary(root: ParentNode, summary: string): void {
  const title = root.querySelector<HTMLElement>("#stage-title");
  if (title) {
    title.textContent = summary;
  }
}

function renderPlayModePopover(context: PlayUiRenderContext): string {
  const state = context.jutsuState;
  return `
    <div class="play-mode-popover" data-play-mode-popover role="dialog" aria-label="術の設定" ${context.controlsOpen ? "" : "hidden"}>
      <button class="play-mode-drag-grip" type="button" data-play-mode-drag-grip aria-label="術メニューを移動"></button>
      <div class="play-jutsu-actions">
        <button type="button" data-apply-jutsu="fill">充填分割の術</button>
        <button type="button" data-apply-jutsu="count-limit">小玉分割の術</button>
      </div>
      <div class="play-jutsu-reset-actions">
        <button type="button" data-reset-ball-jutsu>玉の術を解く</button>
        <button type="button" data-disable-play-jutsu>術を無効</button>
      </div>
      <p class="play-jutsu-feedback" data-play-jutsu-feedback aria-live="polite">${escapeHtml(context.jutsuFeedback)}</p>
      <details class="play-mode-disclosure" data-play-mode-disclosure="world" ${context.worldDisclosureOpen ? "open" : ""}>
        <summary><span>世界</span><small>Sekai</small></summary>
        <div class="play-mode-disclosure-body">
          <div class="play-mode-row" role="group" aria-label="重力">
            <span>重力</span>
            <button type="button" data-play-gravity-mode="free" class="${state.gravityMode === "free" ? "is-on" : ""}">なし</button>
            <button type="button" data-play-gravity-mode="fixed-down" class="${state.gravityMode === "fixed-down" ? "is-on" : ""}">あり</button>
          </div>
          <div class="play-mode-row" role="group" aria-label="浮力。タップ、ドラッグ、親玉の存在中に有効">
            <span>浮力<small>（タップ時のみ有効）</small></span>
            <button type="button" data-play-buoyancy-mode="off" class="${state.buoyancyMode === "off" ? "is-on" : ""}">なし</button>
            <button type="button" data-play-buoyancy-mode="on" class="${state.buoyancyMode === "on" ? "is-on" : ""}" ${state.gravityMode === "free" ? "disabled aria-disabled=\"true\"" : ""}>あり</button>
          </div>
        </div>
      </details>
      <details class="play-mode-disclosure" data-play-mode-disclosure="parent" ${context.parentDisclosureOpen ? "open" : ""}>
        <summary><span>親玉</span><small>Oyadama</small></summary>
        <div class="play-mode-disclosure-body">
          <div class="play-mode-row" role="group" aria-label="親玉">
            <span>親玉</span>
            <button type="button" data-play-parent-enabled="false" class="${state.interactionMode === "grab" ? "is-on" : ""}">なし</button>
            <button type="button" data-play-parent-enabled="true" class="${state.interactionMode === "parent" ? "is-on" : ""}">あり</button>
          </div>
          <div class="play-mode-row play-mode-row-three" role="group" aria-label="親玉の分割の術">
            <span>分割の術</span>
            <button type="button" data-play-parent-split-mode="off" class="${state.parentSplitMode === "off" ? "is-on" : ""}">無</button>
            <button type="button" data-play-parent-split-mode="count-limit" class="${state.parentSplitMode === "count-limit" ? "is-on" : ""}" ${state.interactionMode === "grab" ? "disabled aria-disabled=\"true\"" : ""}>小玉</button>
            <button type="button" data-play-parent-split-mode="fill" class="${state.parentSplitMode === "fill" ? "is-on" : ""}" ${state.interactionMode === "grab" ? "disabled aria-disabled=\"true\"" : ""}>充填</button>
          </div>
        </div>
      </details>
    </div>
  `;
}

function renderPlayPeriodNav(mode: DisplayMode, anchorDate: string): string {
  const displayModeName = renderPlayDisplayModeName(mode);
  const nextDisplayModeName = renderPlayDisplayModeName(nextPlayDisplayMode(mode));
  return `
    <div class="play-period-nav" aria-label="${escapeHtml(displayModeName)}表示の期間移動">
      <button class="period-nav-button period-nav-button-previous" type="button" data-shift-display-period="-1" aria-label="前の${escapeHtml(displayModeName)}">${renderPeriodChevronIcon("previous")}</button>
      <button class="stage-filter play-period-mode-button" type="button" data-cycle-display-mode aria-label="${escapeHtml(`表示期間: ${displayModeName}。押すと${nextDisplayModeName}に切り替え`)}">${escapeHtml(renderPlayDisplayRangeLabel(mode, anchorDate))}</button>
      <button class="period-nav-button period-nav-button-next" type="button" data-shift-display-period="1" aria-label="次の${escapeHtml(displayModeName)}">${renderPeriodChevronIcon("next")}</button>
    </div>
  `;
}

function bindPlayModePopover(
  root: ParentNode,
  initialMenuPosition: PlayMenuPosition | null,
  handlers: Pick<PlayUiActionHandlers, "changeMenuPosition" | "changeDisclosure">,
): { disconnect: () => void; position: () => void } {
  const popover = root.querySelector<HTMLElement>("[data-play-mode-popover]");
  const world = popover?.closest<HTMLElement>(".play-world-region");
  const grip = popover?.querySelector<HTMLButtonElement>("[data-play-mode-drag-grip]");
  if (!popover || !world || !grip) {
    return { disconnect: () => undefined, position: () => undefined };
  }

  let menuPosition = initialMenuPosition;
  const position = () => {
    if (popover.hidden) {
      return;
    }
    const worldSize = { width: world.clientWidth, height: world.clientHeight };
    const menuSize = { width: popover.offsetWidth, height: popover.offsetHeight };
    if (worldSize.width <= 0 || worldSize.height <= 0 || menuSize.width <= 0 || menuSize.height <= 0) {
      return;
    }
    menuPosition = menuPosition
      ? clampPlayMenuPosition(menuPosition, worldSize, menuSize)
      : createInitialPlayMenuPosition(worldSize, menuSize);
    popover.style.left = `${Math.round(menuPosition.x)}px`;
    popover.style.top = `${Math.round(menuPosition.y)}px`;
    popover.dataset.menuX = String(Math.round(menuPosition.x));
    popover.dataset.menuY = String(Math.round(menuPosition.y));
    handlers.changeMenuPosition(menuPosition);
  };

  const resizeObserver = new ResizeObserver(position);
  resizeObserver.observe(world);
  resizeObserver.observe(popover);

  let drag: { pointerId: number; origin: PlayMenuPosition; clientX: number; clientY: number } | null = null;
  grip.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    position();
    const origin = menuPosition ?? { x: popover.offsetLeft, y: popover.offsetTop };
    drag = { pointerId: event.pointerId, origin, clientX: event.clientX, clientY: event.clientY };
    grip.setPointerCapture(event.pointerId);
    popover.classList.add("is-dragging");
  });
  grip.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    menuPosition = {
      x: drag.origin.x + event.clientX - drag.clientX,
      y: drag.origin.y + event.clientY - drag.clientY,
    };
    position();
  });
  const finishDrag = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    if (grip.hasPointerCapture(event.pointerId)) {
      grip.releasePointerCapture(event.pointerId);
    }
    drag = null;
    popover.classList.remove("is-dragging");
  };
  grip.addEventListener("pointerup", finishDrag);
  grip.addEventListener("pointercancel", finishDrag);

  popover.querySelectorAll<HTMLDetailsElement>("[data-play-mode-disclosure]").forEach((details) => {
    details.addEventListener("toggle", () => {
      const disclosure = details.dataset.playModeDisclosure;
      if (disclosure === "world" || disclosure === "parent") {
        handlers.changeDisclosure(disclosure, details.open);
      }
      requestAnimationFrame(position);
    });
  });
  requestAnimationFrame(position);

  return {
    disconnect: () => resizeObserver.disconnect(),
    position,
  };
}

function syncPlayModeControls(
  root: ParentNode,
  controlsOpen: boolean,
  state: PlayJutsuState,
  position: () => void,
): void {
  const popover = root.querySelector<HTMLElement>("[data-play-mode-popover]");
  const toggle = root.querySelector<HTMLButtonElement>("[data-toggle-play-modes]");
  if (popover) {
    popover.hidden = !controlsOpen;
    if (controlsOpen) {
      requestAnimationFrame(position);
    }
  }
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(controlsOpen));
    toggle.classList.toggle("is-on", isPlayJutsuActive(state));
  }
  root.querySelectorAll<HTMLButtonElement>("[data-play-gravity-mode]").forEach((button) => {
    button.classList.toggle("is-on", button.dataset.playGravityMode === state.gravityMode);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-play-buoyancy-mode]").forEach((button) => {
    button.classList.toggle("is-on", button.dataset.playBuoyancyMode === state.buoyancyMode);
    button.disabled = button.dataset.playBuoyancyMode === "on" && state.gravityMode === "free";
    button.setAttribute("aria-disabled", String(button.disabled));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-play-parent-enabled]").forEach((button) => {
    const enabled = state.interactionMode === "parent";
    button.classList.toggle("is-on", button.dataset.playParentEnabled === String(enabled));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-play-parent-split-mode]").forEach((button) => {
    button.classList.toggle("is-on", button.dataset.playParentSplitMode === state.parentSplitMode);
    button.disabled = button.dataset.playParentSplitMode !== "off" && state.interactionMode === "grab";
    button.setAttribute("aria-disabled", String(button.disabled));
  });
}

function syncPlayJutsuFeedback(root: ParentNode, feedbackText: string): void {
  const feedback = root.querySelector<HTMLElement>("[data-play-jutsu-feedback]");
  if (feedback) {
    feedback.textContent = feedbackText;
  }
}

function syncBallLabelModeControls(root: ParentNode, mode: BallLabelMode): boolean {
  const stage = root.querySelector<HTMLElement>(".stage");
  const button = root.querySelector<HTMLButtonElement>("[data-cycle-ball-label-mode]");
  if (!stage || !button) {
    return false;
  }

  stage.classList.toggle("show-ball-labels", mode !== "none");
  for (const candidate of ["none", "date", "title", "name"] as const) {
    stage.classList.toggle(`label-mode-${candidate}`, mode === candidate);
  }
  button.classList.toggle("is-label-on", mode !== "none");
  button.setAttribute("aria-label", renderBallLabelModeCycleAriaLabel(mode));
  button.innerHTML = renderPlayScreenIcon();
  return true;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest("input, textarea, select, button, [contenteditable='true']"));
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
