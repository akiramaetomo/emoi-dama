export type DisplayMode = "day" | "week" | "month";

export interface DisplayDateRange {
  start: string;
  end: string;
}

export function getDisplayDateRange(mode: DisplayMode, anchorDate: string): DisplayDateRange {
  const date = parseIsoLocalDate(anchorDate);
  if (mode === "day") {
    return { start: anchorDate, end: anchorDate };
  }

  if (mode === "week") {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: formatIsoLocalDate(start), end: formatIsoLocalDate(end) };
  }

  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: formatIsoLocalDate(start), end: formatIsoLocalDate(end) };
}

export function shiftDisplayAnchor(mode: DisplayMode, anchorDate: string, delta: -1 | 1): string {
  const current = parseIsoLocalDate(anchorDate);
  if (mode === "day") {
    current.setDate(current.getDate() + delta);
  } else if (mode === "week") {
    current.setDate(current.getDate() + delta * 7);
  } else {
    const next = addMonthsClamped(current, delta);
    current.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
  }
  return formatIsoLocalDate(current);
}

function parseIsoLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatIsoLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addMonthsClamped(date: Date, delta: -1 | 1): Date {
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + delta;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return new Date(targetYear, targetMonth, Math.min(date.getDate(), lastDay));
}
