import { Application, Container, Sprite, Texture } from "pixi.js";
import { createBalancedBallLabelLayout } from "./ball-label-layout.js";
import {
  calculateDescentStarRadius,
  calculateStarRingRotation,
  deriveEchoAppearanceVariant,
  DESCENT_STAR_OPACITY,
  ECHO_FIXED_PATTERN_WEIGHT,
  ECHO_ROTATING_PATTERN_WEIGHT,
  ECHO_UNIFORM_WEIGHT,
  resolveEchoTargetAngularVelocity,
  resolveEchoSpreadScale,
  smoothEchoAngularVelocity,
  stableAppearanceHash,
  unwrapRotation,
  type EchoAppearanceVariant,
} from "./ball-appearance.js";
import type {
  BallAppearanceProfile,
  BallDensityMode,
  BallRenderSnapshot,
  BallStageRenderer,
  VisualBallSource,
} from "./ball-stage-renderer.js";
import type { AppSettings } from "./settings.js";
import { DENSE_APPEARANCE_MAX_DIAMETER_PX } from "./play-population.js";

const MAX_RENDER_RESOLUTION = 3;
const DEV5_ECHO_UNIFORM_WEIGHT = 0.3;
const DEV5_ECHO_FIXED_PATTERN_WEIGHT = 0.4;
const DEV5_ECHO_ROTATING_PATTERN_WEIGHT = 0.3;

interface PixiBallVisual {
  root: Container;
  baseScale: number;
  rotatingCore: Sprite | null;
  rotatingEcho: Sprite | null;
  echoRotation: number;
  echoCurrentAngularVelocity: number;
  echoIdleAngularVelocity: number;
  lastEchoUpdateTimeSeconds: number | null;
  overlay: Sprite | null;
  starRing: Sprite | null;
  baseAlpha: number;
  lastPhysicsAngle: number | null;
  unwrappedPhysicsAngle: number;
}

export interface PixiBallStageRendererOptions {
  densityMode: BallDensityMode;
  appearanceProfile: BallAppearanceProfile;
  onFault?: (error: unknown) => void;
}

