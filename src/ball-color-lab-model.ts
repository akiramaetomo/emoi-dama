import type { CategoryColorPreset } from "./categories.js";

export const BALL_COLOR_LAB_STORAGE_KEY = "happyBall.dev.ballColorLab.v1";
export const BALL_COLOR_LAB_DRAFT_TYPE = "happy-ball-color-lab-draft";
export const BALL_COLOR_LAB_DIFF_TYPE = "happy-ball-color-lab-diff";
export const BALL_COLOR_LAB_DRAFT_VERSION = 2;
export const BALL_COLOR_LAB_DIFF_VERSION = 1;
export const BALL_COLOR_LAB_HISTORY_LIMIT = 100;

export interface BallColorLabValue {
  hue: number;
  saturation: number;
  lightness: number;
}

export interface BallColorLabChange {
  index: number;
  name: string;
  before: BallColorLabValue;
  after: BallColorLabValue;
}

export interface BallColorLabHistoryPatch extends BallColorLabChange {
  applied: boolean;
}

export interface BallColorLabHistoryTransaction {
  id: number;
  scope: "single" | "all";
  patches: BallColorLabHistoryPatch[];
}

export interface BallColorLabPatchReference {
  transactionId: number;
  patchIndex: number;
}

export interface BallColorLabGlobalRedoReference {
  transactionId: number;
  patchIndexes: number[];
}

export interface BallColorLabHistoryState {
  historyBaseValues: BallColorLabValue[];
  workingValues: BallColorLabValue[];
  transactions: BallColorLabHistoryTransaction[];
  selectedRedo: Record<string, BallColorLabPatchReference[]>;
  globalRedo: BallColorLabGlobalRedoReference[];
  nextTransactionId: number;
}

interface BallColorLabDraftEnvelopeV1 {
  type: typeof BALL_COLOR_LAB_DRAFT_TYPE;
  version: 1;
  presetSignature: string;
  values: BallColorLabValue[];
}

interface BallColorLabDraftEnvelopeV2 {
  type: typeof BALL_COLOR_LAB_DRAFT_TYPE;
  version: typeof BALL_COLOR_LAB_DRAFT_VERSION;
  presetSignature: string;
  history: BallColorLabHistoryState;
}

export function createBallColorLabPresetSignature(presets: readonly CategoryColorPreset[]): string {
  return presets.map((preset) => `${preset.name}:${preset.tone}:${preset.visualKind}`).join("|");
}

export function createDefaultBallColorLabValues(
  presets: readonly CategoryColorPreset[],
): BallColorLabValue[] {
  return presets.map(({ hue, saturation, lightness }) => ({ hue, saturation, lightness }));
}

export function createBallColorLabHistoryState(
  presets: readonly CategoryColorPreset[],
  initialValues = createDefaultBallColorLabValues(presets),
): BallColorLabHistoryState {
  const safeValues = cloneValues(initialValues.length === presets.length
    ? initialValues
    : createDefaultBallColorLabValues(presets));
  return {
    historyBaseValues: cloneValues(safeValues),
    workingValues: cloneValues(safeValues),
    transactions: [],
    selectedRedo: {},
    globalRedo: [],
    nextTransactionId: 1,
  };
}

export function normalizeBallColorLabValue(value: unknown): BallColorLabValue | null {
  if (!isPlainObject(value)) return null;
  const hue = normalizeInteger(value.hue, 0, 359);
  const saturation = normalizeInteger(value.saturation, 0, 100);
  const lightness = normalizeInteger(value.lightness, 0, 100);
  return hue === null || saturation === null || lightness === null
    ? null
    : { hue, saturation, lightness };
}

export function normalizeBallColorLabDraft(
  value: unknown,
  presets: readonly CategoryColorPreset[],
): BallColorLabHistoryState | null {
  if (!isPlainObject(value)
    || value.type !== BALL_COLOR_LAB_DRAFT_TYPE
    || value.presetSignature !== createBallColorLabPresetSignature(presets)) {
    return null;
  }
  if (value.version === 1 && Array.isArray(value.values)) {
    const migrated = normalizeValueArray(value.values, presets.length);
    return migrated ? createBallColorLabHistoryState(presets, migrated) : null;
  }
  return value.version === BALL_COLOR_LAB_DRAFT_VERSION ? normalizeHistoryState(value.history, presets) : null;
}

