export type EchoPatternVariant = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface EchoAppearanceVariant {
  basePatternVariant: EchoPatternVariant;
  accentPatternVariant: EchoPatternVariant;
  baseOrientationStep: number;
  accentOrientationStep: number;
  baseMirrored: boolean;
  accentMirrored: boolean;
  intensityVariant: number;
  accentLightnessOffset: number;
  accentSaturationOffset: number;
  accentPhase: number;
  accentAngularVelocity: number;
}

const INTENSITY_VARIANTS = [-0.04, -0.015, 0.015, 0.04] as const;
const ACCENT_LIGHTNESS_VARIANTS = [-0.04, -0.015, 0.015, 0.04] as const;
const ACCENT_SATURATION_VARIANTS = [-3, -1, 1, 3] as const;
export const STAR_ORBIT_ROTATION_RATIO = 0.35;
export const ECHO_PHYSICS_ANGULAR_VELOCITY_THRESHOLD = 0.15;
export const ECHO_PHYSICS_ANGULAR_VELOCITY_RATIO = 0.125;
export const ECHO_VELOCITY_RESPONSE_SECONDS = 0.25;
export const ECHO_UNIFORM_WEIGHT = 0.4;
export const ECHO_FIXED_PATTERN_WEIGHT = 0.3;
export const ECHO_ROTATING_PATTERN_WEIGHT = 0.3;
export const DESCENT_STAR_OPACITY = 0.8;

export function deriveEchoAppearanceVariant(id: string, fragmentIndex = 0): EchoAppearanceVariant {
  const hash = stableAppearanceHash(id);
  const safeFragmentIndex = Math.max(0, Math.floor(fragmentIndex));
  const basePatternVariant = ((hash + safeFragmentIndex) & 7) as EchoPatternVariant;
  const accentOffset = 1 + ((hash >>> 3) % 7);
  const periodSeconds = 18 + ((hash + safeFragmentIndex * 11) % 13);
  const direction = ((hash >>> 17) & 1) === 0 ? 1 : -1;
  return {
    basePatternVariant,
    accentPatternVariant: ((basePatternVariant + accentOffset) & 7) as EchoPatternVariant,
    baseOrientationStep: ((hash >>> 6) + safeFragmentIndex * 3) & 7,
    accentOrientationStep: ((hash >>> 9) + safeFragmentIndex * 5) & 7,
    baseMirrored: ((hash >>> 12) & 1) === 1,
    accentMirrored: ((hash >>> 13) & 1) === 1,
    intensityVariant: INTENSITY_VARIANTS[(hash >>> 14) & 3],
    accentLightnessOffset: ACCENT_LIGHTNESS_VARIANTS[(hash >>> 19) & 3],
    accentSaturationOffset: ACCENT_SATURATION_VARIANTS[(hash >>> 21) & 3],
    accentPhase: (((hash >>> 8) + safeFragmentIndex * 13) & 63) / 64 * Math.PI * 2,
    accentAngularVelocity: direction * Math.PI * 2 / periodSeconds,
  };
}

export function resolveEchoTargetAngularVelocity(
  physicalAngularVelocity: number,
  idleAngularVelocity: number,
): number {
  return Math.abs(physicalAngularVelocity) >= ECHO_PHYSICS_ANGULAR_VELOCITY_THRESHOLD
    ? physicalAngularVelocity * ECHO_PHYSICS_ANGULAR_VELOCITY_RATIO
    : idleAngularVelocity;
}

export function smoothEchoAngularVelocity(
  currentAngularVelocity: number,
  targetAngularVelocity: number,
  elapsedSeconds: number,
): number {
  const safeElapsed = Math.max(0, elapsedSeconds);
  const blend = 1 - Math.exp(-safeElapsed / ECHO_VELOCITY_RESPONSE_SECONDS);
  return currentAngularVelocity + (targetAngularVelocity - currentAngularVelocity) * blend;
}

export function resolveEchoSpreadScale(strength: "off" | "weak" | "medium" | "strong"): number {
  if (strength === "strong") {
    return 4.8;
  }
  if (strength === "medium") {
    return 4.24;
  }
  return 3.68;
}

export function stableAppearanceHash(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function calculateDescentStarRadius(ballRadius: number): number {
  return clamp(ballRadius * 0.195, 4.5, 11.25);
}

export function calculateStarRingRotation(ballRotation: number): number {
  return ballRotation * STAR_ORBIT_ROTATION_RATIO;
}

export function unwrapRotation(
  previousWrappedRotation: number,
  previousUnwrappedRotation: number,
  nextWrappedRotation: number,
): number {
  let delta = nextWrappedRotation - previousWrappedRotation;
  if (delta > Math.PI) {
    delta -= Math.PI * 2;
  } else if (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return previousUnwrappedRotation + delta;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
