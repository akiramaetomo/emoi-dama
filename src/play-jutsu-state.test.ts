import { createInitialPlayJutsuState, normalizePlayJutsuState, reducePlayJutsuState } from "./play-jutsu-state.js";

const initial = createInitialPlayJutsuState();
assert(initial.gravityMode === "free", "gravity should start off");
assert(initial.buoyancyMode === "off", "buoyancy should start off");
assert(initial.interactionMode === "grab", "Parent should start off");
assert(initial.parentSplitMode === "off", "Parent splitting should start off");
assert(initial.fragmentationMode === "count-limit", "small-ball radius mode should be the default");

const blockedBuoyancy = reducePlayJutsuState(initial, { type: "set-buoyancy", mode: "on" });
assert(blockedBuoyancy.buoyancyMode === "off", "buoyancy must not turn on without fixed-down gravity");

const gravityAndBuoyancy = reducePlayJutsuState(
  reducePlayJutsuState(initial, { type: "set-gravity", mode: "fixed-down" }),
  { type: "set-buoyancy", mode: "on" },
);
assert(gravityAndBuoyancy.buoyancyMode === "on", "buoyancy should turn on with fixed-down gravity");
assert(
  reducePlayJutsuState(gravityAndBuoyancy, { type: "set-gravity", mode: "free" }).buoyancyMode === "off",
  "turning gravity off must also turn buoyancy off",
);

const blockedParentSplit = reducePlayJutsuState(initial, { type: "set-parent-split", mode: "fill" });
assert(blockedParentSplit.parentSplitMode === "off", "Parent splitting must not turn on without Parent mode");

const parentWithFill = reducePlayJutsuState(
  reducePlayJutsuState(initial, { type: "set-parent", enabled: true }),
  { type: "set-parent-split", mode: "fill" },
);
assert(parentWithFill.parentSplitMode === "fill", "fill splitting should turn on when Parent is enabled");
assert(parentWithFill.fragmentationMode === "fill", "Parent split selection should also select its radius mode");
const parentOff = reducePlayJutsuState(parentWithFill, { type: "set-parent", enabled: false });
assert(parentOff.parentSplitMode === "off", "turning Parent off must also turn Parent splitting off");
assert(parentOff.fragmentationMode === "fill", "turning Parent off should preserve the current radius mode");

for (const mode of ["count-limit", "fill"] as const) {
  const technique = reducePlayJutsuState(initial, { type: "apply-technique", mode });
  assert(technique.gravityMode === "fixed-down", "a technique should enable fixed-down gravity");
  assert(technique.buoyancyMode === "on", "a technique should arm buoyancy");
  assert(technique.interactionMode === "parent", "a technique should enable Parent mode");
  assert(technique.parentSplitMode === "off", "a technique should leave Parent collision splitting off");
  assert(technique.fragmentationMode === mode, "a technique should select its requested radius mode");
  const reset = reducePlayJutsuState(technique, { type: "reset-normal" });
  assert(reset.gravityMode === "free" && reset.buoyancyMode === "off", "normal reset should disable world effects");
  assert(reset.interactionMode === "grab" && reset.parentSplitMode === "off", "normal reset should disable Parent controls");
  assert(reset.fragmentationMode === mode, "normal reset should preserve existing fragment sizing");
}

const normalizedInvalid = normalizePlayJutsuState({
  gravityMode: "free",
  buoyancyMode: "on",
  interactionMode: "grab",
  parentSplitMode: "count-limit",
  fragmentationMode: "count-limit",
});
assert(normalizedInvalid.buoyancyMode === "off", "normalization should reject gravity-free buoyancy");
assert(normalizedInvalid.parentSplitMode === "off", "normalization should reject splitting without Parent mode");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
