import type { CategoryTone, CategoryVisualKind } from "./categories.js";

export type MotionClass = "dark" | "neutral" | "bright" | "ring";
export type PlayGravityMode = "free" | "fixed-down";
export type PlayInteractionMode = "grab" | "parent";
export type PlayFragmentationMode = "count-limit" | "fill";
export type PlayBuoyancyMode = "off" | "on";
export type PlayParentSplitMode = "off" | PlayFragmentationMode;

export interface MotionProfile {
  density: number;
  dampingMultiplier: number;
}

export interface FragmentationPlan {
  allowed: boolean;
  nextGeneration: number;
  nextGroupCount: number;
  nextTotalCount: number;
}

export interface BatchFragmentationGroup {
  generation: number;
  count: number;
}

export interface BatchFragmentationPlan {
  status: "allowed" | "blocked-limit" | "no-eligible";
  eligibleGroupIndexes: number[];
  nextTotalCount: number;
}

export interface FillRadiusInput {
  id: string;
  generation: number;
}

export interface RadiusTransition {
  from: number;
  to: number;
}

export const MAX_FRAGMENT_GENERATION = 5;
export const PARENT_DRAG_THRESHOLD_PX = 10;
export const PARENT_STOP_SPEED_PX_PER_SECOND = 24;
export const PARENT_STOP_HOLD_MS = 300;
export const PARENT_FADE_MS = 200;
export const FILL_VISIBLE_TARGET = 0.8;
export const FILL_PACKING_FACTOR = 0.72;
export const FILL_AREA_TARGET = FILL_VISIBLE_TARGET * FILL_PACKING_FACTOR;
export const FILL_RADIUS_TRANSITION_MS = 450;
export const MIN_FRAGMENT_RADIUS_PX = 2;
export const PARENT_PROFILE_LIMIT = 256;
export const CLASSIFICATION_RATIO_SLIDER = { min: -2, max: 2, step: 0.05 } as const;
export const CLASSIFICATION_BUOYANCY_RANGE = { min: 0, max: 1, step: 0.05 } as const;
export const CLASSIFICATION_AGITATION_DECAY_MS = 1200;
export const VIRTUAL_FLUID_DENSITY = 0.65;

const MOTION_EXPONENTS: Readonly<Record<MotionClass, number>> = {
  dark: 1,
  neutral: 0,
  bright: -1,
  ring: -2,
};

export function resolveMotionClass(tone: CategoryTone, visualKind: CategoryVisualKind): MotionClass {
  if (visualKind === "ring" || tone === "future") {
    return "ring";
  }
  return tone === "dark" ? "dark" : tone === "bright" ? "bright" : "neutral";
}

export function getMotionProfile(
  motionClass: MotionClass,
  densityRatio = 2,
  dampingRatio = 2,
): MotionProfile {
  const exponent = MOTION_EXPONENTS[motionClass];
  return {
    density: safeRatio(densityRatio) ** exponent,
    dampingMultiplier: safeRatio(dampingRatio) ** -exponent,
  };
}

export function getParentMotionProfile(densityRatio = 2, dampingRatio = 2): MotionProfile {
  return {
    density: clamp(safeRatio(densityRatio) ** 6, 1 / PARENT_PROFILE_LIMIT, PARENT_PROFILE_LIMIT),
    dampingMultiplier: clamp(safeRatio(dampingRatio) ** -6, 1 / PARENT_PROFILE_LIMIT, PARENT_PROFILE_LIMIT),
  };
}

export function resolveClassifiedDamping(
  globalDamping: number,
  motionClass: MotionClass,
  dampingRatio = 2,
): number {
  if (!Number.isFinite(globalDamping) || globalDamping <= 0) {
    return 0;
  }
  return globalDamping * getMotionProfile(motionClass, 1, dampingRatio).dampingMultiplier;
}

export function resolveParentDamping(globalDamping: number, dampingRatio = 2): number {
  if (!Number.isFinite(globalDamping) || globalDamping <= 0) {
    return 0;
  }
  return globalDamping * getParentMotionProfile(1, dampingRatio).dampingMultiplier;
}

export function resolveClassificationGravityScale(
  motionClass: MotionClass,
  densityRatio: number,
  buoyancyStrength: number,
  agitation: number,
): number {
  const density = getMotionProfile(motionClass, densityRatio, 1).density;
  const fluidScale = clamp(1 - VIRTUAL_FLUID_DENSITY / density, -1, 1);
  const blend = clamp(finiteOr(buoyancyStrength, 0), CLASSIFICATION_BUOYANCY_RANGE.min, CLASSIFICATION_BUOYANCY_RANGE.max)
    * clamp(finiteOr(agitation, 0), 0, 1);
  return 1 + (fluidScale - 1) * blend;
}

