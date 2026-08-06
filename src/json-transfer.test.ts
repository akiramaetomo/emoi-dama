import { categoryColorPresets } from "./categories.js";
import {
  createDeviceBackupFileName,
  createDeviceBackupPayload,
  createExportFileName,
  createExportPayload,
  isExportSection,
  reviewJsonImport,
} from "./json-transfer.js";
import type { HappyBall, HappyBallLedger } from "./models";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "./settings.js";
import type { HappyBallWorkspaceStore } from "./workspace.js";

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

const workspaceStore: HappyBallWorkspaceStore = {
  v: 1,
  type: "happy-ball-workspace-store",
  activeWorkspaceId: "workspace_self",
  workspaces: [{
    v: 1,
    type: "happy-ball-workspace",
    workspaceId: "workspace_self",
    sourceWorkspaceId: "workspace_self",
    role: "self",
    displayName: "エモ次郎",
    ledger: existingLedger,
    categories: categoryColorPresets,
    appSettings: DEFAULT_APP_SETTINGS,
    createdAt: existingLedger.createdAt,
    updatedAt: existingLedger.updatedAt,
  }],
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
    appSettings: {
      ...DEFAULT_APP_SETTINGS,
      includeDescentGpsInHandoff: true,
      jutsuPhysicsSettings: { ...DEFAULT_APP_SETTINGS.jutsuPhysicsSettings, gravityStrength: 2220 },
    },
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
    workspaceStore,
  },
  "2026-06-29T12:34:56.000Z",
);
assertEqual(exportPayload.type, "happy-ball-export", "export payload should use the export package type");
assertEqual(exportPayload.exportedAt, "2026-06-29T12:34:56.000Z", "export payload should accept deterministic timestamps");
assertEqual(Boolean(exportPayload.ledger), true, "export payload should include selected ledger data");
assertEqual(Boolean(exportPayload.appSettings), true, "export payload should include selected settings data");
assertEqual((exportPayload.appSettings as AppSettings | undefined)?.includeDescentGpsInHandoff, true, "export should preserve handoff GPS sharing state");
assertEqual((exportPayload.appSettings as AppSettings | undefined)?.jutsuPhysicsSettings.gravityStrength, 2220, "export should preserve customized jutsu physics");
assertEqual(Boolean(exportPayload.categories), false, "export payload should omit unselected category data");
assertEqual(Boolean(exportPayload.activityLog), true, "export payload should include selected activity log data");
assertEqual((exportPayload.workspaceStore as HappyBallWorkspaceStore | undefined)?.workspaces.length, 1, "ledger backup should carry every stored workspace");
assertEqual((exportPayload.ledger as HappyBallLedger | undefined)?.balls[0]?.visual.motionClass, "bright", "selective JSON export should persist a legacy ball's recovered motion class");
assertEqual((exportPayload.workspaceStore as HappyBallWorkspaceStore | undefined)?.workspaces[0]?.ledger.balls[0]?.visual.motionClass, "bright", "workspace JSON export should persist motion class in every workspace ledger");
assertEqual(sampleBall.visual.motionClass, undefined, "export enrichment should not mutate the in-memory legacy ball");

const workspaceBackupReview = reviewJsonImport(exportPayload, "backup.json", existingLedger);
assertEqual(workspaceBackupReview.workspaceStore?.workspaces.length, 1, "backup review should recognize a complete workspace store");
assertEqual(workspaceBackupReview.ignoredActivityLog, true, "legacy mixed backups should identify operation logs as intentionally ignored");
const activityOnlyReview = reviewJsonImport({ v: 1, type: "happy-ball-export", sections: ["activityLog"], activityLog: exportPayload.activityLog }, "activity.json", existingLedger);
assertEqual(activityOnlyReview.error, "操作ログは復元対象外です。ほかに読み込めるデータがありませんでした。", "legacy activity-only backups should explain that logs are not restored");