export class PixiBallStageRenderer implements BallStageRenderer {
  readonly kind = "pixi" as const;
  private readonly app = new Application();
  private readonly visuals = new Map<string, PixiBallVisual>();
  private readonly textureCache = new Map<string, Texture>();
  private readonly renderResolution = Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_RENDER_RESOLUTION);
  private readonly prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private appearanceProfile: BallAppearanceProfile;
  private densityMode: BallDensityMode;
  private sources: VisualBallSource[] = [];
  private radius = 2;
  private destroyed = false;
  private ready = false;
  private paused = false;

  constructor(
    private readonly field: HTMLDivElement,
    private settings: AppSettings,
    private readonly options: PixiBallStageRendererOptions,
  ) {
    this.appearanceProfile = options.appearanceProfile;
    this.densityMode = options.densityMode;
    void this.initialize();
  }

  mount(sources: VisualBallSource[], radius: number): void {
    this.sources = sources;
    this.radius = radius;
    if (this.ready) {
      this.rebuildVisuals();
    }
  }

  updateSources(sources: VisualBallSource[]): boolean {
    const previousById = new Map(this.sources.map((source) => [source.id, source]));
    this.sources = sources;
    if (!this.ready) {
      return true;
    }

    const nextIds = new Set(sources.map((source) => source.id));
    for (const [id, visual] of this.visuals) {
      if (nextIds.has(id)) {
        continue;
      }
      visual.root.removeFromParent();
      visual.root.destroy({ children: true });
      this.visuals.delete(id);
    }

    for (const source of sources) {
      let visual = this.visuals.get(source.id);
      if (!visual) {
        visual = this.createVisual(source);
        this.visuals.set(source.id, visual);
        this.app.stage.addChild(visual.root);
      } else if (previousById.get(source.id)?.radius !== source.radius) {
        visual.baseScale = source.radius / Math.max(this.radius, 1);
        visual.root.scale.set(visual.baseScale);
      }
      if (this.appearanceProfile === "dense-gloss" || !visual.overlay) {
        continue;
      }
      const showLabel = this.settings.ballLabelMode !== "none" && source.label.length > 0;
      const labelKey = showLabel ? `${source.label}:${this.settings.ballLabelMode}` : "none";
      visual.overlay.texture = this.getTexture(
        `overlay:${source.visualKind}:${source.lifecycleStatus}:${source.descentBadgeCount > 0}:${labelKey}:${roundRadius(this.radius)}`,
        () => createFaithfulOverlayCanvas(source, this.radius, showLabel, this.renderResolution),
      );
    }
    return true;
  }

  update(snapshots: BallRenderSnapshot[]): void {
    const animationTimeSeconds = performance.now() / 1000;
    for (const snapshot of snapshots) {
      const visual = this.visuals.get(snapshot.id);
      if (!visual) {
        continue;
      }
      visual.root.position.set(snapshot.x, snapshot.y);
      const renderScale = snapshot.radius / Math.max(this.radius, 1);
      if (Math.abs(renderScale - visual.baseScale) >= 0.0001) {
        visual.baseScale = renderScale;
        visual.root.scale.set(renderScale);
      }
      if (visual.rotatingCore) {
        visual.rotatingCore.rotation = snapshot.rotation;
      }
      if (visual.rotatingEcho) {
        const elapsedSeconds = visual.lastEchoUpdateTimeSeconds === null
          ? 0
          : Math.min(0.1, Math.max(0, animationTimeSeconds - visual.lastEchoUpdateTimeSeconds));
        visual.lastEchoUpdateTimeSeconds = animationTimeSeconds;
        if (!this.prefersReducedMotion) {
          const targetAngularVelocity = resolveEchoTargetAngularVelocity(
            snapshot.angularVelocity,
            visual.echoIdleAngularVelocity,
          );
          visual.echoCurrentAngularVelocity = smoothEchoAngularVelocity(
            visual.echoCurrentAngularVelocity,
            targetAngularVelocity,
            elapsedSeconds,
          );
          visual.echoRotation += visual.echoCurrentAngularVelocity * elapsedSeconds;
        }
        visual.rotatingEcho.rotation = visual.echoRotation;
      }
      if (visual.starRing) {
        if (visual.lastPhysicsAngle === null) {
          visual.lastPhysicsAngle = snapshot.rotation;
          visual.unwrappedPhysicsAngle = snapshot.rotation;
        } else {
          visual.unwrappedPhysicsAngle = unwrapRotation(
            visual.lastPhysicsAngle,
            visual.unwrappedPhysicsAngle,
            snapshot.rotation,
          );
          visual.lastPhysicsAngle = snapshot.rotation;
        }
        visual.starRing.rotation = calculateStarRingRotation(visual.unwrappedPhysicsAngle);
      }
    }
  }

  updateRadius(radius: number): void {
    if (Math.abs(radius - this.radius) < 0.01) {
      return;
    }
    this.radius = radius;
    const nextAppearance = radius * 2 <= DENSE_APPEARANCE_MAX_DIAMETER_PX ? "dense-gloss" : "faithful";
    this.appearanceProfile = nextAppearance;
    this.densityMode = nextAppearance === "dense-gloss" ? "dense" : "normal";
    this.syncFieldRenderingState();
    if (this.ready) {
      this.rebuildVisuals();
    }
  }

  updateAppearanceProfile(profile: BallAppearanceProfile, densityMode: BallDensityMode): void {
    if (this.appearanceProfile === profile && this.densityMode === densityMode) {
      return;
    }
    this.appearanceProfile = profile;
    this.densityMode = densityMode;
    this.syncFieldRenderingState();
    if (this.ready) {
      this.rebuildVisuals();
    }
  }

  updateSettings(settings: AppSettings): void {
    const visualChanged = settings.emotionEchoStrength !== this.settings.emotionEchoStrength;
    this.settings = settings;
    if (visualChanged && this.ready) {
      this.rebuildVisuals();
    }
  }

  setDragging(id: string | null): void {
    for (const [visualId, visual] of this.visuals) {
      visual.root.scale.set(visual.baseScale);
      visual.root.alpha = visual.baseAlpha;
      visual.root.zIndex = visualId === id ? 10 : 0;
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!this.ready) {
      return;
    }
    if (paused) {
      this.app.stop();
    } else {
      this.app.start();
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.clearVisuals();
    this.destroyTextures();
    if (this.ready) {
      this.app.destroy(true, { children: true });
    }
  }

  private async initialize(): Promise<void> {
    try {
      await this.app.init({
        resizeTo: this.field,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: this.renderResolution,
        preference: "webgl",
        powerPreference: "high-performance",
      });
      if (this.destroyed) {
        this.app.destroy(true, { children: true });
        return;
      }
      this.ready = true;
      this.app.stage.sortableChildren = true;
      this.app.canvas.classList.add("pixi-ball-canvas");
      this.app.canvas.setAttribute("aria-hidden", "true");
      this.field.replaceChildren(this.app.canvas);
      this.field.dataset.ballRenderer = "pixi";
      this.field.dataset.pixiResolution = this.renderResolution.toFixed(2);
      this.syncFieldRenderingState();
      this.rebuildVisuals();
      this.setPaused(this.paused);
    } catch (error) {
      this.options.onFault?.(error);
    }
  }

  private rebuildVisuals(): void {
    this.clearVisuals();
    this.destroyTextures();
    for (const source of this.sources) {
      const visual = this.createVisual(source);
      this.visuals.set(source.id, visual);
      this.app.stage.addChild(visual.root);
    }
  }

  private createVisual(source: VisualBallSource): PixiBallVisual {
    return this.appearanceProfile === "dense-gloss"
      ? this.createDenseVisual(source)
      : this.createFaithfulVisual(source);
  }

  private syncFieldRenderingState(): void {
    this.field.dataset.ballDensity = this.densityMode;
    this.field.dataset.ballAppearance = this.appearanceProfile;
    this.field.dataset.ballDiameter = (this.radius * 2).toFixed(2);
  }

  private createDenseVisual(source: VisualBallSource): PixiBallVisual {
    const root = new Container();
    const baseScale = source.radius / Math.max(this.radius, 1);
    root.scale.set(baseScale);
    const variant = stableAppearanceHash(source.id) % 3;
    const texture = this.getTexture(
      denseTextureKey(source, this.radius, variant),
      () => createDenseGlossCanvas(source, this.radius, variant, this.renderResolution),
    );
    root.addChild(createCenteredSprite(texture, this.radius * 2, this.radius * 2));
    const baseAlpha = 1;
    root.alpha = baseAlpha;
    return {
      root,
      baseScale,
      rotatingCore: null,
      rotatingEcho: null,
      echoRotation: 0,
      echoCurrentAngularVelocity: 0,
      echoIdleAngularVelocity: 0,
      lastEchoUpdateTimeSeconds: null,
      overlay: null,
      starRing: null,
      baseAlpha,
      lastPhysicsAngle: null,
      unwrappedPhysicsAngle: 0,
    };
  }

  private createFaithfulVisual(source: VisualBallSource): PixiBallVisual {
    const root = new Container();
    const baseScale = source.radius / Math.max(this.radius, 1);
    root.scale.set(baseScale);
    let echoRoot: Container | null = null;
    let rotatingEcho: Sprite | null = null;
    let echoRotation = 0;
    let echoIdleAngularVelocity = 0;

    if (source.echo && source.lifecycleStatus !== "archived") {
      echoRoot = new Container();
      const appearance = deriveEchoAppearanceVariant(source.ballId, source.fragmentIndex);
      const echoSize = faithfulEchoSize(this.radius, this.settings.emotionEchoStrength);
      const baseEchoTexture = this.getTexture(
        baseEchoTextureKey(source, this.radius, this.settings.emotionEchoStrength, appearance),
        () => createEchoBaseCanvas(source, this.radius, this.settings.emotionEchoStrength, appearance, this.renderResolution),
      );
      const baseEcho = createCenteredSprite(baseEchoTexture, echoSize, echoSize);
      baseEcho.rotation = appearance.baseOrientationStep * Math.PI / 4;
      if (appearance.baseMirrored) {
        baseEcho.scale.x *= -1;
      }
      echoRoot.addChild(baseEcho);

      const accentEchoTexture = this.getTexture(
        accentEchoTextureKey(source, this.radius, this.settings.emotionEchoStrength, appearance),
        () => createEchoAccentCanvas(source, this.radius, this.settings.emotionEchoStrength, appearance, this.renderResolution),
      );
      rotatingEcho = createCenteredSprite(accentEchoTexture, echoSize, echoSize);
      echoRotation = appearance.accentOrientationStep * Math.PI / 4 + appearance.accentPhase;
      echoIdleAngularVelocity = appearance.accentAngularVelocity;
      rotatingEcho.rotation = echoRotation;
      if (appearance.accentMirrored) {
        rotatingEcho.scale.x *= -1;
      }
      echoRoot.addChild(rotatingEcho);
      root.addChild(echoRoot);
    }

    if (source.lifecycleStatus === "archived") {
      const auraSize = faithfulArchivedAuraSize(this.radius);
      const auraTexture = this.getTexture(
        `archived-aura:${source.hue}:${source.visualKind}:${roundRadius(this.radius)}`,
        () => createArchivedAuraCanvas(source, this.radius, this.renderResolution),
      );
      root.addChild(createCenteredSprite(auraTexture, auraSize, auraSize));
    }

    const surfaceSize = faithfulSurfaceSize(this.radius);
    const baseTexture = this.getTexture(
      `base:${source.hue}:${source.saturation}:${source.lightness}:${source.visualKind}:${source.lifecycleStatus}:${roundRadius(this.radius)}`,
      () => createFaithfulBaseCanvas(source, this.radius, this.renderResolution),
    );
    root.addChild(createCenteredSprite(baseTexture, surfaceSize, surfaceSize));

    const coreTexture = this.getTexture(
      `core:${source.hue}:${source.saturation}:${source.lightness}:${source.visualKind}:${source.lifecycleStatus}:${roundRadius(this.radius)}`,
      () => createFaithfulCoreCanvas(source, this.radius, this.renderResolution),
    );
    const core = createCenteredSprite(coreTexture, surfaceSize, surfaceSize);
    root.addChild(core);

    const showLabel = this.settings.ballLabelMode !== "none" && source.label.length > 0;
    const overlaySize = faithfulOverlaySize(this.radius);
    const labelKey = showLabel ? `${source.label}:${this.settings.ballLabelMode}` : "none";
    const overlayTexture = this.getTexture(
      `overlay:${source.visualKind}:${source.lifecycleStatus}:${source.descentBadgeCount > 0}:${labelKey}:${roundRadius(this.radius)}`,
      () => createFaithfulOverlayCanvas(source, this.radius, showLabel, this.renderResolution),
    );
    const overlay = createCenteredSprite(overlayTexture, overlaySize, overlaySize);
    root.addChild(overlay);

    let starRing: Sprite | null = null;
    if (source.descentBadgeCount > 0) {
      const starSize = faithfulStarSize(this.radius);
      const starTexture = this.getTexture(
        `stars:${Math.min(20, Math.floor(source.descentBadgeCount))}:${source.isKamiBall}:${roundRadius(this.radius)}`,
        () => createStarRingCanvas(this.radius, source.descentBadgeCount, source.isKamiBall, this.renderResolution),
      );
      starRing = createCenteredSprite(starTexture, starSize, starSize);
      root.addChild(starRing);
    }

    const baseAlpha = 1;
    root.alpha = baseAlpha;
    return {
      root,
      baseScale,
      rotatingCore: core,
      rotatingEcho,
      echoRotation,
      echoCurrentAngularVelocity: echoIdleAngularVelocity,
      echoIdleAngularVelocity,
      lastEchoUpdateTimeSeconds: null,
      overlay,
      starRing,
      baseAlpha,
      lastPhysicsAngle: null,
      unwrappedPhysicsAngle: 0,
    };
  }

  private getTexture(key: string, createCanvas: () => HTMLCanvasElement): Texture {
    const existing = this.textureCache.get(key);
    if (existing) {
      return existing;
    }
    const texture = Texture.from(createCanvas());
    texture.source.scaleMode = "linear";
    this.textureCache.set(key, texture);
    return texture;
  }

  private clearVisuals(): void {
    this.app.stage.removeChildren();
    for (const visual of this.visuals.values()) {
      visual.root.destroy({ children: true });
    }
    this.visuals.clear();
  }

  private destroyTextures(): void {
    for (const texture of this.textureCache.values()) {
      texture.destroy(true);
    }
    this.textureCache.clear();
  }
}

