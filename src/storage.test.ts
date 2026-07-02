import type { HappyBall, HappyBallLedger } from "./models";
import { clearBallData, createDefaultDraft, DEFAULT_SAMPLE_NAME, normalizeStoredLedger, resetNameBook, updateBall } from "./storage.js";

Object.defineProperty(globalThis, "localStorage", {
  value: {
    setItem(): void {
      // Storage persistence is covered in the browser runtime; these tests inspect returned ledgers.
    },
    getItem(): string | null {
      return null;
    },
    removeItem(): void {},
  },
  configurable: true,
});

const sampleBall: HappyBall = {
  id: "ball_20260626_self_ab12",
  date: "2026-06-26",
  subject: "エモ次郎",
  issuerType: "self",
  issuedBy: "エモ次郎",
  enteredBy: "エモ次郎",
  approvedBy: null,
  keepers: ["エモ次郎"],
  viewers: [],
  count: 1,
  title: "夕方の空がよかった",
  category: "日常",
  note: "少し涼しかった",
  visibility: "category",
  visual: {
    hue: 214,
    saturation: 42,
    lightness: 54,
    kind: "filled",
    label: "夕方の空",
  },
  lifecycleStatus: "active",
  createdAt: "2026-06-26T10:00:00.000Z",
  updatedAt: "2026-06-26T10:00:00.000Z",
};

const sampleLedger: HappyBallLedger = {
  v: 1,
  type: "happy-ball-ledger",
  ledgerId: "ledger_test",
  ownerProfile: {
    name: "エモ次郎",
    nameBook: [
      {
        id: "person_emojirou",
        name: "エモ次郎",
        role: "self",
      },
    ],
  },
  balls: [sampleBall],
  createdAt: "2026-06-26T09:00:00.000Z",
  updatedAt: "2026-06-26T10:00:00.000Z",
};

const mixedRecovery = normalizeStoredLedger({
  ...sampleLedger,
  balls: [
    sampleBall,
    null,
    { ...sampleBall, id: "" },
  ],
});
assertEqual(mixedRecovery.ledger.balls.length, 1, "mixed stored ledger should salvage valid balls");
assertEqual(mixedRecovery.ledger.balls[0]?.id, sampleBall.id, "salvaged ball should keep its ID");
assertEqual(mixedRecovery.rejectedBallCount, 2, "mixed stored ledger should count rejected ball records");
assert(mixedRecovery.shouldSave, "mixed stored ledger should be rewritten after rejecting invalid records");

const legacyVisualRecovery = normalizeStoredLedger({
  ...sampleLedger,
  balls: [
    {
      ...sampleBall,
      count: 500,
      visual: undefined,
    },
  ],
});
assertEqual(legacyVisualRecovery.ledger.balls.length, 1, "legacy visual recovery should keep the ball");
assertEqual(legacyVisualRecovery.ledger.balls[0]?.count, 99, "legacy visual recovery should clamp unsafe counts");
assertEqual(legacyVisualRecovery.ledger.balls[0]?.visual.label, "夕方の空", "legacy visual recovery should recreate a readable label");
assertEqual(typeof legacyVisualRecovery.ledger.balls[0]?.visual.hue, "number", "legacy visual recovery should recreate a hue");
assertEqual(legacyVisualRecovery.ledger.balls[0]?.visual.kind, "filled", "legacy visual recovery should use filled visuals");
assert(legacyVisualRecovery.shouldSave, "legacy visual recovery should be rewritten with a stable visual");

const legacyHiddenRecovery = normalizeStoredLedger({
  ...sampleLedger,
  balls: [
    {
      ...sampleBall,
      visibility: "hidden",
    },
  ],
});
assertEqual(legacyHiddenRecovery.ledger.balls[0]?.visibility, "category", "legacy hidden visibility should normalize to category");
assert(legacyHiddenRecovery.shouldSave, "legacy hidden visibility should be rewritten to the current ladder");

