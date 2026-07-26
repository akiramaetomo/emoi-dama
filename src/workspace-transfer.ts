import { normalizeCategoryColorPresets, type CategoryColorPreset } from "./categories.js";
import { createDurableId } from "./durable-id.js";
import type { HappyBall, HappyBallLedger } from "./models.js";
import { createBallPacket, normalizePacketBall, PACKET_TYPE, reviewPacketImport, type PacketImportReview } from "./packet.js";
import { normalizeAppSettings, type AppSettings } from "./settings.js";
import { MAX_NAME_BOOK_ENTRIES } from "./storage.js";
import type { HappyBallWorkspace } from "./workspace.js";

export const WORKSPACE_SHARE_TYPE = "happy-ball-workspace-share";

export interface WorkspaceSharePeriod {
  from: string;
  to: string;
  selection: "period" | "explicit";
}

export interface WorkspaceShareBundleV1 {
  v: 1;
  type: typeof WORKSPACE_SHARE_TYPE;
  sourceWorkspaceId: string;
  bundleId: string;
  sourceDisplayCode: string;
  sourceDisplayName: string;
  exportedAt: string;
  period: WorkspaceSharePeriod;
  ledger: HappyBallLedger;
  categories: CategoryColorPreset[];
  appSettings: AppSettings;
}

export interface WorkspaceShareReview {
  bundle: WorkspaceShareBundleV1;
  review: PacketImportReview;
  rejectedItemCount: number;
}

export interface WorkspaceImportSelection {
  addNewBalls: boolean;
  addNameBookEntries: boolean;
  replaceCategories: boolean;
  replaceAppSettings: boolean;
  replaceConflicts: boolean;
}

export interface WorkspaceImportApplyResult {
  workspace: HappyBallWorkspace;
  addedCount: number;
  duplicateCount: number;
  conflictCount: number;
  replacedConflictCount: number;
  addedNameCount: number;
  changed: boolean;
}

export function selectWorkspaceShareBalls(
  balls: HappyBall[],
  from: string,
  to: string,
): HappyBall[] {
  if (!from || !to || from > to) {
    return [];
  }
  return balls.filter((ball) => ball.date >= from && ball.date <= to);
}

export function countWorkspaceShareBalls(balls: HappyBall[]): number {
  return balls.reduce((total, ball) => total + ball.count, 0);
}

export function createWorkspaceShareBundle(
  workspace: HappyBallWorkspace,
  balls: HappyBall[],
  period: WorkspaceSharePeriod,
  sourceDisplayCode: string,
  exportedAt = new Date().toISOString(),
): WorkspaceShareBundleV1 {
  const items = balls.map((ball) => createBallPacket(ball, exportedAt, {
    sendMode: "formal",
    includeDescentGps: workspace.appSettings.includeDescentGpsInHandoff,
  }).items[0]);
  return {
    v: 1,
    type: WORKSPACE_SHARE_TYPE,
    sourceWorkspaceId: workspace.sourceWorkspaceId,
    bundleId: createDurableId("bundle"),
    sourceDisplayCode,
    sourceDisplayName: workspace.displayName,
    exportedAt,
    period,
    ledger: {
      ...workspace.ledger,
      balls: items,
    },
    categories: workspace.categories.map((category) => ({ ...category })),
    appSettings: normalizeAppSettings(workspace.appSettings),
  };
}

export function reviewWorkspaceShare(
  value: unknown,
  existingBalls: HappyBall[],
): WorkspaceShareReview | null {
  if (!isObject(value)
    || value.v !== 1
    || value.type !== WORKSPACE_SHARE_TYPE
    || typeof value.sourceWorkspaceId !== "string"
    || typeof value.bundleId !== "string"
    || !isObject(value.ledger)
    || typeof value.ledger.ledgerId !== "string"
    || !value.ledger.ledgerId.trim()
    || !Array.isArray(value.ledger.balls)
    || !Array.isArray(value.categories)
    || !isObject(value.appSettings)) {
    return null;
  }
  const balls = value.ledger.balls.map(normalizePacketBall).filter((ball): ball is HappyBall => Boolean(ball));
  if (balls.length === 0) {
    return null;
  }
  const ownerProfile = normalizeOwnerProfile(value.ledger.ownerProfile);
  const ledger: HappyBallLedger = {
    v: 1,
    type: "happy-ball-ledger",
    ledgerId: value.ledger.ledgerId.trim(),
    ownerProfile,
    balls,
    createdAt: readString(value.ledger.createdAt, value.exportedAt),
    updatedAt: readString(value.ledger.updatedAt, value.exportedAt),
  };
  const bundle: WorkspaceShareBundleV1 = {
    v: 1,
    type: WORKSPACE_SHARE_TYPE,
    sourceWorkspaceId: value.sourceWorkspaceId,
    bundleId: value.bundleId,
    sourceDisplayCode: readString(value.sourceDisplayCode, "---").slice(0, 8),
    sourceDisplayName: readString(value.sourceDisplayName, ownerProfile.name),
    exportedAt: readString(value.exportedAt, new Date().toISOString()),
    period: normalizePeriod(value.period),
    ledger,
    categories: normalizeCategoryColorPresets(value.categories),
    appSettings: normalizeAppSettings(value.appSettings),
  };
  const packet = { v: 1, type: PACKET_TYPE, mode: "append", exportedAt: bundle.exportedAt, items: balls } as const;
  return {
    bundle,
    review: reviewPacketImport(packet, existingBalls),
    rejectedItemCount: value.ledger.balls.length - balls.length,
  };
}

