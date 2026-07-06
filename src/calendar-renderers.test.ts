import { renderCalendarOverlay } from "./calendar-renderers.js";
import type { HappyBall } from "./models.js";

const sampleBall: HappyBall = {
  id: "ball_20260703_sample",
  date: "2026-07-03",
  time: "09:35",
  subject: "エモ次郎",
  issuerType: "self",
  issuedBy: "エモ次郎",
  enteredBy: "エモ次郎",
  approvedBy: null,
  keepers: ["エモ次郎"],
  viewers: [],
  count: 1,
  title: "今日のえもい玉",
  category: "日常",
  note: "朝に少し進めた。午後に続きを見る。",
  visibility: "open",
  visual: {
    hue: 40,
    saturation: 50,
    lightness: 50,
    kind: "filled",
    label: "今日",
  },
  emotionEcho: {
    recordedAt: "2026-07-03T09:00:00.000Z",
    date: "2026-07-03",
    subject: "エモ次郎",
    issuerType: "self",
    count: 1,
    title: "朝のひらめき",
    category: "ひらめき",
    note: "余韻メモ",
    visibility: "open",
    visual: {
      hue: 52,
      saturation: 48,
      lightness: 62,
      kind: "filled",
      label: "ひらめき",
    },
  },
  lifecycleStatus: "active",
  createdAt: "2026-07-03T10:00:00.000Z",
  updatedAt: "2026-07-03T10:00:00.000Z",
};

const offeredBall: HappyBall = {
  ...sampleBall,
  id: "ball_20260703_offered",
  title: "供養した玉",
  note: "",
  lifecycleStatus: "offered",
};

const archivedBall: HappyBall = {
  ...sampleBall,
  id: "ball_20260703_archived",
  time: undefined,
  title: "しまった玉",
  note: "終わった予定の記録。",
  lifecycleStatus: "archived",
};

const monthHtml = renderCalendarOverlay({
  balls: [sampleBall],
  dayListBalls: [],
  calendarMonth: "2026-07",
  calendarMode: "month",
  displayMode: "day",
  selectedDate: "2026-07-03",
  selectedBallId: sampleBall.id,
  emotionEchoStrength: "medium",
});

assert(monthHtml.includes('data-filter-date="2026-07-03"'), "month view should render tappable day cells");
assert(monthHtml.includes("calendar-head calendar-month-head"), "month view should use the centered month header class");
assert(monthHtml.includes('data-calendar-open-panel="create"'), "calendar toolbar should render the create action");
assert(monthHtml.includes('data-calendar-main'), "calendar toolbar should render the main-screen ball action");
assert(monthHtml.includes('data-calendar-open-panel="calendar"'), "calendar toolbar should render the calendar action");
assert(monthHtml.includes('data-calendar-open-panel="dayList"'), "calendar toolbar should render the day-list action");
assert(monthHtml.includes("primary-screen-control-group"), "calendar toolbar should group the three primary screen actions");
assert(monthHtml.includes("calendar-screen-icon"), "calendar toolbar should render the calendar icon");
assert(monthHtml.includes("day-list-screen-icon"), "calendar toolbar should render the day-list icon");
assert(monthHtml.includes("data-calendar-cycle-display-mode"), "calendar toolbar should render a single period cycle action");
assert(monthHtml.includes("表示期間: 日。押すとメイン画面で週を表示"), "calendar toolbar should describe the next period mode");
assert(!monthHtml.includes("data-calendar-display-mode"), "calendar toolbar should not render the old three-button period group");
assert(monthHtml.includes('data-calendar-open-panel="settings"'), "calendar toolbar should render settings");
assert(!monthHtml.includes("data-close-panel"), "month view should not render a top close action");

