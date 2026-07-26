export const SETTINGS_RANGE_THUMB_HIT_SIZE_PX = 44;
export const SETTINGS_RANGE_TAP_MOVEMENT_PX = 10;
export const SETTINGS_RANGE_TAP_DURATION_MS = 600;
const TOUCH_TRACK_RELEASE_DELAY_MS = 700;

interface RangeThumbHitTestInput {
  clientX: number;
  trackLeft: number;
  trackWidth: number;
  value: number;
  min: number;
  max: number;
  hitSize?: number;
  rightToLeft?: boolean;
}

interface RangeValueAtPositionInput {
  clientX: number;
  trackLeft: number;
  trackWidth: number;
  min: number;
  max: number;
  step: number;
  rightToLeft?: boolean;
}

interface IntentionalRangeTapInput {
  deltaX: number;
  deltaY: number;
  durationMs: number;
  movementLimit?: number;
  durationLimit?: number;
}

interface TrackTapState {
  initialValue: string;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startedAt: number;
}

export function isRangeThumbHit({
  clientX,
  trackLeft,
  trackWidth,
  value,
  min,
  max,
  hitSize = SETTINGS_RANGE_THUMB_HIT_SIZE_PX,
  rightToLeft = false,
}: RangeThumbHitTestInput): boolean {
  if (
    !Number.isFinite(clientX)
    || !Number.isFinite(trackLeft)
    || !Number.isFinite(trackWidth)
    || !Number.isFinite(value)
    || !Number.isFinite(min)
    || !Number.isFinite(max)
    || !Number.isFinite(hitSize)
    || trackWidth <= 0
    || max <= min
    || hitSize <= 0
  ) {
    return false;
  }

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const visualRatio = rightToLeft ? 1 - ratio : ratio;
  const thumbCenterX = trackLeft + trackWidth * visualRatio;
  return Math.abs(clientX - thumbCenterX) <= hitSize / 2;
}

export function rangeValueAtClientX({
  clientX,
  trackLeft,
  trackWidth,
  min,
  max,
  step,
  rightToLeft = false,
}: RangeValueAtPositionInput): number {
  if (
    !Number.isFinite(clientX)
    || !Number.isFinite(trackLeft)
    || !Number.isFinite(trackWidth)
    || !Number.isFinite(min)
    || !Number.isFinite(max)
    || !Number.isFinite(step)
    || trackWidth <= 0
    || max <= min
    || step <= 0
  ) {
    return min;
  }

  const visualRatio = Math.max(0, Math.min(1, (clientX - trackLeft) / trackWidth));
  const valueRatio = rightToLeft ? 1 - visualRatio : visualRatio;
  const rawValue = min + valueRatio * (max - min);
  const snappedValue = min + Math.round((rawValue - min) / step) * step;
  const precision = Math.min(10, Math.max(decimalPlaces(min), decimalPlaces(max), decimalPlaces(step)));
  return Number(Math.max(min, Math.min(max, snappedValue)).toFixed(precision));
}

export function isIntentionalRangeTap({
  deltaX,
  deltaY,
  durationMs,
  movementLimit = SETTINGS_RANGE_TAP_MOVEMENT_PX,
  durationLimit = SETTINGS_RANGE_TAP_DURATION_MS,
}: IntentionalRangeTapInput): boolean {
  return Number.isFinite(deltaX)
    && Number.isFinite(deltaY)
    && Number.isFinite(durationMs)
    && Math.abs(deltaX) <= movementLimit
    && Math.abs(deltaY) <= movementLimit
    && durationMs >= 0
    && durationMs <= durationLimit;
}

