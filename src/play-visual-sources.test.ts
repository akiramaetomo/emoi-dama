import type { PhysicsBallSnapshot } from "./ball-stage-renderer.js";
import type { CategoryColorPreset } from "./categories.js";
import type { HappyBall, HappyBallEmotionSnapshot } from "./models.js";
import { planPlayVisualSources } from "./play-visual-sources.js";

const categories: CategoryColorPreset[] = [
  { name: "現在の明色", tone: "bright", hue: 25, saturation: 75, lightness: 60, visualKind: "filled" },
  { name: "現在の暗色", tone: "dark", hue: 220, saturation: 45, lightness: 22, visualKind: "filled" },
  { name: "現在の輪", tone: "future", hue: 145, saturation: 80, lightness: 52, visualKind: "ring" },
];

const older = createBall({
  id: "ball_older",
  createdAt: "2026-07-25T08:00:00.000Z",
  count: 2,
  category: "現在の明色",
});
const newer = createBall({
  id: "ball_newer",
  createdAt: "2026-07-26T08:00:00.000Z",
  count: 1,
  category: "現在の暗色",
});
const ordered = planPlayVisualSources([older, newer], categories, "none", 42, "weak", new Map());
assertEqual(ordered.map((source) => source.id).join(","), "ball_newer_0,ball_older_0,ball_older_1", "sources should be newest-first before instance expansion");

const countZero = planPlayVisualSources([createBall({ id: "ball_zero", count: 0 })], categories, "none", 42, "weak", new Map());
const countOne = planPlayVisualSources([createBall({ id: "ball_one", count: 1 })], categories, "none", 42, "weak", new Map());
const countOver = planPlayVisualSources([createBall({ id: "ball_over", count: 201 })], categories, "none", 42, "weak", new Map());
assertEqual(countZero.length, 1, "zero count should expand to one instance");
assertEqual(countOne.length, 1, "one count should expand to one instance");
assertEqual(countOver.length, 200, "counts above 200 should be capped at 200 instances");
assertEqual(countOver[199]?.id, "ball_over_199", "the capped final instance should retain its stable ID");

const instanceSources = planPlayVisualSources([older], categories, "none", 37, "weak", new Map());
assertDeepEqual(
  instanceSources.map(({ id, ballId, fragmentIndex, baseInstanceId, fragmentGeneration, fragmentOrdinal, radius }) => ({
    id,
    ballId,
    fragmentIndex,
    baseInstanceId,
    fragmentGeneration,
    fragmentOrdinal,
    radius,
  })),
  [
    { id: "ball_older_0", ballId: "ball_older", fragmentIndex: 0, baseInstanceId: "ball_older_0", fragmentGeneration: 0, fragmentOrdinal: 0, radius: 37 },
    { id: "ball_older_1", ballId: "ball_older", fragmentIndex: 1, baseInstanceId: "ball_older_1", fragmentGeneration: 0, fragmentOrdinal: 0, radius: 37 },
  ],
  "multiple instances should retain stable source and initial fragment identity",
);

const knownVisual = planPlayVisualSources([
  createBall({
    id: "ball_known",
    category: "現在の暗色",
    visual: { hue: 1, saturation: 2, lightness: 3, kind: "ring", label: "保存色" },
  }),
], categories, "none", 42, "weak", new Map())[0]!;
assertDeepEqual(
  pickVisual(knownVisual),
  { hue: 220, saturation: 45, lightness: 22, visualKind: "filled", motionClass: "dark" },
  "known categories should use the current preset and tone",
);

const unknownVisual = planPlayVisualSources([
  createBall({
    id: "ball_unknown",
    category: "削除済みカテゴリ",
    visual: { hue: 301, saturation: 33, lightness: 44, kind: "ring", label: "保存色" },
  }),
], categories, "none", 42, "weak", new Map())[0]!;
assertDeepEqual(
  pickVisual(unknownVisual),
  { hue: 301, saturation: 33, lightness: 44, visualKind: "ring", motionClass: "ring" },
  "unknown categories should fall back to their stored snapshot and ring motion",
);

const labelBall = createBall({
  id: "ball_labels",
  date: "2026-07-09",
  subject: "名前五文字",
  title: "12345678901234567",
  visibility: "open",
});
assertLabel(labelBall, "none", "", "label-short");
assertLabel(labelBall, "date", "7/9", "label-short");
assertLabel(labelBall, "name", "名前五文字", "label-medium");
assertLabel(labelBall, "title", "12345678901234567", "label-xlong");
assertLabel(createBall({ title: "123456789", visibility: "open" }), "title", "123456789", "label-long");