const sevenBallMonthHtml = renderCalendarOverlay({
  balls: [{ ...sampleBall, id: "ball_20260707_seven", date: "2026-07-07", count: 7 }],
  dayListBalls: [],
  calendarMonth: "2026-07",
  calendarMode: "month",
  displayMode: "day",
  selectedDate: "2026-07-07",
  selectedBallId: null,
  emotionEchoStrength: "medium",
});

assert(
  /aria-label="2026-07-07(?: 本日)? 7玉"/.test(sevenBallMonthHtml),
  "calendar cells should keep the real marker total in the aria label",
);
assert(sevenBallMonthHtml.includes("calendar-marker-desktop"), "calendar cells should render desktop marker variants");
assert(sevenBallMonthHtml.includes("calendar-marker-mobile"), "calendar cells should render mobile marker variants");
assert(sevenBallMonthHtml.includes('<span class="calendar-overflow">7</span>'), "mobile markers should aggregate after six balls");

const fifteenBallMonthHtml = renderCalendarOverlay({
  balls: [{ ...sampleBall, id: "ball_20260705_fifteen", date: "2026-07-05", count: 15 }],
  dayListBalls: [],
  calendarMonth: "2026-07",
  calendarMode: "month",
  displayMode: "day",
  selectedDate: "2026-07-05",
  selectedBallId: null,
  emotionEchoStrength: "medium",
});

assert(
  countOccurrences(fifteenBallMonthHtml, "mini-ball lifecycle-active") === 15,
  "desktop markers should show up to fifteen mini balls",
);
assert(fifteenBallMonthHtml.includes('<span class="calendar-overflow">15</span>'), "mobile markers should aggregate fifteen balls");

const sixteenBallMonthHtml = renderCalendarOverlay({
  balls: [{ ...sampleBall, id: "ball_20260706_sixteen", date: "2026-07-06", count: 16 }],
  dayListBalls: [],
  calendarMonth: "2026-07",
  calendarMode: "month",
  displayMode: "day",
  selectedDate: "2026-07-06",
  selectedBallId: null,
  emotionEchoStrength: "medium",
});

assert(
  /aria-label="2026-07-06(?: 本日)? 16玉"/.test(sixteenBallMonthHtml),
  "calendar cells should keep the real overflow total in the aria label",
);
assert(!sixteenBallMonthHtml.includes("mini-ball lifecycle-active"), "desktop markers should aggregate after fifteen balls");
assert(countOccurrences(sixteenBallMonthHtml, '<span class="calendar-overflow">16</span>') === 2, "desktop and mobile markers should both aggregate sixteen balls");

const dayListHtml = renderCalendarOverlay({
  balls: [],
  dayListBalls: [
    {
      ...sampleBall,
      descents: [
        {
          id: "descent_1",
          sequence: 1,
          recordedAt: "2026-07-03T10:30:00.000Z",
          badgeAwarded: true,
          memo: "駅前で降臨",
        },
      ],
      descentBadgeCount: 1,
    },
    archivedBall,
    offeredBall,
  ],
  calendarMonth: "2026-07",
  calendarMode: "dayList",
  displayMode: "week",
  selectedDate: "2026-07-03",
  selectedBallId: sampleBall.id,
  emotionEchoStrength: "medium",
});

