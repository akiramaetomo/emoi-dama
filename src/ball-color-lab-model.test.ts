import { categoryColorPresets } from "./categories.js";
import {
  BALL_COLOR_LAB_DIFF_VERSION,
  BALL_COLOR_LAB_DRAFT_VERSION,
  BALL_COLOR_LAB_DIFF_TYPE,
  BALL_COLOR_LAB_DRAFT_TYPE,
  BALL_COLOR_LAB_HISTORY_LIMIT,
  canRedoAllBallColorLab,
  canRedoSelectedBallColorLab,
  canUndoAllBallColorLab,
  canUndoSelectedBallColorLab,
  commitBallColorLabWorkingValues,
  createBallColorLabChanges,
  createBallColorLabDiffJson,
  createBallColorLabHistoryState,
  createBallColorLabPresetSignature,
  createBallColorLabTypeScript,
  createDefaultBallColorLabValues,
  discardAllBallColorLabWorkingValues,
  discardBallColorLabWorkingValue,
  getCommittedBallColorLabValues,
  getDirtyBallColorLabIndexes,
  normalizeBallColorLabDraft,
  normalizeBallColorLabValue,
  redoAllBallColorLab,
  redoSelectedBallColorLab,
  resetAllBallColorLabWorkingValues,
  resetBallColorLabWorkingValue,
  serializeBallColorLabDraft,
  serializeLegacyBallColorLabDraft,
  undoAllBallColorLab,
  undoSelectedBallColorLab,
  updateBallColorLabWorkingValue,
  updateBallColorLabValue,
} from "./ball-color-lab-model.js";

assertEqual(categoryColorPresets.length, 24, "the lab should cover all presets");
assertEqual(categoryColorPresets.filter((preset) => preset.visualKind === "filled").length, 18, "filled count");
assertEqual(categoryColorPresets.filter((preset) => preset.visualKind === "ring").length, 6, "ring count");

const defaults = createDefaultBallColorLabValues(categoryColorPresets);
assertDeepEqual(normalizeBallColorLabValue({ hue: -4, saturation: 104, lightness: 51.6 }), {
  hue: 0,
  saturation: 100,
  lightness: 52,
}, "channels should clamp and round");
assertEqual(normalizeBallColorLabValue({ hue: "43", saturation: 68, lightness: 58 }), null, "strings should be rejected");
assertEqual(updateBallColorLabValue(defaults, 0, "hue", 361)[0].hue, 359, "hue should clamp");

let history = createBallColorLabHistoryState(categoryColorPresets);
history = updateBallColorLabWorkingValue(history, 0, "hue", 21);
assertDeepEqual(getCommittedBallColorLabValues(history), defaults, "live edits should not alter committed values");
assertDeepEqual(getDirtyBallColorLabIndexes(history), [0], "live edits should be dirty");
history = discardBallColorLabWorkingValue(history, 0);
assertDeepEqual(history.workingValues, defaults, "single discard should restore committed values");

history = updateBallColorLabWorkingValue(history, 0, "hue", 21);
history = updateBallColorLabWorkingValue(history, 1, "lightness", 44);
history = commitBallColorLabWorkingValues(history, categoryColorPresets, "single", 0);
assertEqual(history.transactions.length, 1, "single commit should create one transaction");
assertEqual(history.transactions[0].patches.length, 1, "single commit should contain one patch");
assertDeepEqual(getDirtyBallColorLabIndexes(history), [1], "other live edits should remain dirty");
assertEqual(canUndoSelectedBallColorLab(history, 0), false, "dirty values should block undo");
assertEqual(canUndoAllBallColorLab(history), false, "dirty values should block global undo");
history = discardAllBallColorLabWorkingValues(history);
assertEqual(canUndoSelectedBallColorLab(history, 0), true, "discarding dirt should enable undo");
history = undoSelectedBallColorLab(history, 0);
assertEqual(getCommittedBallColorLabValues(history)[0].hue, defaults[0].hue, "single undo should revert its latest patch");
assertEqual(canRedoSelectedBallColorLab(history, 0), true, "single undo should create redo");
history = redoSelectedBallColorLab(history, 0);
assertEqual(getCommittedBallColorLabValues(history)[0].hue, 21, "single redo should reapply its patch");

history = updateBallColorLabWorkingValue(history, 0, "saturation", 60);
history = updateBallColorLabWorkingValue(history, 1, "lightness", 44);
history = commitBallColorLabWorkingValues(history, categoryColorPresets, "all", 0);
assertEqual(history.transactions[history.transactions.length - 1]?.patches.length, 2, "all commit should group every dirty ball");
history = undoSelectedBallColorLab(history, 0);
assertEqual(getCommittedBallColorLabValues(history)[0].saturation, 70, "single undo should revert one part of an all transaction");
assertEqual(getCommittedBallColorLabValues(history)[1].lightness, 44, "other parts should remain applied");
history = undoAllBallColorLab(history);
assertEqual(getCommittedBallColorLabValues(history)[1].lightness, defaults[1].lightness, "global undo should revert remaining applied parts");
assertEqual(canRedoAllBallColorLab(history), true, "global undo should create global redo");
history = redoAllBallColorLab(history);
assertEqual(getCommittedBallColorLabValues(history)[1].lightness, 44, "global redo should restore only the part globally undone");
assertEqual(getCommittedBallColorLabValues(history)[0].saturation, 70, "global redo should leave individually undone parts alone");

