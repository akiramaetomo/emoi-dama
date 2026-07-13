export const MIN_APP_VIEWPORT_HEIGHT = 320;

export interface AppViewportHeights {
  stableHeight: number;
  visibleHeight: number;
}

export function resolveAppViewportHeights(input: {
  innerHeight: number;
  visualViewportHeight?: number | null;
}): AppViewportHeights | null {
  const stableHeight = input.innerHeight;
  const visibleHeight = input.visualViewportHeight ?? input.innerHeight;
  if (!Number.isFinite(stableHeight) || !Number.isFinite(visibleHeight) || stableHeight <= 0 || visibleHeight <= 0) {
    return null;
  }

  return {
    stableHeight: Math.max(MIN_APP_VIEWPORT_HEIGHT, Math.round(stableHeight)),
    visibleHeight: Math.max(MIN_APP_VIEWPORT_HEIGHT, Math.round(visibleHeight)),
  };
}
