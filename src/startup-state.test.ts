import type { HappyBall } from "./models.js";
import { createStartupScreenState } from "./startup-state.js";

const pastBall = createBall("ball_past", "2026-07-02", "active");
const todayBall = createBall("ball_today", "2026-07-03", "active");
const offeredTodayBall = createBall("ball_offered_today", "2026-07-03", "offered");

const pastOnly = createStartupScreenState([pastBall], "2026-07-03");
assert(pastOnly.displayAnchorDate === "2026-07-03", "startup anchor should always be today");
assert(pastOnly.calendarMonth === "2026-07", "startup calendar month should be today's month");
assert(pastOnly.selectedBallId === null, "startup should not select a past ball");
assert(pastOnly.startupScreen === "calendarMonth", "startup should default to the calendar month screen");

const withToday = createStartupScreenState([pastBall, todayBall], "2026-07-03");
assert(withToday.selectedBallId === "ball_today", "startup should select today's visible ball");

const offeredOnlyToday = createStartupScreenState([offeredTodayBall, pastBall], "2026-07-03");
assert(offeredOnlyToday.selectedBallId === null, "startup should not select offered balls");

const mainStartup = createStartupScreenState([todayBall], "2026-07-03", "main");
assert(mainStartup.startupScreen === "main", "startup should preserve the configured main screen");

const dayListStartup = createStartupScreenState([todayBall], "2026-07-03", "calendarDayList");
assert(dayListStartup.startupScreen === "calendarDayList", "startup should preserve the configured day-list screen");

function createBall(id: string, date: string, lifecycleStatus: HappyBall["lifecycleStatus"]): HappyBall {
  return {
    id,
    date,
    subject: "エモ次郎",
    issuerType: "self",
    issuedBy: "エモ次郎",
    enteredBy: "エモ次郎",
    approvedBy: null,
    keepers: ["エモ次郎"],
    viewers: [],
    count: 1,
    title: id,
    category: "日常",
    note: "",
    visibility: "open",
    visual: {
      hue: 40,
      saturation: 50,
      lightness: 50,
      kind: "filled",
      label: "今日",
    },
    lifecycleStatus,
    createdAt: "2026-07-03T10:00:00.000Z",
    updatedAt: "2026-07-03T10:00:00.000Z",
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
