import type { CategoryColorPreset } from "./categories.js";
import type { HappyBall, HappyBallEmotionSnapshot, HappyBallVisual } from "./models.js";

export type DisplayVisual = Pick<HappyBallVisual, "hue" | "saturation" | "lightness" | "kind">;

export function findDisplayCategoryPreset(
  category: string,
  categories: readonly CategoryColorPreset[],
): CategoryColorPreset | undefined {
  return categories.find((preset) => preset.name === category);
}

export function resolveDisplayVisual(
  category: string,
  storedVisual: HappyBallVisual,
  categories: readonly CategoryColorPreset[],
): DisplayVisual {
  const preset = findDisplayCategoryPreset(category, categories);
  if (!preset) {
    return {
      hue: storedVisual.hue,
      saturation: storedVisual.saturation,
      lightness: storedVisual.lightness,
      kind: storedVisual.kind,
    };
  }
  return {
    hue: preset.hue,
    saturation: preset.saturation,
    lightness: preset.lightness,
    kind: preset.visualKind,
  };
}

export function resolveBallDisplayVisual(
  ball: Pick<HappyBall, "category" | "visual" | "provenance">,
  categories: readonly CategoryColorPreset[],
): DisplayVisual {
  if (ball.provenance?.preserveVisualSnapshot) {
    return {
      hue: ball.visual.hue,
      saturation: ball.visual.saturation,
      lightness: ball.visual.lightness,
      kind: ball.visual.kind,
    };
  }
  return resolveDisplayVisual(ball.category, ball.visual, categories);
}

export function resolveEchoDisplayVisual(
  echo: Pick<HappyBallEmotionSnapshot, "category" | "visual">,
  categories: readonly CategoryColorPreset[],
): DisplayVisual {
  return resolveDisplayVisual(echo.category, echo.visual, categories);
}

export function renderDisplayVisualStyle(visual: Pick<DisplayVisual, "hue" | "saturation" | "lightness">): string {
  return `--ball-hue: ${visual.hue}; --ball-saturation: ${visual.saturation}%; --ball-lightness: ${visual.lightness}%;`;
}

export function renderEchoVisualStyle(visual: Pick<DisplayVisual, "hue" | "saturation" | "lightness">): string {
  return `--echo-hue: ${visual.hue}; --echo-saturation: ${visual.saturation}%; --echo-lightness: ${visual.lightness}%;`;
}

export function renderDisplayVisualKindClass(visual: { kind?: string; visualKind?: string }): string {
  return visual.kind === "ring" || visual.visualKind === "ring" ? "is-ring-ball" : "is-filled-ball";
}
