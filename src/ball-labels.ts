import { createVisibilitySafeTitleLabel } from "./dialog-renderers.js";
import type { HappyBall } from "./models";
import type { BallLabelMode } from "./settings";

export function nextBallLabelMode(mode: BallLabelMode): BallLabelMode {
  if (mode === "none") {
    return "date";
  }
  if (mode === "date") {
    return "title";
  }
  if (mode === "title") {
    return "name";
  }
  return "none";
}

export function renderBallLabelModeName(mode: BallLabelMode): string {
  if (mode === "date") {
    return "日付";
  }
  if (mode === "title") {
    return "題";
  }
  if (mode === "name") {
    return "名前";
  }
  return "なし";
}

export function renderBallLabelModeCycleAriaLabel(mode: BallLabelMode): string {
  return `玉の文字表示: 現在は${renderBallLabelModeName(mode)}。押すと${renderBallLabelModeName(nextBallLabelMode(mode))}に切り替え`;
}

export function createBallDisplayLabel(ball: HappyBall, mode: BallLabelMode): string {
  if (mode === "date") {
    return formatBallDateLabel(ball.date);
  }
  if (mode === "title") {
    return createVisibilitySafeTitleLabel(ball);
  }
  if (mode === "name") {
    return ball.subject.trim() || ball.issuedBy.trim() || "";
  }
  return "";
}

export function renderNextBallLabelModeIcon(mode: BallLabelMode): string {
  const nextMode = nextBallLabelMode(mode);
  const iconLabel = renderBallLabelModeIconText(nextMode);
  return `<span class="calendar-main-ball-icon ball-label-mode-icon ball-label-mode-icon-${nextMode}" aria-hidden="true">${iconLabel ? `<span>${iconLabel}</span>` : ""}</span>`;
}

function formatBallDateLabel(date: string): string {
  const [, month, day] = date.split("-");
  return month && day ? `${Number(month)}/${Number(day)}` : date;
}

function renderBallLabelModeIconText(mode: BallLabelMode): string {
  if (mode === "date") {
    return "day";
  }
  if (mode === "title") {
    return "title";
  }
  if (mode === "name") {
    return "name";
  }
  return "";
}
