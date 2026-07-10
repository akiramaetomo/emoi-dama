import type { AppSettings } from "./settings.js";

export interface NumericSettingRange {
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface MotionTuning {
  wallRestitution: number;
  contactRestitution: number;
  linearDamping: number;
  flickPower: number;
  maxSpeed: number;
  gravityStrength: number;
}

export const MOVEMENT_SETTING_RANGES = {
  wallRestitution: { min: 0, max: 1, step: 0.01, defaultValue: 0.9 },
  contactRestitution: { min: 0, max: 1, step: 0.01, defaultValue: 0.9 },
  linearDamping: { min: 0, max: 100, step: 0.01, defaultValue: 0.3 },
  flickPower: { min: 0.2, max: 3, step: 0.01, defaultValue: 2 },
  maxSpeed: { min: 400, max: 5000, step: 50, defaultValue: 5000 },
  gravityStrength: { min: 80, max: 20000, step: 20, defaultValue: 4000 },
} as const satisfies Record<keyof MotionTuning, NumericSettingRange>;

export const DAMPING_SLIDER_RANGE = {
  min: 0,
  max: 300,
  step: 1,
} as const;

const DAMPING_LOG_OFFSET = 1;
const DAMPING_SLIDER_STEPS_PER_DECADE = 100;

export function dampingSliderToValue(sliderValue: number): number {
  if (!Number.isFinite(sliderValue) || sliderValue <= DAMPING_SLIDER_RANGE.min) {
    return MOVEMENT_SETTING_RANGES.linearDamping.min;
  }
  const clamped = clamp(sliderValue, 1, DAMPING_SLIDER_RANGE.max);
  const exponent = clamped / DAMPING_SLIDER_STEPS_PER_DECADE - DAMPING_LOG_OFFSET;
  return clamp(
    10 ** exponent,
    MOVEMENT_SETTING_RANGES.linearDamping.min,
    MOVEMENT_SETTING_RANGES.linearDamping.max,
  );
}

export function dampingValueToSlider(value: number): number {
  if (!Number.isFinite(value) || value <= MOVEMENT_SETTING_RANGES.linearDamping.min) {
    return DAMPING_SLIDER_RANGE.min;
  }
  if (value <= 0.1) {
    return 1;
  }
  const clamped = clamp(
    value,
    MOVEMENT_SETTING_RANGES.linearDamping.min,
    MOVEMENT_SETTING_RANGES.linearDamping.max,
  );
  return Math.round((Math.log10(clamped) + DAMPING_LOG_OFFSET) * DAMPING_SLIDER_STEPS_PER_DECADE);
}

export function createGlobalMotionTuning(settings: AppSettings): MotionTuning {
  return {
    wallRestitution: settings.wallRestitution,
    contactRestitution: settings.contactRestitution,
    linearDamping: settings.linearDamping,
    flickPower: settings.flickPower,
    maxSpeed: settings.maxSpeed,
    gravityStrength: settings.gravityStrength,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
