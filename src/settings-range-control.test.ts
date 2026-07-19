import { SETTINGS_RANGE_THUMB_HIT_SIZE_PX, isRangeThumbHit } from "./settings-range-control.js";

const base = {
  trackLeft: 100,
  trackWidth: 200,
  value: 50,
  min: 0,
  max: 100,
};

assertEqual(isRangeThumbHit({ ...base, clientX: 200 }), true, "the thumb center should be interactive");
assertEqual(
  isRangeThumbHit({ ...base, clientX: 200 + SETTINGS_RANGE_THUMB_HIT_SIZE_PX / 2 }),
  true,
  "the edge of the 44px thumb hit area should be interactive",
);
assertEqual(isRangeThumbHit({ ...base, clientX: 223 }), false, "the track outside the thumb hit area should be ignored");
assertEqual(isRangeThumbHit({ ...base, clientX: 100, value: 0 }), true, "the minimum thumb position should be interactive");
assertEqual(isRangeThumbHit({ ...base, clientX: 300, value: 100 }), true, "the maximum thumb position should be interactive");
assertEqual(
  isRangeThumbHit({ ...base, clientX: 100, value: 100, rightToLeft: true }),
  true,
  "right-to-left ranges should reverse the thumb position",
);
assertEqual(isRangeThumbHit({ ...base, clientX: 200, trackWidth: 0 }), false, "a zero-width range should reject pointer input");
assertEqual(isRangeThumbHit({ ...base, clientX: Number.NaN }), false, "a non-finite pointer position should be rejected");
assertEqual(isRangeThumbHit({ ...base, clientX: 200, min: 1, max: 1 }), false, "an invalid numeric range should reject pointer input");

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
