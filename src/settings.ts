import { MOVEMENT_SETTING_RANGES } from "./motion-tuning.js";

export type EmotionEchoStrength = "off" | "weak" | "medium" | "strong";
export type BallLabelMode = "none" | "date" | "title" | "name";
export type BackgroundTexture = "grid" | "paper" | "grain" | "mist" | "random";
export type StartupScreen = "main" | "calendarMonth" | "calendarDayList";
export type CalendarMarkerMode = "spread" | "meter";

export interface AppSettings {
  wallRestitution: number;
  contactRestitution: number;
  linearDamping: number;
  angularDamping: number;
  friction: number;
  flickPower: number;
  maxSpeed: number;
  radius: number;
  soundEnabled: boolean;
  gravityEnabled: boolean;
  gravityDebugEnabled: boolean;
  gravityStrength: number;
  masterVolume: number;
  frequencyHz: number;
  frequencySpread: number;
  durationMs: number;
  soundThreshold: number;
  ballLabelMode: BallLabelMode;
  showMemoField: boolean;
  emotionEchoStrength: EmotionEchoStrength;
  backgroundTexture: BackgroundTexture;
  startupScreen: StartupScreen;
  calendarMarkerMode: CalendarMarkerMode;
  descentMinDistanceMeters: number;
}

const SETTINGS_KEY = "happyBall.settings.v2";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  wallRestitution: MOVEMENT_SETTING_RANGES.wallRestitution.defaultValue,
  contactRestitution: MOVEMENT_SETTING_RANGES.contactRestitution.defaultValue,
  linearDamping: MOVEMENT_SETTING_RANGES.linearDamping.defaultValue,
  angularDamping: 0.28,
  friction: 0.02,
  flickPower: MOVEMENT_SETTING_RANGES.flickPower.defaultValue,
  maxSpeed: MOVEMENT_SETTING_RANGES.maxSpeed.defaultValue,
  radius: 42,
  soundEnabled: true,
  gravityEnabled: false,
  gravityDebugEnabled: false,
  gravityStrength: MOVEMENT_SETTING_RANGES.gravityStrength.defaultValue,
  masterVolume: 0.28,
  frequencyHz: 1100,
  frequencySpread: 1.35,
  durationMs: 130,
  soundThreshold: 85,
  ballLabelMode: "none",
  showMemoField: false,
  emotionEchoStrength: "weak",
  backgroundTexture: "grid",
  startupScreen: "calendarMonth",
  calendarMarkerMode: "spread",
  descentMinDistanceMeters: 500,
};

export function loadAppSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? normalizeAppSettings(JSON.parse(stored)) : DEFAULT_APP_SETTINGS;
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings, null, 2));
}

