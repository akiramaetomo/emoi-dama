import {
  clampPlayMenuPosition,
  createInitialPlayMenuPosition,
} from "./play-jutsu-menu.js";

assertPosition(
  createInitialPlayMenuPosition({ width: 360, height: 560 }, { width: 272, height: 190 }),
  { x: 80, y: 362 },
  "the initial menu position should sit eight pixels from the world's right and bottom edges",
);

assertPosition(
  clampPlayMenuPosition({ x: -80, y: 900 }, { width: 360, height: 560 }, { width: 272, height: 190 }),
  { x: 8, y: 362 },
  "dragging beyond the world should clamp the menu to its safe edges",
);

assertPosition(
  clampPlayMenuPosition({ x: 80, y: 362 }, { width: 320, height: 420 }, { width: 272, height: 250 }),
  { x: 40, y: 162 },
  "viewport changes should re-clamp a remembered position without resetting it",
);

assertPosition(
  clampPlayMenuPosition({ x: 50, y: 50 }, { width: 220, height: 160 }, { width: 272, height: 190 }),
  { x: 8, y: 8 },
  "an oversized menu should stay anchored inside the world's top-left safety margin",
);

function assertPosition(actual: { x: number; y: number }, expected: { x: number; y: number }, message: string): void {
  if (actual.x !== expected.x || actual.y !== expected.y) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
