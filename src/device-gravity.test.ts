import { motionToGravity, orientationToGravity } from "./device-gravity.js";

const strength = 720;

const orientation = orientationToGravity(45, 35, strength);
assertEqual(orientation.x, strength, "orientation gamma should map to positive x gravity");
assertEqual(orientation.y, strength, "orientation beta should map to positive y gravity");

const clampedOrientation = orientationToGravity(-90, 90, strength);
assertEqual(clampedOrientation.x, strength, "orientation x should clamp at positive strength");
assertEqual(clampedOrientation.y, -strength, "orientation y should clamp at negative strength");

const emptyOrientation = orientationToGravity(null, null, strength);
assertEqual(emptyOrientation.x, 0, "missing gamma should map to zero x gravity");
assertEqual(emptyOrientation.y, 0, "missing beta should map to zero y gravity");

const motion = motionToGravity({ x: 6, y: -6 }, strength);
assertEqual(motion.x, strength, "motion x should map to positive x gravity");
assertEqual(motion.y, strength, "negative motion y should map to positive y gravity");

const clampedMotion = motionToGravity({ x: -99, y: 99 }, strength);
assertEqual(clampedMotion.x, -strength, "motion x should clamp at negative strength");
assertEqual(clampedMotion.y, -strength, "motion y should clamp at negative strength");

const emptyMotion = motionToGravity(null, strength);
assertEqual(emptyMotion.x, 0, "missing motion gravity should map to zero x");
assertEqual(emptyMotion.y, 0, "missing motion gravity should map to zero y");

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
