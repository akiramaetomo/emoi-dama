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
  calendarMarkerMode: "spread",
  activityLog: [],
});

assert(monthHtml.includes('data-filter-date="2026-07-03"'), "month view should render tappable day cells");
assert(monthHtml.includes("calendar-head calendar-month-head"), "month view should use the centered month header class");
assert(monthHtml.includes('data-calendar-open-panel="create"'), "calendar toolbar should render the create action");
assert(monthHtml.includes('data-calendar-main'), "calendar toolbar should render the main-screen ball action");
assert(monthHtml.includes('data-calendar-open-panel="calendar"'), "calendar toolbar should render the calendar action");
assert(monthHtml.includes('data-calendar-open-panel="dayList"'), "calendar toolbar should render the day-list action");
assert(monthHtml.includes("primary-screen-control-group"), "calendar toolbar should group the three primary screen actions");
assert(monthHtml.includes("calendar-screen-icon"), "calendar toolbar should render the calendar icon");
assert(monthHtml.includes("calendar-icon-bar"), "calendar toolbar should render the calendar icon bar");
assert(monthHtml.includes('x1="12.75" y1="8" x2="19.25" y2="8"'), "calendar icon bar should be short and near the top");
assert(monthHtml.includes("day-list-screen-icon"), "calendar toolbar should render the day-list icon");
assert(monthHtml.includes('<p class="screen-kicker">Calendar</p>'), "month view should show the Calendar screen name above the month");
assert(!monthHtml.includes("primary-screen-label"), "calendar toolbar should not put screen names inside buttons");
assert(!monthHtml.includes("data-calendar-cycle-display-mode"), "calendar toolbar should not render the period cycle action");
assert(monthHtml.includes("data-calendar-cycle-marker-mode"), "calendar toolbar should render the calendar marker mode action");
assert(monthHtml.includes("data-calendar-primary-body data-scroll-owner"), "calendar should expose one explicit internal scroll owner");
assert(countOccurrences(monthHtml, "aria-current=\"page\"") === 1, "calendar should have exactly one semantic current navigation item");
assert(monthHtml.includes("通常表示"), "calendar month view should show the current marker mode above the controls");
assert(monthHtml.includes("玉表示: 通常。押すとメーターに切り替え"), "calendar marker mode action should describe the next marker mode");
assert(monthHtml.includes("marker-mode-icon-meter"), "spread mode should offer the meter icon as the next marker mode");
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
  calendarMarkerMode: "spread",
  activityLog: [],
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
  calendarMarkerMode: "spread",
  activityLog: [],
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
  calendarMarkerMode: "spread",
  activityLog: [],
});

assert(
  /aria-label="2026-07-06(?: 本日)? 16玉"/.test(sixteenBallMonthHtml),
  "calendar cells should keep the real overflow total in the aria label",
);
assert(!sixteenBallMonthHtml.includes("mini-ball lifecycle-active"), "desktop markers should aggregate after fifteen balls");
assert(countOccurrences(sixteenBallMonthHtml, '<span class="calendar-overflow">16</span>') === 2, "desktop and mobile markers should both aggregate sixteen balls");

const meterMonthHtml = renderCalendarOverlay({
  balls: [
    { ...sampleBall, id: "ball_20260708_late_hidden", date: "2026-07-08", count: 2, createdAt: "2026-07-08T13:00:00.000Z" },
    { ...sampleBall, id: "ball_20260708_second", date: "2026-07-08", count: 6, createdAt: "2026-07-08T10:00:00.000Z" },
    { ...sampleBall, id: "ball_20260708_first", date: "2026-07-08", count: 4, createdAt: "2026-07-08T09:00:00.000Z" },
    { ...sampleBall, id: "ball_20260708_third", date: "2026-07-08", count: 3, createdAt: "2026-07-08T11:00:00.000Z" },
  ],
  dayListBalls: [],
  calendarMonth: "2026-07",
  calendarMode: "month",
  displayMode: "day",
  selectedDate: "2026-07-08",
  selectedBallId: null,
  emotionEchoStrength: "medium",
  calendarMarkerMode: "meter",
  activityLog: [],
});

