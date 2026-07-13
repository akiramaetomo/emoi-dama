export interface PausablePhysicsStage {
  pause(): void;
  resume(): void;
  destroy(): void;
}

export class PhysicsRuntimeController<T extends PausablePhysicsStage> {
  private stage: T | null = null;
  private paused = true;

  attach(stage: T): void {
    this.stage?.destroy();
    this.stage = stage;
    this.apply();
  }

  sync(paused: boolean): void {
    if (this.paused === paused) {
      return;
    }
    this.paused = paused;
    this.apply();
  }

  current(): T | null {
    return this.stage;
  }

  destroy(): void {
    this.stage?.destroy();
    this.stage = null;
  }

  private apply(): void {
    if (!this.stage) {
      return;
    }
    if (this.paused) {
      this.stage.pause();
    } else {
      this.stage.resume();
    }
  }
}
