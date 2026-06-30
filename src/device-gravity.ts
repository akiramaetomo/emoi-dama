import type { GravityVector } from "./rapier-stage.js";
import { DEFAULT_APP_SETTINGS } from "./settings.js";

interface DeviceSensorEventConstructorWithPermission {
  requestPermission?: () => Promise<"granted" | "denied">;
}

export interface MotionGravitySource {
  x?: number | null;
  y?: number | null;
}

export class DeviceGravityController {
  private active = false;
  private strength = DEFAULT_APP_SETTINGS.gravityStrength;

  constructor(private readonly onGravity: (gravity: GravityVector) => void) {}

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
    window.removeEventListener("deviceorientation", this.handleOrientation);
    window.removeEventListener("devicemotion", this.handleMotion);
    this.onGravity({ x: 0, y: 0 });
  }

  updateStrength(strength: number): void {
    this.strength = strength;
  }

  private readonly handleOrientation = (event: DeviceOrientationEvent): void => {
    this.onGravity(orientationToGravity(event.beta, event.gamma, this.strength));
  };

  private readonly handleMotion = (event: DeviceMotionEvent): void => {
    const gravity = motionToGravity(event.accelerationIncludingGravity, this.strength);
    if (gravity.x !== 0 || gravity.y !== 0) {
      this.onGravity(gravity);
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

export function orientationToGravity(beta: number | null, gamma: number | null, strength: number): GravityVector {
  const safeBeta = typeof beta === "number" ? beta : 0;
  const safeGamma = typeof gamma === "number" ? gamma : 0;
  return {
    x: clamp(safeGamma / 35, -1, 1) * strength,
    y: clamp(safeBeta / 45, -1, 1) * strength,
  };
}

export function motionToGravity(gravity: MotionGravitySource | null, strength: number): GravityVector {
  if (!gravity) {
    return { x: 0, y: 0 };
  }
  return {
    x: typeof gravity.x === "number" ? clamp(gravity.x / 6, -1, 1) * strength : 0,
    y: typeof gravity.y === "number" ? clamp(-gravity.y / 6, -1, 1) * strength : 0,
  };
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
