import { DEFAULT_APP_SETTINGS } from "./settings.js";
import {
  TAMAWARI_DEVICE_MODE_STORAGE_KEY,
  TAMAWARI_LINEAR_DAMPING,
  createReadyTamawariSession,
  createTamawariRevealMap,
  isTamawariTreasure,
  loadDevicePlayMode,
  resetTamawariSession,
  resolveTamawariRevealAppearance,
  resolveTamawariRuntimeSettings,
  saveDevicePlayMode,
  startTamawariSession,
  toggleTamawariInstance,
} from "./tamawari.js";

for (const word of ["おたから", "たから", "お宝", "宝"]) {
  assert(isTamawariTreasure(`  ${word}  \n自由な説明`), `${word} should match on the trimmed first line without a hash`);
  assert(isTamawariTreasure(`#${word}\r\n自由な説明`), `#${word} should match on the first line with a hash`);
}
assert(!isTamawariTreasure("\nお宝"), "a blank first line should not defer classification to the second line");
assert(!isTamawariTreasure("説明\nお宝"), "a treasure word on only the second line should not match");
assert(!isTamawariTreasure("今日はお宝"), "a word embedded in prose should not match");
assert(!isTamawariTreasure("お宝候補"), "a first-line prefix should not partially match");
assert(!isTamawariTreasure("#宝物"), "a longer hashtag should not partially match");

const treasureAppearance = resolveTamawariRevealAppearance("treasure");
assertEqual(treasureAppearance.resultAura, "treasure", "treasure should request the dedicated result aura");
assertEqual(treasureAppearance.showStoredEcho, false, "treasure should temporarily suppress stored echo presentation");
const missAppearance = resolveTamawariRevealAppearance("miss");
assertEqual(missAppearance.resultAura, "none", "miss should not create a result aura");
assertEqual(missAppearance.showStoredEcho, false, "miss should temporarily suppress stored echo presentation");
const closedAppearance = resolveTamawariRevealAppearance("none");
assert(closedAppearance.showStoredEcho, "closed presentation should restore stored echo presentation");

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
};
assertEqual(loadDevicePlayMode(storage), "normal", "missing device mode should default to normal");
saveDevicePlayMode("tamawari", storage);
assertEqual(values.get(TAMAWARI_DEVICE_MODE_STORAGE_KEY), "tamawari", "device mode should use its independent local key");
assertEqual(loadDevicePlayMode(storage), "tamawari", "stored Tamawari mode should load");

const target = { instanceId: "ball_1_0", ballId: "ball_1", title: "🎂", effect: "treasure" as const };
let session = startTamawariSession([target]);
assertEqual(session.phase, "playing", "start should enter playing state");
let toggled = toggleTamawariInstance(session, target.instanceId);
session = toggled.state;
assertEqual(toggled.openedEffect, "treasure", "opening should report its reveal cue");
assertEqual(createTamawariRevealMap(session).get(target.instanceId), "treasure", "an opened instance should expose its presentation");
toggled = toggleTamawariInstance(session, target.instanceId);
assertEqual(toggled.openedEffect, null, "closing should not request another cue");
assertEqual(toggled.state.openedInstanceIds.size, 0, "a second tap should close only that instance");
assertEqual(resetTamawariSession(session).openedInstanceIds.size, 0, "reset should close every instance");
assertEqual(createReadyTamawariSession().phase, "ready", "a new session should start ready");

const runtime = resolveTamawariRuntimeSettings(DEFAULT_APP_SETTINGS, true);
assertEqual(runtime.linearDamping, TAMAWARI_LINEAR_DAMPING, "playing should use maximum linear damping");
assertEqual(DEFAULT_APP_SETTINGS.linearDamping, 0.3, "runtime damping should not mutate saved settings");
assert(resolveTamawariRuntimeSettings(DEFAULT_APP_SETTINGS, false) === DEFAULT_APP_SETTINGS, "ready mode should preserve the settings object");

console.log("Tamawari tests passed");

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
