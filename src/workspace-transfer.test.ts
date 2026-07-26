import { categoryColorPresets } from "./categories.js";
import type { HappyBall, HappyBallLedger } from "./models.js";
import { DEFAULT_APP_SETTINGS } from "./settings.js";
import {
  applyWorkspaceShareToExisting,
  countWorkspaceShareBalls,
  createWorkspaceFromShare,
  createWorkspaceShareBundle,
  markBallsImportedFromWorkspace,
  reviewWorkspaceShare,
  selectWorkspaceShareBalls,
} from "./workspace-transfer.js";
import type { HappyBallWorkspace } from "./workspace.js";

Object.defineProperty(globalThis, "crypto", {
  value: { getRandomValues: (array: Uint8Array) => { array.fill(9); return array; } },
  configurable: true,
});

const ball: HappyBall = {
  id: "ball_legacy",
  date: "2026-07-26",
  subject: "父",
  issuerType: "self",
  issuedBy: "父",
  enteredBy: "父",
  approvedBy: null,
  keepers: [],
  viewers: [],
  count: 1,
  title: "散歩",
  category: "日常",
  note: "",
  visibility: "open",
  visual: { hue: 20, saturation: 40, lightness: 50, kind: "filled", label: "散歩" },
  lifecycleStatus: "active",
  createdAt: "2026-07-26T01:00:00.000Z",
  updatedAt: "2026-07-26T01:00:00.000Z",
};
const ledger: HappyBallLedger = {
  v: 1,
  type: "happy-ball-ledger",
  ledgerId: "ledger_legacy",
  ownerProfile: { name: "父", nameBook: [] },
  balls: [ball],
  createdAt: ball.createdAt,
  updatedAt: ball.updatedAt,
};
const workspace: HappyBallWorkspace = {
  v: 1,
  type: "happy-ball-workspace",
  workspaceId: "workspace_source",
  sourceWorkspaceId: "workspace_source",
  role: "self",
  displayName: "父",
  ledger,
  categories: categoryColorPresets,
  appSettings: DEFAULT_APP_SETTINGS,
  createdAt: ball.createdAt,
  updatedAt: ball.updatedAt,
};

const periodBalls = [
  { ...ball, id: "ball_before", date: "2026-07-24", count: 9 },
  { ...ball, id: "ball_from", date: "2026-07-25", count: 2, lifecycleStatus: "archived" as const },
  { ...ball, id: "ball_middle", date: "2026-07-26", count: 1, lifecycleStatus: "active" as const },
  { ...ball, id: "ball_to", date: "2026-07-27", count: 3, lifecycleStatus: "offered" as const },
  { ...ball, id: "ball_after", date: "2026-07-28", count: 7 },
];
const selectedPeriodBalls = selectWorkspaceShareBalls(periodBalls, "2026-07-25", "2026-07-27");
assert(selectedPeriodBalls.length === 3, "period selection should include both boundaries and every lifecycle state");
assert(selectedPeriodBalls.map((item) => item.lifecycleStatus).join(",") === "archived,active,offered", "period selection should retain all lifecycle states");
assert(countWorkspaceShareBalls(selectedPeriodBalls) === 6, "workspace share count should sum each record's ball count");
assert(selectWorkspaceShareBalls(periodBalls, "2026-07-26", "2026-07-26").map((item) => item.id).join() === "ball_middle", "equal dates should select that one day only");
assert(selectWorkspaceShareBalls(periodBalls, "2026-07-28", "2026-07-25").length === 0, "a reversed period should select nothing");
assert(selectWorkspaceShareBalls(periodBalls, "2026-07-29", "2026-07-30").length === 0, "an empty period should select nothing");
const bundle = createWorkspaceShareBundle(workspace, [ball], { from: ball.date, to: ball.date, selection: "period" }, "ABC", "2026-07-26T02:00:00.000Z");
assert(bundle.bundleId === "bundle_09090909090909090909090909090909", "share bundles should use 128-bit IDs");
assert(bundle.categories.length === categoryColorPresets.length, "share bundles should carry all category definitions");
assert(bundle.appSettings.maxSpeed === DEFAULT_APP_SETTINGS.maxSpeed, "share bundles should carry all app settings");
assert(bundle.type === "happy-ball-workspace-share" && bundle.ledger.balls.length === 1, "an all-selected workspace share should remain a one-workspace share schema");
const gpsBall = {
  ...ball,
  id: "ball_with_gps",
  descents: [{
    id: "descent_1",
    sequence: 1,
    recordedAt: "2026-07-26T01:30:00.000Z",
    latitude: 35.681236,
    longitude: 139.767125,
    accuracyMeters: 12,
    badgeAwarded: true,
    memo: "駅前",
  }],
  descentBadgeCount: 1,
};
const gpsHiddenBundle = createWorkspaceShareBundle(workspace, [gpsBall], { from: ball.date, to: ball.date, selection: "period" }, "ABC", "2026-07-26T02:00:00.000Z");
assert(gpsHiddenBundle.ledger.balls[0].descents?.[0].latitude === undefined, "workspace share should omit GPS when the source sharing setting is off");
const gpsSharedBundle = createWorkspaceShareBundle({
  ...workspace,
  appSettings: { ...workspace.appSettings, includeDescentGpsInHandoff: true },
}, [gpsBall], { from: ball.date, to: ball.date, selection: "period" }, "ABC", "2026-07-26T02:00:00.000Z");
assert(gpsSharedBundle.ledger.balls[0].descents?.[0].latitude === 35.681236, "workspace share should retain GPS only when its sharing setting is on");
const duplicateReview = reviewWorkspaceShare(bundle, [ball]);
assert(duplicateReview?.review.duplicates.length === 1, "review should classify an identical existing ball as registered");
const conflictReview = reviewWorkspaceShare({ ...bundle, ledger: { ...bundle.ledger, balls: [{ ...ball, title: "変更" }] } }, [ball]);
assert(conflictReview?.review.conflicts.length === 1, "review should classify same-ID changed content as a conflict");
const laterBall = { ...ball, id: "ball_new_on_second_receive", title: "翌日の散歩", date: "2026-07-27" };
const secondReview = reviewWorkspaceShare({ ...bundle, ledger: { ...bundle.ledger, balls: [ball, laterBall] } }, [ball]);
assert(secondReview?.review.duplicates.length === 1 && secondReview.review.newItems.length === 1, "re-receiving a source workspace should add only newly seen balls");
const imported = markBallsImportedFromWorkspace([ball], workspace.workspaceId, "2026-07-26T03:00:00.000Z");
assert(imported[0].provenance?.preserveVisualSnapshot === true, "self-ledger imports should retain source visual meaning");

