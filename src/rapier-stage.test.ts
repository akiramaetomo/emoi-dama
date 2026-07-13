import { RapierStage } from "./rapier-stage.js";

let disconnects = 0;
let removedListeners = 0;
let freedWorlds = 0;

const faultedStage = Object.create(RapierStage.prototype) as RapierStage;
Object.assign(faultedStage, {
  disposed: false,
  faulted: true,
  running: false,
  resizeObserver: {
    disconnect: () => { disconnects += 1; },
  },
  field: {
    removeEventListener: () => { removedListeners += 1; },
  },
  world: {
    free: () => { freedWorlds += 1; },
  },
});

faultedStage.destroy();

assert(disconnects === 1, "a faulted stage should still disconnect its ResizeObserver");
assert(removedListeners === 7, "a faulted stage should still remove every field listener");
assert(freedWorlds === 1, "a faulted stage should still release its Rapier world");

faultedStage.destroy();

assert(disconnects === 1, "stage cleanup should remain idempotent after a fault");
assert(removedListeners === 7, "stage listeners should only be removed once");
assert(freedWorlds === 1, "the Rapier world should only be released once");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