function createCenteredSprite(texture: Texture, width: number, height: number): Sprite {
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.width = width;
  sprite.height = height;
  return sprite;
}

function denseTextureKey(source: VisualBallSource, radius: number, variant: number): string {
  return `dense:${source.hue}:${source.saturation}:${source.lightness}:${source.lifecycleStatus}:${roundRadius(radius)}:${variant}`;
}

function baseEchoTextureKey(
  source: VisualBallSource,
  radius: number,
  strength: AppSettings["emotionEchoStrength"],
  appearance: EchoAppearanceVariant,
): string {
  const echo = source.echo;
  return `echo-base:${source.visualKind}:${echo?.hue}:${echo?.saturation}:${echo?.lightness}:${roundRadius(radius)}:${strength}:${appearance.basePatternVariant}:${appearance.intensityVariant}`;
}

function accentEchoTextureKey(
  source: VisualBallSource,
  radius: number,
  strength: AppSettings["emotionEchoStrength"],
  appearance: EchoAppearanceVariant,
): string {
  const echo = source.echo;
  return `echo-accent:${source.visualKind}:${echo?.hue}:${echo?.saturation}:${echo?.lightness}:${roundRadius(radius)}:${strength}:${appearance.accentPatternVariant}:${appearance.accentLightnessOffset}:${appearance.accentSaturationOffset}`;
}

