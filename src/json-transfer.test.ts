import { categoryColorPresets } from "./categories.js";
import {
  createExportFileName,
  createExportPayload,
  isExportSection,
  reviewJsonImport,
} from "./json-transfer.js";
import type { HappyBall, HappyBallLedger } from "./models";
import { DEFAULT_APP_SETTINGS } from "./settings.js";

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

const existingLedger: HappyBallLedger = {
  v: 1,
  type: "happy-ball-ledger",
  ledgerId: "ledger_existing",
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

const newBall: HappyBall = {
  ...sampleBall,
  id: "ball_20260627_proxy_cd34",
  date: "2026-06-27",
  subject: "友人",
  issuerType: "proxy",
  issuedBy: "友人",
  approvedBy: "友人",
  title: "代理で残したこと",
  updatedAt: "2026-06-27T10:00:00.000Z",
};

const exportPayload = createExportPayload(
  ["ledger", "appSettings", "activityLog"],
  {
    ledger: existingLedger,
    appSettings: DEFAULT_APP_SETTINGS,
    categories: categoryColorPresets,
    activityLog: [
      {
        id: "activity_1",
        recordedAt: "2026-06-29T12:00:00.000Z",
        action: "url-receive",
        status: "success",
        ballId: sampleBall.id,
        title: sampleBall.title,
        sendMode: "casual",
      },
    ],
  },
  "2026-06-29T12:34:56.000Z",
);
assertEqual(exportPayload.type, "happy-ball-export", "export payload should use the export package type");
assertEqual(exportPayload.exportedAt, "2026-06-29T12:34:56.000Z", "export payload should accept deterministic timestamps");
assertEqual(Boolean(exportPayload.ledger), true, "export payload should include selected ledger data");
assertEqual(Boolean(exportPayload.appSettings), true, "export payload should include selected settings data");
assertEqual(Boolean(exportPayload.categories), false, "export payload should omit unselected category data");
assertEqual(Boolean(exportPayload.activityLog), true, "export payload should include selected activity log data");

const fileName = createExportFileName(["ledger", "categories"], "2026-06-29T12:34:56.000Z");
assertEqual(fileName, "emoi-dama-export-ledger-categories-20260629-123456.json", "export file name should be deterministic");
assert(isExportSection("appSettings"), "valid export section should be accepted");
assert(isExportSection("activityLog"), "activity log should be a valid export section");
assert(!isExportSection("settings"), "invalid export section should be rejected");

const importReview = reviewJsonImport({
  v: 1,
  type: "happy-ball-export",
  sections: ["ledger", "appSettings", "categories"],
  ledger: {
    ...existingLedger,
    ownerProfile: {
      name: "エモ次郎",
      nameBook: [
        ...existingLedger.ownerProfile.nameBook,
        { id: "person_friend", name: "友人", role: "proxy" },
      ],
    },
    balls: [
      sampleBall,
      newBall,
      { id: "", title: "broken" },
    ],
  },
  appSettings: {
    ...DEFAULT_APP_SETTINGS,
    soundEnabled: "false",
    gravityEnabled: true,
  },
  categories: [
    { ...categoryColorPresets[0], name: "新よろこび" },
  ],
}, "import.json", existingLedger);
assertEqual(importReview.error, undefined, "import review should accept a full export package");
assertEqual(importReview.sections.join(","), "ledger,appSettings,categories", "import review should preserve detected sections");
assertEqual(importReview.ledger?.newItems.length, 1, "ledger review should identify new balls");
assertEqual(importReview.ledger?.duplicates.length, 1, "ledger review should identify duplicate balls");
assertEqual(importReview.ledger?.rejectedItemCount, 1, "ledger review should count rejected stored balls");
assertEqual(importReview.ledger?.nameBookToAdd[0]?.name, "友人", "ledger review should collect importable name book entries");
assertEqual(importReview.appSettings?.soundEnabled, DEFAULT_APP_SETTINGS.soundEnabled, "settings review should reject string boolean values");
assertEqual(importReview.appSettings?.gravityEnabled, true, "settings review should preserve real boolean values");
assertEqual(importReview.categories?.[0]?.name, "新よろこび", "category review should normalize imported category names");

const legacySettingsReview = reviewJsonImport({ soundEnabled: false }, "settings.json", existingLedger);
assertEqual(legacySettingsReview.sections.join(","), "appSettings", "legacy settings JSON should be accepted directly");
assertEqual(legacySettingsReview.appSettings?.soundEnabled, false, "legacy settings JSON should preserve explicit false");

const unknownReview = reviewJsonImport({ hello: "world" }, "unknown.json", existingLedger);
assertEqual(Boolean(unknownReview.error), true, "unknown JSON should return a review error");

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
