import { formatBallDateTime, type HappyBall } from "./models.js";
import type { DisplayMode } from "./display-period";
import type { EmotionEchoStrength } from "./settings";

export type CalendarOverlayMode = "month" | "dayList";

const DESKTOP_MARKER_LIMIT = 15;
const MOBILE_MARKER_LIMIT = 6;

export interface CalendarRenderContext {
  balls: HappyBall[];
  dayListBalls: HappyBall[];
  calendarMonth: string;
  calendarMode: CalendarOverlayMode;
  displayMode: DisplayMode;
  selectedBallId: string | null;
  selectedDate: string;
  emotionEchoStrength: EmotionEchoStrength;
}

export function renderCalendarOverlay(context: CalendarRenderContext): string {
  return context.calendarMode === "dayList" ? renderCalendarDayList(context) : renderCalendarMonth(context);
}

function renderCalendarMonth(context: CalendarRenderContext): string {
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
      <div class="calendar-head calendar-month-head">
        <button class="calendar-nav" type="button" data-calendar-month="${escapeAttribute(shiftCalendarMonth(context.calendarMonth, -1))}" aria-label="前の月">‹</button>
        <h2>${year}年 ${month}月</h2>
        <button class="calendar-nav" type="button" data-calendar-month="${escapeAttribute(shiftCalendarMonth(context.calendarMonth, 1))}" aria-label="次の月">›</button>
      </div>
      <div class="calendar-weekdays" aria-hidden="true">
        <span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span>
      </div>
      <div class="calendar-grid">
        ${cells.join("")}
      </div>
      ${renderCalendarControlDock(context)}
    </section>
  `;
}

function renderCalendarDayList(context: CalendarRenderContext): string {
  return `
    <section class="calendar-overlay calendar-day-list-overlay" aria-label="${escapeAttribute(context.selectedDate)}">
      <div class="calendar-head calendar-day-list-head">
        <button class="calendar-nav" type="button" data-calendar-shift-day="-1" aria-label="前の日">‹</button>
        <h2>${escapeHtml(context.selectedDate)}</h2>
        <button class="calendar-nav" type="button" data-calendar-shift-day="1" aria-label="次の日">›</button>
      </div>
      <div class="calendar-day-list-body">
        ${renderCalendarDayListItems(context)}
      </div>
      ${renderCalendarControlDock(context)}
    </section>
  `;
}

function renderCalendarDayListItems(context: CalendarRenderContext): string {
  if (context.dayListBalls.length === 0) {
    return `<p class="empty-copy">この日の玉はまだありません。</p>`;
  }

  return `
    <div class="calendar-day-ball-list">
      ${context.dayListBalls.map((ball) => renderCalendarDayListItem(ball, context)).join("")}
    </div>
  `;
}

function renderCalendarDayListItem(ball: HappyBall, context: CalendarRenderContext): string {
  const selectedClass = ball.id === context.selectedBallId ? " is-selected" : "";
  return `
    <article class="calendar-day-ball-item lifecycle-${ball.lifecycleStatus}${selectedClass}">
      <span class="mini-ball calendar-day-ball-visual lifecycle-${ball.lifecycleStatus} ${renderVisualKindClass(ball.visual)} ${renderEchoClass(ball, context.emotionEchoStrength)}" style="${renderBallVisualStyle(ball, context.emotionEchoStrength)}" aria-hidden="true"></span>
      <div class="calendar-day-ball-main">
        <div class="calendar-day-ball-title-row">
          <strong>${escapeHtml(ball.title)}</strong>
          <span>${escapeHtml(renderCalendarBallMeta(ball))} / ${escapeHtml(renderLifecycleLabel(ball.lifecycleStatus))}</span>
        </div>
        <p class="calendar-day-ball-time">${escapeHtml(formatBallDateTime(ball.date, ball.time))}</p>
        <p class="calendar-day-ball-memo ${ball.note.trim() ? "" : "is-empty"}">${escapeHtml(ball.note.trim() || "メモなし")}</p>
      </div>
      <div class="calendar-day-ball-actions">
        <button class="share-ball" type="button" data-view-ball-id="${escapeAttribute(ball.id)}" aria-label="${escapeAttribute(ball.title)}の内容を見る">内容</button>
        <button class="edit-ball" type="button" data-edit-ball-id="${escapeAttribute(ball.id)}" aria-label="${escapeAttribute(ball.title)}を編集">編集</button>
        ${renderCalendarLifecycleActions(ball)}
        <button class="delete-ball" type="button" data-delete-ball-id="${escapeAttribute(ball.id)}" aria-label="${escapeAttribute(ball.title)}をお焚上">お焚上</button>
      </div>
    </article>
  `;
}

function renderCalendarLifecycleActions(ball: HappyBall): string {
  if (ball.lifecycleStatus === "offered") {
    return "";
  }
  if (ball.lifecycleStatus === "archived") {
    return `
      <button class="lifecycle-ball" type="button" data-lifecycle-ball-id="${escapeAttribute(ball.id)}" data-lifecycle-status="active" aria-label="${escapeAttribute(ball.title)}を通常表示に戻す">戻す</button>
      <button class="lifecycle-ball" type="button" data-lifecycle-ball-id="${escapeAttribute(ball.id)}" data-lifecycle-status="offered" aria-label="${escapeAttribute(ball.title)}を供養">供養</button>
    `;
  }
  return `
    <button class="lifecycle-ball" type="button" data-lifecycle-ball-id="${escapeAttribute(ball.id)}" data-lifecycle-status="archived" aria-label="${escapeAttribute(ball.title)}をしまう">しまう</button>
    <button class="lifecycle-ball" type="button" data-lifecycle-ball-id="${escapeAttribute(ball.id)}" data-lifecycle-status="offered" aria-label="${escapeAttribute(ball.title)}を供養">供養</button>
  `;
}

function renderLifecycleLabel(status: HappyBall["lifecycleStatus"]): string {
  if (status === "archived") {
    return "しまい中";
  }
  if (status === "offered") {
    return "供養済み";
  }
  if (status === "memorial") {
    return "記憶";
  }
  return "表示中";
}

function renderCalendarBallMeta(ball: HappyBall): string {
  if (!ball.emotionEcho) {
    return ball.category;
  }
  return `${ball.category}／${ball.emotionEcho.category}`;
}

function renderCalendarControlDock(context: CalendarRenderContext): string {
  return `
    <div class="calendar-control-dock">
      <div class="world-actions calendar-actions-bar" aria-label="カレンダー操作">
        <button class="dock-symbol-button dock-create-button" type="button" data-calendar-open-panel="create" aria-label="選択日に玉を作る">＋</button>
        <span class="primary-screen-control-group" aria-label="主要3画面">
          <button class="calendar-main-ball-button" type="button" data-calendar-main aria-label="メイン画面へ戻る">
            <span class="calendar-main-ball-icon" aria-hidden="true"></span>
          </button>
          <button class="calendar-screen-button ${context.calendarMode === "month" ? "is-primary-active" : ""}" type="button" data-calendar-open-panel="calendar" aria-label="カレンダー">
            ${renderCalendarScreenIcon()}
          </button>
          <button class="day-list-screen-button ${context.calendarMode === "dayList" ? "is-primary-active" : ""}" type="button" data-calendar-open-panel="dayList" aria-label="玉リスト">
            <span class="day-list-screen-icon" aria-hidden="true"></span>
          </button>
        </span>
        <button type="button" data-calendar-cycle-display-mode aria-label="${escapeAttribute(renderCalendarDisplayModeCycleAriaLabel(context.displayMode))}">${renderDisplayModeName(context.displayMode)}</button>
        <button class="dock-symbol-button dock-settings-button" type="button" data-calendar-open-panel="settings" aria-label="設定">⚙</button>
      </div>
    </div>
  `;
}

function renderCalendarDisplayModeCycleAriaLabel(mode: DisplayMode): string {
  return `表示期間: ${renderDisplayModeName(mode)}。押すとメイン画面で${renderDisplayModeName(nextDisplayMode(mode))}を表示`;
}

function renderCalendarScreenIcon(): string {
  return `
    <span class="calendar-screen-icon" aria-hidden="true">
      <svg viewBox="0 0 32 28" focusable="false">
        <rect class="calendar-icon-frame" x="2" y="2.5" width="28" height="24" rx="2.25"></rect>
        <circle class="calendar-icon-dot" cx="8.5" cy="13" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="13.5" cy="13" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="18.5" cy="13" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="23.5" cy="13" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="8.5" cy="17.25" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="13.5" cy="17.25" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="18.5" cy="17.25" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="23.5" cy="17.25" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="8.5" cy="21.5" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="13.5" cy="21.5" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="18.5" cy="21.5" r="1.45"></circle>
        <circle class="calendar-icon-dot" cx="23.5" cy="21.5" r="1.45"></circle>
      </svg>
    </span>
  `;
}

function renderDisplayModeName(mode: DisplayMode): string {
  if (mode === "day") {
    return "日";
  }
  if (mode === "week") {
    return "週";
  }
  return "月";
}

function nextDisplayMode(mode: DisplayMode): DisplayMode {
  if (mode === "day") {
    return "week";
  }
  if (mode === "week") {
    return "month";
  }
  return "day";
}

function renderCalendarMarkers(balls: HappyBall[], emotionEchoStrength: EmotionEchoStrength): string {
  const total = countVisualBalls(balls);
  if (total === 0) {
    return `<span class="mini-ball-row" aria-hidden="true"></span>`;
  }

  return `
    <span class="calendar-marker-set" aria-hidden="true">
      ${renderCalendarMarkerVariant(balls, total, DESKTOP_MARKER_LIMIT, "desktop", emotionEchoStrength)}
      ${renderCalendarMarkerVariant(balls, total, MOBILE_MARKER_LIMIT, "mobile", emotionEchoStrength)}
    </span>
  `;
}

function renderCalendarMarkerVariant(
  balls: HappyBall[],
  total: number,
  limit: number,
  variant: "desktop" | "mobile",
  emotionEchoStrength: EmotionEchoStrength,
): string {
  if (total > limit) {
    return `<span class="calendar-marker-variant calendar-marker-${variant}"><span class="calendar-overflow">${total}</span></span>`;
  }

  const markers = createCalendarMarkerBalls(balls, limit);
  return `
    <span class="mini-ball-row calendar-marker-variant calendar-marker-${variant}">
      ${markers.map((ball) => `<span class="mini-ball lifecycle-${ball.lifecycleStatus} ${renderVisualKindClass(ball.visual)} ${renderEchoClass(ball, emotionEchoStrength)}" style="${renderBallVisualStyle(ball, emotionEchoStrength)}"></span>`).join("")}
    </span>
  `;
}

function createCalendarMarkerBalls(balls: HappyBall[], limit: number): HappyBall[] {
  return balls.flatMap((ball) => (
    Array.from({ length: Math.max(1, Math.min(ball.count, limit)) }, () => ball)
  )).slice(0, limit);
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
  return balls.reduce((sum, ball) => sum + Math.max(1, Number.isFinite(ball.count) ? Math.floor(ball.count) : 1), 0);
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
  return ball.lifecycleStatus !== "archived" && Boolean(ball.emotionEcho) && emotionEchoStrength !== "off";
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