function createDenseGlossCanvas(
  source: VisualBallSource,
  radius: number,
  variant: number,
  renderResolution: number,
): HTMLCanvasElement {
  const logicalSize = denseCanvasSize(radius);
  const scale = Math.max(renderResolution, logicalSize <= 12 ? 4 : 3);
  const { canvas, context } = createScaledCanvas(logicalSize, scale);
  const center = logicalSize / 2;
  const edge = Math.max(1, center - 0.55);
  const lightnessShift = [-5, 0, 5][variant] ?? 0;
  const lightness = clamp(source.lightness + lightnessShift, 10, 88);

  context.beginPath();
  context.arc(center, center, edge, 0, Math.PI * 2);
  context.clip();
  const base = context.createRadialGradient(center * 0.76, center * 0.68, center * 0.05, center, center, center * 1.04);
  base.addColorStop(0, hsl(source.hue, source.saturation, lightness + 10, 1));
  base.addColorStop(0.5, hsl(source.hue, source.saturation, lightness, 1));
  base.addColorStop(0.84, hsl(source.hue, source.saturation - 5, lightness - 11, 1));
  base.addColorStop(1, hsl(source.hue, source.saturation - 9, lightness - 20, 1));
  context.fillStyle = base;
  context.fillRect(0, 0, logicalSize, logicalSize);

  if (logicalSize >= 6) {
    const shade = context.createRadialGradient(center * 1.34, center * 1.42, 0, center * 1.08, center * 1.14, center * 0.9);
    shade.addColorStop(0, "rgba(14, 24, 20, 0.28)");
    shade.addColorStop(1, "rgba(14, 24, 20, 0)");
    context.fillStyle = shade;
    context.fillRect(0, 0, logicalSize, logicalSize);
  }
  if (logicalSize >= 8) {
    const highlight = context.createRadialGradient(center * 0.58, center * 0.52, 0, center * 0.58, center * 0.52, center * 0.28);
    highlight.addColorStop(0, "rgba(255, 255, 255, 0.72)");
    highlight.addColorStop(0.28, "rgba(255, 255, 255, 0.24)");
    highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = highlight;
    context.fillRect(0, 0, logicalSize, logicalSize);
  }
  context.beginPath();
  context.arc(center, center, edge, 0, Math.PI * 2);
  context.strokeStyle = "rgba(13, 22, 19, 0.32)";
  context.lineWidth = Math.max(0.45, logicalSize * 0.035);
  context.stroke();
  if (source.lifecycleStatus === "archived") {
    context.globalCompositeOperation = "source-atop";
    context.fillStyle = "rgba(28,34,32,0.68)";
    context.fillRect(0, 0, logicalSize, logicalSize);
  }
  context.restore();
  return canvas;
}

function createArchivedAuraCanvas(
  source: VisualBallSource,
  radius: number,
  scale: number,
): HTMLCanvasElement {
  const size = faithfulArchivedAuraSize(radius);
  const { canvas, context } = createScaledCanvas(size, Math.max(2, scale));
  const center = size / 2;
  context.beginPath();
  context.arc(center, center, radius * 1.18, 0, Math.PI * 2);
  context.clip();
  context.globalAlpha = 0.88;
  context.filter = `blur(${Math.min(9, Math.max(2, radius * 0.22))}px)`;
  const trace = context.createRadialGradient(
    center - radius * 0.08,
    center + radius * 0.04,
    0,
    center - radius * 0.08,
    center + radius * 0.04,
    radius * 1.18,
  );
  trace.addColorStop(0, hsl(source.hue, 18, 42, 0.42));
  trace.addColorStop(0.38, hsl(source.hue, 18, 42, 0));
  context.fillStyle = trace;
  context.fillRect(0, 0, size, size);
  const pale = context.createRadialGradient(
    center - radius * 0.34,
    center - radius * 0.4,
    0,
    center - radius * 0.34,
    center - radius * 0.4,
    radius,
  );
  pale.addColorStop(0, "rgba(255,246,218,0.16)");
  pale.addColorStop(0.3, "rgba(255,246,218,0)");
  context.fillStyle = pale;
  context.fillRect(0, 0, size, size);
  if (typeof context.createConicGradient === "function") {
    const smoke = context.createConicGradient(32 * Math.PI / 180, center, center);
    smoke.addColorStop(0, "rgba(93,112,105,0)");
    smoke.addColorStop(0.2, hsl(source.hue, 24, 46, 0.34));
    smoke.addColorStop(0.33, "rgba(93,112,105,0)");
    smoke.addColorStop(0.52, "rgba(93,112,105,0.28)");
    smoke.addColorStop(0.72, "rgba(93,112,105,0)");
    smoke.addColorStop(1, "rgba(93,112,105,0)");
    context.fillStyle = smoke;
    context.fillRect(center - radius * 1.18, center - radius * 1.18, radius * 2.36, radius * 2.36);
  }
  context.restore();
  return canvas;
}

function createFaithfulBaseCanvas(source: VisualBallSource, radius: number, scale: number): HTMLCanvasElement {
  const size = faithfulSurfaceSize(radius);
  const { canvas, context } = createScaledCanvas(size, Math.max(2, scale));
  const center = size / 2;
  const ballRadius = radius;
  context.beginPath();
  context.arc(center, center, ballRadius, 0, Math.PI * 2);
  context.clip();

  if (source.lifecycleStatus === "archived") {
    context.globalAlpha = 0.62;
    const categoryTrace = context.createRadialGradient(
      center - ballRadius * 0.16,
      center - ballRadius * 0.24,
      0,
      center - ballRadius * 0.16,
      center - ballRadius * 0.24,
      ballRadius,
    );
    categoryTrace.addColorStop(0, hsl(source.hue, 20, 48, 0.32));
    categoryTrace.addColorStop(0.34, hsl(source.hue, 20, 48, 0));
    context.fillStyle = categoryTrace;
    context.fillRect(0, 0, size, size);
    const charcoal = context.createRadialGradient(
      center + ballRadius * 0.2,
      center + ballRadius * 0.24,
      0,
      center + ballRadius * 0.2,
      center + ballRadius * 0.24,
      ballRadius,
    );
    charcoal.addColorStop(0, "rgba(31,39,37,0.5)");
    charcoal.addColorStop(0.56, "rgba(31,39,37,0)");
    context.fillStyle = charcoal;
    context.fillRect(0, 0, size, size);
    context.globalAlpha = 1;
  } else if (source.visualKind === "ring") {
    const innerRatio = ringInnerRadius(ballRadius) / ballRadius;
    const glass = context.createRadialGradient(center, center, ballRadius * 0.42, center, center, ballRadius);
    glass.addColorStop(0, hsl(source.hue, source.saturation - 18, source.lightness + 18, 0));
    glass.addColorStop(Math.max(0, innerRatio - 0.025), hsl(source.hue, source.saturation - 12, source.lightness + 14, 0));
    glass.addColorStop(innerRatio, hsl(source.hue, source.saturation + 4, source.lightness + 6, 0.44));
    glass.addColorStop(Math.min(0.97, innerRatio + 0.055), hsl(source.hue, source.saturation + 6, source.lightness + 8, 0.96));
    glass.addColorStop(1, hsl(source.hue, source.saturation + 3, source.lightness, 0.98));
    context.fillStyle = glass;
  } else {
    context.fillStyle = hsl(source.hue, source.saturation, source.lightness, 1);
  }
  if (source.lifecycleStatus !== "archived") {
    context.fillRect(0, 0, size, size);
  }

  if (source.lifecycleStatus !== "archived") {
    const insetLight = context.createRadialGradient(center * 0.72, center * 0.7, 0, center * 0.8, center * 0.78, ballRadius * 0.9);
    insetLight.addColorStop(0, "rgba(255,255,255,0.18)");
    insetLight.addColorStop(0.52, "rgba(255,255,255,0)");
    insetLight.addColorStop(1, "rgba(24,35,31,0.2)");
    context.fillStyle = insetLight;
    context.fillRect(0, 0, size, size);
  }
  if (source.visualKind === "ring") {
    clearRingCenter(context, center, radius);
  }
  context.restore();
  return canvas;
}