const deviceBackupPayload = createDeviceBackupPayload(workspaceStore, "2026-06-29T12:34:56.000Z");
assertEqual(deviceBackupPayload.type, "happy-ball-device-backup", "new backup should use a dedicated device-backup type");
assertEqual(deviceBackupPayload.workspaceStore.workspaces.length, 1, "device backup should include every workspace");
assertEqual(deviceBackupPayload.workspaceStore.workspaces[0]?.ledger.balls[0]?.visual.motionClass, "bright", "device backup should persist recovered motion class");
assertEqual("activityLog" in deviceBackupPayload, false, "device backup should exclude operation logs");
assertEqual(createDeviceBackupFileName(deviceBackupPayload.exportedAt), "emoi-dama-device-backup-20260629-123456.json", "device backup file name should be deterministic");
const deviceBackupReview = reviewJsonImport(deviceBackupPayload, "device-backup.json", existingLedger);
assertEqual(deviceBackupReview.deviceBackup?.workspaces.length, 1, "device backup review should expose an atomic restore source");
const brokenDeviceBackupReview = reviewJsonImport({ ...deviceBackupPayload, workspaceStore: null }, "broken-device-backup.json", existingLedger);
assertEqual(Boolean(brokenDeviceBackupReview.error), true, "invalid device backup should be rejected");

const gpsBall: HappyBall = {
  ...sampleBall,
  id: "ball_external_with_gps",
  descents: [{
    id: "descent_external_1",
    sequence: 1,
    recordedAt: "2026-06-26T11:00:00.000Z",
    latitude: 35.681236,
    longitude: 139.767125,
    accuracyMeters: 12,
    badgeAwarded: true,
    memo: "外部環境の地点",
  }],
  descentBadgeCount: 1,
};
const multiWorkspaceStore: HappyBallWorkspaceStore = {
  ...workspaceStore,
  activeWorkspaceId: "workspace_external",
  workspaces: [
    workspaceStore.workspaces[0],
    {
      ...workspaceStore.workspaces[0],
      workspaceId: "workspace_external",
      sourceWorkspaceId: "workspace_external",
      role: "received",
      displayName: "外部環境",
      ledger: { ...existingLedger, ledgerId: "ledger_external", balls: [gpsBall] },
      lastImportedAt: "2026-06-29T11:00:00.000Z",
    },
  ],
};
const multiDeviceBackup = createDeviceBackupPayload(multiWorkspaceStore, "2026-06-29T12:35:00.000Z");
assertEqual(multiDeviceBackup.workspaceStore.workspaces.length, 2, "device backup should retain every self and external workspace");
assertEqual(multiDeviceBackup.workspaceStore.activeWorkspaceId, "workspace_external", "device backup should retain the active workspace selection");
assertEqual(multiDeviceBackup.workspaceStore.workspaces[1].ledger.balls[0].descents?.[0].latitude, 35.681236, "device backup should retain complete saved GPS data");
assertEqual(multiDeviceBackup.workspaceStore.workspaces[1].lastImportedAt, "2026-06-29T11:00:00.000Z", "device backup should retain workspace receive metadata");

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
    includeDescentGpsInHandoff: true,
    jutsuPhysicsSettings: { ...DEFAULT_APP_SETTINGS.jutsuPhysicsSettings, gravityStrength: 2220 },
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
assertEqual(importReview.appSettings?.includeDescentGpsInHandoff, true, "settings review should preserve handoff GPS sharing state");
assertEqual(importReview.appSettings?.jutsuPhysicsSettings.gravityStrength, 2220, "settings review should preserve customized jutsu physics");
assertEqual(importReview.categories?.[0]?.name, "新よろこび", "category review should normalize imported category names");

const legacySettingsReview = reviewJsonImport({ soundEnabled: false }, "settings.json", existingLedger);
assertEqual(legacySettingsReview.sections.join(","), "appSettings", "legacy settings JSON should be accepted directly");
assertEqual(legacySettingsReview.appSettings?.soundEnabled, false, "legacy settings JSON should preserve explicit false");
assertEqual(legacySettingsReview.appSettings?.jutsuPhysicsSettings.gravityStrength, 1000, "legacy settings JSON should receive shipped jutsu physics");

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
