import { resolveImeViewport } from "./ime-viewport-coordinator.js";

assertDeepEqual(
  resolveImeViewport({ editableSurface: false, editableFocused: false, baselineHeight: 900, currentHeight: 620, offsetTop: 80 }),
  { active: false, top: 0, height: 900 },
  "normal Primary surfaces must ignore VisualViewport movement",
);

assertDeepEqual(
  resolveImeViewport({ editableSurface: true, editableFocused: true, baselineHeight: 900, currentHeight: 520, offsetTop: 96 }),
  { active: true, top: 96, height: 520 },
  "a focused editable surface should follow a measured keyboard shrink",
);

assertDeepEqual(
  resolveImeViewport({ editableSurface: true, editableFocused: true, baselineHeight: 900, currentHeight: 850, offsetTop: 22 }),
  { active: false, top: 0, height: 900 },
  "browser chrome movement alone should not activate IME sizing",
);

function assertDeepEqual<T>(actual: T, expected: T, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
