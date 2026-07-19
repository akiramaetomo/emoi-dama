import {
  isDomRendererComparisonEnabled,
  isGravityDebugEnabled,
  isHandoffDebugEnabled,
  isPixiFaultInjectionEnabled,
  isUiDebugDiagnosticsEnabled,
} from "./development-diagnostics.js";

assertEqual(isDomRendererComparisonEnabled("?renderer=dom", true), true, "local development should allow DOM comparison");
assertEqual(isDomRendererComparisonEnabled("?renderer=pixi", true), false, "Pixi compatibility query should not select DOM");
assertEqual(isDomRendererComparisonEnabled("?renderer=dom", false), false, "production should ignore DOM comparison");
assertEqual(isPixiFaultInjectionEnabled(true, true), true, "local development should allow Pixi fault injection");
assertEqual(isPixiFaultInjectionEnabled(true, false), false, "production should ignore Pixi fault injection");
assertEqual(isPixiFaultInjectionEnabled(false, true), false, "an absent fault request should not inject a failure");
assertEqual(isUiDebugDiagnosticsEnabled("?uiDebug=1", true), true, "local development should allow UI diagnostics");
assertEqual(isUiDebugDiagnosticsEnabled("?uiDebug=1", false), false, "production should ignore UI diagnostics");
assertEqual(isHandoffDebugEnabled("?handoffDebug=1", true), true, "local development should allow handoff diagnostics");
assertEqual(isHandoffDebugEnabled("?handoffDebug=1", false), false, "production should ignore handoff diagnostics");
assertEqual(isGravityDebugEnabled(true, true), true, "local development should allow gravity diagnostics");
assertEqual(isGravityDebugEnabled(true, false), false, "production should ignore stored gravity diagnostics");

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
