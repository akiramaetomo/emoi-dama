import type { AppSettings } from "./settings";

export type AppSettingsRuntimeEffect =
  | "sync-ball-label-controls"
  | "sync-ball-visual-sources"
  | "sync-debug-panel"
  | "sync-gravity"
  | "sync-runtime-settings"
  | "sync-texture";

export interface AppSettingsRuntimePlan {
  changedKeys: (keyof AppSettings)[];
  effects: AppSettingsRuntimeEffect[];
  persist: boolean;
}

const runtimeEffectsBySetting: { [Key in keyof AppSettings]: readonly AppSettingsRuntimeEffect[] } = {
  wallRestitution: ["sync-runtime-settings"],
  contactRestitution: ["sync-runtime-settings"],
  linearDamping: ["sync-runtime-settings"],
  angularDamping: ["sync-runtime-settings"],
  friction: ["sync-runtime-settings"],
  flickPower: ["sync-runtime-settings"],
  maxSpeed: ["sync-runtime-settings"],
  radius: ["sync-runtime-settings"],
  soundEnabled: ["sync-runtime-settings"],
  gravityEnabled: ["sync-gravity", "sync-runtime-settings"],
  gravityDebugEnabled: ["sync-debug-panel"],
  gravityStrength: ["sync-gravity", "sync-runtime-settings"],
  classificationDensityRatio: ["sync-runtime-settings"],
  classificationDampingRatio: ["sync-runtime-settings"],
  classificationBuoyancyStrength: ["sync-runtime-settings"],
  parentBallDiameterPx: ["sync-runtime-settings"],
  parentBallLifetimeSeconds: ["sync-runtime-settings"],
  masterVolume: ["sync-runtime-settings"],
  frequencyHz: ["sync-runtime-settings"],
  frequencySpread: ["sync-runtime-settings"],
  durationMs: ["sync-runtime-settings"],
  soundThreshold: ["sync-runtime-settings"],
  ballLabelMode: ["sync-runtime-settings", "sync-ball-label-controls", "sync-ball-visual-sources"],
  showMemoField: [],
  emotionEchoStrength: ["sync-runtime-settings", "sync-ball-visual-sources"],
  backgroundTexture: ["sync-texture"],
  startupScreen: [],
  calendarMarkerMode: [],
  descentMinDistanceMeters: [],
  includeDescentGpsInHandoff: [],
  jutsuPhysicsSettings: ["sync-runtime-settings"],
};

export function planAppSettingsRuntimeEffects(
  previous: AppSettings,
  next: AppSettings,
): AppSettingsRuntimePlan {
  const changedKeys = (Object.keys(runtimeEffectsBySetting) as (keyof AppSettings)[])
    .filter((key) => !settingValuesEqual(previous[key], next[key]));
  const effects = Array.from(new Set(changedKeys.flatMap((key) => runtimeEffectsBySetting[key])));
  return {
    changedKeys,
    effects,
    persist: changedKeys.length > 0,
  };
}

export function hasAppSettingsRuntimeEffect(
  plan: AppSettingsRuntimePlan,
  effect: AppSettingsRuntimeEffect,
): boolean {
  return plan.effects.includes(effect);
}

function settingValuesEqual(previous: AppSettings[keyof AppSettings], next: AppSettings[keyof AppSettings]): boolean {
  if (typeof previous !== "object" || previous === null || typeof next !== "object" || next === null) {
    return Object.is(previous, next);
  }
  return JSON.stringify(previous) === JSON.stringify(next);
}
