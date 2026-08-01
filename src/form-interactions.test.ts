import {
  createBallDraftFromValues,
  createEditedDescentRecordFromValues,
  hasBallDraftChanged,
  haveDescentRecordsChanged,
  resolveManualSubjectPreset,
  resolveNamePresetSelection,
} from "./form-interactions.js";
import type { BallDraft, HappyBall } from "./models.js";

assertDeepEqual(
  resolveNamePresetSelection({ name: " エモ次郎 ", role: "self", issuerType: "proxy" }),
  { subject: "エモ次郎", issuerType: "self" },
  "selecting a self name should copy the name and leave proxy mode",
);

assertDeepEqual(
  resolveNamePresetSelection({ name: "代理さん", role: "proxy", issuerType: "self" }),
  { subject: "代理さん", issuerType: "proxy" },
  "selecting a proxy name should copy the name and select proxy mode",
);

assert(
  resolveManualSubjectPreset("自由な名前", "エモ次郎") === "",
  "manual input that differs from the selected name should clear the preset",
);

assert(
  resolveManualSubjectPreset("エモ次郎", "エモ次郎") === "エモ次郎",
  "unchanged manual input should keep the matching preset",
);

const defaults = {
  date: "2026-07-27",
  subject: "エモ次郎",
  currentTime: "14:35",
};
const draft = createBallDraftFromValues(valueReader({
  timeEnabled: "on",
  issuerType: "proxy",
  count: "5",
  title: " 変換する玉 ",
  category: "未来",
  note: "メモ",
  visibility: "title",
}), defaults);
assertDeepEqual(draft, {
  date: "2026-07-27",
  time: "14:35",
  subject: "エモ次郎",
  issuerType: "proxy",
  count: 5,
  title: " 変換する玉 ",
  category: "未来",
  note: "メモ",
  visibility: "title",
}, "draft parsing should preserve entered text and apply explicit fallbacks");

const noTimeDraft = createBallDraftFromValues(valueReader({
  date: "2026-08-01",
  time: "09:20",
  issuerType: "unknown",
  visibility: "unknown",
}), defaults);
assert(noTimeDraft.time === undefined, "disabled timestamp recording should omit time");
assert(noTimeDraft.issuerType === "self", "unknown issuer type should use the stable self fallback");
assert(noTimeDraft.visibility === "open", "unknown visibility should use the stable open fallback");

const positionedRecord = createEditedDescentRecordFromValues({
  id: "descent_7",
  sequence: "7.9",
  recordedAt: "2026-07-27T05:00:00.000Z",
  badgeAwarded: "false",
  memo: "現地メモ",
  latitude: "35.681236",
  longitude: "139.767125",
  accuracyMeters: "12.5",
  distanceFromPreviousMeters: "450",
}, 0, "fallback");
assertDeepEqual(positionedRecord, {
  id: "descent_7",
  sequence: 7,
  recordedAt: "2026-07-27T05:00:00.000Z",
  badgeAwarded: false,
  memo: "現地メモ",
  latitude: 35.681236,
  longitude: 139.767125,
  accuracyMeters: 12.5,
  distanceFromPreviousMeters: 450,
}, "descent parsing should convert stable hidden-field values");

const incompletePosition = createEditedDescentRecordFromValues({ latitude: "35.0", longitude: "" }, 2, "2026-07-27T06:00:00.000Z");
assertDeepEqual(incompletePosition, {
  id: "edited_descent_3",
  sequence: 1,
  recordedAt: "2026-07-27T06:00:00.000Z",
  badgeAwarded: true,
  memo: "",
}, "a partial coordinate pair should remain a GPS-less descent");

const ball = createBallFixture(draft);
assert(!hasBallDraftChanged(ball, { ...draft, title: "変換する玉", subject: "エモ次郎 " }), "comparison should ignore saved text-edge whitespace");
assert(hasBallDraftChanged(ball, { ...draft, visibility: "open" }), "comparison should detect a stable draft field change");
assert(!haveDescentRecordsChanged([positionedRecord], [{ ...positionedRecord }]), "equal descent records should remain unchanged");
assert(haveDescentRecordsChanged([positionedRecord], [{ ...positionedRecord, memo: "変更" }]), "descent memo changes should be detected");

function valueReader(values: Record<string, string>) {
  return {
    get(name: string): string | null {
      return values[name] ?? null;
    },
  };
}

function createBallFixture(source: BallDraft): HappyBall {
  return {
    ...source,
    subject: source.subject.trim(),
    title: source.title.trim(),
    category: source.category.trim(),
    note: source.note.trim(),
    id: "ball_test",
    issuedBy: "エモ次郎",
    enteredBy: "エモ次郎",
    approvedBy: null,
    keepers: [],
    viewers: [],
    visual: { hue: 40, saturation: 70, lightness: 60, kind: "filled", label: "日常" },
    lifecycleStatus: "active",
    createdAt: "2026-07-27T05:00:00.000Z",
    updatedAt: "2026-07-27T05:00:00.000Z",
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertDeepEqual<T>(actual: T, expected: T, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
