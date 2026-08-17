import type { AppSettings } from "./settings.js";

export type DevicePlayMode = "normal" | "tamawari";
export type TamawariPhase = "ready" | "playing";
export type TamawariRevealEffect = "treasure" | "miss";

export interface TamawariTarget {
  instanceId: string;
  ballId: string;
  title: string;
  effect: TamawariRevealEffect;
}

export interface TamawariSessionState {
  phase: TamawariPhase;
  targets: ReadonlyMap<string, TamawariTarget>;
  openedInstanceIds: ReadonlySet<string>;
}

export const TAMAWARI_DEVICE_MODE_STORAGE_KEY = "happyBall.devicePlayMode.v1";
export const TAMAWARI_MAX_TARGETS = 50;
export const TAMAWARI_LINEAR_DAMPING = 100;
export const TAMAWARI_TREASURE_WORDS = new Set(["おたから", "たから", "お宝", "宝"]);

export interface TamawariRevealAppearance {
  showStoredEcho: boolean;
  resultAura: "none" | "treasure";
}

export function loadDevicePlayMode(storage: Pick<Storage, "getItem"> = localStorage): DevicePlayMode {
  try {
    return storage.getItem(TAMAWARI_DEVICE_MODE_STORAGE_KEY) === "tamawari" ? "tamawari" : "normal";
  } catch {
    return "normal";
  }
}

export function saveDevicePlayMode(
  mode: DevicePlayMode,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(TAMAWARI_DEVICE_MODE_STORAGE_KEY, mode);
  } catch {
    // Device-only presentation preferences may fail without blocking the app.
  }
}

export function createReadyTamawariSession(): TamawariSessionState {
  return { phase: "ready", targets: new Map(), openedInstanceIds: new Set() };
}

export function startTamawariSession(targets: readonly TamawariTarget[]): TamawariSessionState {
  return {
    phase: "playing",
    targets: new Map(targets.slice(0, TAMAWARI_MAX_TARGETS).map((target) => [target.instanceId, target])),
    openedInstanceIds: new Set(),
  };
}

export function toggleTamawariInstance(
  state: TamawariSessionState,
  instanceId: string,
): { state: TamawariSessionState; openedEffect: TamawariRevealEffect | null } {
  if (state.phase !== "playing" || !state.targets.has(instanceId)) {
    return { state, openedEffect: null };
  }
  const openedInstanceIds = new Set(state.openedInstanceIds);
  if (openedInstanceIds.delete(instanceId)) {
    return { state: { ...state, openedInstanceIds }, openedEffect: null };
  }
  openedInstanceIds.add(instanceId);
  return {
    state: { ...state, openedInstanceIds },
    openedEffect: state.targets.get(instanceId)?.effect ?? null,
  };
}

export function resetTamawariSession(state: TamawariSessionState): TamawariSessionState {
  return state.phase === "playing" ? { ...state, openedInstanceIds: new Set() } : createReadyTamawariSession();
}

export function isTamawariTreasure(note: string): boolean {
  const firstLine = note.split(/\r?\n/, 1)[0]?.trim() ?? "";
  const candidate = firstLine.startsWith("#") ? firstLine.slice(1).trim() : firstLine;
  return TAMAWARI_TREASURE_WORDS.has(candidate);
}

export function resolveTamawariRevealAppearance(effect: "none" | TamawariRevealEffect): TamawariRevealAppearance {
  if (effect === "treasure") {
    return {
      showStoredEcho: false,
      resultAura: "treasure",
    };
  }
  if (effect === "miss") {
    return {
      showStoredEcho: false,
      resultAura: "none",
    };
  }
  return {
    showStoredEcho: true,
    resultAura: "none",
  };
}

export function resolveTamawariRuntimeSettings(settings: AppSettings, playing: boolean): AppSettings {
  return playing ? { ...settings, linearDamping: TAMAWARI_LINEAR_DAMPING } : settings;
}

export function createTamawariRevealMap(state: TamawariSessionState): ReadonlyMap<string, TamawariRevealEffect> {
  const result = new Map<string, TamawariRevealEffect>();
  for (const instanceId of state.openedInstanceIds) {
    const target = state.targets.get(instanceId);
    if (target) result.set(instanceId, target.effect);
  }
  return result;
}
