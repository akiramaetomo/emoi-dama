export const BALL_COUNT_SLIDER_MIN = 1;
export const BALL_COUNT_SLIDER_MAX = 10;
export const BALL_COUNT_SLIDER_EMPHASIS = 5;
export const BALL_COUNT_NORMAL_MAX = 10;

export function sliderPositionToBallCount(position: number): number {
  return clampRounded(position, BALL_COUNT_SLIDER_MIN, BALL_COUNT_SLIDER_MAX);
}

export function ballCountToSliderPosition(count: number): number {
  return clampRounded(count, BALL_COUNT_SLIDER_MIN, BALL_COUNT_SLIDER_MAX);
}

export function ballCountToTrackPercent(count: number): number {
  const position = ballCountToSliderPosition(count);
  return ((position - BALL_COUNT_SLIDER_MIN) / (BALL_COUNT_SLIDER_MAX - BALL_COUNT_SLIDER_MIN)) * 100;
}

export function isLegacyBallCount(count: number): boolean {
  return Number.isFinite(count) && Math.round(count) > BALL_COUNT_NORMAL_MAX;
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
    if (!range || !hidden || !output) {
      return;
    }

    const sync = () => {
      const count = sliderPositionToBallCount(Number(range.value));
      const label = formatBallCount(count);
      hidden.value = String(count);
      output.value = label;
      output.textContent = label;
      range.setAttribute("aria-valuetext", label);
    };

    range.addEventListener("input", sync);
    range.addEventListener("change", sync);
    convert?.addEventListener("click", () => {
      legacy?.setAttribute("hidden", "");
      slider?.removeAttribute("hidden");
      range.value = String(BALL_COUNT_SLIDER_MAX);
      sync();
      range.focus({ preventScroll: true });
    });
  });
}

function clampRounded(value: number, min: number, max: number): number {
  const normalized = Math.round(Number.isFinite(value) ? value : min);
  return Math.max(min, Math.min(max, normalized));
}