function createFaithfulCoreCanvas(source: VisualBallSource, radius: number, scale: number): HTMLCanvasElement {
  const size = faithfulSurfaceSize(radius);
  const { canvas, context } = createScaledCanvas(size, Math.max(2, scale));
  const center = size / 2;
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.clip();

  if (source.lifecycleStatus === "archived") {
    context.globalAlpha = 0.62;
    if (typeof context.createConicGradient === "function") {
      const archivedCore = context.createConicGradient(18 * Math.PI / 180, center, center);
      archivedCore.addColorStop(0, "rgba(255,255,255,0)");
      archivedCore.addColorStop(0.2, hsl(source.hue, 22, 52, 0.38));
      archivedCore.addColorStop(0.42, "rgba(255,255,255,0)");
      archivedCore.addColorStop(0.58, "rgba(255,246,218,0.12)");
      archivedCore.addColorStop(0.78, "rgba(255,255,255,0)");
      archivedCore.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = archivedCore;
    } else {
      context.fillStyle = hsl(source.hue, 22, 52, 0.24);
    }
    context.fillRect(0, 0, size, size);
    context.globalAlpha = 1;
  } else if (typeof context.createConicGradient === "function") {
    const conic = context.createConicGradient(18 * Math.PI / 180, center, center);
    if (source.visualKind === "ring") {
      conic.addColorStop(0, hsl(source.hue, source.saturation + 8, source.lightness + 22, 0.9));
      conic.addColorStop(0.14, "rgba(255,255,255,0)");
      conic.addColorStop(0.3, hsl(source.hue, source.saturation, source.lightness - 10, 0.68));
      conic.addColorStop(0.46, "rgba(255,255,255,0)");
      conic.addColorStop(0.61, "rgba(255,255,255,0.56)");
      conic.addColorStop(0.76, "rgba(255,255,255,0)");
      conic.addColorStop(1, hsl(source.hue, source.saturation + 6, source.lightness + 8, 0.78));
    } else {
      conic.addColorStop(0, hsl(source.hue, source.saturation, source.lightness, 1));
      conic.addColorStop(0.33, hsl(source.hue + 8, source.saturation + 3, source.lightness + 6, 1));
      conic.addColorStop(0.67, hsl(source.hue - 6, source.saturation - 10, source.lightness - 5, 1));
      conic.addColorStop(1, hsl(source.hue, source.saturation, source.lightness, 1));
    }
    context.fillStyle = conic;
  } else {
    context.fillStyle = hsl(source.hue, source.saturation, source.lightness, source.visualKind === "ring" ? 0.78 : 1);
  }
  if (source.lifecycleStatus !== "archived") {
    context.fillRect(0, 0, size, size);
  }

  if (source.lifecycleStatus !== "archived") {
    const bright = context.createRadialGradient(center - radius * 0.24, center - radius * 0.18, 0, center - radius * 0.24, center - radius * 0.18, radius * 0.45);
    bright.addColorStop(0, hsl(source.hue, source.saturation + 10, source.lightness + 10, 0.86));
    bright.addColorStop(1, hsl(source.hue, source.saturation + 10, source.lightness + 10, 0));
    context.fillStyle = bright;
    context.fillRect(0, 0, size, size);
    const dark = context.createRadialGradient(center + radius * 0.48, center + radius * 0.32, 0, center + radius * 0.48, center + radius * 0.32, radius * 0.55);
    dark.addColorStop(0, hsl(source.hue, source.saturation - 12, source.lightness - 14, 0.7));
    dark.addColorStop(1, hsl(source.hue, source.saturation - 12, source.lightness - 14, 0));
    context.fillStyle = dark;
    context.fillRect(0, 0, size, size);
  }

  if (source.visualKind === "ring") {
    clearRingCenter(context, center, radius);
  }
  context.restore();
  return canvas;
}

function createFaithfulOverlayCanvas(
  source: VisualBallSource,
  radius: number,
  showLabel: boolean,
  scale: number,
): HTMLCanvasElement {
  const size = faithfulOverlaySize(radius);
  const { canvas, context } = createScaledCanvas(size, Math.max(2, scale));
  const center = size / 2;
  context.save();
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.clip();
  context.globalAlpha = source.lifecycleStatus === "archived" ? 0.22 : 1;
  drawSphereHighlight(context, center, radius);
  context.globalAlpha = 1;

  const shade = context.createRadialGradient(center + radius * 0.42, center + radius * 0.48, 0, center + radius * 0.3, center + radius * 0.32, radius);
  const shadeAlpha = source.lifecycleStatus === "archived" ? 0.36 : source.visualKind === "ring" ? 0.18 : 0.32;
  shade.addColorStop(0, `rgba(18,31,27,${shadeAlpha})`);
  shade.addColorStop(1, "rgba(18,31,27,0)");
  context.fillStyle = shade;
  context.fillRect(0, 0, size, size);

  if (source.visualKind === "ring") {
    clearRingCenter(context, center, radius);
  }
  context.restore();
  if (showLabel) {
    context.globalCompositeOperation = "source-over";
    context.fillStyle = source.lifecycleStatus === "archived" ? "rgba(170,166,159,0.72)" : "rgba(255,255,255,0.8)";
    context.textAlign = "center";
    context.textBaseline = "middle";
    drawBalancedBallLabel(context, source.label, center, radius);
  }
  context.restore();
  return canvas;
}

