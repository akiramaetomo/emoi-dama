import {
  BALL_COUNT_SLIDER_EMPHASIS,
  BALL_COUNT_SLIDER_MAX,
  ballCountToSliderPosition,
  ballCountToTrackPercent,
  formatBallCount,
  isLegacyBallCount,
  pointerClientXToSliderPosition,
  sliderPositionToBallCount,
} from "./ball-count-slider.js";

assertEqual(sliderPositionToBallCount(0), 1, "positions below the range should clamp to one ball");
assertEqual(sliderPositionToBallCount(1), 1, "the left edge should select one ball");
assertEqual(sliderPositionToBallCount(2), 2, "position two should select two balls");
assertEqual(sliderPositionToBallCount(BALL_COUNT_SLIDER_EMPHASIS), 5, "the emphasized detent should select five balls");
assertEqual(sliderPositionToBallCount(8), 8, "position eight should remain eight balls");
assertEqual(sliderPositionToBallCount(9), 50, "position nine should select fifty balls");
assertEqual(sliderPositionToBallCount(BALL_COUNT_SLIDER_MAX), 100, "the right edge should select one hundred balls");
assertEqual(ballCountToSliderPosition(1), 1, "one stored ball should load at the left edge");
assertEqual(ballCountToSliderPosition(2), 2, "two stored balls should load at position two");
assertEqual(ballCountToSliderPosition(5), 5, "five stored balls should load at its natural detent");
assertEqual(ballCountToSliderPosition(50), 9, "fifty stored balls should load at position nine");
assertEqual(ballCountToSliderPosition(100), 10, "one hundred stored balls should load at the right edge");
assertEqual(ballCountToSliderPosition(9), 8, "nine legacy balls should convert to the nearest public detent");
assertEqual(ballCountToSliderPosition(10), 8, "ten legacy balls should convert to the nearest public detent");
assertEqual(ballCountToSliderPosition(200), 10, "two hundred legacy balls should convert to the nearest public detent");
assertClose(ballCountToTrackPercent(1), 0, "one should be at the left track edge");
assertClose(ballCountToTrackPercent(5), (4 / 9) * 100, "five should be four of nine intervals from the left");
assertClose(ballCountToTrackPercent(100), 100, "one hundred should be at the right track edge");
assertEqual(formatBallCount(5), "5玉", "the visible value should use the ball unit");
assertEqual(isLegacyBallCount(9), true, "nine balls should remain a compatibility value");
assertEqual(isLegacyBallCount(10), true, "ten balls should remain a compatibility value");
assertEqual(isLegacyBallCount(11), true, "eleven balls should use compatibility mode");
assertEqual(isLegacyBallCount(99), true, "the storage maximum should use compatibility mode");
assertEqual(isLegacyBallCount(50), false, "fifty balls should be native to the public slider");
assertEqual(isLegacyBallCount(100), false, "one hundred balls should be native to the public slider");
assertEqual(isLegacyBallCount(200), true, "two hundred balls should remain a compatibility value");
assertEqual(pointerClientXToSliderPosition(100, 100, 180), 1, "the pointer mapping should clamp to the left endpoint");
assertEqual(pointerClientXToSliderPosition(180, 100, 180), 5, "the pointer mapping should round to the nearest detent");
assertEqual(pointerClientXToSliderPosition(280, 100, 180), 10, "the pointer mapping should clamp to the right endpoint");
assertEqual(pointerClientXToSliderPosition(999, 100, 0), 1, "an invalid track width should safely keep the minimum");

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertClose(actual: number, expected: number, message: string): void {
  if (Math.abs(actual - expected) > 0.000001) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
