import RAPIER from "@dimforge/rapier2d-compat";
import { calculateFragmentMergeState, RapierStage, shouldEnableFragmentCcd } from "./rapier-stage.js";
import type { VisualBallSource } from "./ball-stage-renderer.js";
import "./play-physics-classification.test.js";
import "./play-jutsu-state.test.js";

let disconnects = 0;
let removedListeners = 0;
let freedWorlds = 0;
let freedEventQueues = 0;
let destroyedRenderers = 0;
let rendererPauses = 0;

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
  eventQueue: {
    free: () => { freedEventQueues += 1; },
  },
  renderer: {
    setPaused: (paused: boolean) => { if (paused) rendererPauses += 1; },
    destroy: () => { destroyedRenderers += 1; },
  },
});

faultedStage.destroy();

assert(disconnects === 1, "a faulted stage should still disconnect its ResizeObserver");
assert(removedListeners === 7, "a faulted stage should still remove every field listener");
assert(freedWorlds === 1, "a faulted stage should still release its Rapier world");
assert(freedEventQueues === 1, "a faulted stage should still release its Rapier event queue");
assert(destroyedRenderers === 1, "a faulted stage should still release its renderer");
assert(rendererPauses === 1, "stage cleanup should pause renderer work even after a physics fault");

faultedStage.destroy();

assert(disconnects === 1, "stage cleanup should remain idempotent after a fault");
assert(removedListeners === 7, "stage listeners should only be removed once");
assert(freedWorlds === 1, "the Rapier world should only be released once");
assert(freedEventQueues === 1, "the Rapier event queue should only be released once");
assert(destroyedRenderers === 1, "the stage renderer should only be released once");
assert(rendererPauses === 1, "renderer pause should remain idempotent after disposal");

let sourceUpdates = 0;
const liveStage = Object.create(RapierStage.prototype) as RapierStage;
const originalBall = { ...createVisualSource("ball_0", "old"), label: "old" };
Object.assign(liveStage, {
  disposed: false,
  faulted: false,
  balls: [originalBall],
  baseSourceByInstanceId: new Map([[originalBall.baseInstanceId, originalBall]]),
  width: 400,
  height: 600,
  sourceCount: 1,
  options: {},
  renderer: {
    updateAppearanceProfile: () => undefined,
    updateSources: () => {
      sourceUpdates += 1;
      return true;
    },
  },
});
const updatedSource = createVisualSource("ball_0", "new");
assert(liveStage.updateVisualSources([updatedSource]), "matching visual ids should update without rebuilding physics");
assert(sourceUpdates === 1, "a presentation-only update should reach the renderer once");
assert(originalBall.label === "new", "the existing physical ball should retain identity while receiving new presentation data");
assert(!liveStage.updateVisualSources([createVisualSource("other_0", "other")]), "mismatched ids should request the rebuild fallback");
assert(sourceUpdates === 1, "mismatched ids should not update the renderer");

assert(!shouldEnableFragmentCcd(3), "one-eighth fragments should avoid predictive CCD constraints");
assert(shouldEnableFragmentCcd(4), "one-sixteenth fragments should use hard CCD");
assert(shouldEnableFragmentCcd(5), "one-thirty-second fragments should use hard CCD");

const merged = calculateFragmentMergeState([
  { mass: 1, position: { x: 10, y: 20 }, linvel: { x: 6, y: -2 }, rotation: Math.PI - 0.1, angvel: 2 },
  { mass: 3, position: { x: 30, y: 40 }, linvel: { x: -2, y: 6 }, rotation: -Math.PI + 0.1, angvel: -2 },
]);
assert(closeTo(merged.position.x, 25) && closeTo(merged.position.y, 35), "fragment reset should use a mass-weighted centroid");
assert(closeTo(merged.linvel.x, 0) && closeTo(merged.linvel.y, 4), "fragment reset should preserve mass-weighted linear motion");
assert(closeTo(merged.angvel, -1), "fragment reset should preserve mass-weighted angular velocity");
assert(Math.abs(Math.abs(merged.rotation) - Math.PI) < 0.06, "fragment reset should average rotations across the plus/minus pi boundary");

await RAPIER.init();
verifySmallFragmentMotionConservation();

function createVisualSource(id: string, label: string): VisualBallSource {
  return {
    id,
    ballId: id.split("_")[0] ?? id,
    fragmentIndex: 0,
    baseInstanceId: id,
    fragmentGeneration: 0,
    fragmentOrdinal: 0,
    radius: 40,
    motionClass: "neutral",
    hue: 30,
    saturation: 60,
    lightness: 55,
    visualKind: "filled",
    lifecycleStatus: "active",
    descentBadgeCount: 0,
    isKamiBall: false,
    echo: null,
    snapshot: null,
    label,
    labelClass: "label-short",
    title: label,
  };
}

function verifySmallFragmentMotionConservation(): void {
  const width = 400;
  const radius = 42 / Math.sqrt(32);
  const initialSpeed = 1200;
  const world = new RAPIER.World({ x: 0, y: 0 });
  world.timestep = 1 / 60;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(32, 160)
      .setTranslation(-32, 150)
      .setRestitution(1)
      .setFriction(0),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(32, 160)
      .setTranslation(width + 32, 150)
      .setRestitution(1)
      .setFriction(0),
  );
  const first = createConservationBody(world, width * 0.25, radius, initialSpeed);
  const second = createConservationBody(world, width * 0.7, radius, 0);
  const initialEnergy = first.mass() * initialSpeed ** 2;
  for (let step = 0; step < 1200; step += 1) {
    world.step();
  }
  const firstVelocity = first.linvel();
  const secondVelocity = second.linvel();
  const finalEnergy = first.mass() * (firstVelocity.x ** 2 + secondVelocity.x ** 2);
  assert(
    Math.abs(finalEnergy / initialEnergy - 1) < 0.01,
    "hard CCD should preserve repeated one-thirty-second fragment collisions",
  );
  world.free();
}

function createConservationBody(world: RAPIER.World, x: number, radius: number, velocityX: number): RAPIER.RigidBody {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, 150)
      .setLinvel(velocityX, 0)
      .setLinearDamping(0)
      .setCcdEnabled(true),
  );
  world.createCollider(
    RAPIER.ColliderDesc.ball(radius)
      .setRestitution(1)
      .setFriction(0)
      .setDensity(1),
    body,
  );
  return body;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function closeTo(actual: number, expected: number, tolerance = 0.0001): boolean {
  return Math.abs(actual - expected) <= tolerance;
}
