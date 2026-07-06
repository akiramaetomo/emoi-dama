import { capturePrimaryScreen, shouldMountPlayStage } from "./screen-navigation.js";

const main = capturePrimaryScreen({
  activePrimarySurface: "main",
  calendarMode: "month",
  calendarMonth: "2026-07",
  selectedDate: "2026-07-03",
});

assert(main.kind === "main", "main surface should capture as the main primary screen");
assert(main.selectedDate === "2026-07-03", "main capture should retain the selected date");

const calendarMonth = capturePrimaryScreen({
  activePrimarySurface: "calendar",
  calendarMode: "month",
  calendarMonth: "2026-08",
  selectedDate: "2026-07-03",
});

assert(calendarMonth.kind === "calendarMonth", "calendar month should capture as a primary screen");
assert(calendarMonth.calendarMonth === "2026-08", "calendar month capture should retain the viewed month");

const calendarDayList = capturePrimaryScreen({
  activePrimarySurface: "calendar",
  calendarMode: "dayList",
  calendarMonth: "2026-07",
  selectedDate: "2026-07-04",
});

assert(calendarDayList.kind === "calendarDayList", "day list should capture as a primary screen");
assert(calendarDayList.selectedDate === "2026-07-04", "day-list capture should retain the selected day");

assert(shouldMountPlayStage({ activeOverlay: "none" }), "play physics should mount on the visible play screen");
assert(!shouldMountPlayStage({ activeOverlay: "calendar" }), "play physics should not mount behind the calendar overlay");
assert(!shouldMountPlayStage({ activeOverlay: "create" }), "play physics should not mount behind the create overlay");
assert(!shouldMountPlayStage({ activeOverlay: "none", hasPendingDialog: true }), "play physics should not mount behind pending modal dialogs");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
