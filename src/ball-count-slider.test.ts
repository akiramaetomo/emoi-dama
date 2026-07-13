import {
  BALL_COUNT_SLIDER_EMPHASIS,
  BALL_COUNT_SLIDER_MAX,
  ballCountToSliderPosition,
  ballCountToTrackPercent,
  formatBallCount,
  isLegacyBallCount,
  sliderPositionToBallCount,
} from "./ball-count-slider.js";

assertEqual(sliderPositionToBallCount(0), 1, "positions below the range should clamp to one ball");
assertEqual(sliderPositionToBallCount(1), 1, "the left edge should select one ball");
assertEqual(sliderPositionToBallCount(2), 2, "position two should select two balls");
assertEqual(sliderPositionToBallCount(BALL_COUNT_SLIDER_EMPHASIS), 5, "the emphasized detent should select five balls");
assertEqual(sliderPositionToBallCount(BALL_COUNT_SLIDER_MAX), 10, "the right edge should select ten balls");
assertEqual(ballCountToSliderPosition(1), 1, "one stored ball should load at the left edge");
assertEqual(ballCountToSliderPosition(2), 2, "two stored balls should load at position two");
assertEqual(ballCountToSliderPosition(5), 5, "five stored balls should load at its natural detent");
assertEqual(ballCountToSliderPosition(10), 10, "ten stored balls should load at the right edge");
assertClose(ballCountToTrackPercent(1), 0, "one should be at the left track edge");
assertClose(ballCountToTrackPercent(5), (4 / 9) * 100, "five should be four of nine intervals from the left");
assertClose(ballCountToTrackPercent(10), 100, "ten should be at the right track edge");
assertEqual(formatBallCount(5), "5玉", "the visible value should use the ball unit");
assertEqual(isLegacyBallCount(10), false, "ten balls should use the normal slider");
assertEqual(isLegacyBallCount(11), true, "eleven balls should use compatibility mode");
assertEqual(isLegacyBallCount(99), true, "the storage maximum should use compatibility mode");

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
