export const MIN_APP_VIEWPORT_HEIGHT = 320;

export interface AppViewportHeights {
  stableHeight: number;
  visibleHeight: number;
  visibleOffsetTop: number;
}

export function resolveAppViewportHeights(input: {
  innerHeight: number;
  visualViewportHeight?: number | null;
  visualViewportOffsetTop?: number | null;
}): AppViewportHeights | null {
  const stableHeight = input.innerHeight;
  const visibleHeight = input.visualViewportHeight ?? input.innerHeight;
  const visibleOffsetTop = input.visualViewportOffsetTop ?? 0;
  if (!Number.isFinite(stableHeight) || !Number.isFinite(visibleHeight) || stableHeight <= 0 || visibleHeight <= 0) {
    return null;
  }

  return {
    stableHeight: Math.max(MIN_APP_VIEWPORT_HEIGHT, Math.round(stableHeight)),
    visibleHeight: Math.max(MIN_APP_VIEWPORT_HEIGHT, Math.round(visibleHeight)),
    visibleOffsetTop: Number.isFinite(visibleOffsetTop) ? Math.max(0, Math.round(visibleOffsetTop)) : 0,
  };
}
