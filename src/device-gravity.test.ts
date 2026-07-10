import { motionToGravity, resolveDeviceGravityPlatform } from "./device-gravity.js";

const strength = 720;

const leftSideDown = motionToGravity({ x: 9.8, y: 0, z: 0 }, strength);
assertEqual(leftSideDown.x, -strength, "positive motion x should move gravity toward screen left");
assertEqual(leftSideDown.y, 0, "positive motion x should not move screen y");

const rightSideDown = motionToGravity({ x: -9.8, y: 0, z: 0 }, strength);
assertEqual(rightSideDown.x, strength, "negative motion x should move gravity toward screen right");
assertEqual(rightSideDown.y, 0, "negative motion x should not move screen y");

const bottomSideDown = motionToGravity({ x: 0, y: 9.8, z: 0 }, strength);
assertEqual(bottomSideDown.x, 0, "positive motion y should not move screen x");
assertEqual(bottomSideDown.y, strength, "positive motion y should move gravity toward screen bottom");

const topSideDown = motionToGravity({ x: 0, y: -9.8, z: 0 }, strength);
assertEqual(topSideDown.x, 0, "negative motion y should not move screen x");
assertEqual(topSideDown.y, -strength, "negative motion y should move gravity toward screen top");

const faceUp = motionToGravity({ x: 0, y: 0, z: 9.8 }, strength);
assertEqual(faceUp.x, 0, "positive motion z should not project into screen x");
assertEqual(faceUp.y, 0, "positive motion z should not project into screen y");

const faceDown = motionToGravity({ x: 0, y: 0, z: -9.8 }, strength);
assertEqual(faceDown.x, 0, "negative motion z should not project into screen x");
assertEqual(faceDown.y, 0, "negative motion z should not project into screen y");

const diagonal = motionToGravity({ x: -4.9, y: 4.9, z: 8 }, strength);
assertEqual(diagonal.x, strength / 2, "motion x should scale linearly before clamping");
assertEqual(diagonal.y, strength / 2, "motion y should scale linearly before clamping");

const ipadCorrected = motionToGravity({ x: -4.9, y: 4.9, z: 8 }, strength, "ios-inverted");
assertEqual(ipadCorrected.x, -strength / 2, "iPad correction should invert projected x");
assertEqual(ipadCorrected.y, -strength / 2, "iPad correction should invert projected y");

const clamped = motionToGravity({ x: -99, y: 99, z: 0 }, strength);
assertEqual(clamped.x, strength, "motion x should clamp at positive strength");
assertEqual(clamped.y, strength, "motion y should clamp at positive strength");

const emptyMotion = motionToGravity(null, strength);
assertEqual(emptyMotion.x, 0, "missing motion gravity should map to zero x");
assertEqual(emptyMotion.y, 0, "missing motion gravity should map to zero y");

const invalidMotion = motionToGravity({ x: Number.NaN, y: Number.NaN, z: Number.NaN }, strength);
assertEqual(invalidMotion.x, 0, "invalid motion x should map to zero x");
assertEqual(invalidMotion.y, 0, "invalid motion y should map to zero y");

const iosUserAgent = resolveDeviceGravityPlatform({
  userAgent: "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15",
  platform: "iPad",
  maxTouchPoints: 5,
});
assertEqual(iosUserAgent.axisCorrection, "ios-inverted", "explicit iPad user agent should use iOS axis correction");

const ipadDesktopMode = resolveDeviceGravityPlatform({
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15",
  platform: "MacIntel",
  maxTouchPoints: 5,
});
assertEqual(ipadDesktopMode.axisCorrection, "ios-inverted", "iPad desktop mode should use iOS axis correction");

const androidChrome = resolveDeviceGravityPlatform({
  userAgent: "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
  platform: "Linux armv8l",
  maxTouchPoints: 5,
});
assertEqual(androidChrome.axisCorrection, "none", "Android should keep standard gravity axis mapping");

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