export function serializeBallColorLabDraft(
  history: BallColorLabHistoryState,
  presets: readonly CategoryColorPreset[],
): string {
  const envelope: BallColorLabDraftEnvelopeV2 = {
    type: BALL_COLOR_LAB_DRAFT_TYPE,
    version: BALL_COLOR_LAB_DRAFT_VERSION,
    presetSignature: createBallColorLabPresetSignature(presets),
    history: cloneHistory(history),
  };
  return JSON.stringify(envelope);
}

export function serializeLegacyBallColorLabDraft(
  values: readonly BallColorLabValue[],
  presets: readonly CategoryColorPreset[],
): string {
  const envelope: BallColorLabDraftEnvelopeV1 = {
    type: BALL_COLOR_LAB_DRAFT_TYPE,
    version: BALL_COLOR_LAB_DIFF_VERSION,
    presetSignature: createBallColorLabPresetSignature(presets),
    values: cloneValues(values),
  };
  return JSON.stringify(envelope);
}

export function getCommittedBallColorLabValues(history: BallColorLabHistoryState): BallColorLabValue[] {
  const values = cloneValues(history.historyBaseValues);
  for (const transaction of history.transactions) {
    for (const patch of transaction.patches) {
      if (patch.applied && values[patch.index]) values[patch.index] = { ...patch.after };
    }
  }
  return values;
}

export function getDirtyBallColorLabIndexes(history: BallColorLabHistoryState): number[] {
  const committed = getCommittedBallColorLabValues(history);
  return history.workingValues.flatMap((value, index) => (
    committed[index] && !areBallColorLabValuesEqual(value, committed[index]) ? [index] : []
  ));
}

export function updateBallColorLabWorkingValue(
  history: BallColorLabHistoryState,
  index: number,
  channel: keyof BallColorLabValue,
  nextValue: number,
): BallColorLabHistoryState {
  const next = cloneHistory(history);
  next.workingValues = updateBallColorLabValue(next.workingValues, index, channel, nextValue);
  return next;
}

export function resetBallColorLabWorkingValue(
  history: BallColorLabHistoryState,
  presets: readonly CategoryColorPreset[],
  index: number,
): BallColorLabHistoryState {
  const next = cloneHistory(history);
  next.workingValues = resetBallColorLabValue(next.workingValues, presets, index);
  return next;
}

export function resetAllBallColorLabWorkingValues(
  history: BallColorLabHistoryState,
  presets: readonly CategoryColorPreset[],
): BallColorLabHistoryState {
  const next = cloneHistory(history);
  next.workingValues = createDefaultBallColorLabValues(presets);
  return next;
}

export function discardBallColorLabWorkingValue(
  history: BallColorLabHistoryState,
  index: number,
): BallColorLabHistoryState {
  const next = cloneHistory(history);
  const committed = getCommittedBallColorLabValues(next);
  if (committed[index]) next.workingValues[index] = { ...committed[index] };
  return next;
}

export function discardAllBallColorLabWorkingValues(
  history: BallColorLabHistoryState,
): BallColorLabHistoryState {
  const next = cloneHistory(history);
  next.workingValues = getCommittedBallColorLabValues(next);
  return next;
}

export function commitBallColorLabWorkingValues(
  history: BallColorLabHistoryState,
  presets: readonly CategoryColorPreset[],
  scope: "single" | "all",
  selectedIndex: number,
): BallColorLabHistoryState {
  const next = cloneHistory(history);
  const committed = getCommittedBallColorLabValues(next);
  const dirtyIndexes = getDirtyBallColorLabIndexes(next);
  const targetIndexes = scope === "single"
    ? dirtyIndexes.filter((index) => index === selectedIndex)
    : dirtyIndexes;
  if (targetIndexes.length === 0) return next;
  const patches = targetIndexes.map((index): BallColorLabHistoryPatch => ({
    index,
    name: presets[index]?.name ?? `#${index + 1}`,
    before: { ...committed[index] },
    after: { ...next.workingValues[index] },
    applied: true,
  }));
  next.transactions.push({ id: next.nextTransactionId, scope, patches });
  next.nextTransactionId += 1;
  next.selectedRedo = {};
  next.globalRedo = [];
  compactHistory(next);
  return next;
}

export function canUndoSelectedBallColorLab(history: BallColorLabHistoryState, index: number): boolean {
  return !hasDirtyBallColorLabValues(history) && findLatestAppliedPatch(history, index) !== null;
}

export function canRedoSelectedBallColorLab(history: BallColorLabHistoryState, index: number): boolean {
  return !hasDirtyBallColorLabValues(history) && (history.selectedRedo[String(index)]?.length ?? 0) > 0;
}

