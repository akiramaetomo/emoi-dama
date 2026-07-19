import RAPIER from "@dimforge/rapier2d-compat";
import {
  calculateFillRadii,
  calculateParentRadius,
  confineBallToWorld,
  classificationRatioToSlider,
  classificationSliderToRatio,
  createBatchFragmentationPlan,
  createFragmentationPlan,
  FILL_AREA_TARGET,
  fragmentRadius,
  getMotionProfile,
  getParentMotionProfile,
  interpolateRadiusByArea,
  planSplitPairPlacement,
  resolveClassifiedDamping,
  resolveClassificationGravityScale,
  resolveMotionClass,
  resolveParentDamping,
  shouldThrowParent,
} from "./play-physics-classification.js";

assert(resolveMotionClass("dark", "filled") === "dark", "dark filled categories should be heavy");
assert(resolveMotionClass("neutral", "filled") === "neutral", "neutral categories should use the flat profile");
assert(resolveMotionClass("bright", "filled") === "bright", "bright categories should use the bright profile");
assert(resolveMotionClass("bright", "ring") === "ring", "ring appearance should override tone");

const expectedProfiles = {
  dark: { density: 2, dampingMultiplier: 0.5 },
  neutral: { density: 1, dampingMultiplier: 1 },
  bright: { density: 0.5, dampingMultiplier: 2 },
  ring: { density: 0.25, dampingMultiplier: 4 },
} as const;
for (const [motionClass, expected] of Object.entries(expectedProfiles)) {
  const profile = getMotionProfile(motionClass as keyof typeof expectedProfiles, 2, 2);
  assert(closeTo(profile.density, expected.density), `${motionClass} should use the accepted density sequence`);
  assert(closeTo(profile.dampingMultiplier, expected.dampingMultiplier), `${motionClass} should use the inverse damping sequence`);
}
assert(getMotionProfile("dark", 1, 1).density === 1 && getMotionProfile("ring", 1, 1).density === 1, "ratio one should remove class differences");
assert(getMotionProfile("ring", 0.25, 0.25).density > getMotionProfile("dark", 0.25, 0.25).density, "ratios below one should reverse density order");
assert(getParentMotionProfile(2, 2).density === 64, "ratio two should produce parent density 64");
assert(closeTo(getParentMotionProfile(2, 2).dampingMultiplier, 1 / 64), "ratio two should produce parent damping 1/64");
assert(getParentMotionProfile(4, 4).density === 256, "parent density should stop at the safety cap");
assert(closeTo(getParentMotionProfile(0.25, 0.25).density, 1 / 256), "reversed parent density should stop at the inverse safety cap");
assert(resolveClassifiedDamping(0, "ring", 4) === 0, "zero global damping should remove classification differences");
assert(resolveParentDamping(0, 4) === 0, "zero global damping should also remove parent damping");
assert(closeTo(resolveClassifiedDamping(0.4, "dark", 2), 0.2), "dark damping should use the accepted multiplier");
assert(closeTo(resolveClassificationGravityScale("dark", 2, 1, 1), 0.675), "agitated dark balls should keep sinking through the virtual fluid");
assert(resolveClassificationGravityScale("ring", 2, 1, 1) === -1, "agitated rings should receive capped upward pseudo-buoyancy");
assert(resolveClassificationGravityScale("ring", 2, 1, 0) === 1, "pseudo-buoyancy should stop outside agitation");
assert(resolveClassificationGravityScale("dark", 1, 1, 1) === resolveClassificationGravityScale("ring", 1, 1, 1), "ratio one should remove buoyancy class differences");

for (const ratio of [0.25, 0.5, 1, 2, 4]) {
  assert(closeTo(classificationSliderToRatio(classificationRatioToSlider(ratio)), ratio), `ratio ${ratio} should round-trip through the logarithmic slider`);
}

assert(closeTo(fragmentRadius(40, 1), 40 / Math.sqrt(2)), "one split should conserve two-dimensional area");
assert(closeTo(fragmentRadius(40, 5), 40 / Math.sqrt(32)), "generation five should be the minimum fragment radius");
const allowed = createFragmentationPlan(2, 40, 120, 500);
assert(allowed.allowed && allowed.nextGeneration === 3 && allowed.nextGroupCount === 80 && allowed.nextTotalCount === 160, "a fitting group should double atomically");
assert(!createFragmentationPlan(3, 300, 400, 500).allowed, "a group that crosses the device limit should be rejected entirely");
assert(!createFragmentationPlan(5, 320, 320, 1000).allowed, "generation five should not split again");
const allowedBatch = createBatchFragmentationPlan([
  { generation: 0, count: 10 },
  { generation: 3, count: 80 },
  { generation: 5, count: 32 },
], 122, 500);
assert(allowedBatch.status === "allowed" && allowedBatch.nextTotalCount === 212, "a batch should advance every eligible group by one generation");
assert(allowedBatch.eligibleGroupIndexes.join(",") === "0,1", "a batch should leave maximum-generation groups unchanged");
const blockedBatch = createBatchFragmentationPlan([
  { generation: 4, count: 300 },
  { generation: 1, count: 20 },
], 400, 500);
assert(blockedBatch.status === "blocked-limit", "a batch crossing the device limit should be rejected as a whole");
assert(createBatchFragmentationPlan([{ generation: 5, count: 320 }], 320, 1000).status === "no-eligible", "a maximum-generation batch should report no eligible groups");