export function bindIntentionalRangeInteraction(input: HTMLInputElement): void {
  let trackTap: TrackTapState | null = null;
  let protectedValue: string | null = null;
  let clearTimer: number | undefined;
  let committingValue = false;

  const clearProtection = () => {
    if (clearTimer !== undefined) {
      window.clearTimeout(clearTimer);
      clearTimer = undefined;
    }
    protectedValue = null;
  };

  const protectValue = (value: string) => {
    if (clearTimer !== undefined) {
      window.clearTimeout(clearTimer);
      clearTimer = undefined;
    }
    protectedValue = value;
  };

  const scheduleProtectionRelease = () => {
    if (protectedValue === null) {
      return;
    }
    if (clearTimer !== undefined) {
      window.clearTimeout(clearTimer);
    }
    clearTimer = window.setTimeout(clearProtection, TOUCH_TRACK_RELEASE_DELAY_MS);
  };

  const beginTrackTap = (clientX: number, clientY: number) => {
    const initialValue = input.value;
    protectValue(initialValue);
    trackTap = {
      initialValue,
      startX: clientX,
      startY: clientY,
      lastX: clientX,
      lastY: clientY,
      startedAt: performance.now(),
    };
  };

  const updateTrackTap = (clientX: number, clientY: number) => {
    if (!trackTap) {
      return;
    }
    trackTap.lastX = clientX;
    trackTap.lastY = clientY;
  };

  const finishTrackTap = (clientX: number, clientY: number) => {
    const completedTap = trackTap;
    trackTap = null;
    if (!completedTap) {
      return;
    }
    completedTap.lastX = clientX;
    completedTap.lastY = clientY;
    const intentional = isIntentionalRangeTap({
      deltaX: completedTap.lastX - completedTap.startX,
      deltaY: completedTap.lastY - completedTap.startY,
      durationMs: performance.now() - completedTap.startedAt,
    });
    if (!intentional) {
      input.value = completedTap.initialValue;
      protectValue(completedTap.initialValue);
      scheduleProtectionRelease();
      return;
    }

    const nextValue = `${readRangeValueAtClientX(input, completedTap.lastX)}`;
    protectValue(nextValue);
    committingValue = true;
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    committingValue = false;
    scheduleProtectionRelease();
  };

  const cancelTrackTap = () => {
    const initialValue = trackTap?.initialValue;
    trackTap = null;
    if (initialValue !== undefined) {
      input.value = initialValue;
      protectValue(initialValue);
      scheduleProtectionRelease();
    }
  };

  input.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    if (shouldStartTrackTap(input, event.clientX)) {
      beginTrackTap(event.clientX, event.clientY);
      return;
    }
    trackTap = null;
    clearProtection();
  });
  input.addEventListener("pointermove", (event) => {
    if (event.isPrimary) {
      updateTrackTap(event.clientX, event.clientY);
    }
  });
  input.addEventListener("pointerup", (event) => {
    if (event.isPrimary) {
      finishTrackTap(event.clientX, event.clientY);
    }
  });
  input.addEventListener("pointercancel", cancelTrackTap);

  if (!("PointerEvent" in window)) {
    input.addEventListener("touchstart", (event) => {
      const touch = event.touches.item(0);
      if (!touch) {
        return;
      }
      if (shouldStartTrackTap(input, touch.clientX)) {
        beginTrackTap(touch.clientX, touch.clientY);
      } else {
        trackTap = null;
        clearProtection();
      }
    }, { passive: true });
    input.addEventListener("touchmove", (event) => {
      const touch = event.touches.item(0);
      if (touch) {
        updateTrackTap(touch.clientX, touch.clientY);
      }
    }, { passive: true });
    input.addEventListener("touchend", (event) => {
      const touch = event.changedTouches.item(0);
      if (touch) {
        finishTrackTap(touch.clientX, touch.clientY);
      }
    });
    input.addEventListener("touchcancel", cancelTrackTap);
  }

  const blockLateValueChange = (event: Event) => {
    if (protectedValue === null || committingValue) {
      return;
    }
    input.value = protectedValue;
    event.stopImmediatePropagation();
  };
  input.addEventListener("input", blockLateValueChange, { capture: true });
  input.addEventListener("change", blockLateValueChange, { capture: true });
  input.addEventListener("click", (event) => {
    if (protectedValue === null) {
      return;
    }
    input.value = protectedValue;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });
  input.addEventListener("blur", () => {
    trackTap = null;
    clearProtection();
  });
}

function shouldStartTrackTap(input: HTMLInputElement, clientX: number): boolean {
  const rect = input.getBoundingClientRect();
  const min = readFiniteNumber(input.min, 0);
  const max = readFiniteNumber(input.max, 100);
  const value = readFiniteNumber(input.value, min);
  const rightToLeft = getComputedStyle(input).direction === "rtl";
  return !isRangeThumbHit({
    clientX,
    trackLeft: rect.left,
    trackWidth: rect.width,
    value,
    min,
    max,
    rightToLeft,
  });
}

function readRangeValueAtClientX(input: HTMLInputElement, clientX: number): number {
  const rect = input.getBoundingClientRect();
  return rangeValueAtClientX({
    clientX,
    trackLeft: rect.left,
    trackWidth: rect.width,
    min: readFiniteNumber(input.min, 0),
    max: readFiniteNumber(input.max, 100),
    step: readFiniteNumber(input.step, 1),
    rightToLeft: getComputedStyle(input).direction === "rtl",
  });
}

function decimalPlaces(value: number): number {
  const text = `${value}`.toLowerCase();
  if (text.includes("e-")) {
    return Number(text.split("e-")[1]) || 0;
  }
  return text.includes(".") ? text.split(".")[1].length : 0;
}

function readFiniteNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
