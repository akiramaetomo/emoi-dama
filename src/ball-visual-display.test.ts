import { categoryColorPresets } from "./categories.js";
import {
  renderDisplayVisualKindClass,
  renderDisplayVisualStyle,
  renderEchoVisualStyle,
  resolveBallDisplayVisual,
  resolveDisplayVisual,
  resolveEchoDisplayVisual,
} from "./ball-visual-display.js";
import type { HappyBall } from "./models.js";

const storedVisual = {
  hue: 12,
  saturation: 34,
  lightness: 56,
  kind: "ring" as const,
  label: "旧配色",
};

const before = JSON.stringify(storedVisual);
const current = resolveDisplayVisual("日常", storedVisual, categoryColorPresets);
const dailyPreset = categoryColorPresets.find((preset) => preset.name === "日常");

assert(dailyPreset, "日常 preset should exist");
assert(current.hue === dailyPreset.hue, "known category should use current hue");
assert(current.saturation === dailyPreset.saturation, "known category should use current saturation");
assert(current.lightness === dailyPreset.lightness, "known category should use current lightness");
assert(current.kind === dailyPreset.visualKind, "known category should use current visual kind");
assert(JSON.stringify(storedVisual) === before, "display resolution should not mutate the stored snapshot");

const unknown = resolveDisplayVisual("廃止済みカテゴリ", storedVisual, categoryColorPresets);
assert(unknown.hue === storedVisual.hue, "unknown category should preserve stored hue");
assert(unknown.saturation === storedVisual.saturation, "unknown category should preserve stored saturation");
assert(unknown.lightness === storedVisual.lightness, "unknown category should preserve stored lightness");
assert(unknown.kind === storedVisual.kind, "unknown category should preserve stored kind");

const ball = {
  category: "よろこび",
  visual: storedVisual,
  emotionEcho: {
    category: "先々・期待",
    visual: { ...storedVisual, kind: "filled" as const },
  },
} as Pick<HappyBall, "category" | "visual" | "emotionEcho">;
const ballVisual = resolveBallDisplayVisual(ball, categoryColorPresets);
const echoVisual = resolveEchoDisplayVisual(ball.emotionEcho!, categoryColorPresets);
assert(ballVisual.hue === 0 && ballVisual.saturation === 70, "ball resolver should use current category color");
assert(echoVisual.hue === 41 && echoVisual.kind === "ring", "echo resolver should use current echo category color and kind");
assert(renderDisplayVisualStyle(ballVisual).includes("--ball-hue: 0;"), "base style should expose resolved CSS variables");
assert(renderEchoVisualStyle(echoVisual).includes("--echo-hue: 41;"), "echo style should expose resolved CSS variables");
assert(renderDisplayVisualKindClass(echoVisual) === "is-ring-ball", "kind helper should render the ring class");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