const fillInputs = Array.from({ length: 100 }, (_, index) => ({ id: `fill_${index}`, generation: 2 }));
const fillRadii = calculateFillRadii(1000, 800, 40, fillInputs);
const fillArea = [...fillRadii.values()].reduce((sum, radius) => sum + Math.PI * radius * radius, 0);
assert(Math.abs(fillArea - 1000 * 800 * FILL_AREA_TARGET) < 1, "fill radii should target 57.6 percent circle area when enough fragments exist");
const sparseRadii = calculateFillRadii(1000, 800, 40, [{ id: "only", generation: 0 }]);
assert(sparseRadii.get("only") === 40, "sparse fill should not enlarge a ball beyond the normal radius");
const mixedRadii = calculateFillRadii(800, 600, 40, [
  ...Array.from({ length: 100 }, (_, index) => ({ id: `g1_${index}`, generation: 1 })),
  ...Array.from({ length: 100 }, (_, index) => ({ id: `g2_${index}`, generation: 2 })),
]);
assert(closeTo((mixedRadii.get("g1_0") ?? 0) / (mixedRadii.get("g2_0") ?? 1), Math.sqrt(2)), "unclamped mixed generations should retain their relative radius ratio");
assert(closeTo(interpolateRadiusByArea(10, 20, 0.5) ** 2, 250), "radius interpolation should be linear in area");

assert(!shouldThrowParent(10), "ten pixels should remain a static parent tap");
assert(shouldThrowParent(10.01), "movement beyond ten pixels should throw the parent ball");
assert(calculateParentRadius(40) === 20, "parent diameter should expose a 40px minimum");
assert(calculateParentRadius(112) === 56, "the accepted parent default should be 112px across");
assert(calculateParentRadius(160, 80, 80) === 38, "parent size should fit inside a very small world");

const leftEscape = confineBallToWorld({ x: 5, y: 50 }, { x: -120, y: 30 }, 10, 100, 100);
assert(leftEscape.corrected && leftEscape.position.x === 10, "a shallow wall penetration should be corrected immediately");
assert(leftEscape.velocity.x === 120 && leftEscape.velocity.y === 30, "recovery should reflect outward normal velocity and preserve tangential motion");
const dampedBounce = confineBallToWorld({ x: 5, y: 50 }, { x: -120, y: 30 }, 10, 100, 100, 0.25, 0.9);
assert(dampedBounce.velocity.x === 108 && dampedBounce.velocity.y === 30, "boundary fallback should apply the configured wall restitution");
const cornerEscape = confineBallToWorld({ x: 4, y: 96 }, { x: -40, y: 70 }, 10, 100, 100);
assert(cornerEscape.position.x === 10 && cornerEscape.position.y === 90, "corner penetration should be corrected on both axes");
assert(cornerEscape.velocity.x === 40 && cornerEscape.velocity.y === -70, "corner recovery should reflect both outward components");
const alreadyReflected = confineBallToWorld({ x: 5, y: 50 }, { x: 90, y: 12 }, 10, 100, 100, 0.25, 0.9);
assert(alreadyReflected.velocity.x === 90 && alreadyReflected.velocity.y === 12, "fallback should not reflect a velocity Rapier already turned inward");

const openSplit = planSplitPairPlacement({ x: 100, y: 100 }, 10, 200, 200, 0.42);
assert(Math.hypot(openSplit.second.x - openSplit.first.x, openSplit.second.y - openSplit.first.y) >= 20, "split children should not begin overlapped");
const leftWallSplit = planSplitPairPlacement({ x: 10, y: 100 }, 10, 200, 200, 0);
assert(leftWallSplit.first.x >= 10 && leftWallSplit.second.x >= 10, "wall splits should keep both children inside");
assert(Math.hypot(leftWallSplit.second.x - leftWallSplit.first.x, leftWallSplit.second.y - leftWallSplit.first.y) >= 20, "wall splits should choose a tangent axis with legal separation");
const cornerSplit = planSplitPairPlacement({ x: 10, y: 10 }, 10, 200, 200, Math.PI * 1.25);
assert(cornerSplit.first.x >= 10 && cornerSplit.first.y >= 10 && cornerSplit.second.x >= 10 && cornerSplit.second.y >= 10, "corner splits should remain legal");

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: 1000 });
world.timestep = 1 / 60;
const settling = (["dark", "neutral", "bright", "ring"] as const).map((motionClass, index) => {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(index * 40, 0)
      .setLinearDamping(resolveClassifiedDamping(0.4, motionClass, 2)),
  );
  world.createCollider(RAPIER.ColliderDesc.ball(5).setDensity(getMotionProfile(motionClass, 2, 2).density), body);
  return { motionClass, body };
});
for (let step = 0; step < 180; step += 1) {
  world.step();
}
const settledY = Object.fromEntries(settling.map(({ motionClass, body }) => [motionClass, body.translation().y]));
assert(settledY.dark > settledY.neutral, "dark should statistically settle faster than neutral in separate lanes");
assert(settledY.neutral > settledY.bright, "neutral should settle faster than bright");
assert(settledY.bright > settledY.ring, "bright should settle faster than ring");
world.free();

function closeTo(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < 0.000001;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
