import type {
  PlayBuoyancyMode,
  PlayFragmentationMode,
  PlayGravityMode,
  PlayInteractionMode,
  PlayParentSplitMode,
} from "./play-physics-classification.js";

export interface PlayJutsuState {
  gravityMode: PlayGravityMode;
  buoyancyMode: PlayBuoyancyMode;
  interactionMode: PlayInteractionMode;
  parentSplitMode: PlayParentSplitMode;
  fragmentationMode: PlayFragmentationMode;
}

export type PlayJutsuAction =
  | { type: "set-gravity"; mode: PlayGravityMode }
  | { type: "set-buoyancy"; mode: PlayBuoyancyMode }
  | { type: "set-parent"; enabled: boolean }
  | { type: "set-parent-split"; mode: PlayParentSplitMode }
  | { type: "apply-technique"; mode: PlayFragmentationMode }
  | { type: "reset-normal" };

export function createInitialPlayJutsuState(): PlayJutsuState {
  return {
    gravityMode: "free",
    buoyancyMode: "off",
    interactionMode: "grab",
    parentSplitMode: "off",
    fragmentationMode: "count-limit",
  };
}

export function reducePlayJutsuState(state: PlayJutsuState, action: PlayJutsuAction): PlayJutsuState {
  switch (action.type) {
    case "set-gravity":
      return normalizePlayJutsuState({
        ...state,
        gravityMode: action.mode,
        buoyancyMode: action.mode === "fixed-down" ? state.buoyancyMode : "off",
      });
    case "set-buoyancy":
      return normalizePlayJutsuState({ ...state, buoyancyMode: action.mode });
    case "set-parent":
      return normalizePlayJutsuState({
        ...state,
        interactionMode: action.enabled ? "parent" : "grab",
        parentSplitMode: action.enabled ? state.parentSplitMode : "off",
      });
    case "set-parent-split":
      return normalizePlayJutsuState({
        ...state,
        parentSplitMode: action.mode,
        fragmentationMode: action.mode === "off" ? state.fragmentationMode : action.mode,
      });
    case "apply-technique":
      return {
        gravityMode: "fixed-down",
        buoyancyMode: "on",
        interactionMode: "parent",
        parentSplitMode: "off",
        fragmentationMode: action.mode,
      };
    case "reset-normal":
      return {
        ...state,
        gravityMode: "free",
        buoyancyMode: "off",
        interactionMode: "grab",
        parentSplitMode: "off",
      };
  }
}

export function normalizePlayJutsuState(state: PlayJutsuState): PlayJutsuState {
  const gravityMode: PlayGravityMode = state.gravityMode === "fixed-down" ? "fixed-down" : "free";
  const interactionMode: PlayInteractionMode = state.interactionMode === "parent" ? "parent" : "grab";
  const fragmentationMode: PlayFragmentationMode = state.fragmentationMode === "fill" ? "fill" : "count-limit";
  return {
    gravityMode,
    buoyancyMode: gravityMode === "fixed-down" && state.buoyancyMode === "on" ? "on" : "off",
    interactionMode,
    parentSplitMode: interactionMode === "parent" && state.parentSplitMode !== "off"
      ? state.parentSplitMode === "fill" ? "fill" : "count-limit"
      : "off",
    fragmentationMode,
  };
}
