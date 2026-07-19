export const BALL_COUNT_SLIDER_MIN = 1;
export const BALL_COUNT_SLIDER_MAX = 10;
export const BALL_COUNT_SLIDER_EMPHASIS = 5;
export const BALL_COUNT_STORAGE_MAX = 200;

const PUBLIC_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 50, 100] as const;

export function sliderPositionToBallCount(position: number): number {
  const normalizedPosition = clampRounded(position, BALL_COUNT_SLIDER_MIN, BALL_COUNT_SLIDER_MAX);
  return PUBLIC_COUNTS[normalizedPosition - 1];
}

export function ballCountToSliderPosition(count: number): number {
  const rounded = Math.round(Number.isFinite(count) ? count : PUBLIC_COUNTS[0]);
  let nearestPosition = BALL_COUNT_SLIDER_MIN;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < PUBLIC_COUNTS.length; index += 1) {
    const distance = Math.abs(PUBLIC_COUNTS[index] - rounded);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPosition = index + 1;
    }
  }
  return nearestPosition;
}

export function ballCountToTrackPercent(count: number): number {
  const position = ballCountToSliderPosition(count);
  return ((position - BALL_COUNT_SLIDER_MIN) / (BALL_COUNT_SLIDER_MAX - BALL_COUNT_SLIDER_MIN)) * 100;
}

export function pointerClientXToSliderPosition(clientX: number, trackLeft: number, trackWidth: number): number {
  if (!Number.isFinite(clientX) || !Number.isFinite(trackLeft) || !Number.isFinite(trackWidth) || trackWidth <= 0) {
    return BALL_COUNT_SLIDER_MIN;
  }
  const fraction = Math.max(0, Math.min(1, (clientX - trackLeft) / trackWidth));
  return clampRounded(
    BALL_COUNT_SLIDER_MIN + fraction * (BALL_COUNT_SLIDER_MAX - BALL_COUNT_SLIDER_MIN),
    BALL_COUNT_SLIDER_MIN,
    BALL_COUNT_SLIDER_MAX,
  );
}

export function isLegacyBallCount(count: number): boolean {
  if (!Number.isFinite(count)) {
    return false;
  }
  const rounded = Math.round(count);
  return !PUBLIC_COUNTS.includes(rounded as typeof PUBLIC_COUNTS[number]);
}

export function formatBallCount(count: number): string {
  return `${Math.max(1, Math.round(Number.isFinite(count) ? count : 1))}玉`;
}

export function bindBallCountSliderControls(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-ball-count-control]").forEach((control) => {
    const range = control.querySelector<HTMLInputElement>("[data-ball-count-range]");
    const hidden = control.querySelector<HTMLInputElement>("input[name='count']");
    const output = control.querySelector<HTMLOutputElement>("[data-ball-count-output]");
    const convert = control.querySelector<HTMLButtonElement>("[data-ball-count-convert]");
    const legacy = control.querySelector<HTMLElement>("[data-ball-count-legacy]");
    const slider = control.querySelector<HTMLElement>("[data-ball-count-slider]");
    const visualTrack = control.querySelector<HTMLElement>("[data-ball-count-track]");
    const thumb = control.querySelector<HTMLElement>("[data-ball-count-thumb]");
    if (!range || !hidden || !output) {
      return;
    }

    let activePointerId: number | null = null;
    let pointerValueChanged = false;

    const sync = () => {
      const count = sliderPositionToBallCount(Number(range.value));
      const label = formatBallCount(count);
      hidden.value = String(count);
      output.value = label;
      output.textContent = label;
      range.setAttribute("aria-valuetext", label);
      visualTrack?.style.setProperty("--ball-count-position", `${ballCountToTrackPercent(count)}%`);
    };

    range.addEventListener("input", sync);
    range.addEventListener("change", sync);
    thumb?.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) {
        return;
      }
      activePointerId = event.pointerId;
      pointerValueChanged = false;
      event.preventDefault();
      range.focus({ preventScroll: true });
      try {
        thumb.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can be unavailable in synthetic environments.
      }
    });
    thumb?.addEventListener("pointermove", (event) => {
      if (activePointerId !== event.pointerId || !visualTrack) {
        return;
      }
      event.preventDefault();
      const trackRect = visualTrack.getBoundingClientRect();
      const nextPosition = pointerClientXToSliderPosition(event.clientX, trackRect.left, trackRect.width);
      if (range.value === String(nextPosition)) {
        return;
      }
      range.value = String(nextPosition);
      pointerValueChanged = true;
      range.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const finishPointerDrag = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) {
        return;
      }
      if (pointerValueChanged) {
        range.dispatchEvent(new Event("change", { bubbles: true }));
      }
      try {
        thumb?.releasePointerCapture(event.pointerId);
      } catch {
        // A cancelled pointer may already have released capture.
      }
      activePointerId = null;
      pointerValueChanged = false;
    };
    thumb?.addEventListener("pointerup", finishPointerDrag);
    thumb?.addEventListener("pointercancel", finishPointerDrag);
    convert?.addEventListener("click", () => {
      legacy?.setAttribute("hidden", "");
      slider?.removeAttribute("hidden");
      range.value = String(ballCountToSliderPosition(Number(hidden.value)));
      sync();
      range.focus({ preventScroll: true });
    });
    if (!slider?.hasAttribute("hidden")) {
      sync();
    }
  });
}

function clampRounded(value: number, min: number, max: number): number {
  const normalized = Math.round(Number.isFinite(value) ? value : min);
  return Math.max(min, Math.min(max, normalized));
}