function drawSphereHighlight(context: CanvasRenderingContext2D, center: number, radius: number): void {
  context.save();
  context.translate(center - radius * 0.28, center - radius * 0.34);
  context.rotate(-0.28);
  context.scale(1.45, 1);
  const broad = context.createRadialGradient(0, 0, 0, 0, 0, radius * 0.96);
  broad.addColorStop(0, "rgba(255,255,255,0.22)");
  broad.addColorStop(0.38, "rgba(255,255,255,0.15)");
  broad.addColorStop(0.72, "rgba(255,255,255,0.07)");
  broad.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = broad;
  context.fillRect(-radius, -radius, radius * 2, radius * 2);
  context.restore();

  const glint = context.createRadialGradient(
    center - radius * 0.46,
    center - radius * 0.5,
    0,
    center - radius * 0.46,
    center - radius * 0.5,
    radius * 0.27,
  );
  glint.addColorStop(0, "rgba(255,255,255,0.18)");
  glint.addColorStop(0.5, "rgba(255,255,255,0.08)");
  glint.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glint;
  context.fillRect(center - radius, center - radius, radius * 2, radius * 2);
}

function createEchoBaseCanvas(
  source: VisualBallSource,
  radius: number,
  strength: AppSettings["emotionEchoStrength"],
  appearance: EchoAppearanceVariant,
  scale: number,
): HTMLCanvasElement {
  const size = faithfulEchoSize(radius, strength);
  const { canvas, context } = createScaledCanvas(size, Math.max(2, scale));
  const center = size / 2;
  const echo = source.echo;
  if (!echo) {
    context.restore();
    return canvas;
  }
  const lightness = echo.lightness + appearance.intensityVariant * 100;

  const outerRadius = size * 0.49;
  const ballEdgeStop = clamp(radius / outerRadius, 0.2, 0.72);
  const diffusionShoulderStop = Math.min(0.76, ballEdgeStop + 0.16);
  const uniform = context.createRadialGradient(center, center, 0, center, center, outerRadius);
  const uniformScale = ECHO_UNIFORM_WEIGHT / DEV5_ECHO_UNIFORM_WEIGHT;
  uniform.addColorStop(0, hsl(echo.hue, echo.saturation + 6, lightness + 8, 0.22 * uniformScale));
  uniform.addColorStop(ballEdgeStop * 0.72, hsl(echo.hue, echo.saturation + 5, lightness + 7, 0.21 * uniformScale));
  uniform.addColorStop(ballEdgeStop, hsl(echo.hue, echo.saturation + 4, lightness + 6, 0.22 * uniformScale));
  uniform.addColorStop(diffusionShoulderStop, hsl(echo.hue, echo.saturation + 3, lightness + 4, 0.26 * uniformScale));
  uniform.addColorStop(Math.max(diffusionShoulderStop + 0.12, 0.72), hsl(echo.hue, echo.saturation + 1, lightness + 2, 0.17 * uniformScale));
  uniform.addColorStop(0.88, hsl(echo.hue, echo.saturation, lightness, 0.055 * uniformScale));
  uniform.addColorStop(0.96, hsl(echo.hue, echo.saturation, lightness, 0.008 * uniformScale));
  uniform.addColorStop(1, hsl(echo.hue, echo.saturation, lightness, 0));
  context.fillStyle = uniform;
  context.fillRect(0, 0, size, size);

  const patternLayer = createScaledCanvas(size, Math.max(2, scale));
  drawEchoPattern(patternLayer.context, appearance.basePatternVariant, center, radius, size, echo.hue, echo.saturation, lightness, 0.72 * ECHO_FIXED_PATTERN_WEIGHT / DEV5_ECHO_FIXED_PATTERN_WEIGHT);
  maskEchoPattern(patternLayer.context, center, radius, size);
  patternLayer.context.restore();
  context.drawImage(patternLayer.canvas, 0, 0, size, size);
  punchRingEchoCenter(context, source, center, radius);
  context.restore();
  return canvas;
}

function createEchoAccentCanvas(
  source: VisualBallSource,
  radius: number,
  strength: AppSettings["emotionEchoStrength"],
  appearance: EchoAppearanceVariant,
  scale: number,
): HTMLCanvasElement {
  const size = faithfulEchoSize(radius, strength);
  const { canvas, context } = createScaledCanvas(size, Math.max(2, scale));
  const center = size / 2;
  const echo = source.echo;
  if (!echo) {
    context.restore();
    return canvas;
  }
  const lightness = echo.lightness + appearance.intensityVariant * 100 + appearance.accentLightnessOffset * 100;
  const saturation = echo.saturation + appearance.accentSaturationOffset;
  drawEchoPattern(context, appearance.accentPatternVariant, center, radius, size, echo.hue, saturation, lightness, 0.68 * ECHO_ROTATING_PATTERN_WEIGHT / DEV5_ECHO_ROTATING_PATTERN_WEIGHT);
  maskEchoPattern(context, center, radius, size);
  punchRingEchoCenter(context, source, center, radius);
  context.restore();
  return canvas;
}

function maskEchoPattern(
  context: CanvasRenderingContext2D,
  center: number,
  radius: number,
  size: number,
): void {
  const outerRadius = size * 0.5;
  const ballEdgeStop = clamp(radius / outerRadius, 0.2, 0.72);
  const shoulderStop = Math.min(0.75, ballEdgeStop + 0.17);
  const patternMask = context.createRadialGradient(center, center, 0, center, center, outerRadius);
  patternMask.addColorStop(0, "rgba(255,255,255,0.26)");
  patternMask.addColorStop(ballEdgeStop * 0.72, "rgba(255,255,255,0.32)");
  patternMask.addColorStop(ballEdgeStop, "rgba(255,255,255,0.5)");
  patternMask.addColorStop(shoulderStop, "rgba(255,255,255,0.72)");
  patternMask.addColorStop(Math.max(shoulderStop + 0.13, 0.76), "rgba(255,255,255,0.46)");
  patternMask.addColorStop(0.9, "rgba(255,255,255,0.09)");
  patternMask.addColorStop(0.97, "rgba(255,255,255,0.012)");
  patternMask.addColorStop(1, "rgba(255,255,255,0)");
  context.globalCompositeOperation = "destination-in";
  context.fillStyle = patternMask;
  context.fillRect(0, 0, size, size);
  context.globalCompositeOperation = "source-over";
}

