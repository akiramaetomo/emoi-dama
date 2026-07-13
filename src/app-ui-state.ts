export type PrimaryRoute =
  | "play"
  | "calendar-month"
  | "calendar-day-list"
  | "create"
  | "saved-list"
  | "settings";

export type ModalRoute =
  | "ball-detail"
  | "ball-edit"
  | "receipt"
  | "receipt-qr"
  | "url-import"
  | "json-import"
  | "manual-copy";

export type ConfirmRoute = "edit-save";

export interface AppUiState {
  primary: PrimaryRoute;
  modals: ModalRoute[];
  confirm: ConfirmRoute | null;
}

export type AppUiAction =
  | { type: "open-primary"; route: PrimaryRoute }
  | { type: "replace-modal"; route: ModalRoute }
  | { type: "push-modal"; route: ModalRoute }
  | { type: "close-top-modal" }
  | { type: "clear-modals" }
  | { type: "open-confirm"; route: ConfirmRoute }
  | { type: "close-confirm" };

export interface AppUiSnapshot extends AppUiState {
  topRoute: PrimaryRoute | ModalRoute | ConfirmRoute;
  blocksBase: boolean;
  hidesPlayChrome: boolean;
  pausesPhysics: boolean;
  editableSurface: boolean;
}

export function createInitialAppUiState(startupScreen: "main" | "calendarMonth" | "calendarDayList"): AppUiState {
  return {
    primary: startupScreen === "calendarMonth"
      ? "calendar-month"
      : startupScreen === "calendarDayList"
        ? "calendar-day-list"
        : "play",
    modals: [],
    confirm: null,
  };
}

export function reduceAppUiState(state: AppUiState, action: AppUiAction): AppUiState {
  switch (action.type) {
    case "open-primary":
      return { ...state, primary: action.route };
    case "replace-modal":
      return { ...state, modals: [action.route], confirm: null };
    case "push-modal":
      return { ...state, modals: [...state.modals, action.route], confirm: null };
    case "close-top-modal":
      return { ...state, modals: state.modals.slice(0, -1), confirm: null };
    case "clear-modals":
      return { ...state, modals: [], confirm: null };
    case "open-confirm":
      return { ...state, confirm: action.route };
    case "close-confirm":
      return { ...state, confirm: null };
  }
}

export function createAppUiSnapshot(state: AppUiState): AppUiSnapshot {
  const topModal = state.modals[state.modals.length - 1];
  const topRoute = state.confirm ?? topModal ?? state.primary;
  const blocksBase = state.primary !== "play" || Boolean(topModal) || Boolean(state.confirm);
  return {
    ...state,
    modals: [...state.modals],
    topRoute,
    blocksBase,
    hidesPlayChrome: blocksBase,
    pausesPhysics: blocksBase,
    editableSurface: state.confirm === null && (
      topModal === "ball-edit"
      || topModal === "manual-copy"
      || (!topModal && (state.primary === "create" || state.primary === "settings"))
    ),
  };
}

export function isCalendarRoute(route: PrimaryRoute): boolean {
  return route === "calendar-month" || route === "calendar-day-list";
}
