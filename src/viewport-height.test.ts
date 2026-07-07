import { resolveAppViewportHeights } from "./viewport-height.js";

assertDeepEqual(
  resolveAppViewportHeights({ innerHeight: 820, visualViewportHeight: 420, visualViewportOffsetTop: 18 }),
  { stableHeight: 820, visibleHeight: 420, visibleOffsetTop: 18 },
  "visual viewport height should not shrink the stable app height",
);

assertDeepEqual(
  resolveAppViewportHeights({ innerHeight: 812, visualViewportHeight: null }),
  { stableHeight: 812, visibleHeight: 812, visibleOffsetTop: 0 },
  "missing visual viewport should use the window height for both values",
);

assertDeepEqual(
  resolveAppViewportHeights({ innerHeight: 260, visualViewportHeight: 240 }),
  { stableHeight: 320, visibleHeight: 320, visibleOffsetTop: 0 },
  "very small heights should be clamped to the minimum",
);

assert(
  resolveAppViewportHeights({ innerHeight: 0, visualViewportHeight: 420 }) === null,
  "invalid stable heights should be ignored",
);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertDeepEqual<T>(actual: T, expected: T, message: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}: expected ${expectedJson}, got ${actualJson}`);
  }
}
