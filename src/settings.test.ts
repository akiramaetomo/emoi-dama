import {
  DEFAULT_APP_SETTINGS,
  looksLikeAppSettings,
  normalizeAppSettings,
} from "./settings.js";

const normalized = normalizeAppSettings({
  wallRestitution: 2,
  contactRestitution: -1,
  maxSpeed: 99999,
  radius: 2,
  masterVolume: 0.5,
  frequencyHz: Number.NaN,
  soundEnabled: false,
  gravityEnabled: true,
  ballLabelMode: "date",
  showMemoField: true,
  emotionEchoStrength: "strong",
  backgroundTexture: "random",
  startupScreen: "calendarDayList",
  calendarMarkerMode: "meter",
  descentMinDistanceMeters: 1200,
});
assertEqual(normalized.wallRestitution, 1, "wall restitution should clamp to the maximum");
assertEqual(normalized.contactRestitution, 0, "contact restitution should clamp to the minimum");
assertEqual(normalized.maxSpeed, 5000, "max speed should clamp to the maximum");
assertEqual(normalized.radius, 24, "radius should clamp to the minimum");
assertEqual(normalized.masterVolume, 0.5, "valid numbers should be preserved");
assertEqual(normalized.frequencyHz, DEFAULT_APP_SETTINGS.frequencyHz, "invalid numbers should fall back to defaults");
assertEqual(normalized.soundEnabled, false, "explicit false should be preserved");
assertEqual(normalized.gravityEnabled, true, "explicit true should be preserved");
assertEqual(normalized.ballLabelMode, "date", "valid ball label mode should be preserved");
assertEqual(normalized.showMemoField, true, "memo field boolean should be preserved");
assertEqual(normalized.emotionEchoStrength, "strong", "valid echo strength should be preserved");
assertEqual(normalized.backgroundTexture, "random", "valid background texture should be preserved");
assertEqual(normalized.startupScreen, "calendarDayList", "valid startup screen should be preserved");
assertEqual(normalized.calendarMarkerMode, "meter", "valid calendar marker mode should be preserved");
assertEqual(normalized.descentMinDistanceMeters, 1200, "valid descent distance should be preserved");

const booleanFallback = normalizeAppSettings({
  soundEnabled: "false",
  gravityEnabled: 1,
  ballLabelMode: "wide",
  showMemoField: null,
  backgroundTexture: "stripe",
  startupScreen: "month",
  calendarMarkerMode: "bars",
  descentMinDistanceMeters: -1,
});
assertEqual(booleanFallback.soundEnabled, DEFAULT_APP_SETTINGS.soundEnabled, "string false should not become a truthy setting");
assertEqual(booleanFallback.gravityEnabled, DEFAULT_APP_SETTINGS.gravityEnabled, "numeric booleans should not be accepted");
assertEqual(booleanFallback.ballLabelMode, DEFAULT_APP_SETTINGS.ballLabelMode, "invalid label mode should fall back to defaults");
assertEqual(booleanFallback.showMemoField, DEFAULT_APP_SETTINGS.showMemoField, "null booleans should fall back to defaults");
assertEqual(
  booleanFallback.backgroundTexture,
  DEFAULT_APP_SETTINGS.backgroundTexture,
  "invalid background texture should fall back to defaults",
);
assertEqual(
  booleanFallback.startupScreen,
  DEFAULT_APP_SETTINGS.startupScreen,
  "invalid startup screen should fall back to defaults",
);
assertEqual(
  booleanFallback.calendarMarkerMode,
  DEFAULT_APP_SETTINGS.calendarMarkerMode,
  "invalid calendar marker mode should fall back to defaults",
);
assertEqual(
  booleanFallback.descentMinDistanceMeters,
  10,
  "descent distance should clamp to the minimum",
);

const legacyLabelMode = normalizeAppSettings({
  showBallLabels: true,
});
assertEqual(legacyLabelMode.ballLabelMode, "title", "legacy true label display should become title labels");

const defaults = normalizeAppSettings("not settings");
assertEqual(defaults.wallRestitution, DEFAULT_APP_SETTINGS.wallRestitution, "non-object settings should use defaults");
assertEqual(defaults.emotionEchoStrength, DEFAULT_APP_SETTINGS.emotionEchoStrength, "invalid echo strength should use default");
assertEqual(defaults.backgroundTexture, DEFAULT_APP_SETTINGS.backgroundTexture, "missing texture should use default");
assertEqual(defaults.startupScreen, "calendarMonth", "missing startup screen should default to calendar month");
assertEqual(defaults.calendarMarkerMode, "spread", "missing calendar marker mode should default to spread");
assertEqual(defaults.descentMinDistanceMeters, 500, "missing descent distance should default to 500m");

assert(looksLikeAppSettings({ soundEnabled: false }), "settings-like objects should be recognized");
assert(looksLikeAppSettings({ startupScreen: "main" }), "startup screen setting should be recognized");
assert(looksLikeAppSettings({ calendarMarkerMode: "meter" }), "calendar marker mode setting should be recognized");
assert(looksLikeAppSettings({ descentMinDistanceMeters: 500 }), "descent distance setting should be recognized");
assert(!looksLikeAppSettings({ ledger: [] }), "unrelated objects should not be recognized as settings");
assert(!looksLikeAppSettings(null), "null should not be recognized as settings");

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
