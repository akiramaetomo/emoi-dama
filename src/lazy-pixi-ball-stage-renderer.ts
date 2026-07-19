import type {
  BallAppearanceProfile,
  BallDensityMode,
  BallRenderSnapshot,
  BallStageRenderer,
  VisualBallSource,
} from "./ball-stage-renderer.js";
import type { PixiBallStageRendererOptions } from "./pixi-ball-stage-renderer.js";
import type { AppSettings } from "./settings.js";
import { isPixiFaultInjectionEnabled } from "./development-diagnostics.js";

export interface LazyPixiBallStageRendererOptions extends Omit<PixiBallStageRendererOptions, "onFault"> {
  onFallback?: (error: unknown) => void;
}

export class LazyPixiBallStageRenderer implements BallStageRenderer {
  readonly kind = "pixi" as const;
  private delegate: BallStageRenderer | null = null;
  private sources: VisualBallSource[] = [];
  private snapshots: BallRenderSnapshot[] = [];
  private radius = 2;
  private draggingId: string | null = null;
  private paused = false;
  private destroyed = false;

  constructor(
    private readonly field: HTMLDivElement,
    private settings: AppSettings,
    private readonly options: LazyPixiBallStageRendererOptions,
  ) {
    void this.load();
  }

  mount(sources: VisualBallSource[], radius: number): void {
    this.sources = sources;
    this.radius = radius;
    this.delegate?.mount(sources, radius);
  }

  updateSources(sources: VisualBallSource[]): boolean {
    this.sources = sources;
    return this.delegate?.updateSources(sources) ?? true;
  }

  update(snapshots: BallRenderSnapshot[]): void {
    this.snapshots = snapshots;
    this.delegate?.update(snapshots);
  }

  updateRadius(radius: number): void {
    this.radius = radius;
    this.delegate?.updateRadius(radius);
  }

  updateAppearanceProfile(profile: BallAppearanceProfile, densityMode: BallDensityMode): void {
    this.options.appearanceProfile = profile;
    this.options.densityMode = densityMode;
    this.delegate?.updateAppearanceProfile(profile, densityMode);
  }

  updateSettings(settings: AppSettings): void {
    this.settings = settings;
    this.delegate?.updateSettings(settings);
  }

  setDragging(id: string | null): void {
    this.draggingId = id;
    this.delegate?.setDragging(id);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.delegate?.setPaused(paused);
  }

  destroy(): void {
    this.destroyed = true;
    this.delegate?.destroy();
    this.delegate = null;
  }

  private async load(): Promise<void> {
    try {
      if (isPixiFaultInjectionEnabled(Boolean(
        (window as Window & { __HAPPY_BALL_TEST_PIXI_FAULT__?: boolean }).__HAPPY_BALL_TEST_PIXI_FAULT__,
      ))) {
        throw new Error("Simulated Pixi initialization fault for development verification.");
      }
      const { PixiBallStageRenderer } = await import("./pixi-ball-stage-renderer.js");
      if (this.destroyed) {
        return;
      }
      const delegate = new PixiBallStageRenderer(this.field, this.settings, {
        densityMode: this.options.densityMode,
        appearanceProfile: this.options.appearanceProfile,
        onFault: (error) => this.handleFallback(error),
      });
      this.delegate = delegate;
      delegate.mount(this.sources, this.radius);
      delegate.update(this.snapshots);
      delegate.setDragging(this.draggingId);
      delegate.setPaused(this.paused);
    } catch (error) {
      this.handleFallback(error);
    }
  }

  private handleFallback(error: unknown): void {
    if (!this.destroyed) {
      this.options.onFallback?.(error);
    }
  }
}