export function normalizeAppSettings(value: unknown): AppSettings {
  const source = isPlainObject(value) ? (value as Partial<AppSettings> & { showBallLabels?: unknown }) : {};
  return {
    wallRestitution: clampNumber(source.wallRestitution, MOVEMENT_SETTING_RANGES.wallRestitution.min, MOVEMENT_SETTING_RANGES.wallRestitution.max, DEFAULT_APP_SETTINGS.wallRestitution),
    contactRestitution: clampNumber(source.contactRestitution, MOVEMENT_SETTING_RANGES.contactRestitution.min, MOVEMENT_SETTING_RANGES.contactRestitution.max, DEFAULT_APP_SETTINGS.contactRestitution),
    linearDamping: clampNumber(source.linearDamping, MOVEMENT_SETTING_RANGES.linearDamping.min, MOVEMENT_SETTING_RANGES.linearDamping.max, DEFAULT_APP_SETTINGS.linearDamping),
    angularDamping: clampNumber(source.angularDamping, 0, 2, DEFAULT_APP_SETTINGS.angularDamping),
    friction: clampNumber(source.friction, 0, 1, DEFAULT_APP_SETTINGS.friction),
    flickPower: clampNumber(source.flickPower, MOVEMENT_SETTING_RANGES.flickPower.min, MOVEMENT_SETTING_RANGES.flickPower.max, DEFAULT_APP_SETTINGS.flickPower),
    maxSpeed: clampNumber(source.maxSpeed, MOVEMENT_SETTING_RANGES.maxSpeed.min, MOVEMENT_SETTING_RANGES.maxSpeed.max, DEFAULT_APP_SETTINGS.maxSpeed),
    radius: clampNumber(source.radius, 24, 64, DEFAULT_APP_SETTINGS.radius),
    soundEnabled: readBoolean(source.soundEnabled, DEFAULT_APP_SETTINGS.soundEnabled),
    gravityEnabled: readBoolean(source.gravityEnabled, DEFAULT_APP_SETTINGS.gravityEnabled),
    gravityDebugEnabled: readBoolean(source.gravityDebugEnabled, DEFAULT_APP_SETTINGS.gravityDebugEnabled),
    gravityStrength: clampNumber(source.gravityStrength, MOVEMENT_SETTING_RANGES.gravityStrength.min, MOVEMENT_SETTING_RANGES.gravityStrength.max, DEFAULT_APP_SETTINGS.gravityStrength),
    masterVolume: clampNumber(source.masterVolume, 0, 1, DEFAULT_APP_SETTINGS.masterVolume),
    frequencyHz: clampNumber(source.frequencyHz, 200, 4200, DEFAULT_APP_SETTINGS.frequencyHz),
    frequencySpread: clampNumber(source.frequencySpread, 1, 3, DEFAULT_APP_SETTINGS.frequencySpread),
    durationMs: clampNumber(source.durationMs, 30, 420, DEFAULT_APP_SETTINGS.durationMs),
    soundThreshold: clampNumber(source.soundThreshold, 20, 500, DEFAULT_APP_SETTINGS.soundThreshold),
    ballLabelMode: readBallLabelMode(source.ballLabelMode, source.showBallLabels),
    showMemoField: readBoolean(source.showMemoField, DEFAULT_APP_SETTINGS.showMemoField),
    emotionEchoStrength: readEchoStrength(source.emotionEchoStrength),
    backgroundTexture: readBackgroundTexture(source.backgroundTexture),
    startupScreen: readStartupScreen(source.startupScreen),
    calendarMarkerMode: readCalendarMarkerMode(source.calendarMarkerMode),
    descentMinDistanceMeters: clampNumber(source.descentMinDistanceMeters, 10, 100_000, DEFAULT_APP_SETTINGS.descentMinDistanceMeters),
  };
}

export function looksLikeAppSettings(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }
  return [
    "wallRestitution",
    "contactRestitution",
    "linearDamping",
    "gravityEnabled",
    "gravityDebugEnabled",
    "soundEnabled",
    "ballLabelMode",
    "showBallLabels",
    "showMemoField",
    "emotionEchoStrength",
    "backgroundTexture",
    "startupScreen",
    "calendarMarkerMode",
    "descentMinDistanceMeters",
  ].some((key) => key in value);
}

export function readCalendarMarkerMode(value: unknown): CalendarMarkerMode {
  return value === "meter" || value === "spread"
    ? value
    : DEFAULT_APP_SETTINGS.calendarMarkerMode;
}

export function readStartupScreen(value: unknown): StartupScreen {
  return value === "main" || value === "calendarDayList" || value === "calendarMonth"
    ? value
    : DEFAULT_APP_SETTINGS.startupScreen;
}

export function readBackgroundTexture(value: unknown): BackgroundTexture {
  return value === "paper" || value === "grain" || value === "mist" || value === "random" || value === "grid"
    ? value
    : DEFAULT_APP_SETTINGS.backgroundTexture;
}

export function readEchoStrength(value: unknown): EmotionEchoStrength {
  return value === "off" || value === "medium" || value === "strong" || value === "weak"
    ? value
    : DEFAULT_APP_SETTINGS.emotionEchoStrength;
}

function readBallLabelMode(value: unknown, legacyShowLabels: unknown): BallLabelMode {
  if (value === "none" || value === "date" || value === "title" || value === "name") {
    return value;
  }
  if (typeof legacyShowLabels === "boolean") {
    return legacyShowLabels ? "title" : "none";
  }
  return DEFAULT_APP_SETTINGS.ballLabelMode;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
