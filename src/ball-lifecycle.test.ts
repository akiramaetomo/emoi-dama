import { resolveBallLifecycleTransition } from "./ball-lifecycle.js";

assert(resolveBallLifecycleTransition("active", "archive") === "archived", "active should archive");
assert(resolveBallLifecycleTransition("active", "offer") === "offered", "active should offer");
assert(resolveBallLifecycleTransition("archived", "offer") === "offered", "archived should offer");
assert(resolveBallLifecycleTransition("archived", "restore") === "active", "archived should restore");
assert(resolveBallLifecycleTransition("offered", "restore") === "active", "offered should restore");
assert(resolveBallLifecycleTransition("active", "restore") === null, "active should reject restore");
assert(resolveBallLifecycleTransition("archived", "archive") === null, "archived should reject archive");
assert(resolveBallLifecycleTransition("offered", "archive") === null, "offered should reject archive");
assert(resolveBallLifecycleTransition("offered", "offer") === null, "offered should reject duplicate offer");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