export function canUndoAllBallColorLab(history: BallColorLabHistoryState): boolean {
  return !hasDirtyBallColorLabValues(history)
    && history.transactions.some((transaction) => transaction.patches.some((patch) => patch.applied));
}

export function canRedoAllBallColorLab(history: BallColorLabHistoryState): boolean {
  return !hasDirtyBallColorLabValues(history) && history.globalRedo.length > 0;
}

export function undoSelectedBallColorLab(
  history: BallColorLabHistoryState,
  index: number,
): BallColorLabHistoryState {
  const next = cloneHistory(history);
  if (hasDirtyBallColorLabValues(next)) return next;
  const found = findLatestAppliedPatch(next, index);
  if (!found) return next;
  next.transactions[found.transactionIndex].patches[found.patchIndex].applied = false;
  next.globalRedo = [];
  next.selectedRedo = {
    [String(index)]: [
      ...(next.selectedRedo[String(index)] ?? []),
      { transactionId: next.transactions[found.transactionIndex].id, patchIndex: found.patchIndex },
    ],
  };
  next.workingValues = getCommittedBallColorLabValues(next);
  return next;
}

export function redoSelectedBallColorLab(
  history: BallColorLabHistoryState,
  index: number,
): BallColorLabHistoryState {
  const next = cloneHistory(history);
  if (hasDirtyBallColorLabValues(next)) return next;
  const references = next.selectedRedo[String(index)] ?? [];
  const reference = references.pop();
  if (!reference || !setPatchApplied(next, reference, true)) return next;
  next.globalRedo = [];
  next.selectedRedo = references.length > 0 ? { [String(index)]: references } : {};
  next.workingValues = getCommittedBallColorLabValues(next);
  return next;
}

export function undoAllBallColorLab(history: BallColorLabHistoryState): BallColorLabHistoryState {
  const next = cloneHistory(history);
  if (hasDirtyBallColorLabValues(next)) return next;
  for (let transactionIndex = next.transactions.length - 1; transactionIndex >= 0; transactionIndex -= 1) {
    const transaction = next.transactions[transactionIndex];
    const patchIndexes = transaction.patches.flatMap((patch, patchIndex) => patch.applied ? [patchIndex] : []);
    if (patchIndexes.length === 0) continue;
    for (const patchIndex of patchIndexes) transaction.patches[patchIndex].applied = false;
    next.selectedRedo = {};
    next.globalRedo.push({ transactionId: transaction.id, patchIndexes });
    next.workingValues = getCommittedBallColorLabValues(next);
    return next;
  }
  return next;
}

export function redoAllBallColorLab(history: BallColorLabHistoryState): BallColorLabHistoryState {
  const next = cloneHistory(history);
  if (hasDirtyBallColorLabValues(next)) return next;
  const reference = next.globalRedo.pop();
  if (!reference) return next;
  const transaction = next.transactions.find((candidate) => candidate.id === reference.transactionId);
  if (!transaction) return next;
  for (const patchIndex of reference.patchIndexes) {
    if (transaction.patches[patchIndex]) transaction.patches[patchIndex].applied = true;
  }
  next.selectedRedo = {};
  next.workingValues = getCommittedBallColorLabValues(next);
  return next;
}

export function hasDirtyBallColorLabValues(history: BallColorLabHistoryState): boolean {
  return getDirtyBallColorLabIndexes(history).length > 0;
}

export function updateBallColorLabValue(
  values: readonly BallColorLabValue[],
  index: number,
  channel: keyof BallColorLabValue,
  nextValue: number,
): BallColorLabValue[] {
  if (!Number.isInteger(index) || index < 0 || index >= values.length) return cloneValues(values);
  const limits = channel === "hue" ? { min: 0, max: 359 } : { min: 0, max: 100 };
  const normalized = normalizeInteger(nextValue, limits.min, limits.max);
  if (normalized === null) return cloneValues(values);
  return values.map((value, valueIndex) => valueIndex === index
    ? { ...value, [channel]: normalized }
    : { ...value });
}

export function resetBallColorLabValue(
  values: readonly BallColorLabValue[],
  presets: readonly CategoryColorPreset[],
  index: number,
): BallColorLabValue[] {
  if (!Number.isInteger(index) || index < 0 || index >= presets.length) return cloneValues(values);
  const defaults = createDefaultBallColorLabValues(presets);
  return values.map((value, valueIndex) => valueIndex === index ? defaults[index] : { ...value });
}

