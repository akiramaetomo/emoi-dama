import {
  calculateDescentStarRadius,
  calculateStarRingRotation,
  deriveEchoAppearanceVariant,
  resolveEchoTargetAngularVelocity,
  resolveEchoSpreadScale,
  smoothEchoAngularVelocity,
  unwrapRotation,
  ECHO_FIXED_PATTERN_WEIGHT,
  ECHO_ROTATING_PATTERN_WEIGHT,
  ECHO_UNIFORM_WEIGHT,
  DESCENT_STAR_OPACITY,
} from "./ball-appearance.js";

const first = deriveEchoAppearanceVariant("ball_alpha", 0);
const repeated = deriveEchoAppearanceVariant("ball_alpha", 0);
assert(JSON.stringify(first) === JSON.stringify(repeated), "the same visual id should keep one echo appearance");
assert(first.basePatternVariant >= 0 && first.basePatternVariant <= 7, "echo patterns should stay within eight baked variants");
assert(first.accentPatternVariant !== first.basePatternVariant, "fixed and rotating layers should use different patterns");
assert(first.baseOrientationStep >= 0 && first.baseOrientationStep <= 7, "echo orientation should use eight fixed directions");
assert(Math.abs(first.intensityVariant) <= 0.04, "base echo lightness variation should stay within four percent");
assert(Math.abs(first.accentLightnessOffset) <= 0.04, "accent echo lightness variation should stay within four percent");
assert(Math.abs(first.accentSaturationOffset) <= 3, "accent echo saturation variation should stay subtle");
const period = Math.PI * 2 / Math.abs(first.accentAngularVelocity);
assert(period >= 18 && period <= 30, "accent echo should complete one idle turn in 18 to 30 seconds");

assert(resolveEchoTargetAngularVelocity(0.14, -0.3) === -0.3, "slow physical rotation should retain the id-derived idle motion");
assert(resolveEchoTargetAngularVelocity(0.15, -0.3) === 0.01875, "the physical threshold should couple at one eighth speed");
assert(resolveEchoTargetAngularVelocity(2, -0.3) === 0.25, "positive physical rotation should keep its direction at one eighth speed");
assert(resolveEchoTargetAngularVelocity(-2, 0.3) === -0.25, "negative physical rotation should keep its direction at one eighth speed");
const smoothed = smoothEchoAngularVelocity(0, 1, 0.25);
assert(smoothed > 0.6 && smoothed < 0.65, "a 250ms response should approach the target without jumping to it");
assert(smoothEchoAngularVelocity(0.25, 1, 0) === 0.25, "a zero-length frame should not change echo velocity");
assert(resolveEchoSpreadScale("weak") === 3.68, "narrow echo should use the proportional 3.68r spread");
assert(resolveEchoSpreadScale("medium") === 4.24, "standard echo should take the former wide 4.24r spread");
assert(resolveEchoSpreadScale("strong") === 4.8, "wide echo should extend one proportional step beyond standard");
assert(ECHO_UNIFORM_WEIGHT === 0.4, "the radial foundation should soften local variation without flattening both irregular layers");
assert(ECHO_FIXED_PATTERN_WEIGHT === 0.3 && ECHO_ROTATING_PATTERN_WEIGHT === 0.3, "fixed and rotating echo layers should retain equal irregular strength");
assert(ECHO_FIXED_PATTERN_WEIGHT + ECHO_ROTATING_PATTERN_WEIGHT === 0.6, "irregular echo weight should preserve legible but moderated interference");
assert(Math.abs(ECHO_UNIFORM_WEIGHT + ECHO_FIXED_PATTERN_WEIGHT + ECHO_ROTATING_PATTERN_WEIGHT - 1) < Number.EPSILON * 2, "echo profile weights should preserve nominal total light");
assert(DESCENT_STAR_OPACITY === 0.8, "descent stars should blend into the ball at eighty percent opacity");

const siblingPatterns = new Set(Array.from({ length: 4 }, (_, index) => {
  const appearance = deriveEchoAppearanceVariant("ball_alpha", index);
  return `${appearance.basePatternVariant}:${appearance.accentPatternVariant}`;
}));
assert(siblingPatterns.size === 4, "the first four fragments should receive distinct echo pattern pairs");

const variants = new Set(Array.from({ length: 48 }, (_, index) => {
  const variant = deriveEchoAppearanceVariant(`ball_${index}`, index % 4);
  return `${variant.basePatternVariant}:${variant.accentPatternVariant}:${variant.baseOrientationStep}:${variant.baseMirrored}:${variant.intensityVariant}`;
}));
assert(variants.size >= 16, "stable ids should produce varied echo appearances without randomness");

assert(calculateDescentStarRadius(10) === 4.5, "small faithful balls should keep the enlarged readable star floor");
assert(Math.abs(calculateDescentStarRadius(42) - 8.19) < 0.001, "normal stars should scale at one and a half times the prior size");
assert(calculateDescentStarRadius(100) === 11.25, "large stars should retain the enlarged cap");
assert(Math.abs(calculateStarRingRotation(2) - 0.7) < 0.001, "star rings should follow physical rotation at 0.35x");

const crossedPositivePi = unwrapRotation(Math.PI - 0.1, Math.PI - 0.1, -Math.PI + 0.1);
assert(Math.abs(crossedPositivePi - (Math.PI + 0.1)) < 0.001, "positive rotation should stay continuous across the pi wrap");
const crossedNegativePi = unwrapRotation(-Math.PI + 0.1, -Math.PI + 0.1, Math.PI - 0.1);
assert(Math.abs(crossedNegativePi - (-Math.PI - 0.1)) < 0.001, "negative rotation should stay continuous across the minus-pi wrap");
const secondTurn = unwrapRotation(-Math.PI + 0.1, crossedPositivePi, -Math.PI + 0.4);
assert(secondTurn > crossedPositivePi, "successive wrapped samples should continue accumulating in one direction");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