const emptyRecovery = normalizeStoredLedger({ type: "wrong", v: 1, balls: [sampleBall] });
assertEqual(emptyRecovery.ledger.balls.length, 0, "invalid ledger envelope should fall back to an empty ledger");
assertEqual(emptyRecovery.ledger.ownerProfile.name, DEFAULT_SAMPLE_NAME, "invalid ledger envelope should use the default sample name");
assertEqual(emptyRecovery.rejectedBallCount, 0, "invalid ledger envelope should not report item-level rejections");

const defaultDraft = createDefaultDraft();
assertEqual(defaultDraft.visibility, "open", "new ball drafts should default to memo-visible sharing");

const clearedBallData = clearBallData(sampleLedger);
assertEqual(clearedBallData.balls.length, 0, "clearing ball data should remove saved balls");
assertEqual(clearedBallData.ownerProfile.name, sampleLedger.ownerProfile.name, "clearing ball data should keep the owner profile name");
assertEqual(clearedBallData.ownerProfile.nameBook.length, sampleLedger.ownerProfile.nameBook.length, "clearing ball data should keep the name book");

const resetNameBookLedger = resetNameBook({
  ...sampleLedger,
  ownerProfile: {
    name: "利用者",
    nameBook: [
      { id: "person_user", name: "利用者", role: "self" },
      { id: "person_proxy", name: "代理相手", role: "proxy" },
    ],
  },
});
assertEqual(resetNameBookLedger.ownerProfile.name, DEFAULT_SAMPLE_NAME, "resetting the name book should restore the default sample name");
assertEqual(resetNameBookLedger.ownerProfile.nameBook.length, 1, "resetting the name book should restore a single default entry");
assertEqual(resetNameBookLedger.balls.length, sampleLedger.balls.length, "resetting the name book should keep saved balls");

const editedDraft = {
  date: sampleBall.date,
  subject: sampleBall.subject,
  issuerType: sampleBall.issuerType,
  count: sampleBall.count,
  title: "夕方の空を訂正した",
  category: "よろこび",
  note: sampleBall.note,
  visibility: sampleBall.visibility,
};
const echoSaved = updateBall(sampleLedger, sampleBall.id, editedDraft, "withEcho");
const echoSavedBall = echoSaved.balls[0];
assertEqual(echoSavedBall?.title, editedDraft.title, "echo save should update the current ball");
assertEqual(echoSavedBall?.emotionEcho?.title, sampleBall.title, "echo save should preserve the previous title as echo data");
assertEqual(echoSavedBall?.emotionEcho?.category, sampleBall.category, "echo save should preserve the previous category as echo data");
assertEqual(echoSavedBall?.visual.kind, "filled", "normal categories should keep filled visuals");

const correctionDraft = {
  ...editedDraft,
  title: "夕方の空をさらに訂正した",
  category: "しみじみ",
};
const correctionSaved = updateBall(echoSaved, sampleBall.id, correctionDraft, "correction");
const correctionSavedBall = correctionSaved.balls[0];
assertEqual(correctionSavedBall?.title, correctionDraft.title, "correction save should update the current ball");
assertEqual(correctionSavedBall?.emotionEcho?.title, sampleBall.title, "correction save should keep the existing echo");
assertEqual(correctionSavedBall?.emotionEcho?.category, sampleBall.category, "correction save should not replace the existing echo");

const correctionWithoutEcho = updateBall(sampleLedger, sampleBall.id, correctionDraft, "correction");
assert(!correctionWithoutEcho.balls[0]?.emotionEcho, "correction save should not create a new echo when none exists");

const sakisakiDraft = {
  ...editedDraft,
  category: "先々・予定",
};
const sakisakiSaved = updateBall(sampleLedger, sampleBall.id, sakisakiDraft, "withEcho");
assertEqual(sakisakiSaved.balls[0]?.visual.kind, "ring", "sakisaki categories should create ring visuals");
assertEqual(sakisakiSaved.balls[0]?.emotionEcho?.visual.kind, "filled", "echo snapshots should preserve the previous visual kind");

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