export interface ConfinedBallState {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  corrected: boolean;
}

export function confineBallToWorld(
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  radius: number,
  width: number,
  height: number,
  tolerance = 0.25,
  wallRestitution = 1,
): ConfinedBallState {
  const minX = radius;
  const maxX = Math.max(radius, width - radius);
  const minY = radius;
  const maxY = Math.max(radius, height - radius);
  const x = clamp(position.x, minX, maxX);
  const y = clamp(position.y, minY, maxY);
  const correctedX = position.x < minX - tolerance || position.x > maxX + tolerance;
  const correctedY = position.y < minY - tolerance || position.y > maxY + tolerance;
  const bounce = clamp(finiteOr(wallRestitution, 1), 0, 1);
  let nextVx = velocity.x;
  let nextVy = velocity.y;
  if (correctedX) {
    if (position.x < minX && velocity.x < 0) {
      nextVx = Math.abs(velocity.x) * bounce;
    } else if (position.x > maxX && velocity.x > 0) {
      nextVx = -Math.abs(velocity.x) * bounce;
    }
  }
  if (correctedY) {
    if (position.y < minY && velocity.y < 0) {
      nextVy = Math.abs(velocity.y) * bounce;
    } else if (position.y > maxY && velocity.y > 0) {
      nextVy = -Math.abs(velocity.y) * bounce;
    }
  }
  return {
    position: { x, y },
    velocity: { x: nextVx, y: nextVy },
    corrected: correctedX || correctedY,
  };
}

export interface SplitPairPlacement {
  first: { x: number; y: number };
  second: { x: number; y: number };
  axis: { x: number; y: number };
}

export function planSplitPairPlacement(
  center: { x: number; y: number },
  radius: number,
  width: number,
  height: number,
  preferredAngle: number,
): SplitPairPlacement {
  const clearance = radius + Math.max(0.35, radius * 0.03);
  const candidates = [
    { x: Math.cos(preferredAngle), y: Math.sin(preferredAngle) },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  let best: SplitPairPlacement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const axis of candidates) {
    const first = {
      x: clamp(center.x - axis.x * clearance, radius, width - radius),
      y: clamp(center.y - axis.y * clearance, radius, height - radius),
    };
    const second = {
      x: clamp(center.x + axis.x * clearance, radius, width - radius),
      y: clamp(center.y + axis.y * clearance, radius, height - radius),
    };
    const separation = Math.hypot(second.x - first.x, second.y - first.y);
    const overlap = Math.max(0, radius * 2 - separation);
    const displacement = Math.hypot((first.x + second.x) / 2 - center.x, (first.y + second.y) / 2 - center.y);
    const score = overlap * 1000 + displacement;
    if (score < bestScore) {
      bestScore = score;
      best = { first, second, axis };
    }
  }
  return best ?? { first: center, second: center, axis: { x: 1, y: 0 } };
}

export function classificationRatioToSlider(ratio: number): number {
  return Math.log2(safeRatio(ratio));
}

export function classificationSliderToRatio(sliderValue: number): number {
  return safeRatio(2 ** clamp(finiteOr(sliderValue, 0), CLASSIFICATION_RATIO_SLIDER.min, CLASSIFICATION_RATIO_SLIDER.max));
}

export function fragmentRadius(baseRadius: number, generation: number): number {
  const safeGeneration = Math.max(0, Math.min(MAX_FRAGMENT_GENERATION, Math.floor(generation)));
  return baseRadius / Math.sqrt(2 ** safeGeneration);
}

