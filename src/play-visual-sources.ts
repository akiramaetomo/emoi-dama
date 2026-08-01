import { createBallDisplayLabel } from "./ball-labels.js";
import {
  findDisplayCategoryPreset,
  resolveBallDisplayVisual,
  resolveEchoDisplayVisual,
} from "./ball-visual-display.js";
import type { PhysicsBallSnapshot, VisualBallSource } from "./ball-stage-renderer.js";
import type { CategoryColorPreset } from "./categories.js";
import type { HappyBall } from "./models.js";
import { sortNewestFirst } from "./play-population.js";
import { resolveMotionClass } from "./play-physics-classification.js";
import type { BallLabelMode, EmotionEchoStrength } from "./settings.js";

export function planPlayVisualSources(
  balls: readonly HappyBall[],
  categories: readonly CategoryColorPreset[],
  labelMode: BallLabelMode,
  radius: number,
  emotionEchoStrength: EmotionEchoStrength,
  snapshots: ReadonlyMap<string, PhysicsBallSnapshot>,
): VisualBallSource[] {
  return sortNewestFirst(balls).flatMap((ball) => {
    const count = Math.max(1, Math.min(ball.count, 200));
    return Array.from({ length: count }, (_, index) => {
      const label = createBallDisplayLabel(ball, labelMode);
      const baseInstanceId = `${ball.id}_${index}`;
      const visual = resolveBallDisplayVisual(ball, categories);
      const category = findDisplayCategoryPreset(ball.category, categories);
      const motionClass = resolveMotionClass(
        category?.tone ?? (visual.kind === "ring" ? "future" : "neutral"),
        visual.kind,
      );
      return {
        id: baseInstanceId,
        ballId: ball.id,
        fragmentIndex: index,
        baseInstanceId,
        fragmentGeneration: 0,
        fragmentOrdinal: 0,
        radius,
        motionClass,
        hue: visual.hue,
        saturation: visual.saturation,
        lightness: visual.lightness,
        visualKind: visual.kind,
        lifecycleStatus: ball.lifecycleStatus,
        descentBadgeCount: ball.descentBadgeCount ?? 0,
        isKamiBall: ball.isKamiBall === true,
        echo: shouldShowEmotionEcho(ball, emotionEchoStrength)
          ? resolveEchoDisplayVisual(ball.emotionEcho!, categories)
          : null,
        snapshot: snapshots.get(baseInstanceId) ?? null,
        label,
        labelClass: createBallLabelClass(label),
        title: ball.title,
      };
    });
  });
}

function createBallLabelClass(label: string): string {
  const length = Array.from(label).length;
  if (length <= 4) {
    return "label-short";
  }
  if (length <= 8) {
    return "label-medium";
  }
  if (length <= 16) {
    return "label-long";
  }
  return "label-xlong";
}

function shouldShowEmotionEcho(ball: HappyBall, emotionEchoStrength: EmotionEchoStrength): boolean {
  return ball.lifecycleStatus !== "archived"
    && Boolean(ball.emotionEcho)
    && emotionEchoStrength !== "off";
}
