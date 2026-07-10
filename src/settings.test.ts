import {
  DEFAULT_APP_SETTINGS,
  looksLikeAppSettings,
  normalizeAppSettings,
} from "./settings.js";
import {
  dampingSliderToValue,
  dampingValueToSlider,
} from "./motion-tuning.js";

const normalized = normalizeAppSettings({
  wallRestitution: 2,
  contactRestitution: -1,
  linearDamping: 999,
  flickPower: 99,
  maxSpeed: 99999,
  gravityStrength: 99999,
  radius: 2,
  masterVolume: 0.5,
  frequencyHz: Number.NaN,
  soundEnabled: false,
  gravityEnabled: true,
  gravityDebugEnabled: true,
  ballLabelMode: "name",
  showMemoField: true,
  emotionEchoStrength: "strong",
  backgroundTexture: "random",
  startupScreen: "calendarDayList",
  calendarMarkerMode: "meter",
  descentMinDistanceMeters: 1200,
});
assertEqual(normalized.wallRestitution, 1, "wall restitution should clamp to the maximum");
assertEqual(normalized.contactRestitution, 0, "contact restitution should clamp to the minimum");
assertEqual(normalized.linearDamping, 100, "linear damping should clamp to the maximum");
assertEqual(normalized.flickPower, 3, "flick power should clamp to the maximum");
assertEqual(normalized.maxSpeed, 5000, "max speed should clamp to the maximum");
assertEqual(normalized.gravityStrength, 20000, "gravity strength should clamp to the maximum");
assertEqual(normalized.radius, 24, "radius should clamp to the minimum");
assertEqual(normalized.masterVolume, 0.5, "valid numbers should be preserved");
assertEqual(normalized.frequencyHz, DEFAULT_APP_SETTINGS.frequencyHz, "invalid numbers should fall back to defaults");
assertEqual(normalized.soundEnabled, false, "explicit false should be preserved");
assertEqual(normalized.gravityEnabled, true, "explicit true should be preserved");
assertEqual(normalized.gravityDebugEnabled, true, "explicit gravity debug should be preserved");
assertEqual(normalized.ballLabelMode, "name", "valid name ball label mode should be preserved");
assertEqual(normalized.showMemoField, true, "memo field boolean should be preserved");
assertEqual(normalized.emotionEchoStrength, "strong", "valid echo strength should be preserved");
assertEqual(normalized.backgroundTexture, "random", "valid background texture should be preserved");
assertEqual(normalized.startupScreen, "calendarDayList", "valid startup screen should be preserved");
assertEqual(normalized.calendarMarkerMode, "meter", "valid calendar marker mode should be preserved");
assertEqual(normalized.descentMinDistanceMeters, 1200, "valid descent distance should be preserved");

const booleanFallback = normalizeAppSettings({
  soundEnabled: "false",
  gravityEnabled: 1,
  gravityDebugEnabled: "true",
  ballLabelMode: "wide",
  showMemoField: null,
  backgroundTexture: "stripe",
  startupScreen: "month",
  calendarMarkerMode: "bars",
  descentMinDistanceMeters: -1,
});
assertEqual(booleanFallback.soundEnabled, DEFAULT_APP_SETTINGS.soundEnabled, "string false should not become a truthy setting");
assertEqual(booleanFallback.gravityEnabled, DEFAULT_APP_SETTINGS.gravityEnabled, "numeric booleans should not be accepted");
assertEqual(booleanFallback.gravityDebugEnabled, DEFAULT_APP_SETTINGS.gravityDebugEnabled, "string debug booleans should not be accepted");
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
assertEqual(defaults.wallRestitution, 0.9, "wall restitution should default to the current movement tuning value");
assertEqual(defaults.contactRestitution, 0.9, "contact restitution should default to the current movement tuning value");
assertEqual(defaults.linearDamping, 0.3, "linear damping should default to the current movement tuning value");
assertEqual(defaults.flickPower, 2, "flick power should default to the current movement tuning value");
assertEqual(defaults.maxSpeed, 5000, "max speed should default to the current movement tuning value");
assertEqual(defaults.gravityStrength, 4000, "gravity strength should default to the current movement tuning value");
assertEqual(defaults.emotionEchoStrength, DEFAULT_APP_SETTINGS.emotionEchoStrength, "invalid echo strength should use default");
assertEqual(defaults.backgroundTexture, DEFAULT_APP_SETTINGS.backgroundTexture, "missing texture should use default");
assertEqual(defaults.startupScreen, "calendarMonth", "missing startup screen should default to calendar month");
assertEqual(defaults.calendarMarkerMode, "spread", "missing calendar marker mode should default to spread");
assertEqual(defaults.descentMinDistanceMeters, 500, "missing descent distance should default to 500m");

assert(looksLikeAppSettings({ soundEnabled: false }), "settings-like objects should be recognized");
assert(looksLikeAppSettings({ startupScreen: "main" }), "startup screen setting should be recognized");
assert(looksLikeAppSettings({ calendarMarkerMode: "meter" }), "calendar marker mode setting should be recognized");
assert(looksLikeAppSettings({ descentMinDistanceMeters: 500 }), "descent distance setting should be recognized");
assert(looksLikeAppSettings({ gravityDebugEnabled: true }), "gravity debug setting should be recognized");
assert(!looksLikeAppSettings({ ledger: [] }), "unrelated objects should not be recognized as settings");
assert(!looksLikeAppSettings(null), "null should not be recognized as settings");

assertEqual(dampingSliderToValue(0), 0, "leftmost damping slider position should disable damping");
assertClose(dampingSliderToValue(100), 1, 0.0001, "damping slider should map 100 to 1");
assertClose(dampingSliderToValue(200), 10, 0.0001, "damping slider should map 200 to 10");
assertClose(dampingSliderToValue(300), 100, 0.0001, "damping slider should map 300 to 100");
assertEqual(dampingValueToSlider(0), 0, "zero damping should map back to the leftmost slider position");
assertEqual(dampingValueToSlider(0.3), 48, "default damping should map back to the expected logarithmic slider position");

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

function assertClose(actual: number, expected: number, tolerance: number, message: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