history = undoAllBallColorLab(history);
assertEqual(canRedoAllBallColorLab(history), true, "redo should exist before a new branch");
history = updateBallColorLabWorkingValue(history, 2, "hue", 90);
history = commitBallColorLabWorkingValues(history, categoryColorPresets, "single", 2);
assertEqual(canRedoAllBallColorLab(history), false, "a new commit should discard an old redo branch");

history = resetBallColorLabWorkingValue(history, categoryColorPresets, 2);
assertDeepEqual(getDirtyBallColorLabIndexes(history), [2], "single reset should remain live until committed");
history = discardBallColorLabWorkingValue(history, 2);
history = resetAllBallColorLabWorkingValues(history, categoryColorPresets);
assert(getDirtyBallColorLabIndexes(history).length > 0, "all reset should remain live until committed");

const v1Values = updateBallColorLabValue(defaults, 0, "hue", 42);
const v1 = JSON.parse(serializeLegacyBallColorLabDraft(v1Values, categoryColorPresets));
const migrated = normalizeBallColorLabDraft(v1, categoryColorPresets);
assert(migrated !== null, "valid v1 drafts should migrate");
assertEqual(migrated!.transactions.length, 0, "v1 migration should start with no history");
assertEqual(migrated!.workingValues[0].hue, 42, "v1 current values should become the history baseline");

const v2Source = commitBallColorLabWorkingValues(
  updateBallColorLabWorkingValue(createBallColorLabHistoryState(categoryColorPresets), 0, "hue", 23),
  categoryColorPresets,
  "single",
  0,
);
const serializedDraft = serializeBallColorLabDraft(v2Source, categoryColorPresets);
const parsedDraft = JSON.parse(serializedDraft) as Record<string, unknown>;
assertEqual(parsedDraft.type, BALL_COLOR_LAB_DRAFT_TYPE, "drafts should have a dedicated type");
assertEqual(parsedDraft.version, BALL_COLOR_LAB_DRAFT_VERSION, "drafts should expose the maintained schema version");
assertDeepEqual(normalizeBallColorLabDraft(parsedDraft, categoryColorPresets), v2Source, "v2 history should round-trip");
assertEqual(normalizeBallColorLabDraft({ ...parsedDraft, presetSignature: "stale" }, categoryColorPresets), null, "stale signatures should be rejected");
const withRedo = undoSelectedBallColorLab(v2Source, 0);
const restoredRedo = normalizeBallColorLabDraft(JSON.parse(serializeBallColorLabDraft(withRedo, categoryColorPresets)), categoryColorPresets);
assert(restoredRedo !== null && canRedoSelectedBallColorLab(restoredRedo, 0), "v2 restore should preserve redo references");
const corrupt = structuredClone(parsedDraft) as { history: { transactions: Array<{ patches: Array<{ applied: unknown }> }> } };
corrupt.history.transactions[0].patches[0].applied = "yes";
assertEqual(normalizeBallColorLabDraft(corrupt, categoryColorPresets), null, "invalid history should be rejected");

let capped = createBallColorLabHistoryState(categoryColorPresets);
for (let iteration = 0; iteration < BALL_COLOR_LAB_HISTORY_LIMIT + 5; iteration += 1) {
  capped = updateBallColorLabWorkingValue(capped, 0, "hue", 30 + (iteration % 2));
  capped = commitBallColorLabWorkingValues(capped, categoryColorPresets, "single", 0);
}
assertEqual(capped.transactions.length, BALL_COLOR_LAB_HISTORY_LIMIT, "history should compact to one hundred transactions");
assertEqual(capped.historyBaseValues[0].hue, 30, "compacted transactions should fold into the baseline");

const adjusted = updateBallColorLabValue(updateBallColorLabValue(defaults, 0, "hue", 359), 0, "lightness", 57);
assertDeepEqual(createBallColorLabChanges(adjusted, categoryColorPresets)[0], {
  index: 0,
  name: "よろこび",
  before: { hue: 0, saturation: 70, lightness: 57 },
  after: { hue: 359, saturation: 70, lightness: 57 },
}, "diffs should include source and adjusted values");
const diffPayload = JSON.parse(createBallColorLabDiffJson(adjusted, categoryColorPresets)) as Record<string, unknown>;
assertEqual(diffPayload.type, BALL_COLOR_LAB_DIFF_TYPE, "diff JSON should have a dedicated type");
assertEqual(diffPayload.version, BALL_COLOR_LAB_DIFF_VERSION, "diff JSON should expose the maintained schema version");
assertEqual((diffPayload.changes as unknown[]).length, 1, "diff JSON should contain only changes");
assertEqual(diffPayload.presetSignature, createBallColorLabPresetSignature(categoryColorPresets), "diff signature");
const typeScript = createBallColorLabTypeScript(adjusted, categoryColorPresets);
assert(typeScript.includes('name: "よろこび", tone: "bright", hue: 359, saturation: 70, lightness: 57, visualKind: "filled"'), "TypeScript should contain adjusted values");
assertEqual(typeScript.split("\n").filter((line) => line.trimStart().startsWith("{ name:")).length, 24, "TypeScript should contain all presets");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
