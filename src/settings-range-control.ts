export const SETTINGS_RANGE_THUMB_HIT_SIZE_PX = 44;
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

export function bindThumbOnlyRangeInteraction(input: HTMLInputElement): void {
  let blockedValue: string | null = null;
  let clearTimer: number | undefined;

  const clearBlock = () => {
    if (clearTimer !== undefined) {
      window.clearTimeout(clearTimer);
      clearTimer = undefined;
    }
    blockedValue = null;
  };

  const blockTrackStart = () => {
    if (clearTimer !== undefined) {
      window.clearTimeout(clearTimer);
      clearTimer = undefined;
    }
    blockedValue = input.value;
  };

  const scheduleBlockRelease = (delayMs: number) => {
    if (blockedValue === null) {
      return;
    }
    if (clearTimer !== undefined) {
      window.clearTimeout(clearTimer);
    }
    clearTimer = window.setTimeout(clearBlock, delayMs);
  };

  input.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    if (shouldBlockPointerStart(input, event.clientX)) {
      blockTrackStart();
      if (event.pointerType !== "touch") {
        scheduleBlockRelease(0);
        event.preventDefault();
      }
    } else {
      clearBlock();
    }
  });

  input.addEventListener("touchstart", (event) => {
    const touch = event.touches.item(0);
    if (touch && shouldBlockPointerStart(input, touch.clientX)) {
      blockTrackStart();
    } else {
      clearBlock();
    }
  }, { passive: true });

  const blockLateValueChange = (event: Event) => {
    if (blockedValue === null) {
      return;
    }
    input.value = blockedValue;
    event.stopImmediatePropagation();
  };
  input.addEventListener("input", blockLateValueChange, { capture: true });
  input.addEventListener("change", blockLateValueChange, { capture: true });
  input.addEventListener("click", (event) => {
    if (blockedValue === null) {
      return;
    }
    input.value = blockedValue;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });

  const finishTouch = () => {
    scheduleBlockRelease(TOUCH_TRACK_RELEASE_DELAY_MS);
  };
  input.addEventListener("pointerup", finishTouch);
  input.addEventListener("pointercancel", finishTouch);
  input.addEventListener("touchend", finishTouch);
  input.addEventListener("touchcancel", finishTouch);
  input.addEventListener("blur", clearBlock);
}

function shouldBlockPointerStart(input: HTMLInputElement, clientX: number): boolean {
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

function readFiniteNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
