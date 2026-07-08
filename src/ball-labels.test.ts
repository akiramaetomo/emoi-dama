import {
  createBallDisplayLabel,
  nextBallLabelMode,
  renderBallLabelModeCycleAriaLabel,
  renderNextBallLabelModeIcon,
} from "./ball-labels.js";
import type { HappyBall } from "./models.js";

const sampleBall: HappyBall = {
  id: "ball_label_sample",
  date: "2026-07-09",
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
  note: "",
  visibility: "open",
  visual: {
    hue: 40,
    saturation: 50,
    lightness: 50,
    kind: "filled",
    label: "今日",
  },
  lifecycleStatus: "active",
  createdAt: "2026-07-09T10:00:00.000Z",
  updatedAt: "2026-07-09T10:00:00.000Z",
};

assertEqual(nextBallLabelMode("none"), "date", "none should cycle to date");
assertEqual(nextBallLabelMode("date"), "title", "date should cycle to title");
assertEqual(nextBallLabelMode("title"), "name", "title should cycle to name");
assertEqual(nextBallLabelMode("name"), "none", "name should cycle back to none");

assertEqual(createBallDisplayLabel(sampleBall, "date"), "7/9", "date label should use month/day");
assertEqual(createBallDisplayLabel(sampleBall, "name"), "エモ次郎", "name label should use subject");
assertEqual(createBallDisplayLabel({ ...sampleBall, subject: "", issuedBy: "発行者" }, "name"), "発行者", "name label should fall back to issuer");

assert(renderNextBallLabelModeIcon("none").includes("ball-label-mode-icon-date"), "none mode button should show next date icon");
assert(renderNextBallLabelModeIcon("date").includes("ball-label-mode-icon-title"), "date mode button should show next title icon");
assert(renderNextBallLabelModeIcon("title").includes("ball-label-mode-icon-name"), "title mode button should show next name icon");
assert(renderNextBallLabelModeIcon("name").includes("ball-label-mode-icon-none"), "name mode button should show next none icon");
assert(renderNextBallLabelModeIcon("none").includes(">day<"), "date icon should show day text on the ball");
assert(renderNextBallLabelModeIcon("date").includes(">title<"), "title icon should show title text on the ball");
assert(renderNextBallLabelModeIcon("title").includes(">name<"), "name icon should show name text on the ball");
assert(!renderNextBallLabelModeIcon("name").includes("無印"), "none icon should stay unmarked");
assert(
  renderBallLabelModeCycleAriaLabel("title").includes("現在は題。押すと名前に切り替え"),
  "aria label should describe current and next label mode",
);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
