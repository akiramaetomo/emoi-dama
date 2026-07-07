import { getDisplayDateRange, getDisplayModeIconDotCount, moveDisplayAnchorToCalendarMonth, shiftDisplayAnchor } from "./display-period.js";

assertEqualRange(
  getDisplayDateRange("day", "2026-07-01"),
  { start: "2026-07-01", end: "2026-07-01" },
  "day mode should return the anchor date",
);

assertEqualRange(
  getDisplayDateRange("week", "2026-07-01"),
  { start: "2026-06-28", end: "2026-07-04" },
  "week mode should start on Sunday and end on Saturday",
);

assertEqualRange(
  getDisplayDateRange("month", "2026-02-14"),
  { start: "2026-02-01", end: "2026-02-28" },
  "month mode should cover the full calendar month",
);

assertEqual(
  getDisplayDateRange("month", "2024-02-14").end,
  "2024-02-29",
  "month mode should preserve leap-year February",
);

assertEqual(shiftDisplayAnchor("day", "2026-07-01", 1), "2026-07-02", "day mode should move one day");
assertEqual(shiftDisplayAnchor("week", "2026-07-01", -1), "2026-06-24", "week mode should move seven days");
assertEqual(
  shiftDisplayAnchor("month", "2026-01-31", 1),
  "2026-02-28",
  "month mode should clamp to the target month's last day",
);
assertEqual(
  shiftDisplayAnchor("month", "2024-03-31", -1),
  "2024-02-29",
  "month mode should clamp backward across leap-year February",
);
assertEqual(getDisplayModeIconDotCount("day"), 1, "day mode icon should render one square");
assertEqual(getDisplayModeIconDotCount("week"), 5, "week mode icon should render five dots");
assertEqual(getDisplayModeIconDotCount("month"), 20, "month mode icon should render a five-by-four grid");
assertEqual(
  moveDisplayAnchorToCalendarMonth("2026-05-15", "2026-09"),
  "2026-09-15",
  "calendar month movement should preserve the day number when possible",
);
assertEqual(
  moveDisplayAnchorToCalendarMonth("2026-05-31", "2026-09"),
  "2026-09-30",
  "calendar month movement should clamp to the target month's last day",
);

function assertEqualRange(
  actual: { start: string; end: string },
  expected: { start: string; end: string },
  message: string,
): void {
  assertEqual(actual.start, expected.start, `${message}: start`);
  assertEqual(actual.end, expected.end, `${message}: end`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
