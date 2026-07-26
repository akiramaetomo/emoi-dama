import {
  SETTINGS_RANGE_THUMB_HIT_SIZE_PX,
  isIntentionalRangeTap,
  isRangeThumbHit,
  rangeValueAtClientX,
} from "./settings-range-control.js";

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
assertEqual(isRangeThumbHit({ ...base, clientX: 223 }), false, "the track outside the thumb hit area should be a tap target");
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

assertEqual(
  rangeValueAtClientX({ clientX: 250, trackLeft: 100, trackWidth: 200, min: 0, max: 100, step: 1 }),
  75,
  "a track position should map to its value",
);
assertEqual(
  rangeValueAtClientX({ clientX: 241, trackLeft: 100, trackWidth: 200, min: 0, max: 1, step: 0.1 }),
  0.7,
  "a track position should snap to decimal steps",
);
assertEqual(
  rangeValueAtClientX({ clientX: 150, trackLeft: 100, trackWidth: 200, min: 0, max: 100, step: 5, rightToLeft: true }),
  75,
  "right-to-left positions should map from the opposite edge",
);
assertEqual(
  rangeValueAtClientX({ clientX: 400, trackLeft: 100, trackWidth: 200, min: 10, max: 20, step: 2 }),
  20,
  "positions beyond the track should clamp to max",
);

assertEqual(isIntentionalRangeTap({ deltaX: 3, deltaY: 4, durationMs: 220 }), true, "a short steady touch should be a tap");
assertEqual(isIntentionalRangeTap({ deltaX: 2, deltaY: 18, durationMs: 220 }), false, "vertical scrolling should not be a tap");
assertEqual(isIntentionalRangeTap({ deltaX: 18, deltaY: 2, durationMs: 220 }), false, "track dragging should not be a tap");
assertEqual(isIntentionalRangeTap({ deltaX: 0, deltaY: 0, durationMs: 800 }), false, "a long press should not be a tap");

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
