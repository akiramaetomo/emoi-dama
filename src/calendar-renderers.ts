import type { HappyBall } from "./models";
import type { EmotionEchoStrength } from "./settings";

export interface CalendarRenderContext {
  balls: HappyBall[];
  calendarMonth: string;
  selectedDate: string;
  emotionEchoStrength: EmotionEchoStrength;
}

export function renderCalendarOverlay(context: CalendarRenderContext): string {
  const [year, month] = context.calendarMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const offset = firstDay.getDay();
  const today = getLocalIsoDate();
  const cells: string[] = [];

  for (let i = 0; i < offset; i += 1) {
    cells.push(`<div class="calendar-cell is-empty" aria-hidden="true"></div>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${context.calendarMonth}-${String(day).padStart(2, "0")}`;
    const balls = context.balls.filter((ball) => ball.date === date);
    const total = countVisualBalls(balls);
    const selectedClass = context.selectedDate === date ? " is-selected" : "";
    const todayClass = today === date ? " is-today" : "";
    const todayLabel = today === date ? " 本日" : "";
    cells.push(`
      <button class="calendar-cell${selectedClass}${todayClass}" type="button" data-filter-date="${date}" aria-label="${date}${todayLabel} ${total}玉">
        <span class="calendar-day">${day}</span>
        ${renderCalendarMarkers(balls, context.emotionEchoStrength)}
      </button>
    `);
  }

  return `
    <section class="calendar-overlay" aria-label="カレンダー">
      <div class="calendar-head">
        <button class="calendar-nav" type="button" data-calendar-month="${escapeAttribute(shiftCalendarMonth(context.calendarMonth, -1))}" aria-label="前の月">‹</button>
        <h2>${year}年 ${month}月</h2>
        <button class="calendar-nav" type="button" data-calendar-month="${escapeAttribute(shiftCalendarMonth(context.calendarMonth, 1))}" aria-label="次の月">›</button>
        <button class="dialog-close" type="button" data-close-panel aria-label="閉じる">&times;</button>
      </div>
      <div class="calendar-weekdays" aria-hidden="true">
        <span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span>
      </div>
      <div class="calendar-grid">
        ${cells.join("")}
      </div>
    </section>
  `;
}

function renderCalendarMarkers(balls: HappyBall[], emotionEchoStrength: EmotionEchoStrength): string {
  const total = countVisualBalls(balls);
  if (total === 0) {
    return `<span class="mini-ball-row" aria-hidden="true"></span>`;
  }

  if (total > 6) {
    return `<span class="calendar-overflow">${total}</span>`;
  }

  const markers = balls.flatMap((ball) => (
    Array.from({ length: Math.max(1, Math.min(ball.count, 6)) }, () => ball)
  )).slice(0, 6);
  return `
    <span class="mini-ball-row" aria-hidden="true">
      ${markers.map((ball) => `<span class="mini-ball ${renderVisualKindClass(ball.visual)} ${renderEchoClass(ball, emotionEchoStrength)}" style="${renderBallVisualStyle(ball, emotionEchoStrength)}"></span>`).join("")}
    </span>
  `;
}

function shiftCalendarMonth(calendarMonth: string, delta: number): string {
  const [year, month] = calendarMonth.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function getLocalIsoDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function countVisualBalls(balls: HappyBall[]): number {
  return balls.reduce((sum, ball) => sum + Math.max(1, Math.min(ball.count, 12)), 0);
}

function renderBallVisualStyle(ball: HappyBall, emotionEchoStrength: EmotionEchoStrength): string {
  const base = renderVisualStyle(ball.visual);
  const echo = shouldShowEmotionEcho(ball, emotionEchoStrength) ? ball.emotionEcho?.visual : null;
  if (!echo) {
    return base;
  }
  return `${base} --echo-hue: ${echo.hue}; --echo-saturation: ${echo.saturation}%; --echo-lightness: ${echo.lightness}%;`;
}

function renderVisualStyle(visual: { hue: number; saturation: number; lightness: number }): string {
  return `--ball-hue: ${visual.hue}; --ball-saturation: ${visual.saturation}%; --ball-lightness: ${visual.lightness}%;`;
}

function renderVisualKindClass(visual: { kind?: string }): string {
  return visual.kind === "ring" ? "is-ring-ball" : "is-filled-ball";
}

function renderEchoClass(ball: HappyBall, emotionEchoStrength: EmotionEchoStrength): string {
  return shouldShowEmotionEcho(ball, emotionEchoStrength) ? `has-echo echo-${emotionEchoStrength}` : "";
}

function shouldShowEmotionEcho(ball: HappyBall, emotionEchoStrength: EmotionEchoStrength): boolean {
  return Boolean(ball.emotionEcho) && emotionEchoStrength !== "off";
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