const incomingName = { id: "person_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", name: "子", role: "proxy" as const };
const changedBundle = {
  ...bundle,
  ledger: {
    ...bundle.ledger,
    ownerProfile: { ...bundle.ledger.ownerProfile, nameBook: [incomingName] },
    balls: [{ ...ball, title: "編集済み" }, laterBall],
  },
  categories: bundle.categories.map((category, index) => index === 0 ? { ...category, name: "変更カテゴリ" } : category),
  appSettings: { ...bundle.appSettings, soundEnabled: !bundle.appSettings.soundEnabled },
};
const addOnly = applyWorkspaceShareToExisting(workspace, changedBundle, {
  addNewBalls: true,
  addNameBookEntries: false,
  replaceCategories: false,
  replaceAppSettings: false,
  replaceConflicts: false,
}, "2026-07-26T04:00:00.000Z");
assert(addOnly.addedCount === 1 && addOnly.workspace.ledger.balls.length === 2, "default import should add only new balls");
assert(addOnly.workspace.ledger.balls.find((item) => item.id === ball.id)?.title === ball.title, "default import should preserve conflicts");
assert(addOnly.workspace.categories[0].name === workspace.categories[0].name, "default import should preserve categories");
assert(addOnly.workspace.appSettings.soundEnabled === workspace.appSettings.soundEnabled, "default import should preserve app settings");

const selectedApply = applyWorkspaceShareToExisting(workspace, changedBundle, {
  addNewBalls: false,
  addNameBookEntries: true,
  replaceCategories: true,
  replaceAppSettings: true,
  replaceConflicts: true,
}, "2026-07-26T05:00:00.000Z");
assert(selectedApply.replacedConflictCount === 1, "explicit conflict selection should replace changed same-ID balls");
assert(selectedApply.workspace.ledger.balls[0].title === "編集済み", "conflict replacement should use incoming content");
assert(selectedApply.addedNameCount === 1 && selectedApply.workspace.ledger.ownerProfile.nameBook[0].id === incomingName.id, "selected name import should add missing people");
assert(selectedApply.workspace.ledger.ownerProfile.name === workspace.ledger.ownerProfile.name, "name import should preserve the target owner name");
assert(selectedApply.workspace.categories[0].name === "変更カテゴリ", "selected category import should replace the snapshot");
assert(selectedApply.workspace.appSettings.soundEnabled === changedBundle.appSettings.soundEnabled, "selected app settings import should replace the snapshot");

const separate = createWorkspaceFromShare(bundle, "2026-07-26T06:00:00.000Z");
assert(separate.workspaceId === bundle.sourceWorkspaceId && separate.role === "received", "separate import should preserve source identity and origin");
assert(separate.ledger.balls.length === bundle.ledger.balls.length && separate.categories.length === bundle.categories.length, "separate import should retain the complete shared snapshot");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
