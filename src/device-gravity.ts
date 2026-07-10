import type { GravityVector } from "./rapier-stage.js";
import { DEFAULT_APP_SETTINGS } from "./settings.js";

interface DeviceSensorEventConstructorWithPermission {
  requestPermission?: () => Promise<"granted" | "denied">;
}

const MOTION_GRAVITY_REFERENCE = 9.8;

export type DeviceGravityAxisCorrection = "none" | "ios-inverted";

export interface DeviceGravityPlatformInput {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
}

export interface DeviceGravityPlatform {
  name: "ios-webkit" | "standard";
  axisCorrection: DeviceGravityAxisCorrection;
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}

export interface MotionGravitySource {
  x?: number | null;
  y?: number | null;
  z?: number | null;
}

export interface DeviceGravityDebugSnapshot {
  source: "orientation" | "motion";
  used: boolean;
  reason: "motion-2d" | "orientation-debug" | "empty";
  gravity: GravityVector;
  rawGravity: GravityVector;
  platform: DeviceGravityPlatform;
  axisCorrection: DeviceGravityAxisCorrection;
  screenAngle: number;
  orientationType: string;
  viewport: { width: number; height: number };
  beta: number | null;
  gamma: number | null;
  alpha: number | null;
  motionX: number | null;
  motionY: number | null;
  motionZ: number | null;
}

export class DeviceGravityController {
  private active = false;
  private strength = DEFAULT_APP_SETTINGS.gravityStrength;
  private readonly platform = resolveDeviceGravityPlatform();
  private latestOrientation: Pick<DeviceGravityDebugSnapshot, "beta" | "gamma" | "alpha"> = {
    beta: null,
    gamma: null,
    alpha: null,
  };

  constructor(
    private readonly onGravity: (gravity: GravityVector) => void,
    private readonly onDebug?: (snapshot: DeviceGravityDebugSnapshot) => void,
  ) {}

  start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    window.addEventListener("deviceorientation", this.handleOrientation);
    window.addEventListener("devicemotion", this.handleMotion);
  }

  stop(): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.latestOrientation = { beta: null, gamma: null, alpha: null };
    window.removeEventListener("deviceorientation", this.handleOrientation);
    window.removeEventListener("devicemotion", this.handleMotion);
    this.onGravity({ x: 0, y: 0 });
  }

  updateStrength(strength: number): void {
    this.strength = strength;
  }

  private readonly handleOrientation = (event: DeviceOrientationEvent): void => {
    this.latestOrientation = {
      beta: readFiniteNumberOrNull(event.beta),
      gamma: readFiniteNumberOrNull(event.gamma),
      alpha: readFiniteNumberOrNull(event.alpha),
    };
  };

  private readonly handleMotion = (event: DeviceMotionEvent): void => {
    const rawGravity = motionToGravity(event.accelerationIncludingGravity, this.strength);
    const gravity = applyAxisCorrection(rawGravity, this.platform.axisCorrection);
    this.onDebug?.(createMotionDebugSnapshot(event, this.latestOrientation, rawGravity, gravity, this.platform, "motion-2d"));
    if (gravity.x !== 0 || gravity.y !== 0) {
      this.onGravity(gravity);
    } else {
      this.onGravity({ x: 0, y: 0 });
    }
  };
}

export async function requestDeviceGravityPermission(): Promise<boolean> {
  const hasOrientation = "DeviceOrientationEvent" in window;
  const hasMotion = "DeviceMotionEvent" in window;
  if (!hasOrientation && !hasMotion) {
    return false;
  }

  const permissionChecks: Promise<boolean>[] = [];
  if (hasOrientation) {
    permissionChecks.push(requestSensorPermission(DeviceOrientationEvent as DeviceSensorEventConstructorWithPermission));
  }
  if (hasMotion) {
    permissionChecks.push(requestSensorPermission(DeviceMotionEvent as DeviceSensorEventConstructorWithPermission));
  }

  const results = await Promise.all(permissionChecks);
  return results.some(Boolean);
}

export function motionToGravity(
  gravity: MotionGravitySource | null,
  strength: number,
  axisCorrection: DeviceGravityAxisCorrection = "none",
): GravityVector {
  if (!gravity) {
    return { x: 0, y: 0 };
  }
  const gravityX = readFiniteNumber(gravity.x);
  const gravityY = readFiniteNumber(gravity.y);
  const rawGravity = {
    x: gravityX === 0 ? 0 : clamp(-gravityX / MOTION_GRAVITY_REFERENCE, -1, 1) * strength,
    y: gravityY === 0 ? 0 : clamp(gravityY / MOTION_GRAVITY_REFERENCE, -1, 1) * strength,
  };
  return applyAxisCorrection(rawGravity, axisCorrection);
}

export function resolveDeviceGravityPlatform(input?: DeviceGravityPlatformInput): DeviceGravityPlatform {
  const source = input ?? readNavigatorPlatformInput();
  const userAgent = source.userAgent ?? "";
  const platform = source.platform ?? "";
  const maxTouchPoints = source.maxTouchPoints ?? 0;
  const isExplicitIos = /iPad|iPhone|iPod/i.test(userAgent);
  const isDesktopModeIpad = platform === "MacIntel" && maxTouchPoints > 1;
  const isIosWebKit = isExplicitIos || isDesktopModeIpad;
  return {
    name: isIosWebKit ? "ios-webkit" : "standard",
    axisCorrection: isIosWebKit ? "ios-inverted" : "none",
    userAgent,
    platform,
    maxTouchPoints,
  };
}

function readNavigatorPlatformInput(): DeviceGravityPlatformInput {
  if (typeof navigator === "undefined") {
    return {};
  }
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  };
}

function applyAxisCorrection(gravity: GravityVector, axisCorrection: DeviceGravityAxisCorrection): GravityVector {
  if (axisCorrection !== "ios-inverted") {
    return gravity;
  }
  return {
    x: gravity.x === 0 ? 0 : -gravity.x,
    y: gravity.y === 0 ? 0 : -gravity.y,
  };
}

function getScreenOrientationAngle(): number {
  const orientation = screen.orientation?.angle;
  if (typeof orientation === "number") {
    return orientation;
  }
  const legacyOrientation = window.orientation;
  return typeof legacyOrientation === "number" ? legacyOrientation : 0;
}

function getScreenOrientationType(): string {
  return screen.orientation?.type ?? "unknown";
}

function createMotionDebugSnapshot(
  event: DeviceMotionEvent,
  orientation: Pick<DeviceGravityDebugSnapshot, "beta" | "gamma" | "alpha">,
  rawGravity: GravityVector,
  gravity: GravityVector,
  platform: DeviceGravityPlatform,
  reason: DeviceGravityDebugSnapshot["reason"],
): DeviceGravityDebugSnapshot {
  const motion = event.accelerationIncludingGravity;
  return {
    source: "motion",
    used: true,
    reason,
    gravity,
    rawGravity,
    platform,
    axisCorrection: platform.axisCorrection,
    screenAngle: getScreenOrientationAngle(),
    orientationType: getScreenOrientationType(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    beta: orientation.beta,
    gamma: orientation.gamma,
    alpha: orientation.alpha,
    motionX: readFiniteNumberOrNull(motion?.x),
    motionY: readFiniteNumberOrNull(motion?.y),
    motionZ: readFiniteNumberOrNull(motion?.z),
  };
}

function readFiniteNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readFiniteNumberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function requestSensorPermission(eventConstructor: DeviceSensorEventConstructorWithPermission): Promise<boolean> {
  if (typeof eventConstructor.requestPermission !== "function") {
    return true;
  }

  try {
    return (await eventConstructor.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
