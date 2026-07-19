export function isDomRendererComparisonEnabled(
  search: string,
  developmentBuild = import.meta.env.DEV,
): boolean {
  return developmentBuild && new URLSearchParams(search).get("renderer") === "dom";
}

export function isPixiFaultInjectionEnabled(
  requested: boolean,
  developmentBuild = import.meta.env.DEV,
): boolean {
  return developmentBuild && requested;
}

export function isUiDebugDiagnosticsEnabled(
  search: string,
  developmentBuild = import.meta.env.DEV,
): boolean {
  return developmentBuild && new URLSearchParams(search).get("uiDebug") === "1";
}

export function isHandoffDebugEnabled(
  search: string,
  developmentBuild = import.meta.env.DEV,
): boolean {
  return developmentBuild && new URLSearchParams(search).get("handoffDebug") === "1";
}

export function isGravityDebugEnabled(
  requested: boolean,
  developmentBuild = import.meta.env.DEV,
): boolean {
  return developmentBuild && requested;
}
