import type { CategoryColorPreset } from "./categories.js";
import { createDurableId } from "./durable-id.js";
import type { HappyBallLedger } from "./models.js";
import type { AppSettings } from "./settings.js";

export const WORKSPACE_STORE_KEY = "happyBall.workspaces.v1";
export const MAX_WORKSPACES = 4;

export type WorkspaceRole = "self" | "received";

export interface HappyBallWorkspace {
  v: 1;
  type: "happy-ball-workspace";
  workspaceId: string;
  role: WorkspaceRole;
  sourceWorkspaceId: string;
  displayName: string;
  ledger: HappyBallLedger;
  categories: CategoryColorPreset[];
  appSettings: AppSettings;
  createdAt: string;
  updatedAt: string;
  lastImportedAt?: string;
}

export interface HappyBallWorkspaceStore {
  v: 1;
  type: "happy-ball-workspace-store";
  activeWorkspaceId: string;
  workspaces: HappyBallWorkspace[];
  selfLegacyFingerprint?: string;
}

export interface WorkspaceSnapshot {
  ledger: HappyBallLedger;
  categories: CategoryColorPreset[];
  appSettings: AppSettings;
}

export function loadOrCreateWorkspaceStore(
  legacy: WorkspaceSnapshot,
  now = new Date().toISOString(),
): HappyBallWorkspaceStore {
  const stored = readStoredWorkspaceStore();
  if (stored) {
    return stored;
  }
  const workspaceId = createDurableId("workspace");
  const selfWorkspace: HappyBallWorkspace = {
    v: 1,
    type: "happy-ball-workspace",
    workspaceId,
    role: "self",
    sourceWorkspaceId: workspaceId,
    displayName: legacy.ledger.ownerProfile.name,
    ledger: cloneLedger(legacy.ledger),
    categories: cloneCategories(legacy.categories),
    appSettings: cloneSettings(legacy.appSettings),
    createdAt: now,
    updatedAt: now,
  };
  const store: HappyBallWorkspaceStore = {
    v: 1,
    type: "happy-ball-workspace-store",
    activeWorkspaceId: workspaceId,
    workspaces: [selfWorkspace],
    selfLegacyFingerprint: workspaceSnapshotFingerprint(legacy),
  };
  saveWorkspaceStore(store);
  return store;
}

export function saveWorkspaceStore(store: HappyBallWorkspaceStore): void {
  localStorage.setItem(WORKSPACE_STORE_KEY, JSON.stringify(store));
}

export function getActiveWorkspace(store: HappyBallWorkspaceStore): HappyBallWorkspace {
  return store.workspaces.find((workspace) => workspace.workspaceId === store.activeWorkspaceId)
    ?? store.workspaces[0];
}

export function getSelfWorkspace(store: HappyBallWorkspaceStore): HappyBallWorkspace {
  return store.workspaces.find((workspace) => workspace.role === "self") ?? store.workspaces[0];
}

export function isReceivedWorkspace(store: HappyBallWorkspaceStore): boolean {
  return getActiveWorkspace(store).role === "received";
}

export function updateActiveWorkspaceSnapshot(
  store: HappyBallWorkspaceStore,
  snapshot: WorkspaceSnapshot,
  now = new Date().toISOString(),
): HappyBallWorkspaceStore {
  const active = getActiveWorkspace(store);
  if (JSON.stringify(active.ledger) === JSON.stringify(snapshot.ledger)
    && JSON.stringify(active.categories) === JSON.stringify(snapshot.categories)
    && JSON.stringify(active.appSettings) === JSON.stringify(snapshot.appSettings)) {
    return store;
  }
  const nextStore = replaceWorkspace(store, {
    ...active,
    ledger: cloneLedger(snapshot.ledger),
    categories: cloneCategories(snapshot.categories),
    appSettings: cloneSettings(snapshot.appSettings),
    updatedAt: now,
  });
  return active.role === "self"
    ? { ...nextStore, selfLegacyFingerprint: workspaceSnapshotFingerprint(snapshot) }
    : nextStore;
}

export function updateSelfWorkspaceSnapshot(
  store: HappyBallWorkspaceStore,
  snapshot: WorkspaceSnapshot,
  now = new Date().toISOString(),
): HappyBallWorkspaceStore {
  const self = getSelfWorkspace(store);
  const nextStore = replaceWorkspace(store, {
    ...self,
    displayName: snapshot.ledger.ownerProfile.name,
    ledger: cloneLedger(snapshot.ledger),
    categories: cloneCategories(snapshot.categories),
    appSettings: cloneSettings(snapshot.appSettings),
    updatedAt: now,
  });
  return { ...nextStore, selfLegacyFingerprint: workspaceSnapshotFingerprint(snapshot) };
}

