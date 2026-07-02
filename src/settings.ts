export type EmotionEchoStrength = "off" | "weak" | "medium" | "strong";
export type BallLabelMode = "none" | "date" | "title";
export type BackgroundTexture = "grid" | "paper" | "grain" | "mist" | "random";

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
}

const SETTINGS_KEY = "happyBall.settings.v2";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  wallRestitution: 0.38,
  contactRestitution: 0.34,
  linearDamping: 0.12,
  angularDamping: 0.28,
  friction: 0.02,
  flickPower: 0.92,
  maxSpeed: 1900,
  radius: 42,
  soundEnabled: true,
  gravityEnabled: false,
  gravityStrength: 720,
  masterVolume: 0.28,
  frequencyHz: 1100,
  frequencySpread: 1.35,
  durationMs: 130,
  soundThreshold: 85,
  ballLabelMode: "none",
  showMemoField: false,
  emotionEchoStrength: "weak",
  backgroundTexture: "grid",
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
    wallRestitution: clampNumber(source.wallRestitution, 0, 1, DEFAULT_APP_SETTINGS.wallRestitution),
    contactRestitution: clampNumber(source.contactRestitution, 0, 1, DEFAULT_APP_SETTINGS.contactRestitution),
    linearDamping: clampNumber(source.linearDamping, 0, 2, DEFAULT_APP_SETTINGS.linearDamping),
    angularDamping: clampNumber(source.angularDamping, 0, 2, DEFAULT_APP_SETTINGS.angularDamping),
    friction: clampNumber(source.friction, 0, 1, DEFAULT_APP_SETTINGS.friction),
    flickPower: clampNumber(source.flickPower, 0.2, 2.2, DEFAULT_APP_SETTINGS.flickPower),
    maxSpeed: clampNumber(source.maxSpeed, 400, 5000, DEFAULT_APP_SETTINGS.maxSpeed),
    radius: clampNumber(source.radius, 24, 64, DEFAULT_APP_SETTINGS.radius),
    soundEnabled: readBoolean(source.soundEnabled, DEFAULT_APP_SETTINGS.soundEnabled),
    gravityEnabled: readBoolean(source.gravityEnabled, DEFAULT_APP_SETTINGS.gravityEnabled),
    gravityStrength: clampNumber(source.gravityStrength, 80, 1800, DEFAULT_APP_SETTINGS.gravityStrength),
    masterVolume: clampNumber(source.masterVolume, 0, 1, DEFAULT_APP_SETTINGS.masterVolume),
    frequencyHz: clampNumber(source.frequencyHz, 200, 4200, DEFAULT_APP_SETTINGS.frequencyHz),
    frequencySpread: clampNumber(source.frequencySpread, 1, 3, DEFAULT_APP_SETTINGS.frequencySpread),
    durationMs: clampNumber(source.durationMs, 30, 420, DEFAULT_APP_SETTINGS.durationMs),
    soundThreshold: clampNumber(source.soundThreshold, 20, 500, DEFAULT_APP_SETTINGS.soundThreshold),
    ballLabelMode: readBallLabelMode(source.ballLabelMode, source.showBallLabels),
    showMemoField: readBoolean(source.showMemoField, DEFAULT_APP_SETTINGS.showMemoField),
    emotionEchoStrength: readEchoStrength(source.emotionEchoStrength),
    backgroundTexture: readBackgroundTexture(source.backgroundTexture),
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
    "soundEnabled",
    "ballLabelMode",
    "showBallLabels",
    "showMemoField",
    "emotionEchoStrength",
    "backgroundTexture",
  ].some((key) => key in value);
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
  if (value === "none" || value === "date" || value === "title") {
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
