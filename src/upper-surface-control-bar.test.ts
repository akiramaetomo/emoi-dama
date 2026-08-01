import {
  isUpperSurfaceControlTarget,
  planEditUpperSurfaceNavigation,
  renderUpperSurfaceControlBar,
} from "./upper-surface-control-bar.js";

const detailBar = renderUpperSurfaceControlBar({
  currentPrimary: "dayList",
  settingsActive: false,
});

assert(count(detailBar, "data-upper-control-target=") === 5, "upper bar should expose five common destinations");
assert(detailBar.includes('data-upper-control-target="create"'), "upper bar should expose creation");
assert(detailBar.includes('data-upper-control-target="play"'), "upper bar should expose Play");
assert(detailBar.includes('data-upper-control-target="calendar"'), "upper bar should expose Calendar");
assert(detailBar.includes('data-upper-control-target="dayList" aria-label="Ball Listへ移動" aria-current="page"'), "upper bar should mark its primary origin");
assert(detailBar.includes('data-upper-control-target="settings" aria-label="設定" aria-pressed="false"'), "upper bar should expose inactive Settings");
assert(count(detailBar, 'aria-current="page"') === 1, "upper bar should expose one current primary screen");
assert(!detailBar.includes("data-toggle-play-modes"), "upper bar should omit Jutsu");
assert(!detailBar.includes("data-toggle-ball-sieve"), "upper bar should omit the sieve");
assert(!detailBar.includes("data-calendar-cycle-marker-mode"), "upper bar should omit Calendar-specific functions");

const settingsBar = renderUpperSurfaceControlBar({
  currentPrimary: "calendar",
  settingsActive: true,
});
assert(settingsBar.includes('data-upper-control-target="calendar" aria-label="Calendarへ移動" aria-current="page"'), "Settings should preserve its opening primary screen");
assert(settingsBar.includes('dock-settings-button is-on'), "Settings should light its own action");
assert(settingsBar.includes('aria-pressed="true"'), "Settings should expose its selected state");

for (const target of ["create", "play", "calendar", "dayList", "settings"]) {
  assert(isUpperSurfaceControlTarget(target), `${target} should be a valid upper control target`);
}
assert(!isUpperSurfaceControlTarget("jutsu"), "screen-specific functions should not be upper control targets");

const directPlan = planEditUpperSurfaceNavigation(false, "play");
assert(directPlan.kind === "navigate" && directPlan.target === "play", "unchanged edits should navigate immediately");
const pendingPlan = planEditUpperSurfaceNavigation(true, "calendar");
assert(
  pendingPlan.kind === "confirm" && pendingPlan.pendingTarget === "calendar",
  "changed edits should preserve the requested target while confirmation is open",
);

console.log("upper-surface-control-bar tests passed");

function count(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
