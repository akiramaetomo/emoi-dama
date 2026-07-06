import type { CalendarOverlayMode } from "./calendar-renderers";

export type PrimaryScreenKind = "main" | "calendarMonth" | "calendarDayList";

export interface PrimaryScreenState {
  kind: PrimaryScreenKind;
  calendarMonth: string;
  selectedDate: string;
}

export interface PrimaryScreenCaptureInput {
  activePrimarySurface: "main" | "calendar";
  calendarMode: CalendarOverlayMode;
  calendarMonth: string;
  selectedDate: string;
}

export interface PlayStageMountInput {
  activeOverlay: string;
  hasPendingDialog?: boolean;
}

export function capturePrimaryScreen(input: PrimaryScreenCaptureInput): PrimaryScreenState {
  if (input.activePrimarySurface === "calendar") {
    return {
      kind: input.calendarMode === "dayList" ? "calendarDayList" : "calendarMonth",
      calendarMonth: input.calendarMonth,
      selectedDate: input.selectedDate,
    };
  }

  return {
    kind: "main",
    calendarMonth: input.calendarMonth,
    selectedDate: input.selectedDate,
  };
}

export function createMainPrimaryScreen(calendarMonth: string, selectedDate: string): PrimaryScreenState {
  return {
    kind: "main",
    calendarMonth,
    selectedDate,
  };
}

export function shouldMountPlayStage(input: PlayStageMountInput): boolean {
  return input.activeOverlay === "none" && input.hasPendingDialog !== true;
}