assert(dayListHtml.includes("<h2>2026-07-03</h2>"), "day list view should title only the selected date");
assert(!dayListHtml.includes("2026-07-03 の玉"), "day list view should not append no-tama to the title");
assert(dayListHtml.includes('data-calendar-shift-day="-1"'), "day list view should offer a previous-day action");
assert(dayListHtml.includes('data-calendar-shift-day="1"'), "day list view should offer a next-day action");
assert(!dayListHtml.includes('data-calendar-view="month"'), "day list view should not render the old month-back action");
assert(!dayListHtml.includes('data-close-panel'), "day list view should not render a top close action");
assert(!dayListHtml.includes("この日の玉"), "day list view should not render the redundant day heading");
assert(dayListHtml.includes("calendar-day-ball-visual"), "day list view should render compact ball visuals");
assert(dayListHtml.includes("calendar-day-descent-badge"), "day list view should render descent badges above compact ball visuals");
assert(dayListHtml.includes("✦1"), "day list view should show descent star count");
assert(dayListHtml.includes("今日のえもい玉"), "day list view should show selected-day balls");
assert(dayListHtml.includes("2026-07-03 09:35"), "day list view should show ball timestamps when recorded");
assert(dayListHtml.includes("しまった玉"), "day list view should show archived balls");
assert(dayListHtml.includes("2026-07-03"), "day list view should show ball dates even without recorded times");
assert(dayListHtml.includes("日常／ひらめき"), "day list view should show category and echo category");
assert(dayListHtml.includes("表示中"), "day list view should label active balls as displayed");
assert(dayListHtml.includes("朝に少し進めた。午後に続きを見る。"), "day list view should show memo snippets");
assert(dayListHtml.includes("calendar-day-ball-memo"), "day list memo should use the compact two-line memo class");
assert(dayListHtml.includes("供養した玉"), "day list view should include offered balls for daily management history");
assert(dayListHtml.includes("供養済み"), "day list view should label offered balls");
assert(dayListHtml.includes("しまい中"), "day list view should label archived balls");
assert(dayListHtml.includes("calendar-day-ball-item lifecycle-archived"), "day list view should apply the archived row class");
assert(dayListHtml.includes("メモなし"), "day list view should show a quiet empty memo placeholder");
assert(dayListHtml.includes('data-view-ball-id="ball_20260703_sample"'), "day list view should render content actions");
assert(dayListHtml.includes('data-edit-ball-id="ball_20260703_sample"'), "day list view should render edit actions");
assert(dayListHtml.includes('data-lifecycle-status="archived"'), "day list view should render shimau actions");
assert(dayListHtml.includes('data-lifecycle-status="active"'), "day list view should render restore actions");
assert(dayListHtml.includes('data-lifecycle-status="offered"'), "day list view should render kuyoh actions");
assert(dayListHtml.includes('data-delete-ball-id="ball_20260703_sample"'), "day list view should render otakiage actions");
assert(!dayListHtml.includes("data-copy-ball-url-id"), "day list view should omit URL actions");
assert(!dayListHtml.includes("data-copy-ball-line-url-id"), "day list view should omit LINE actions");
assert(!dayListHtml.includes("data-descend-ball-id"), "day list view should omit kourin actions");
assert(!dayListHtml.includes("data-clear-ledger-list-date"), "calendar day list should not render the saved-list all-balls control");
assert(dayListHtml.includes("表示期間: 週。押すとメイン画面で月を表示"), "day list toolbar should keep the current period on the cycle button");

const offeredOnlyHtml = renderCalendarOverlay({
  balls: [],
  dayListBalls: [offeredBall],
  calendarMonth: "2026-07",
  calendarMode: "dayList",
  displayMode: "day",
  selectedDate: "2026-07-03",
  selectedBallId: offeredBall.id,
  emotionEchoStrength: "medium",
});

assert(offeredOnlyHtml.includes('data-view-ball-id="ball_20260703_offered"'), "offered day-list balls should keep content actions");
assert(offeredOnlyHtml.includes('data-edit-ball-id="ball_20260703_offered"'), "offered day-list balls should keep edit actions");
assert(offeredOnlyHtml.includes('data-delete-ball-id="ball_20260703_offered"'), "offered day-list balls should keep otakiage actions");
assert(!offeredOnlyHtml.includes('data-lifecycle-status="archived"'), "offered day-list balls should not render shimau actions");
assert(!offeredOnlyHtml.includes('data-lifecycle-status="active"'), "offered day-list balls should not render restore actions");
assert(!offeredOnlyHtml.includes('data-lifecycle-status="offered"'), "offered day-list balls should not render kuyoh actions");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function countOccurrences(value: string, pattern: string): number {
  return value.split(pattern).length - 1;
}
