import {
  renderCalendarScreenIcon,
  renderCreateBallIcon,
  renderPlayScreenIcon,
} from "./control-bar-icons.js";

export type UpperSurfacePrimaryTarget = "play" | "calendar" | "dayList";

export type UpperSurfaceControlTarget =
  | "create"
  | UpperSurfacePrimaryTarget
  | "settings";

export interface UpperSurfaceControlBarState {
  currentPrimary: UpperSurfacePrimaryTarget;
  settingsActive: boolean;
}

export type EditUpperSurfaceNavigationPlan =
  | { kind: "navigate"; target: UpperSurfaceControlTarget }
  | { kind: "confirm"; pendingTarget: UpperSurfaceControlTarget };

export function planEditUpperSurfaceNavigation(
  changed: boolean,
  target: UpperSurfaceControlTarget,
): EditUpperSurfaceNavigationPlan {
  return changed
    ? { kind: "confirm", pendingTarget: target }
    : { kind: "navigate", target };
}

export function isUpperSurfaceControlTarget(value: unknown): value is UpperSurfaceControlTarget {
  return value === "create"
    || value === "play"
    || value === "calendar"
    || value === "dayList"
    || value === "settings";
}

export function renderUpperSurfaceControlBar(state: UpperSurfaceControlBarState): string {
  return `
    <div class="upper-surface-control-dock">
      <div class="world-actions app-control-bar upper-surface-actions" aria-label="コントロールバー">
        <span class="control-bar-left">
          <button class="dock-symbol-button dock-create-button" type="button" data-upper-control-target="create" aria-label="玉を作る">${renderCreateBallIcon()}</button>
        </span>
        <span class="primary-screen-control-group" aria-label="主要3画面">
          <button class="calendar-main-ball-button" type="button" data-upper-control-target="play" aria-label="Emotion Playへ移動"${renderCurrent(state.currentPrimary === "play")}>
            ${renderPlayScreenIcon()}
          </button>
          <button class="calendar-screen-button" type="button" data-upper-control-target="calendar" aria-label="Calendarへ移動"${renderCurrent(state.currentPrimary === "calendar")}>
            ${renderCalendarScreenIcon()}
          </button>
          <button class="day-list-screen-button" type="button" data-upper-control-target="dayList" aria-label="Ball Listへ移動"${renderCurrent(state.currentPrimary === "dayList")}>
            <span class="day-list-screen-icon" aria-hidden="true"></span>
          </button>
        </span>
        <span class="control-bar-functions">
          <button class="dock-symbol-button dock-settings-button${state.settingsActive ? " is-on" : ""}" type="button" data-upper-control-target="settings" aria-label="設定" aria-pressed="${state.settingsActive}">⚙</button>
        </span>
      </div>
    </div>
  `;
}

function renderCurrent(current: boolean): string {
  return current ? ' aria-current="page"' : "";
}
