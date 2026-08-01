import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from "./settings.js";
import { hasAppSettingsRuntimeEffect, planAppSettingsRuntimeEffects } from "./settings-runtime-effects.js";

const unchanged = planAppSettingsRuntimeEffects(
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings(DEFAULT_APP_SETTINGS),
);
assert(!unchanged.persist, "equivalent normalized settings should not request persistence");
assert(unchanged.changedKeys.length === 0, "equivalent normalized settings should not report changed keys");

const label = plan({ ballLabelMode: "title" });
assert(label.changedKeys.length === 1 && label.changedKeys[0] === "ballLabelMode", "label changes should remain isolated");
assert(hasAppSettingsRuntimeEffect(label, "sync-runtime-settings"), "label changes should update renderer settings");
assert(hasAppSettingsRuntimeEffect(label, "sync-ball-label-controls"), "label changes should update visible controls");
assert(hasAppSettingsRuntimeEffect(label, "sync-ball-visual-sources"), "label changes should rebuild renderer-owned label sources");

const echo = plan({ emotionEchoStrength: "off" });
assert(hasAppSettingsRuntimeEffect(echo, "sync-runtime-settings"), "echo changes should update renderer settings");
assert(hasAppSettingsRuntimeEffect(echo, "sync-ball-visual-sources"), "echo on/off changes should rebuild echo-bearing sources");
assert(!hasAppSettingsRuntimeEffect(echo, "sync-ball-label-controls"), "echo changes should not update label controls");

const gravity = plan({ gravityEnabled: true, gravityStrength: 1200 });
assert(hasAppSettingsRuntimeEffect(gravity, "sync-gravity"), "gravity changes should update the sensor controller");
assert(hasAppSettingsRuntimeEffect(gravity, "sync-runtime-settings"), "gravity changes should update the physics stage");

const texture = plan({ backgroundTexture: "paper" });
assert(texture.effects.length === 1 && hasAppSettingsRuntimeEffect(texture, "sync-texture"), "texture changes should only update the field texture");

const debug = plan({ gravityDebugEnabled: true });
assert(debug.effects.length === 1 && hasAppSettingsRuntimeEffect(debug, "sync-debug-panel"), "debug changes should only update debug structure");

const metadataOnly = plan({ startupScreen: "main", includeDescentGpsInHandoff: true });
assert(metadataOnly.persist, "metadata-only changes should still be persisted");
assert(metadataOnly.effects.length === 0, "metadata-only changes should not update unrelated runtime systems");

const jutsu = plan({
  jutsuPhysicsSettings: {
    ...DEFAULT_APP_SETTINGS.jutsuPhysicsSettings,
    maxSpeed: DEFAULT_APP_SETTINGS.jutsuPhysicsSettings.maxSpeed + 1,
  },
});
assert(hasAppSettingsRuntimeEffect(jutsu, "sync-runtime-settings"), "nested Jutsu settings should update runtime settings");

function plan(patch: Parameters<typeof normalizeAppSettings>[0]) {
  return planAppSettingsRuntimeEffects(
    DEFAULT_APP_SETTINGS,
    normalizeAppSettings({ ...DEFAULT_APP_SETTINGS, ...(patch as object) }),
  );
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