export function calculateFillRadii(
  width: number,
  height: number,
  baseRadius: number,
  balls: readonly FillRadiusInput[],
): Map<string, number> {
  const result = new Map<string, number>();
  if (balls.length === 0) {
    return result;
  }
  const safeWidth = Math.max(0, finiteOr(width, 0));
  const safeHeight = Math.max(0, finiteOr(height, 0));
  const safeBaseRadius = Math.max(MIN_FRAGMENT_RADIUS_PX, finiteOr(baseRadius, MIN_FRAGMENT_RADIUS_PX));
  const targetArea = safeWidth * safeHeight * FILL_AREA_TARGET;
  const baseRadii = balls.map((ball) => ({
    ...ball,
    radius: Math.max(MIN_FRAGMENT_RADIUS_PX, fragmentRadius(safeBaseRadius, ball.generation)),
  }));

  if (targetArea <= 0) {
    for (const ball of baseRadii) {
      result.set(ball.id, ball.radius);
    }
    return result;
  }

  const areaAtScale = (scale: number): number => baseRadii.reduce((sum, ball) => {
    const radius = clamp(ball.radius * scale, MIN_FRAGMENT_RADIUS_PX, safeBaseRadius);
    return sum + Math.PI * radius * radius;
  }, 0);

  const maxArea = areaAtScale(Number.POSITIVE_INFINITY);
  if (maxArea <= targetArea) {
    for (const ball of baseRadii) {
      result.set(ball.id, safeBaseRadius);
    }
    return result;
  }

  let low = 0;
  let high = 1;
  while (areaAtScale(high) < targetArea && high < 1024) {
    high *= 2;
  }
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const middle = (low + high) / 2;
    if (areaAtScale(middle) < targetArea) {
      low = middle;
    } else {
      high = middle;
    }
  }
  for (const ball of baseRadii) {
    result.set(ball.id, clamp(ball.radius * high, MIN_FRAGMENT_RADIUS_PX, safeBaseRadius));
  }
  return result;
}

export function interpolateRadiusByArea(from: number, to: number, progress: number): number {
  const clampedProgress = clamp(finiteOr(progress, 0), 0, 1);
  const fromSquared = Math.max(0, finiteOr(from, 0)) ** 2;
  const toSquared = Math.max(0, finiteOr(to, 0)) ** 2;
  return Math.sqrt(fromSquared + (toSquared - fromSquared) * clampedProgress);
}

export function createFragmentationPlan(
  currentGeneration: number,
  currentGroupCount: number,
  currentTotalCount: number,
  displayLimit: number,
): FragmentationPlan {
  const generation = Math.max(0, Math.floor(currentGeneration));
  const groupCount = Math.max(0, Math.floor(currentGroupCount));
  const totalCount = Math.max(0, Math.floor(currentTotalCount));
  const limit = Math.max(0, Math.floor(displayLimit));
  const nextGeneration = Math.min(MAX_FRAGMENT_GENERATION, generation + 1);
  const nextGroupCount = generation >= MAX_FRAGMENT_GENERATION ? groupCount : groupCount * 2;
  const nextTotalCount = totalCount - groupCount + nextGroupCount;
  return {
    allowed: generation < MAX_FRAGMENT_GENERATION && groupCount > 0 && nextTotalCount <= limit,
    nextGeneration,
    nextGroupCount,
    nextTotalCount,
  };
}

export function createBatchFragmentationPlan(
  groups: readonly BatchFragmentationGroup[],
  currentTotalCount: number,
  displayLimit: number,
): BatchFragmentationPlan {
  const totalCount = Math.max(0, Math.floor(finiteOr(currentTotalCount, 0)));
  const limit = Math.max(0, Math.floor(finiteOr(displayLimit, 0)));
  const eligibleGroupIndexes = groups.flatMap((group, index) => {
    const generation = Math.max(0, Math.floor(finiteOr(group.generation, MAX_FRAGMENT_GENERATION)));
    const count = Math.max(0, Math.floor(finiteOr(group.count, 0)));
    return generation < MAX_FRAGMENT_GENERATION && count > 0 ? [index] : [];
  });
  if (eligibleGroupIndexes.length === 0) {
    return { status: "no-eligible", eligibleGroupIndexes, nextTotalCount: totalCount };
  }
  const addedCount = eligibleGroupIndexes.reduce((sum, index) => {
    const count = Math.max(0, Math.floor(finiteOr(groups[index]?.count ?? 0, 0)));
    return sum + count;
  }, 0);
  const nextTotalCount = totalCount + addedCount;
  return {
    status: nextTotalCount <= limit ? "allowed" : "blocked-limit",
    eligibleGroupIndexes,
    nextTotalCount,
  };
}

export function shouldThrowParent(pointerTravelPx: number): boolean {
  return Number.isFinite(pointerTravelPx) && pointerTravelPx > PARENT_DRAG_THRESHOLD_PX;
}

export function calculateParentRadius(diameterPx: number, width = Number.POSITIVE_INFINITY, height = Number.POSITIVE_INFINITY): number {
  const requestedRadius = clamp(finiteOr(diameterPx, 112), 40, 160) / 2;
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return requestedRadius;
  }
  const availableRadius = Math.max(2, Math.min(width, height) / 2 - 2);
  return Math.min(requestedRadius, availableRadius);
}

function safeRatio(value: number): number {
  return clamp(finiteOr(value, 1), 0.25, 4);
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
