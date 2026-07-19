export const DOM_VISUAL_BALL_LIMIT = 120;
export const DOM_TARGET_FILL_RATIO = 0.45;
export const DOM_MIN_BALL_RADIUS_PX = 24;
export const DENSE_TARGET_FILL_RATIO = 0.3;
export const DENSE_MIN_BALL_RADIUS_PX = 2;
export const DENSE_APPEARANCE_MAX_DIAMETER_PX = 12;
export const DENSE_DESKTOP_VISUAL_LIMIT = 1000;
export const DENSE_NARROW_VISUAL_LIMIT = 500;

export interface PlayRenderPlan {
  renderer: "dom" | "pixi";
  appearanceProfile: "faithful" | "dense-gloss";
  densityMode: "normal" | "dense";
  radiusMode: "dom" | "dense";
  radius: number;
}

export type BallRendererPreference = "pixi" | "dom";

export interface DatedVisualRecord {
  id: string;
  createdAt: string;
}

export interface PopulationPlan<T> {
  displayed: T[];
  displayedCount: number;
  totalCount: number;
  truncated: boolean;
}

export function sortNewestFirst<T extends DatedVisualRecord>(records: readonly T[]): T[] {
  return [...records].sort((a, b) => {
    const dateOrder = b.createdAt.localeCompare(a.createdAt);
    return dateOrder !== 0 ? dateOrder : b.id.localeCompare(a.id);
  });
}

export function limitVisualPopulation<T>(sources: readonly T[], limit = DOM_VISUAL_BALL_LIMIT): PopulationPlan<T> {
  const safeLimit = Math.max(0, Math.floor(limit));
  const displayed = sources.slice(0, safeLimit);
  return {
    displayed,
    displayedCount: displayed.length,
    totalCount: sources.length,
    truncated: displayed.length < sources.length,
  };
}

export function calculateDomBallRadius(
  width: number,
  height: number,
  count: number,
  requestedRadius: number,
): number {
  if (count <= 0) {
    return requestedRadius;
  }
  const safeArea = Math.max(1, width) * Math.max(1, height) * DOM_TARGET_FILL_RATIO;
  const fitRadius = Math.sqrt(safeArea / (Math.PI * count));
  return Math.min(requestedRadius, Math.max(DOM_MIN_BALL_RADIUS_PX, fitRadius));
}

export function calculateDenseBallRadius(width: number, height: number, count: number): number {
  if (count <= 0) {
    return DENSE_MIN_BALL_RADIUS_PX;
  }
  const safeArea = Math.max(1, width) * Math.max(1, height) * DENSE_TARGET_FILL_RATIO;
  return Math.max(DENSE_MIN_BALL_RADIUS_PX, Math.sqrt(safeArea / (Math.PI * count)));
}

export function needsDenseRendering(width: number, height: number, count: number, requestedRadius: number): boolean {
  if (count > DOM_VISUAL_BALL_LIMIT) {
    return true;
  }
  if (count <= 0) {
    return false;
  }
  const safeArea = Math.max(1, width) * Math.max(1, height) * DOM_TARGET_FILL_RATIO;
  const fitRadius = Math.sqrt(safeArea / (Math.PI * count));
  return Math.min(requestedRadius, fitRadius) < DOM_MIN_BALL_RADIUS_PX;
}

export function createPlayRenderPlan(
  width: number,
  height: number,
  count: number,
  requestedRadius: number,
  rendererPreference: BallRendererPreference = "pixi",
): PlayRenderPlan {
  if (rendererPreference === "dom") {
    return {
      renderer: "dom",
      appearanceProfile: "faithful",
      densityMode: "normal",
      radiusMode: "dom",
      radius: calculateDomBallRadius(width, height, count, requestedRadius),
    };
  }
  const needsPixi = needsDenseRendering(width, height, count, requestedRadius);
  if (!needsPixi) {
    return {
      renderer: "pixi",
      appearanceProfile: "faithful",
      densityMode: "normal",
      radiusMode: "dom",
      radius: calculateDomBallRadius(width, height, count, requestedRadius),
    };
  }

  const radius = calculateDenseBallRadius(width, height, count);
  const denseAppearance = radius * 2 <= DENSE_APPEARANCE_MAX_DIAMETER_PX;
  return {
    renderer: "pixi",
    appearanceProfile: denseAppearance ? "dense-gloss" : "faithful",
    densityMode: denseAppearance ? "dense" : "normal",
    radiusMode: "dense",
    radius,
  };
}

export function denseDeviceLimit(narrowViewport: boolean): number {
  return narrowViewport ? DENSE_NARROW_VISUAL_LIMIT : DENSE_DESKTOP_VISUAL_LIMIT;
}