const echo = createEcho({ category: "現在の輪" });
const activeEcho = planPlayVisualSources([createBall({ id: "ball_echo", emotionEcho: echo })], categories, "none", 42, "strong", new Map())[0]!;
assert(activeEcho.echo !== null, "active balls should show an available echo when strength is enabled");
assertDeepEqual(
  activeEcho.echo,
  { hue: 145, saturation: 80, lightness: 52, kind: "ring" },
  "echo display should use the current category preset",
);
assert(
  planPlayVisualSources([createBall({ emotionEcho: echo })], categories, "none", 42, "off", new Map())[0]!.echo === null,
  "echo strength off should hide an available echo",
);
assert(
  planPlayVisualSources([createBall({ lifecycleStatus: "archived", emotionEcho: echo })], categories, "none", 42, "strong", new Map())[0]!.echo === null,
  "archived balls should not show echoes",
);
assert(
  planPlayVisualSources([createBall({ emotionEcho: undefined })], categories, "none", 42, "strong", new Map())[0]!.echo === null,
  "balls without an echo should return null",
);

const lifecycleSource = planPlayVisualSources([
  createBall({
    id: "ball_lifecycle",
    lifecycleStatus: "offered",
    descentBadgeCount: 3,
    isKamiBall: true,
    title: "契約タイトル",
  }),
], categories, "none", 58, "weak", new Map())[0]!;
assertDeepEqual(
  {
    lifecycleStatus: lifecycleSource.lifecycleStatus,
    descentBadgeCount: lifecycleSource.descentBadgeCount,
    isKamiBall: lifecycleSource.isKamiBall,
    radius: lifecycleSource.radius,
    title: lifecycleSource.title,
  },
  { lifecycleStatus: "offered", descentBadgeCount: 3, isKamiBall: true, radius: 58, title: "契約タイトル" },
  "lifecycle presentation fields and radius should pass through",
);

const firstSnapshot: PhysicsBallSnapshot = {
  id: "ball_snapshots_0",
  position: { x: 12, y: 34 },
  linvel: { x: 5, y: 6 },
  rotation: 0.5,
  angvel: 0.25,
};
const snapshots = new Map<string, PhysicsBallSnapshot>([[firstSnapshot.id, firstSnapshot]]);
const snapshotBall = createBall({ id: "ball_snapshots", count: 2 });
const ballsBefore = JSON.stringify([snapshotBall]);
const categoriesBefore = JSON.stringify(categories);
const snapshotsBefore = JSON.stringify([...snapshots]);
const snapshotSources = planPlayVisualSources([snapshotBall], categories, "none", 42, "weak", snapshots);
assert(snapshotSources[0]!.snapshot === firstSnapshot, "a snapshot should match its exact instance ID without copying or changing it");
assert(snapshotSources[1]!.snapshot === null, "an instance without a snapshot should use null");
assertEqual(JSON.stringify([snapshotBall]), ballsBefore, "planning should not mutate balls");
assertEqual(JSON.stringify(categories), categoriesBefore, "planning should not mutate category presets");
assertEqual(JSON.stringify([...snapshots]), snapshotsBefore, "planning should not mutate snapshots");

function assertLabel(ball: HappyBall, mode: "none" | "date" | "title" | "name", label: string, labelClass: string): void {
  const source = planPlayVisualSources([ball], categories, mode, 42, "weak", new Map())[0]!;
  assertEqual(source.label, label, `${mode} mode should resolve its display label`);
  assertEqual(source.labelClass, labelClass, `${mode} mode should classify the resolved label length`);
}

function pickVisual(source: ReturnType<typeof planPlayVisualSources>[number]): object {
  return {
    hue: source.hue,
    saturation: source.saturation,
    lightness: source.lightness,
    visualKind: source.visualKind,
    motionClass: source.motionClass,
  };
}

function createBall(overrides: Partial<HappyBall> = {}): HappyBall {
  return {
    id: "ball_sample",
    date: "2026-07-27",
    subject: "本人",
    issuerType: "self",
    issuedBy: "本人",
    enteredBy: "本人",
    approvedBy: null,
    keepers: ["本人"],
    viewers: [],
    count: 1,
    title: "題",
    category: "現在の明色",
    note: "",
    visibility: "open",
    visual: { hue: 10, saturation: 20, lightness: 30, kind: "filled", label: "保存色" },
    lifecycleStatus: "active",
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
    ...overrides,
  };
}

function createEcho(overrides: Partial<HappyBallEmotionSnapshot> = {}): HappyBallEmotionSnapshot {
  return {
    recordedAt: "2026-07-26T00:00:00.000Z",
    date: "2026-07-26",
    subject: "本人",
    issuerType: "self",
    count: 1,
    title: "前の題",
    category: "削除済みカテゴリ",
    note: "",
    visibility: "open",
    visual: { hue: 280, saturation: 20, lightness: 35, kind: "filled", label: "余韻" },
    ...overrides,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}: expected ${expectedJson}, got ${actualJson}`);
  }
}