assert(meterMonthHtml.includes("calendar-meter-marker-set"), "meter mode should render meter marker sets");
assert(meterMonthHtml.includes("玉表示: メーター。押すと通常に切り替え"), "meter mode action should describe switching back");
assert(meterMonthHtml.includes("marker-mode-icon-spread"), "meter mode should offer the spread icon as the next marker mode");
assert(
  /aria-label="2026-07-08(?: 本日)? 15玉"/.test(meterMonthHtml),
  "meter mode calendar cells should keep the real total in the aria label",
);
assert(
  meterMonthHtml.indexOf('data-calendar-meter-ball-id="ball_20260708_first"')
    < meterMonthHtml.indexOf('data-calendar-meter-ball-id="ball_20260708_second"')
    && meterMonthHtml.indexOf('data-calendar-meter-ball-id="ball_20260708_second"')
    < meterMonthHtml.indexOf('data-calendar-meter-ball-id="ball_20260708_third"'),
  "meter rows should use created-at order, not input order",
);
assert(!meterMonthHtml.includes('data-calendar-meter-ball-id="ball_20260708_late_hidden"'), "meter mode should hide the fourth record row");
assert(countOccurrences(meterMonthHtml, 'data-calendar-meter-ball-id="ball_20260708_first"') === 2, "desktop and mobile meter variants should both render the first row");
assert(countOccurrences(meterMonthHtml, '<span class="calendar-meter-count">6</span>') === 2, "six-count rows should aggregate as one ball plus count in both variants");
assert(countOccurrences(meterMonthHtml, '<span class="calendar-meter-count">3</span>') === 1, "mobile meter variant should aggregate counts over two balls");
assert(countOccurrences(meterMonthHtml, '<span class="calendar-meter-overflow">+2</span>') === 2, "hidden fourth-row balls should be summarized in both variants");

const dayListHtml = renderCalendarOverlay({
  balls: [],
  dayListBalls: [
    {
      ...sampleBall,
      count: 3,
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
  calendarMarkerMode: "spread",
  activityLog: [
    {
      id: "activity_1",
      recordedAt: "2026-07-03T11:00:00.000Z",
      action: "send-url",
      status: "success",
      ballId: sampleBall.id,
      title: sampleBall.title,
      issuedBy: sampleBall.issuedBy,
      sendMode: "casual",
    },
  ],
});

assert(dayListHtml.includes('<p class="screen-kicker">Ball List</p>'), "day list view should show the Ball List screen name above the selected date");
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
assert(dayListHtml.includes("発行者: エモ次郎"), "day list view should show the issuer");
assert(dayListHtml.includes("送り手段: お配り"), "day list view should show the latest send method");
assert(dayListHtml.includes("朝に少し進めた。午後に続きを見る。"), "day list view should show memo snippets");
assert(dayListHtml.includes("calendar-day-ball-memo"), "day list memo should use the compact two-line memo class");
assert(dayListHtml.includes(">中身</button>"), "day list should name the detail action as ball contents");
assert(!dayListHtml.includes(">内容</button>"), "day list should remove the old detail action name");
assert(dayListHtml.includes("calendar-day-count-under-icon"), "day list view should show multi-ball counts below the ball icon");
assert(dayListHtml.includes("3玉"), "day list view should show multi-ball counts only when needed");
assert(!dayListHtml.includes("calendar-day-count-badge"), "day list view should not show the old title-row count badge");
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
assert(!dayListHtml.includes("data-calendar-cycle-display-mode"), "day list toolbar should not render the period cycle action");
assert(dayListHtml.includes("data-calendar-cycle-marker-mode") && dayListHtml.includes("data-calendar-cycle-marker-mode aria-label=\"玉表示: 通常。押すとメーターに切り替え\" hidden"), "day list should retain but hide the persistent calendar marker action");
assert(dayListHtml.includes("aria-current=\"page\""), "day list should expose exactly one semantic current navigation item");
assert(countOccurrences(dayListHtml, "aria-current=\"page\"") === 1, "day list should have exactly one semantic current navigation item");

const offeredOnlyHtml = renderCalendarOverlay({
  balls: [],
  dayListBalls: [offeredBall],
  calendarMonth: "2026-07",
  calendarMode: "dayList",
  displayMode: "day",
  selectedDate: "2026-07-03",
  selectedBallId: offeredBall.id,
  emotionEchoStrength: "medium",
  calendarMarkerMode: "spread",
  activityLog: [],
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