export function workspaceSnapshotFingerprint(snapshot: WorkspaceSnapshot): string {
  const serialized = JSON.stringify([snapshot.ledger, snapshot.categories, snapshot.appSettings]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function activateWorkspace(
  store: HappyBallWorkspaceStore,
  workspaceId: string,
): HappyBallWorkspaceStore {
  return store.workspaces.some((workspace) => workspace.workspaceId === workspaceId)
    ? { ...store, activeWorkspaceId: workspaceId }
    : store;
}

export function activateNextWorkspace(store: HappyBallWorkspaceStore): HappyBallWorkspaceStore {
  if (store.workspaces.length < 2) {
    return store;
  }
  const currentIndex = Math.max(0, store.workspaces.findIndex((workspace) => workspace.workspaceId === store.activeWorkspaceId));
  return { ...store, activeWorkspaceId: store.workspaces[(currentIndex + 1) % store.workspaces.length].workspaceId };
}

export function replaceWorkspace(
  store: HappyBallWorkspaceStore,
  workspace: HappyBallWorkspace,
): HappyBallWorkspaceStore {
  return {
    ...store,
    workspaces: store.workspaces.map((item) => item.workspaceId === workspace.workspaceId ? workspace : item),
  };
}

export function addWorkspace(
  store: HappyBallWorkspaceStore,
  workspace: HappyBallWorkspace,
): HappyBallWorkspaceStore | null {
  if (store.workspaces.length >= MAX_WORKSPACES || store.workspaces.some((item) => item.workspaceId === workspace.workspaceId)) {
    return null;
  }
  return { ...store, workspaces: [...store.workspaces, workspace] };
}

export function removeReceivedWorkspace(
  store: HappyBallWorkspaceStore,
  workspaceId: string,
): HappyBallWorkspaceStore {
  const target = store.workspaces.find((workspace) => workspace.workspaceId === workspaceId);
  if (!target || target.role !== "received") {
    return store;
  }
  const workspaces = store.workspaces.filter((workspace) => workspace.workspaceId !== workspaceId);
  const self = workspaces.find((workspace) => workspace.role === "self") ?? workspaces[0];
  return {
    ...store,
    activeWorkspaceId: store.activeWorkspaceId === workspaceId ? self.workspaceId : store.activeWorkspaceId,
    workspaces,
  };
}

export function findWorkspaceBySourceId(
  store: HappyBallWorkspaceStore,
  sourceWorkspaceId: string,
): HappyBallWorkspace | undefined {
  return store.workspaces.find((workspace) => workspace.sourceWorkspaceId === sourceWorkspaceId);
}

export function getWorkspaceDisplayCode(
  store: HappyBallWorkspaceStore,
  workspaceId: string,
): string {
  const token = workspaceId.replace(/^[^_]*_/, "").toUpperCase();
  for (let length = 3; length <= Math.min(token.length, 8); length += 1) {
    const candidate = token.slice(0, length);
    const matches = store.workspaces.filter((workspace) => workspace.workspaceId.replace(/^[^_]*_/, "").toUpperCase().startsWith(candidate));
    if (matches.length === 1) {
      return candidate;
    }
  }
  return token.slice(0, 8) || workspaceId.slice(-8).toUpperCase();
}

function readStoredWorkspaceStore(): HappyBallWorkspaceStore | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORE_KEY);
    if (!raw) {
      return null;
    }
    return normalizeWorkspaceStore(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function normalizeWorkspaceStore(value: unknown): HappyBallWorkspaceStore | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const candidate = value as Partial<HappyBallWorkspaceStore>;
  if (candidate.v !== 1 || candidate.type !== "happy-ball-workspace-store" || !Array.isArray(candidate.workspaces) || candidate.workspaces.length === 0) {
    return null;
  }
  const workspaces = candidate.workspaces.filter(isStoredWorkspace).slice(0, MAX_WORKSPACES);
  if (workspaces.length === 0 || !workspaces.some((workspace) => workspace.role === "self")) {
    return null;
  }
  const self = workspaces.find((workspace) => workspace.role === "self") ?? workspaces[0];
  const activeWorkspaceId = workspaces.some((workspace) => workspace.workspaceId === candidate.activeWorkspaceId)
    ? String(candidate.activeWorkspaceId)
    : self.workspaceId;
  return {
    v: 1,
    type: "happy-ball-workspace-store",
    activeWorkspaceId,
    workspaces,
    ...(typeof candidate.selfLegacyFingerprint === "string"
      ? { selfLegacyFingerprint: candidate.selfLegacyFingerprint }
      : {}),
  };
}

function isStoredWorkspace(value: unknown): value is HappyBallWorkspace {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const workspace = value as Partial<HappyBallWorkspace>;
  const ledger = workspace.ledger as Partial<HappyBallLedger> | undefined;
  return workspace.v === 1
    && workspace.type === "happy-ball-workspace"
    && typeof workspace.workspaceId === "string"
    && (workspace.role === "self" || workspace.role === "received")
    && typeof workspace.sourceWorkspaceId === "string"
    && typeof workspace.displayName === "string"
    && typeof ledger === "object"
    && ledger?.v === 1
    && ledger.type === "happy-ball-ledger"
    && typeof ledger.ledgerId === "string"
    && typeof ledger.ownerProfile === "object"
    && Array.isArray(ledger.balls)
    && Array.isArray(workspace.categories)
    && typeof workspace.appSettings === "object";
}

function cloneLedger(ledger: HappyBallLedger): HappyBallLedger {
  return JSON.parse(JSON.stringify(ledger)) as HappyBallLedger;
}

function cloneCategories(categories: CategoryColorPreset[]): CategoryColorPreset[] {
  return categories.map((category) => ({ ...category }));
}

function cloneSettings(settings: AppSettings): AppSettings {
  return JSON.parse(JSON.stringify(settings)) as AppSettings;
}