export function createBallColorLabChanges(
  values: readonly BallColorLabValue[],
  presets: readonly CategoryColorPreset[],
): BallColorLabChange[] {
  const defaults = createDefaultBallColorLabValues(presets);
  return presets.flatMap((preset, index) => {
    const before = defaults[index];
    const after = values[index];
    if (!before || !after || areBallColorLabValuesEqual(before, after)) return [];
    return [{ index, name: preset.name, before: { ...before }, after: { ...after } }];
  });
}

export function createBallColorLabDiffJson(
  values: readonly BallColorLabValue[],
  presets: readonly CategoryColorPreset[],
): string {
  return JSON.stringify({
    type: BALL_COLOR_LAB_DIFF_TYPE,
    version: 1,
    presetSignature: createBallColorLabPresetSignature(presets),
    changes: createBallColorLabChanges(values, presets),
  }, null, 2);
}

export function createBallColorLabTypeScript(
  values: readonly BallColorLabValue[],
  presets: readonly CategoryColorPreset[],
): string {
  const rows = presets.map((preset, index) => {
    const value = values[index] ?? preset;
    return `  { name: ${JSON.stringify(preset.name)}, tone: ${JSON.stringify(preset.tone)}, hue: ${value.hue}, saturation: ${value.saturation}, lightness: ${value.lightness}, visualKind: ${JSON.stringify(preset.visualKind)} },`;
  });
  return ["export const categoryColorPresets: CategoryColorPreset[] = [", ...rows, "];"].join("\n");
}

function normalizeHistoryState(
  value: unknown,
  presets: readonly CategoryColorPreset[],
): BallColorLabHistoryState | null {
  if (!isPlainObject(value)) return null;
  const historyBaseValues = normalizeValueArray(value.historyBaseValues, presets.length);
  const workingValues = normalizeValueArray(value.workingValues, presets.length);
  if (!historyBaseValues || !workingValues || !Array.isArray(value.transactions)
    || value.transactions.length > BALL_COLOR_LAB_HISTORY_LIMIT) return null;
  const transactions: BallColorLabHistoryTransaction[] = [];
  const ids = new Set<number>();
  for (const rawTransaction of value.transactions) {
    if (!isPlainObject(rawTransaction)
      || (rawTransaction.scope !== "single" && rawTransaction.scope !== "all")
      || !Array.isArray(rawTransaction.patches)) return null;
    const id = normalizePositiveInteger(rawTransaction.id);
    if (id === null || ids.has(id)) return null;
    ids.add(id);
    const patches: BallColorLabHistoryPatch[] = [];
    const patchIndexes = new Set<number>();
    for (const rawPatch of rawTransaction.patches) {
      if (!isPlainObject(rawPatch)) return null;
      const index = normalizeIndex(rawPatch.index, presets.length);
      const before = normalizeBallColorLabValue(rawPatch.before);
      const after = normalizeBallColorLabValue(rawPatch.after);
      if (index === null || patchIndexes.has(index) || !before || !after
        || typeof rawPatch.applied !== "boolean") return null;
      patchIndexes.add(index);
      patches.push({ index, name: presets[index].name, before, after, applied: rawPatch.applied });
    }
    if (patches.length === 0) return null;
    transactions.push({ id, scope: rawTransaction.scope, patches });
  }
  const selectedRedo = normalizeSelectedRedo(value.selectedRedo, transactions, presets.length);
  const globalRedo = normalizeGlobalRedo(value.globalRedo, transactions);
  const nextTransactionId = normalizePositiveInteger(value.nextTransactionId);
  const maxId = Math.max(0, ...ids);
  if (!selectedRedo || !globalRedo || nextTransactionId === null || nextTransactionId <= maxId) return null;
  return { historyBaseValues, workingValues, transactions, selectedRedo, globalRedo, nextTransactionId };
}

function normalizeSelectedRedo(
  value: unknown,
  transactions: readonly BallColorLabHistoryTransaction[],
  presetCount: number,
): Record<string, BallColorLabPatchReference[]> | null {
  if (!isPlainObject(value)) return null;
  const result: Record<string, BallColorLabPatchReference[]> = {};
  for (const [key, rawReferences] of Object.entries(value)) {
    const index = normalizeIndex(Number(key), presetCount);
    if (index === null || !Array.isArray(rawReferences)) return null;
    const references: BallColorLabPatchReference[] = [];
    for (const rawReference of rawReferences) {
      const reference = normalizePatchReference(rawReference, transactions);
      if (!reference) return null;
      const transaction = transactions.find((candidate) => candidate.id === reference.transactionId);
      const patch = transaction?.patches[reference.patchIndex];
      if (!patch || patch.index !== index || patch.applied) return null;
      references.push(reference);
    }
    if (references.length > 0) result[key] = references;
  }
  return result;
}

