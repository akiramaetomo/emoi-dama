import type { LifecycleStatus } from "./models.js";

export type BallLifecycleAction = "archive" | "offer" | "restore";

export function isBallLifecycleAction(value: unknown): value is BallLifecycleAction {
  return value === "archive" || value === "offer" || value === "restore";
}

export function resolveBallLifecycleTransition(
  current: LifecycleStatus,
  action: BallLifecycleAction,
): LifecycleStatus | null {
  if (action === "archive") {
    return current === "active" ? "archived" : null;
  }
  if (action === "offer") {
    return current === "active" || current === "archived" ? "offered" : null;
  }
  return current === "archived" || current === "offered" ? "active" : null;
}
