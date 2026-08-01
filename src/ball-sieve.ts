import type { HappyBall, LifecycleStatus } from "./models.js";

export type BallSievePresetId = "usual" | "archived" | "offered" | "descent";

export type BallSieveCriterion =
  | { kind: "lifecycle"; values: readonly LifecycleStatus[] }
  | { kind: "descent"; present: true }
  | { kind: "category"; values: readonly string[] }
  | { kind: "subject"; values: readonly string[] };

export interface BallSieveSpec {
  id: BallSievePresetId;
  label: string;
  criteria: readonly BallSieveCriterion[];
  operator: "all" | "any";
}

export const DEFAULT_BALL_SIEVE_PRESET: BallSievePresetId = "usual";

export const BALL_SIEVE_PRESETS: Readonly<Record<BallSievePresetId, BallSieveSpec>> = {
  usual: {
    id: "usual",
    label: "いつもの玉",
    criteria: [{ kind: "lifecycle", values: ["active", "archived"] }],
    operator: "all",
  },
  archived: {
    id: "archived",
    label: "しまい中",
    criteria: [{ kind: "lifecycle", values: ["archived"] }],
    operator: "all",
  },
  offered: {
    id: "offered",
    label: "供養済み",
    criteria: [{ kind: "lifecycle", values: ["offered"] }],
    operator: "all",
  },
  descent: {
    id: "descent",
    label: "降臨",
    criteria: [{ kind: "descent", present: true }],
    operator: "all",
  },
};

export function isBallSievePresetId(value: unknown): value is BallSievePresetId {
  return value === "usual" || value === "archived" || value === "offered" || value === "descent";
}

export function getBallSieveSpec(presetId: BallSievePresetId): BallSieveSpec {
  return BALL_SIEVE_PRESETS[presetId];
}

export function getBallSieveLabel(presetId: BallSievePresetId): string {
  return getBallSieveSpec(presetId).label;
}

export function matchesBallSieve(ball: HappyBall, spec: BallSieveSpec): boolean {
  const results = spec.criteria.map((criterion) => matchesCriterion(ball, criterion));
  return spec.operator === "any" ? results.some(Boolean) : results.every(Boolean);
}

export function applyBallSieve(
  balls: readonly HappyBall[],
  presetOrSpec: BallSievePresetId | BallSieveSpec,
): HappyBall[] {
  const spec = typeof presetOrSpec === "string" ? getBallSieveSpec(presetOrSpec) : presetOrSpec;
  return balls.filter((ball) => matchesBallSieve(ball, spec));
}

export function renderBallSieveEmptyMessage(presetId: BallSievePresetId): string {
  if (presetId === "archived") {
    return "しまっている玉は、今はありません。";
  }
  if (presetId === "offered") {
    return "供養済みの玉は、今はありません。";
  }
  if (presetId === "descent") {
    return "降臨した玉は、今はありません。";
  }
  return "この日のえもい玉は、まだありません。";
}

function matchesCriterion(ball: HappyBall, criterion: BallSieveCriterion): boolean {
  if (criterion.kind === "lifecycle") {
    return criterion.values.includes(ball.lifecycleStatus);
  }
  if (criterion.kind === "descent") {
    return (ball.descents?.length ?? 0) > 0;
  }
  if (criterion.kind === "category") {
    return criterion.values.includes(ball.category);
  }
  return criterion.values.includes(ball.subject);
}
