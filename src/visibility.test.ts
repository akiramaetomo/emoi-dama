import { getMemoSurfaceMode } from "./visibility.js";
import type { Visibility } from "./models.js";

const privateLevels: Visibility[] = ["category", "issuer", "title"];

for (const visibility of privateLevels) {
  assertEqual(
    getMemoSurfaceMode(visibility, "秘密のメモ", true),
    "private-obscured",
    `${visibility} should show dummy memo strokes when memo field display is on`,
  );
  assertEqual(
    getMemoSurfaceMode(visibility, "", true),
    "private-empty",
    `${visibility} should show an empty memo surface when memo field display is on and memo is empty`,
  );
  assertEqual(
    getMemoSurfaceMode(visibility, "秘密のメモ", false),
    "none",
    `${visibility} should omit memo surface when memo field display is off`,
  );
}

assertEqual(
  getMemoSurfaceMode("open", "見えるメモ", true),
  "visible",
  "open visibility should show real memo text",
);
assertEqual(
  getMemoSurfaceMode("open", "", true),
  "visible-empty",
  "open visibility should show an empty memo surface when memo field display is on",
);
assertEqual(
  getMemoSurfaceMode("open", "", false),
  "none",
  "open visibility should omit empty memo surface when memo field display is off",
);

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