function punchRingEchoCenter(
  context: CanvasRenderingContext2D,
  source: VisualBallSource,
  center: number,
  radius: number,
): void {
  if (source.visualKind !== "ring") {
    return;
  }
  context.globalCompositeOperation = "destination-out";
  context.beginPath();
  context.arc(center, center, ringInnerRadius(radius), 0, Math.PI * 2);
  context.fillStyle = "#000";
  context.fill();
  context.globalCompositeOperation = "source-over";
}

function drawEchoPattern(
  context: CanvasRenderingContext2D,
  variant: number,
  center: number,
  radius: number,
  size: number,
  hue: number,
  saturation: number,
  lightness: number,
  alpha: number,
): void {
  if (variant === 0) {
    drawRadialGlow(context, center * 0.72, center * 0.68, radius * 0.08, radius * 1.35, hue, saturation + 10, lightness + 10, alpha);
    drawRadialGlow(context, center * 1.26, center * 1.12, radius * 0.04, radius * 1.05, hue, saturation, lightness - 8, alpha * 0.7);
    return;
  }
  if (variant === 1) {
    drawRadialGlow(context, center * 0.64, center * 1.02, 0, radius * 1.05, hue, saturation + 8, lightness + 8, alpha);
    drawRadialGlow(context, center * 1.34, center * 0.88, 0, radius * 0.9, hue, saturation + 4, lightness + 4, alpha * 0.82);
    return;
  }
  if (variant === 2 && typeof context.createConicGradient === "function") {
    const brokenRing = context.createConicGradient(0, center, center);
    brokenRing.addColorStop(0, hsl(hue, saturation + 8, lightness + 8, 0));
    brokenRing.addColorStop(0.12, hsl(hue, saturation + 8, lightness + 8, alpha));
    brokenRing.addColorStop(0.3, hsl(hue, saturation + 4, lightness + 4, alpha * 0.35));
    brokenRing.addColorStop(0.48, hsl(hue, saturation, lightness, 0));
    brokenRing.addColorStop(0.72, hsl(hue, saturation + 6, lightness + 6, alpha * 0.8));
    brokenRing.addColorStop(0.9, hsl(hue, saturation + 2, lightness + 2, alpha * 0.22));
    brokenRing.addColorStop(1, hsl(hue, saturation + 8, lightness + 8, 0));
    context.fillStyle = brokenRing;
    context.fillRect(0, 0, size, size);
    drawRadialGlow(context, center * 1.18, center * 0.78, radius * 0.2, radius * 0.95, hue, saturation + 5, lightness + 5, alpha * 0.58);
    return;
  }
  if (variant === 2) {
    drawRadialGlow(context, center * 0.72, center * 0.82, 0, radius * 0.86, hue, saturation + 8, lightness + 8, alpha);
    drawRadialGlow(context, center * 1.28, center * 1.18, 0, radius * 0.72, hue, saturation + 2, lightness + 2, alpha * 0.62);
    return;
  }
  if (variant === 4) {
    drawRadialGlow(context, center * 0.62, center * 0.72, 0, radius * 0.82, hue, saturation + 8, lightness + 10, alpha);
    drawRadialGlow(context, center * 1.38, center * 0.82, 0, radius * 0.76, hue, saturation + 4, lightness + 5, alpha * 0.76);
    drawRadialGlow(context, center * 0.94, center * 1.34, 0, radius * 0.7, hue, saturation, lightness - 3, alpha * 0.58);
    return;
  }
  if (variant === 5) {
    context.save();
    context.translate(center * 1.1, center * 0.9);
    context.scale(0.7, 1.45);
    const crescent = context.createRadialGradient(0, 0, radius * 0.12, 0, 0, radius * 1.12);
    crescent.addColorStop(0, hsl(hue, saturation + 10, lightness + 10, alpha));
    crescent.addColorStop(0.42, hsl(hue, saturation + 6, lightness + 6, alpha * 0.54));
    crescent.addColorStop(1, hsl(hue, saturation, lightness, 0));
    context.fillStyle = crescent;
    context.fillRect(-radius * 1.3, -radius * 1.3, radius * 2.6, radius * 2.6);
    context.restore();
    return;
  }
  if (variant === 6) {
    drawRadialGlow(context, center * 0.72, center * 1.18, radius * 0.06, radius * 1.12, hue, saturation + 7, lightness + 8, alpha);
    drawRadialGlow(context, center * 1.34, center * 0.68, 0, radius * 0.66, hue, saturation + 2, lightness + 2, alpha * 0.7);
    return;
  }
  if (variant === 7) {
    context.save();
    context.translate(center * 0.82, center * 1.08);
    context.rotate(-0.28);
    context.scale(1.62, 0.54);
    const wisp = context.createRadialGradient(0, 0, 0, 0, 0, radius * 1.18);
    wisp.addColorStop(0, hsl(hue, saturation + 8, lightness + 9, alpha));
    wisp.addColorStop(0.36, hsl(hue, saturation + 5, lightness + 5, alpha * 0.62));
    wisp.addColorStop(1, hsl(hue, saturation, lightness, 0));
    context.fillStyle = wisp;
    context.fillRect(-radius * 1.35, -radius * 1.35, radius * 2.7, radius * 2.7);
    context.restore();
    return;
  }
  context.save();
  context.translate(center * 0.86, center * 0.96);
  context.scale(1.5, 0.68);
  const tail = context.createRadialGradient(0, 0, 0, 0, 0, radius * 1.2);
  tail.addColorStop(0, hsl(hue, saturation + 8, lightness + 8, alpha));
  tail.addColorStop(0.5, hsl(hue, saturation + 4, lightness + 4, alpha * 0.42));
  tail.addColorStop(1, hsl(hue, saturation, lightness, 0));
  context.fillStyle = tail;
  context.fillRect(-radius * 1.3, -radius * 1.3, radius * 2.6, radius * 2.6);
  context.restore();
}

