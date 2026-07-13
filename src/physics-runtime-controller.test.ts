import { PhysicsRuntimeController, type PausablePhysicsStage } from "./physics-runtime-controller.js";

class FakeStage implements PausablePhysicsStage {
  pauses = 0;
  resumes = 0;
  destroys = 0;
  pause(): void { this.pauses += 1; }
  resume(): void { this.resumes += 1; }
  destroy(): void { this.destroys += 1; }
}

const runtime = new PhysicsRuntimeController<FakeStage>();
const stage = new FakeStage();
runtime.attach(stage);
runtime.sync(false);
runtime.sync(true);
runtime.sync(false);

assert(stage.pauses === 2, "attach and upper-surface transition should pause without rebuilding");
assert(stage.resumes === 2, "returning to Play should resume the same stage");
assert(stage.destroys === 0, "Primary and Modal state changes must not destroy physics");

runtime.destroy();
assert(stage.destroys === 1, "explicit Base teardown should destroy physics exactly once");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