export function markBallsImportedFromWorkspace(
  balls: HappyBall[],
  sourceWorkspaceId: string,
  importedAt = new Date().toISOString(),
): HappyBall[] {
  return balls.map((ball) => ({
    ...ball,
    provenance: {
      sourceWorkspaceId,
      importedAt,
      preserveVisualSnapshot: true,
    },
  }));
}

export function applyWorkspaceShareToExisting(
  target: HappyBallWorkspace,
  bundle: WorkspaceShareBundleV1,
  selection: WorkspaceImportSelection,
  importedAt = new Date().toISOString(),
): WorkspaceImportApplyResult {
  const reviewed = reviewWorkspaceShare(bundle, target.ledger.balls);
  if (!reviewed) {
    return {
      workspace: target,
      addedCount: 0,
      duplicateCount: 0,
      conflictCount: 0,
      replacedConflictCount: 0,
      addedNameCount: 0,
      changed: false,
    };
  }

  const incomingNew = selection.addNewBalls
    ? markBallsImportedFromWorkspace(reviewed.review.newItems, bundle.sourceWorkspaceId, importedAt)
    : [];
  const incomingConflicts = selection.replaceConflicts
    ? markBallsImportedFromWorkspace(reviewed.review.conflicts, bundle.sourceWorkspaceId, importedAt)
    : [];
  const replacementById = new Map(incomingConflicts.map((ball) => [ball.id, ball]));
  const existingNameIds = new Set(target.ledger.ownerProfile.nameBook.map((entry) => entry.id));
  const namesToAdd = selection.addNameBookEntries
    ? bundle.ledger.ownerProfile.nameBook
      .filter((entry) => !existingNameIds.has(entry.id))
      .slice(0, Math.max(0, MAX_NAME_BOOK_ENTRIES - target.ledger.ownerProfile.nameBook.length))
    : [];
  const changed = incomingNew.length > 0
    || incomingConflicts.length > 0
    || namesToAdd.length > 0
    || selection.replaceCategories
    || selection.replaceAppSettings;

  if (!changed) {
    return {
      workspace: target,
      addedCount: 0,
      duplicateCount: reviewed.review.duplicates.length,
      conflictCount: reviewed.review.conflicts.length,
      replacedConflictCount: 0,
      addedNameCount: 0,
      changed: false,
    };
  }

  return {
    workspace: {
      ...target,
      ledger: {
        ...target.ledger,
        ownerProfile: {
          ...target.ledger.ownerProfile,
          nameBook: [...target.ledger.ownerProfile.nameBook, ...namesToAdd],
        },
        balls: [
          ...incomingNew,
          ...target.ledger.balls.map((ball) => replacementById.get(ball.id) ?? ball),
        ],
        updatedAt: importedAt,
      },
      categories: selection.replaceCategories
        ? bundle.categories.map((category) => ({ ...category }))
        : target.categories,
      appSettings: selection.replaceAppSettings
        ? normalizeAppSettings(bundle.appSettings)
        : target.appSettings,
      updatedAt: importedAt,
      lastImportedAt: importedAt,
    },
    addedCount: incomingNew.length,
    duplicateCount: reviewed.review.duplicates.length,
    conflictCount: reviewed.review.conflicts.length,
    replacedConflictCount: incomingConflicts.length,
    addedNameCount: namesToAdd.length,
    changed: true,
  };
}

export function createWorkspaceFromShare(
  bundle: WorkspaceShareBundleV1,
  importedAt = new Date().toISOString(),
): HappyBallWorkspace {
  return {
    v: 1,
    type: "happy-ball-workspace",
    workspaceId: bundle.sourceWorkspaceId,
    sourceWorkspaceId: bundle.sourceWorkspaceId,
    role: "received",
    displayName: bundle.sourceDisplayName,
    ledger: {
      ...bundle.ledger,
      ownerProfile: {
        ...bundle.ledger.ownerProfile,
        nameBook: bundle.ledger.ownerProfile.nameBook.map((entry) => ({ ...entry })),
      },
      balls: bundle.ledger.balls.map((ball) => ({ ...ball })),
    },
    categories: bundle.categories.map((category) => ({ ...category })),
    appSettings: normalizeAppSettings(bundle.appSettings),
    createdAt: importedAt,
    updatedAt: importedAt,
    lastImportedAt: importedAt,
  };
}

function normalizeOwnerProfile(value: unknown): HappyBallLedger["ownerProfile"] {
  if (!isObject(value)) {
    return { name: "受信した利用環境", nameBook: [] };
  }
  const name = readString(value.name, "受信した利用環境");
  const nameBook = Array.isArray(value.nameBook)
    ? value.nameBook.flatMap((item) => {
      if (!isObject(item)) {
        return [];
      }
      const itemName = readString(item.name, "");
      const itemId = readString(item.id, "");
      if (!itemName || !itemId) {
        return [];
      }
      return [{
        id: itemId,
        name: itemName,
        role: item.role === "proxy" ? "proxy" as const : "self" as const,
      }];
    }).slice(0, 10)
    : [];
  return { name, nameBook };
}

function normalizePeriod(value: unknown): WorkspaceSharePeriod {
  if (!isObject(value)) {
    return { from: "", to: "", selection: "explicit" };
  }
  return {
    from: readString(value.from, ""),
    to: readString(value.to, ""),
    selection: value.selection === "period" ? "period" : "explicit",
  };
}

function readString(value: unknown, fallback: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : typeof fallback === "string"
      ? fallback
      : "";
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