function drawRadialGlow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  hue: number,
  saturation: number,
  lightness: number,
  alpha: number,
): void {
  const glow = context.createRadialGradient(x, y, innerRadius, x, y, outerRadius);
  glow.addColorStop(0, hsl(hue, saturation, lightness, alpha));
  glow.addColorStop(0.48, hsl(hue, saturation, lightness, alpha * 0.48));
  glow.addColorStop(1, hsl(hue, saturation, lightness, 0));
  context.fillStyle = glow;
  context.fillRect(x - outerRadius, y - outerRadius, outerRadius * 2, outerRadius * 2);
}

function createStarRingCanvas(radius: number, count: number, kami: boolean, scale: number): HTMLCanvasElement {
  const size = faithfulStarSize(radius);
  const { canvas, context } = createScaledCanvas(size, Math.max(2, scale));
  const center = size / 2;
  const safeCount = Math.max(0, Math.min(20, Math.floor(count)));
  const starRadius = calculateDescentStarRadius(radius);
  context.globalAlpha = DESCENT_STAR_OPACITY;
  context.shadowColor = kami ? "rgba(80,177,150,0.42)" : "rgba(189,132,48,0.38)";
  context.shadowBlur = starRadius * 0.9;
  context.shadowOffsetY = starRadius * 0.12;
  for (let index = 0; index < safeCount; index += 1) {
    const angle = (Math.PI * 2 * index) / safeCount - Math.PI / 2;
    const x = center + Math.cos(angle) * radius * 0.78;
    const y = center + Math.sin(angle) * radius * 0.78;
    const starColor = context.createLinearGradient(
      x - starRadius * 0.55,
      y - starRadius * 0.62,
      x + starRadius * 0.62,
      y + starRadius * 0.7,
    );
    if (kami) {
      starColor.addColorStop(0, "rgba(255,255,239,0.96)");
      starColor.addColorStop(0.3, "rgba(255,238,154,0.94)");
      starColor.addColorStop(0.68, "rgba(116,210,176,0.88)");
      starColor.addColorStop(1, "rgba(47,104,87,0.78)");
    } else {
      starColor.addColorStop(0, "rgba(255,252,222,0.96)");
      starColor.addColorStop(0.32, "rgba(255,224,116,0.94)");
      starColor.addColorStop(0.7, "rgba(224,157,55,0.88)");
      starColor.addColorStop(1, "rgba(91,92,65,0.76)");
    }
    context.fillStyle = starColor;
    context.beginPath();
    for (let point = 0; point < 8; point += 1) {
      const pointAngle = angle + Math.PI * point / 4;
      const pointRadius = point % 2 === 0 ? starRadius : starRadius * 0.35;
      const px = x + Math.cos(pointAngle) * pointRadius;
      const py = y + Math.sin(pointAngle) * pointRadius;
      if (point === 0) context.moveTo(px, py); else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
  }
  context.restore();
  return canvas;
}

function createScaledCanvas(logicalSize: number, scale: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(logicalSize * scale));
  canvas.height = Math.max(1, Math.ceil(logicalSize * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("2D canvas context is unavailable for ball texture generation.");
  }
  context.save();
  context.scale(scale, scale);
  return { canvas, context };
}

function denseCanvasSize(radius: number): number {
  return Math.max(4, Math.ceil(radius * 2));
}

function faithfulSurfaceSize(radius: number): number {
  return Math.max(18, Math.ceil(radius * 2 + 4));
}

function faithfulOverlaySize(radius: number): number {
  return Math.max(24, Math.ceil(radius * 2.9));
}

function faithfulEchoSize(radius: number, strength: AppSettings["emotionEchoStrength"]): number {
  return Math.max(24, Math.ceil(radius * resolveEchoSpreadScale(strength)));
}

function faithfulArchivedAuraSize(radius: number): number {
  return Math.max(28, Math.ceil(radius * 3));
}

function faithfulStarSize(radius: number): number {
  return Math.max(22, Math.ceil(radius * 2.35));
}

function clearRingCenter(context: CanvasRenderingContext2D, center: number, radius: number): void {
  context.globalCompositeOperation = "destination-out";
  context.beginPath();
  context.arc(center, center, ringInnerRadius(radius), 0, Math.PI * 2);
  context.fillStyle = "#000";
  context.fill();
  context.globalCompositeOperation = "source-over";
}

function ringInnerRadius(radius: number): number {
  return Math.max(0, radius - Math.max(1.5, radius * 0.14));
}

function drawBalancedBallLabel(
  context: CanvasRenderingContext2D,
  label: string,
  center: number,
  radius: number,
): void {
  const { lines } = createBalancedBallLabelLayout(label);
  if (lines.length === 0) {
    return;
  }
  const targetSize = Math.max(16, Math.min(36, radius * 0.5));
  const lineHeightRatio = 1.02;
  const availableWidth = radius * 1.55;
  const availableHeight = radius * 1.45;
  context.font = `800 ${targetSize}px sans-serif`;
  const widestLine = Math.max(...lines.map((line) => context.measureText(line).width), 1);
  const widthScale = availableWidth / widestLine;
  const heightScale = availableHeight / (lines.length * targetSize * lineHeightRatio);
  const fontSize = Math.max(8, targetSize * Math.min(1, widthScale, heightScale));
  const lineHeight = fontSize * lineHeightRatio;
  const firstLineY = center - (lines.length - 1) * lineHeight / 2;
  context.font = `800 ${fontSize}px sans-serif`;
  lines.forEach((line, index) => {
    context.fillText(line, center, firstLineY + index * lineHeight);
  });
}

function roundRadius(radius: number): string {
  return radius.toFixed(2);
}

function hsl(hue: number, saturation: number, lightness: number, alpha: number): string {
  const normalizedHue = ((hue % 360) + 360) % 360;
  return `hsl(${normalizedHue} ${clamp(saturation, 0, 100)}% ${clamp(lightness, 0, 100)}% / ${clamp(alpha, 0, 1)})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