function normalizeGlobalRedo(
  value: unknown,
  transactions: readonly BallColorLabHistoryTransaction[],
): BallColorLabGlobalRedoReference[] | null {
  if (!Array.isArray(value)) return null;
  const result: BallColorLabGlobalRedoReference[] = [];
  for (const rawReference of value) {
    if (!isPlainObject(rawReference) || !Array.isArray(rawReference.patchIndexes)) return null;
    const transactionId = normalizePositiveInteger(rawReference.transactionId);
    if (transactionId === null) return null;
    const transaction = transactions.find((candidate) => candidate.id === transactionId);
    if (!transaction) return null;
    const patchIndexes = rawReference.patchIndexes.map((item) => normalizeIndex(item, transaction.patches.length));
    if (patchIndexes.some((item) => item === null)) return null;
    const normalizedIndexes = patchIndexes as number[];
    if (normalizedIndexes.some((patchIndex) => transaction.patches[patchIndex].applied)) return null;
    result.push({ transactionId, patchIndexes: normalizedIndexes });
  }
  return result;
}

function normalizePatchReference(
  value: unknown,
  transactions: readonly BallColorLabHistoryTransaction[],
): BallColorLabPatchReference | null {
  if (!isPlainObject(value)) return null;
  const transactionId = normalizePositiveInteger(value.transactionId);
  const transaction = transactions.find((candidate) => candidate.id === transactionId);
  const patchIndex = transaction ? normalizeIndex(value.patchIndex, transaction.patches.length) : null;
  return transactionId === null || patchIndex === null ? null : { transactionId, patchIndex };
}

function compactHistory(history: BallColorLabHistoryState): void {
  while (history.transactions.length > BALL_COLOR_LAB_HISTORY_LIMIT) {
    const removed = history.transactions.shift();
    if (!removed) break;
    for (const patch of removed.patches) {
      if (patch.applied) history.historyBaseValues[patch.index] = { ...patch.after };
    }
  }
}

function findLatestAppliedPatch(
  history: BallColorLabHistoryState,
  index: number,
): { transactionIndex: number; patchIndex: number } | null {
  for (let transactionIndex = history.transactions.length - 1; transactionIndex >= 0; transactionIndex -= 1) {
    const patchIndex = history.transactions[transactionIndex].patches.findIndex(
      (patch) => patch.index === index && patch.applied,
    );
    if (patchIndex >= 0) return { transactionIndex, patchIndex };
  }
  return null;
}

function setPatchApplied(
  history: BallColorLabHistoryState,
  reference: BallColorLabPatchReference,
  applied: boolean,
): boolean {
  const transaction = history.transactions.find((candidate) => candidate.id === reference.transactionId);
  const patch = transaction?.patches[reference.patchIndex];
  if (!patch) return false;
  patch.applied = applied;
  return true;
}

function normalizeValueArray(value: unknown, expectedLength: number): BallColorLabValue[] | null {
  if (!Array.isArray(value) || value.length !== expectedLength) return null;
  const normalized = value.map(normalizeBallColorLabValue);
  return normalized.some((item) => item === null) ? null : normalized as BallColorLabValue[];
}

function cloneHistory(history: BallColorLabHistoryState): BallColorLabHistoryState {
  return {
    historyBaseValues: cloneValues(history.historyBaseValues),
    workingValues: cloneValues(history.workingValues),
    transactions: history.transactions.map((transaction) => ({
      ...transaction,
      patches: transaction.patches.map((patch) => ({
        ...patch,
        before: { ...patch.before },
        after: { ...patch.after },
      })),
    })),
    selectedRedo: Object.fromEntries(Object.entries(history.selectedRedo).map(([key, references]) => [
      key,
      references.map((reference) => ({ ...reference })),
    ])),
    globalRedo: history.globalRedo.map((reference) => ({
      transactionId: reference.transactionId,
      patchIndexes: [...reference.patchIndexes],
    })),
    nextTransactionId: history.nextTransactionId,
  };
}

function cloneValues(values: readonly BallColorLabValue[]): BallColorLabValue[] {
  return values.map((value) => ({ ...value }));
}

function areBallColorLabValuesEqual(left: BallColorLabValue, right: BallColorLabValue): boolean {
  return left.hue === right.hue
    && left.saturation === right.saturation
    && left.lightness === right.lightness;
}

function normalizeInteger(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizePositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function normalizeIndex(value: unknown, length: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < length ? value : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
