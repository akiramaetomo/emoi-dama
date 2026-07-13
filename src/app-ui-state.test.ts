import {
  createAppUiSnapshot,
  createInitialAppUiState,
  reduceAppUiState,
} from "./app-ui-state.js";

let state = createInitialAppUiState("calendarMonth");
assert(state.primary === "calendar-month", "calendar startup should have exactly one month route");

state = reduceAppUiState(state, { type: "open-primary", route: "calendar-day-list" });
assert(state.primary === "calendar-day-list", "one action should switch month to day list");

state = reduceAppUiState(state, { type: "open-primary", route: "calendar-month" });
assert(state.primary === "calendar-month", "one action should switch day list to month");

state = reduceAppUiState(state, { type: "replace-modal", route: "ball-edit" });
let snapshot = createAppUiSnapshot(state);
assert(snapshot.modals.length === 1 && snapshot.topRoute === "ball-edit", "modal replacement should have one owner");
assert(snapshot.pausesPhysics && snapshot.hidesPlayChrome, "a modal should pause and isolate Play");
assert(snapshot.editableSurface, "ball edit should opt into keyboard coordination");

state = reduceAppUiState(state, { type: "open-confirm", route: "edit-save" });
snapshot = createAppUiSnapshot(state);
assert(snapshot.topRoute === "edit-save" && !snapshot.editableSurface, "confirm should exclusively own the top route");

state = reduceAppUiState(state, { type: "close-confirm" });
state = reduceAppUiState(state, { type: "clear-modals" });
snapshot = createAppUiSnapshot(state);
assert(snapshot.modals.length === 0 && snapshot.primary === "calendar-month", "closing modals should preserve Primary");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
