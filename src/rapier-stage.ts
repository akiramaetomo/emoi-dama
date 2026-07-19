import RAPIER, { type Collider, type RigidBody, type World } from "@dimforge/rapier2d-compat";
import {
  DomBallStageRenderer,
  type BallRenderSnapshot,
  type BallStageRenderer,
  type PhysicsBallSnapshot,
  type VisualBallSource,
} from "./ball-stage-renderer.js";
import { createGlobalMotionTuning, type MotionTuning } from "./motion-tuning.js";
import { calculateDenseBallRadius, calculateDomBallRadius, DENSE_APPEARANCE_MAX_DIAMETER_PX } from "./play-population.js";
import {
  calculateFillRadii,
  calculateParentRadius,
  CLASSIFICATION_AGITATION_DECAY_MS,
  confineBallToWorld,
  createBatchFragmentationPlan,
  createFragmentationPlan,
  FILL_RADIUS_TRANSITION_MS,
  fragmentRadius,
  getMotionProfile,
  getParentMotionProfile,
  interpolateRadiusByArea,
  MAX_FRAGMENT_GENERATION,
  planSplitPairPlacement,
  PARENT_FADE_MS,
  PARENT_STOP_HOLD_MS,
  PARENT_STOP_SPEED_PX_PER_SECOND,
  resolveClassifiedDamping,
  resolveClassificationGravityScale,
  resolveParentDamping,
  shouldThrowParent,
  type PlayBuoyancyMode,
  type PlayFragmentationMode,
  type PlayGravityMode,
  type PlayInteractionMode,
  type PlayParentSplitMode,
} from "./play-physics-classification.js";
import type { AppSettings } from "./settings.js";

export type { PhysicsBallSnapshot, VisualBallSource } from "./ball-stage-renderer.js";

const BALL_TAP_MAX_MS = 520;
const BALL_TAP_MOVE_PX = 10;
const BALL_DRAG_START_PX = 0;
const WALL_THICKNESS_PX = 64;
const PHYSICS_TIMESTEP_SECONDS = 1 / 60;
const PHYSICS_TIMESTEP_MS = 1000 / 60;
const MAX_PHYSICS_FRAME_DELTA_MS = 100;
const MAX_PHYSICS_STEPS_PER_FRAME = 4;
const CONTACT_FRICTION = 0;
const DRAG_WALL_CLEARANCE_PX = 1;
const SMALL_FRAGMENT_HARD_CCD_GENERATION = 4;
const WALL_SOUND_COOLDOWN_MS = 140;

export type ImpactKind = "wall" | "contact";

export interface ImpactEvent {
  kind: ImpactKind;
  energy: number;
}

export type GravityVector = { x: number; y: number };
export type WallImpactSide = "left" | "right" | "top" | "bottom";

export interface WallImpactCandidate {
  side: WallImpactSide;
  energy: number;
}

export interface PhysicsStepSchedule {
  steps: number;
  accumulatorMs: number;
}

export interface MutableBallCollider {
  setRestitution(value: number): void;
  setFriction(value: number): void;
  setFrictionCombineRule?(rule: RAPIER.CoefficientCombineRule): void;
}

export interface BallColliderSettings {
  contactRestitution: number;
  friction: number;
}

export interface ImpactAudio {
  unlock(): void;
  play(impacts: ImpactEvent[], settings: AppSettings): void;
}

export interface RapierStageOptions {
  autoFitDomRadius?: boolean;
  radiusMode?: "fixed" | "dom" | "dense";
  renderer?: BallStageRenderer;
  gravityMode?: PlayGravityMode;
  buoyancyMode?: PlayBuoyancyMode;
  interactionMode?: PlayInteractionMode;
  fragmentationMode?: PlayFragmentationMode;
  parentSplitMode?: PlayParentSplitMode;
  displayLimit?: number;
  onPopulationChange?: (displayedCount: number, originalCount: number) => void;
  onBuoyancyActivationChange?: (activation: number) => void;
}

export interface JutsuFragmentationResult {
  status: "applied" | "blocked-limit" | "no-eligible";
  splitRecordCount: number;
  previousCount: number;
  nextCount: number;
}

export interface JutsuResetResult {
  status: "reset" | "no-fragments";
  resetGroupCount: number;
  previousCount: number;
  nextCount: number;
}

export interface FragmentMergeSample {
  mass: number;
  position: { x: number; y: number };
  linvel: { x: number; y: number };
  rotation: number;
  angvel: number;
}

export interface FragmentMergeState {
  position: { x: number; y: number };
  linvel: { x: number; y: number };
  rotation: number;
  angvel: number;
}

interface RapierBall extends VisualBallSource {
  body: RigidBody;
  collider: Collider;
  radius: number;
}

interface ParentBallActor {
  id: number;
  body: RigidBody;
  collider: Collider;
  radius: number;
  element: HTMLDivElement;
  processedBallIds: Set<string>;
  pointerId: number | null;
  startPoint: { x: number; y: number };
  lastPoint: { x: number; y: number; time: number };
  velocity: { x: number; y: number };
  releasedAt: number | null;
  removeAfterSteps: number | null;
  stoppedSince: number | null;
  maxLifetimeMs: number;
}

interface ActiveRadiusTransition {
  startedAt: number;
  from: Map<string, number>;
  to: Map<string, number>;
}

export class RapierStage {
  private world: World;
  private readonly eventQueue = new RAPIER.EventQueue(true);
  private readonly balls: RapierBall[] = [];
  private readonly renderSnapshots: BallRenderSnapshot[] = [];
  private readonly resizeObserver: ResizeObserver;
  private readonly ballByColliderHandle = new Map<number, RapierBall>();
  private readonly boundaryColliders = new Map<WallImpactSide, Collider>();
  private readonly baseSourceByInstanceId = new Map<string, VisualBallSource>();
  private parentActor: ParentBallActor | null = null;
  private nextParentId = 1;
  private pendingSplitBallIds = new Set<string>();
  private animationId = 0;
  private lastTickTimeMs: number | null = null;
  private physicsAccumulatorMs = 0;
  private width = 0;
  private height = 0;
  private sourceCount = 0;
  private requestedRadius: number;
  private readonly renderer: BallStageRenderer;
  private dragging: RapierBall | null = null;
  private dragOffset = { x: 0, y: 0 };
  private dragVelocity = { x: 0, y: 0 };
  private lastPointer: { x: number; y: number; time: number } | null = null;
  private tapStart: { x: number; y: number; time: number; ball: RapierBall } | null = null;
  private dragActive = false;
  private heldBallMotion: { position: { x: number; y: number }; linvel: { x: number; y: number }; angvel: number } | null = null;
  private gravityVector: GravityVector = { x: 0, y: 0 };
  private gravityMode: PlayGravityMode;
  private buoyancyMode: PlayBuoyancyMode;
  private interactionMode: PlayInteractionMode;
  private fragmentationMode: PlayFragmentationMode;
  private parentSplitMode: PlayParentSplitMode;
  private radiusTransition: ActiveRadiusTransition | null = null;
  private classificationAgitationUntilMs = 0;
  private lastBuoyancyActivation = -1;
  private readonly lastWallSoundAt = new Map<string, number>();
  private motionTuning: MotionTuning;
  private disposed = false;
  private running = false;
  private faulted = false;

  constructor(
    private readonly field: HTMLDivElement,
    sources: VisualBallSource[],
    private readonly onSelect: (ballId: string) => void,
    private readonly onOpenDetail: (ballId: string) => void,
    private settings: AppSettings,
    private readonly audio: ImpactAudio,
    private readonly onFault: (error: unknown) => void = () => undefined,
    private readonly options: RapierStageOptions = {},
  ) {
    this.world = new RAPIER.World({ x: 0, y: 0 });
    this.motionTuning = createGlobalMotionTuning(settings);
    this.requestedRadius = settings.radius;
    this.gravityMode = options.gravityMode ?? "free";
    this.buoyancyMode = this.gravityMode === "fixed-down" ? options.buoyancyMode ?? "off" : "off";
    this.interactionMode = options.interactionMode ?? "grab";
    this.fragmentationMode = options.fragmentationMode ?? "count-limit";
    this.parentSplitMode = this.interactionMode === "parent" ? options.parentSplitMode ?? "off" : "off";
    this.field.dataset.playGravityMode = this.gravityMode;
    this.field.dataset.playBuoyancyMode = this.buoyancyMode;
    this.field.dataset.playInteractionMode = this.interactionMode;
    this.field.dataset.playFragmentationMode = this.fragmentationMode;
    this.field.dataset.playParentSplitMode = this.parentSplitMode;
    this.renderer = options.renderer ?? new DomBallStageRenderer(field, settings);
    this.world.timestep = PHYSICS_TIMESTEP_SECONDS;
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.disposed) {
        this.updateBounds();
      }
    });
    this.rebuild(sources);
    this.resizeObserver.observe(this.field);
    this.field.addEventListener("pointerdown", this.handlePointerDown);
    this.field.addEventListener("pointermove", this.handlePointerMove);
    this.field.addEventListener("pointerup", this.handlePointerUp);
    this.field.addEventListener("pointercancel", this.handlePointerUp);
    this.field.addEventListener("selectstart", this.preventPlaySelection);
    this.field.addEventListener("dragstart", this.preventPlaySelection);
    this.field.addEventListener("contextmenu", this.preventPlaySelection);
  }

  start(): void {
    this.resume();
  }

  pause(): void {
    this.renderer.setPaused(true);
    if (this.disposed || !this.running) {
      return;
    }
    this.running = false;
    cancelAnimationFrame(this.animationId);
  }

  resume(): void {
    if (this.disposed || this.faulted || this.running || this.balls.length === 0) {
      return;
    }
    this.renderer.setPaused(false);
    this.running = true;
    this.lastTickTimeMs = null;
    this.physicsAccumulatorMs = 0;
    this.animationId = requestAnimationFrame(this.tick);
  }

  destroy(): void {
    if (this.disposed) {
      return;
    }
    this.pause();
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.removeParentActor();
    this.field.removeEventListener("pointerdown", this.handlePointerDown);
    this.field.removeEventListener("pointermove", this.handlePointerMove);
    this.field.removeEventListener("pointerup", this.handlePointerUp);
    this.field.removeEventListener("pointercancel", this.handlePointerUp);
    this.field.removeEventListener("selectstart", this.preventPlaySelection);
    this.field.removeEventListener("dragstart", this.preventPlaySelection);
    this.field.removeEventListener("contextmenu", this.preventPlaySelection);
    this.renderer.destroy();
    this.safeFreeWorld();
    this.eventQueue.free();
  }

  updateSettings(settings: AppSettings): void {
    if (this.disposed) {
      return;
    }
    this.requestedRadius = settings.radius;
    this.settings = settings;
    this.motionTuning = createGlobalMotionTuning(settings);
    this.renderer.updateSettings(settings);
    if (!settings.gravityEnabled) {
      this.setGravityVector({ x: 0, y: 0 });
    }
    this.applyCurrentRadius();
    for (const ball of this.balls) {
      const profile = getMotionProfile(
        ball.motionClass,
        settings.classificationDensityRatio,
        settings.classificationDampingRatio,
      );
      ball.body.setLinearDamping(resolveClassifiedDamping(
        this.motionTuning.linearDamping,
        ball.motionClass,
        settings.classificationDampingRatio,
      ));
      ball.body.setAngularDamping(settings.angularDamping);
      ball.collider.setDensity(profile.density);
      applyBallColliderSettings(ball.collider, {
        contactRestitution: this.motionTuning.contactRestitution,
        friction: CONTACT_FRICTION,
      });
    }
    if (this.parentActor) {
      const parentProfile = getParentMotionProfile(
        settings.classificationDensityRatio,
        settings.classificationDampingRatio,
      );
      this.parentActor.collider.setDensity(parentProfile.density);
      this.parentActor.body.setLinearDamping(resolveParentDamping(
        this.motionTuning.linearDamping,
        settings.classificationDampingRatio,
      ));
    }
    this.updateBoundaryColliders();
  }

  captureSnapshots(): PhysicsBallSnapshot[] {
    if (this.disposed || this.faulted) {
      return [];
    }

    return this.balls.map((ball) => {
      const position = ball.body.translation();
      const linvel = ball.body.linvel();
      return {
        id: ball.id,
        position: { x: position.x, y: position.y },
        linvel: { x: linvel.x, y: linvel.y },
        rotation: ball.body.rotation(),
        angvel: ball.body.angvel(),
      };
    });
  }

  setGravityVector(gravity: GravityVector): void {
    if (this.disposed || this.faulted) {
      return;
    }
    this.gravityVector = gravity;
  }

  setPlayGravityMode(mode: PlayGravityMode): void {
    if (this.gravityMode === mode) {
      return;
    }
    this.gravityMode = mode;
    this.field.dataset.playGravityMode = mode;
    if (mode === "free") {
      this.setBuoyancyMode("off");
    }
    for (const ball of this.balls) {
      ball.body.wakeUp();
    }
    this.parentActor?.body.wakeUp();
  }

  setBuoyancyMode(mode: PlayBuoyancyMode): void {
    const nextMode = this.gravityMode === "fixed-down" && mode === "on" ? "on" : "off";
    if (this.buoyancyMode === nextMode) {
      return;
    }
    this.buoyancyMode = nextMode;
    this.field.dataset.playBuoyancyMode = nextMode;
    if (nextMode === "off") {
      this.classificationAgitationUntilMs = 0;
      for (const ball of this.balls) {
        ball.body.setGravityScale(1, true);
      }
      this.publishBuoyancyActivation(0, true);
    }
  }

  setInteractionMode(mode: PlayInteractionMode): void {
    if (this.interactionMode === mode) {
      return;
    }
    this.interactionMode = mode;
    this.field.dataset.playInteractionMode = mode;
    this.resetPointerState();
    this.removeParentActor();
    if (mode === "grab") {
      this.setParentSplitMode("off");
    }
    this.lastWallSoundAt.clear();
  }

  setParentSplitMode(mode: PlayParentSplitMode): void {
    const nextMode = this.interactionMode === "parent" ? mode : "off";
    if (this.parentSplitMode === nextMode) {
      return;
    }
    this.parentSplitMode = nextMode;
    this.field.dataset.playParentSplitMode = nextMode;
    if (nextMode !== "off") {
      this.setFragmentationMode(nextMode);
    }
  }

  setFragmentationMode(mode: PlayFragmentationMode): void {
    if (this.fragmentationMode === mode) {
      return;
    }
    this.fragmentationMode = mode;
    this.field.dataset.playFragmentationMode = mode;
    this.scheduleRadiusTransition(performance.now());
  }

  applyJutsuFragmentation(mode: PlayFragmentationMode): JutsuFragmentationResult {
    this.setFragmentationMode(mode);
    const previousCount = this.balls.length;
    const groups = new Map<string, RapierBall[]>();
    for (const ball of this.balls) {
      const group = groups.get(ball.ballId) ?? [];
      group.push(ball);
      groups.set(ball.ballId, group);
    }
    const groupEntries = [...groups.entries()].filter(([, group]) => {
      const generation = group[0]?.fragmentGeneration ?? Number.MAX_SAFE_INTEGER;
      return group.length > 0 && group.every((ball) => ball.fragmentGeneration === generation);
    });
    const batchPlan = createBatchFragmentationPlan(
      groupEntries.map(([, group]) => ({ generation: group[0]?.fragmentGeneration ?? MAX_FRAGMENT_GENERATION, count: group.length })),
      previousCount,
      this.options.displayLimit ?? 1000,
    );
    if (batchPlan.status === "no-eligible") {
      return { status: "no-eligible", splitRecordCount: 0, previousCount, nextCount: previousCount };
    }
    if (batchPlan.status === "blocked-limit") {
      return { status: "blocked-limit", splitRecordCount: 0, previousCount, nextCount: previousCount };
    }
    const eligibleBallIds = batchPlan.eligibleGroupIndexes
      .map((index) => groupEntries[index]?.[0])
      .filter((ballId): ballId is string => Boolean(ballId));
    let splitRecordCount = 0;
    for (const ballId of eligibleBallIds) {
      if (this.splitBallGroup(ballId, false)) {
        splitRecordCount += 1;
      }
    }
    this.scheduleRadiusTransition(performance.now());
    this.syncRendererSources();
    this.paint();
    return { status: "applied", splitRecordCount, previousCount, nextCount: this.balls.length };
  }

  resetJutsuFragmentation(): JutsuResetResult {
    const previousCount = this.balls.length;
    const groups = new Map<string, RapierBall[]>();
    for (const ball of this.balls) {
      const group = groups.get(ball.baseInstanceId) ?? [];
      group.push(ball);
      groups.set(ball.baseInstanceId, group);
    }
    const fragmentedGroups = [...groups.entries()].filter(([, group]) => (
      group.length > 1 || group.some((ball) => ball.fragmentGeneration > 0)
    ));
    if (fragmentedGroups.length === 0) {
      return { status: "no-fragments", resetGroupCount: 0, previousCount, nextCount: previousCount };
    }

    this.resetPointerState();
    this.pendingSplitBallIds.clear();
    const replacements = fragmentedGroups.map(([baseInstanceId, group]) => {
      const baseSource = this.baseSourceByInstanceId.get(baseInstanceId) ?? stripPhysicalBall(group[0]);
      const state = calculateFragmentMergeState(group.map((ball) => {
        const position = ball.body.translation();
        const linvel = ball.body.linvel();
        return {
          mass: ball.body.mass(),
          position: { x: position.x, y: position.y },
          linvel: { x: linvel.x, y: linvel.y },
          rotation: ball.body.rotation(),
          angvel: ball.body.angvel(),
        };
      }));
      return { baseSource, group, state };
    });

    for (const replacement of replacements) {
      for (const ball of replacement.group) {
        this.removeBall(ball);
      }
      const radius = this.settings.radius;
      this.createBall({
        ...replacement.baseSource,
        id: replacement.baseSource.baseInstanceId,
        fragmentGeneration: 0,
        fragmentOrdinal: 0,
        radius,
        snapshot: null,
      }, {
        x: clamp(replacement.state.position.x, radius, this.width - radius),
        y: clamp(replacement.state.position.y, radius, this.height - radius),
        linvel: replacement.state.linvel,
        rotation: replacement.state.rotation,
        angvel: replacement.state.angvel,
      });
    }

    this.scheduleRadiusTransition(performance.now());
    this.syncRendererSources();
    this.paint();
    return {
      status: "reset",
      resetGroupCount: replacements.length,
      previousCount,
      nextCount: this.balls.length,
    };
  }

  private rebuild(sources: VisualBallSource[]): void {
    if (this.disposed) {
      return;
    }
    this.resetPointerState();
    this.removeParentActor();
    this.sourceCount = sources.length;
    this.baseSourceByInstanceId.clear();
    for (const source of sources) {
      this.baseSourceByInstanceId.set(source.baseInstanceId, {
        ...source,
        id: source.baseInstanceId,
        fragmentGeneration: 0,
        fragmentOrdinal: 0,
        snapshot: null,
      });
    }
    this.updateBounds();
    this.balls.length = 0;
    this.renderSnapshots.length = 0;
    this.radiusTransition = null;
    this.ballByColliderHandle.clear();
    this.boundaryColliders.clear();
    this.safeFreeWorld();
    this.world = new RAPIER.World({ x: 0, y: 0 });
    this.world.timestep = PHYSICS_TIMESTEP_SECONDS;
    this.lastTickTimeMs = null;
    this.physicsAccumulatorMs = 0;
    this.createBoundaryColliders();

    if (sources.length === 0) {
      this.renderer.mount([], this.settings.radius);
      return;
    }

    this.createBalls(sources);
  }

  private updateBounds(): void {
    const rect = this.field.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.updateBoundaryColliders();
    this.applyCurrentRadius();
  }

  updateVisualSources(sources: VisualBallSource[]): boolean {
    if (this.disposed || this.faulted) {
      return false;
    }
    const sourceByBaseInstanceId = new Map(sources.map((source) => [source.baseInstanceId, source]));
    for (const source of sources) {
      this.baseSourceByInstanceId.set(source.baseInstanceId, {
        ...source,
        id: source.baseInstanceId,
        fragmentGeneration: 0,
        fragmentOrdinal: 0,
        snapshot: null,
      });
    }
    for (const ball of this.balls) {
      const source = sourceByBaseInstanceId.get(ball.baseInstanceId);
      if (!source) {
        return false;
      }
      ball.hue = source.hue;
      ball.saturation = source.saturation;
      ball.lightness = source.lightness;
      ball.visualKind = source.visualKind;
      ball.lifecycleStatus = source.lifecycleStatus;
      ball.descentBadgeCount = source.descentBadgeCount;
      ball.isKamiBall = source.isKamiBall;
      ball.echo = source.echo;
      ball.label = source.label;
      ball.labelClass = source.labelClass;
      ball.title = source.title;
    }
    this.syncRendererSources();
    return true;
  }

  private applyCurrentRadius(): void {
    const radiusMode = this.options.radiusMode ?? (this.options.autoFitDomRadius ? "dom" : "fixed");
    const radius = radiusMode === "dense"
      ? calculateDenseBallRadius(this.width, this.height, this.sourceCount)
      : radiusMode === "dom"
        ? calculateDomBallRadius(this.width, this.height, this.sourceCount, this.requestedRadius)
        : this.requestedRadius;
    this.settings = { ...this.settings, radius };
    this.renderer.updateRadius(radius);
    this.scheduleRadiusTransition(performance.now());
    this.syncRendererSources();
  }

  private calculateTargetRadii(): Map<string, number> {
    if (this.fragmentationMode === "fill") {
      return calculateFillRadii(
        this.width,
        this.height,
        this.settings.radius,
        this.balls.map((ball) => ({ id: ball.id, generation: ball.fragmentGeneration })),
      );
    }
    return new Map(this.balls.map((ball) => [
      ball.id,
      fragmentRadius(this.settings.radius, ball.fragmentGeneration),
    ]));
  }

  private scheduleRadiusTransition(now: number): void {
    if (this.balls.length === 0) {
      this.radiusTransition = null;
      return;
    }
    const to = this.calculateTargetRadii();
    const from = new Map(this.balls.map((ball) => [ball.id, ball.radius]));
    const changed = this.balls.some((ball) => Math.abs((to.get(ball.id) ?? ball.radius) - ball.radius) >= 0.01);
    this.radiusTransition = changed ? { startedAt: now, from, to } : null;
  }

  private applyRadiusTransition(now: number): void {
    const transition = this.radiusTransition;
    if (!transition) {
      return;
    }
    const rawProgress = clamp((now - transition.startedAt) / FILL_RADIUS_TRANSITION_MS, 0, 1);
    const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
    for (const ball of this.balls) {
      const from = transition.from.get(ball.id) ?? ball.radius;
      const to = transition.to.get(ball.id) ?? ball.radius;
      const radius = interpolateRadiusByArea(from, to, progress);
      ball.radius = radius;
      ball.collider.setRadius(radius);
      const position = ball.body.translation();
      ball.body.setTranslation({
        x: clamp(position.x, radius, this.width - radius),
        y: clamp(position.y, radius, this.height - radius),
      }, true);
    }
    if (rawProgress >= 1) {
      this.radiusTransition = null;
    }
  }

  private createBoundaryColliders(): void {
    const descriptors: Array<[WallImpactSide, ReturnType<typeof RAPIER.ColliderDesc.cuboid>]> = [
      ["left", RAPIER.ColliderDesc.cuboid(WALL_THICKNESS_PX / 2, this.height / 2 + WALL_THICKNESS_PX).setTranslation(-WALL_THICKNESS_PX / 2, this.height / 2)],
      ["right", RAPIER.ColliderDesc.cuboid(WALL_THICKNESS_PX / 2, this.height / 2 + WALL_THICKNESS_PX).setTranslation(this.width + WALL_THICKNESS_PX / 2, this.height / 2)],
      ["top", RAPIER.ColliderDesc.cuboid(this.width / 2 + WALL_THICKNESS_PX, WALL_THICKNESS_PX / 2).setTranslation(this.width / 2, -WALL_THICKNESS_PX / 2)],
      ["bottom", RAPIER.ColliderDesc.cuboid(this.width / 2 + WALL_THICKNESS_PX, WALL_THICKNESS_PX / 2).setTranslation(this.width / 2, this.height + WALL_THICKNESS_PX / 2)],
    ];
    for (const [side, descriptor] of descriptors) {
      const collider = this.world.createCollider(
        descriptor
          .setRestitution(this.motionTuning.wallRestitution)
          .setFriction(CONTACT_FRICTION)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      );
      this.boundaryColliders.set(side, collider);
    }
  }

  private updateBoundaryColliders(): void {
    const left = this.boundaryColliders.get("left");
    const right = this.boundaryColliders.get("right");
    const top = this.boundaryColliders.get("top");
    const bottom = this.boundaryColliders.get("bottom");
    if (!left || !right || !top || !bottom) {
      return;
    }
    left.setTranslation({ x: -WALL_THICKNESS_PX / 2, y: this.height / 2 });
    left.setHalfExtents({ x: WALL_THICKNESS_PX / 2, y: this.height / 2 + WALL_THICKNESS_PX });
    right.setTranslation({ x: this.width + WALL_THICKNESS_PX / 2, y: this.height / 2 });
    right.setHalfExtents({ x: WALL_THICKNESS_PX / 2, y: this.height / 2 + WALL_THICKNESS_PX });
    top.setTranslation({ x: this.width / 2, y: -WALL_THICKNESS_PX / 2 });
    top.setHalfExtents({ x: this.width / 2 + WALL_THICKNESS_PX, y: WALL_THICKNESS_PX / 2 });
    bottom.setTranslation({ x: this.width / 2, y: this.height + WALL_THICKNESS_PX / 2 });
    bottom.setHalfExtents({ x: this.width / 2 + WALL_THICKNESS_PX, y: WALL_THICKNESS_PX / 2 });
    for (const collider of this.boundaryColliders.values()) {
      collider.setRestitution(this.motionTuning.wallRestitution);
      collider.setFriction(CONTACT_FRICTION);
      collider.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
    }
  }

  private resetPointerState(): void {
    if (this.dragging && this.dragging.body.bodyType() !== RAPIER.RigidBodyType.Dynamic) {
      this.dragging.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    }
    this.renderer.setDragging(null);
    this.dragging = null;
    this.dragOffset = { x: 0, y: 0 };
    this.dragVelocity = { x: 0, y: 0 };
    this.lastPointer = null;
    this.tapStart = null;
    this.dragActive = false;
    this.heldBallMotion = null;
  }

  private safeFreeWorld(): void {
    try {
      this.world.free();
    } catch {
      // Rapier may already have invalidated the WASM-side world after an error.
    }
  }

  private createBalls(sources: VisualBallSource[]): void {
    const columns = Math.max(1, Math.ceil(Math.sqrt(sources.length)));

    sources.forEach((source, index) => {
      const radius = fragmentRadius(this.settings.radius, source.fragmentGeneration);
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = ((column + 1) / (columns + 1)) * this.width + (index % 2) * 12;
      const y = Math.min(this.height - radius, 80 + row * (radius * 1.78));
      const snapshot = source.snapshot;
      const startX = snapshot ? snapshot.position.x : x;
      const startY = snapshot ? snapshot.position.y : y;
      const startLinvel = snapshot?.linvel ?? {
        x: (index % 2 === 0 ? 1 : -1) * (20 + (index % 12) * 3),
        y: 8 + (index % 10) * 2,
      };
      this.createBall({ ...source, radius }, {
        x: clamp(startX, radius, this.width - radius),
        y: clamp(startY, radius, this.height - radius),
        linvel: startLinvel,
        rotation: snapshot?.rotation ?? 0,
        angvel: snapshot?.angvel ?? 0,
      });
    });
    this.renderer.mount(this.balls.map(stripPhysicalBall), this.settings.radius);
    this.scheduleRadiusTransition(performance.now());
    this.paint();
  }

  private createBall(
    source: VisualBallSource,
    state: {
      x: number;
      y: number;
      linvel: { x: number; y: number };
      rotation: number;
      angvel: number;
    },
  ): RapierBall {
    const radius = source.radius;
    const profile = getMotionProfile(
      source.motionClass,
      this.settings.classificationDensityRatio,
      this.settings.classificationDampingRatio,
    );
    const bodyDescriptor = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(state.x, state.y)
        .setRotation(state.rotation)
        .setLinvel(state.linvel.x, state.linvel.y)
        .setAngularDamping(this.settings.angularDamping)
        .setLinearDamping(resolveClassifiedDamping(
          this.motionTuning.linearDamping,
          source.motionClass,
          this.settings.classificationDampingRatio,
        ));
    if (shouldEnableFragmentCcd(source.fragmentGeneration)) {
      bodyDescriptor.setCcdEnabled(true);
    }
    const body = this.world.createRigidBody(bodyDescriptor);
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(radius)
        .setRestitution(this.motionTuning.contactRestitution)
        .setFriction(CONTACT_FRICTION)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setDensity(profile.density)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    body.setAngvel(state.angvel, true);
    const ball = { ...source, body, collider, radius };
    this.balls.push(ball);
    this.renderSnapshots.push({ id: source.id, x: state.x, y: state.y, rotation: state.rotation, angularVelocity: state.angvel, radius });
    this.ballByColliderHandle.set(collider.handle, ball);
    return ball;
  }

  private readonly tick = (timestampMs: number): void => {
    if (this.disposed || !this.running) {
      return;
    }
    try {
      const previousTimestampMs = this.lastTickTimeMs ?? timestampMs - PHYSICS_TIMESTEP_MS;
      this.lastTickTimeMs = timestampMs;
      this.applyRadiusTransition(timestampMs);
      const schedule = scheduleFixedPhysicsSteps(this.physicsAccumulatorMs, timestampMs - previousTimestampMs);
      this.physicsAccumulatorMs = schedule.accumulatorMs;
      const impacts: ImpactEvent[] = [];
      for (let step = 0; step < schedule.steps; step += 1) {
        this.world.gravity = this.gravityMode === "fixed-down"
          ? { x: 0, y: this.settings.gravityStrength }
          : this.settings.gravityEnabled
            ? this.gravityVector
            : { x: 0, y: 0 };
        this.applyClassificationBuoyancy(timestampMs);
        this.world.step(this.eventQueue);
        impacts.push(...this.collectCollisionImpacts(), ...this.recoverEscapedBalls());
        this.applyPendingSplits();
        this.updateParentLifecycle(timestampMs);
      }
      this.audio.play(impacts, this.settings);
      this.paint();
      if (!this.disposed && this.running) {
        this.animationId = requestAnimationFrame(this.tick);
      }
    } catch (error) {
      console.error("Rapier stage stopped after physics error.", error);
      this.running = false;
      this.faulted = true;
      this.onFault(error);
    }
  };

  private recoverEscapedBalls(): ImpactEvent[] {
    const impacts: ImpactEvent[] = [];

    for (const ball of this.balls) {
      const position = ball.body.translation();
      const velocity = ball.body.linvel();
      const speed = Math.hypot(velocity.x, velocity.y);

      if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(speed)) {
        ball.body.setTranslation({ x: this.width / 2, y: this.height / 2 }, true);
        ball.body.setLinvel({ x: 0, y: 0 }, true);
        continue;
      }

      const confined = confineBallToWorld(
        position,
        velocity,
        ball.radius,
        this.width,
        this.height,
        0.25,
        this.motionTuning.wallRestitution,
      );
      if (confined.corrected) {
        ball.body.setTranslation(confined.position, true);
        ball.body.setLinvel(this.limitVelocity(confined.velocity), true);
        continue;
      }

      if (speed > this.motionTuning.maxSpeed) {
        ball.body.setLinvel(this.limitVelocity(velocity), true);
      }
    }

    return impacts;
  }

  private collectCollisionImpacts(): ImpactEvent[] {
    const impacts: ImpactEvent[] = [];
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (!started) {
        return;
      }
      const ball1 = this.ballByColliderHandle.get(handle1);
      const ball2 = this.ballByColliderHandle.get(handle2);
      const parent = this.parentActor;
      const parentHandle = parent?.collider.handle;
      if (parent && (handle1 === parentHandle || handle2 === parentHandle)) {
        const ball = handle1 === parentHandle ? ball2 : ball1;
        if (ball) {
          if (this.parentSplitMode !== "off" && !parent.processedBallIds.has(ball.ballId)) {
            parent.processedBallIds.add(ball.ballId);
            this.pendingSplitBallIds.add(ball.ballId);
          }
          const parentVelocity = parent.pointerId === null ? parent.body.linvel() : parent.velocity;
          const ballVelocity = ball.body.linvel();
          const energy = Math.hypot(parentVelocity.x - ballVelocity.x, parentVelocity.y - ballVelocity.y);
          if (energy >= this.settings.soundThreshold) {
            impacts.push({ kind: "contact", energy });
          }
        }
        return;
      }
      if (ball1 && ball2) {
        const velocity1 = ball1.body.linvel();
        const velocity2 = ball2.body.linvel();
        const energy = Math.hypot(velocity1.x - velocity2.x, velocity1.y - velocity2.y);
        if (energy >= this.settings.soundThreshold) {
          impacts.push({ kind: "contact", energy });
        }
        return;
      }
      const ball = ball1 ?? ball2;
      const wallHandle = ball1 ? handle2 : handle1;
      const side = findBoundarySide(this.boundaryColliders, wallHandle);
      if (!ball || !side) {
        return;
      }
      const velocity = ball.body.linvel();
      const energy = side === "left" || side === "right" ? Math.abs(velocity.x) : Math.abs(velocity.y);
      const now = performance.now();
      const soundKey = `${ball.id}:${side}`;
      const lastSoundAt = this.lastWallSoundAt.get(soundKey) ?? Number.NEGATIVE_INFINITY;
      const isDraggedBall = this.dragging === ball && this.dragActive;
      if (!isDraggedBall && energy >= this.settings.soundThreshold && now - lastSoundAt >= WALL_SOUND_COOLDOWN_MS) {
        this.lastWallSoundAt.set(soundKey, now);
        impacts.push({ kind: "wall", energy });
      }
    });
    return impacts;
  }

  private limitVelocity(velocity: { x: number; y: number }): { x: number; y: number } {
    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed <= this.motionTuning.maxSpeed || speed === 0) {
      return velocity;
    }
    const scale = this.motionTuning.maxSpeed / speed;
    return {
      x: velocity.x * scale,
      y: velocity.y * scale,
    };
  }

  private paint(): void {
    for (let index = 0; index < this.balls.length; index += 1) {
      const ball = this.balls[index];
      const snapshot = this.renderSnapshots[index];
      const position = ball.body.translation();
      snapshot.x = position.x;
      snapshot.y = position.y;
      snapshot.rotation = ball.body.rotation();
      snapshot.angularVelocity = ball.body.angvel();
      snapshot.radius = ball.radius;
    }
    this.renderer.update(this.renderSnapshots);
    this.paintParentActor();
  }

  private applyPendingSplits(): void {
    if (this.pendingSplitBallIds.size === 0) {
      return;
    }
    const pending = [...this.pendingSplitBallIds];
    this.pendingSplitBallIds.clear();
    for (const ballId of pending) {
      this.splitBallGroup(ballId);
    }
  }

  private splitBallGroup(ballId: string, syncRenderer = true): boolean {
    const group = this.balls.filter((ball) => ball.ballId === ballId);
    const generation = group[0]?.fragmentGeneration ?? 0;
    if (group.length === 0 || group.some((ball) => ball.fragmentGeneration !== generation)) {
      return false;
    }
    const plan = createFragmentationPlan(
      generation,
      group.length,
      this.balls.length,
      this.options.displayLimit ?? 1000,
    );
    if (!plan.allowed) {
      return false;
    }

    const replacementStates = group.map((ball) => {
      const position = ball.body.translation();
      const linvel = ball.body.linvel();
      return {
        source: ball,
        position: { x: position.x, y: position.y },
        linvel: { x: linvel.x, y: linvel.y },
        rotation: ball.body.rotation(),
        angvel: ball.body.angvel(),
      };
    });
    for (const ball of group) {
      this.removeBall(ball);
    }

    for (const [sourceIndex, item] of replacementStates.entries()) {
      const nextGeneration = generation + 1;
      const nextRadius = fragmentRadius(this.settings.radius, nextGeneration);
      const tangentAngle = item.rotation + sourceIndex * 0.618;
      const placement = planSplitPairPlacement(item.position, nextRadius, this.width, this.height, tangentAngle);
      const impulseX = placement.axis.x * Math.min(36, nextRadius * 0.8);
      const impulseY = placement.axis.y * Math.min(36, nextRadius * 0.8);
      for (let child = 0; child < 2; child += 1) {
        const direction = child === 0 ? -1 : 1;
        const ordinal = item.source.fragmentOrdinal * 2 + child;
        const id = `${item.source.baseInstanceId}~g${nextGeneration}~${ordinal}`;
        this.createBall({
          ...stripPhysicalBall(item.source),
          id,
          fragmentGeneration: nextGeneration,
          fragmentOrdinal: ordinal,
          fragmentIndex: ordinal,
          radius: nextRadius,
          snapshot: null,
        }, {
          x: child === 0 ? placement.first.x : placement.second.x,
          y: child === 0 ? placement.first.y : placement.second.y,
          linvel: {
            x: item.linvel.x + impulseX * direction,
            y: item.linvel.y + impulseY * direction,
          },
          rotation: item.rotation,
          angvel: item.angvel + direction * 0.18,
        });
      }
    }
    if (syncRenderer) {
      this.scheduleRadiusTransition(performance.now());
      this.syncRendererSources();
      this.paint();
    }
    return true;
  }

  private removeBall(ball: RapierBall): void {
    const index = this.balls.indexOf(ball);
    if (index < 0) {
      return;
    }
    this.ballByColliderHandle.delete(ball.collider.handle);
    this.world.removeRigidBody(ball.body);
    this.balls.splice(index, 1);
    this.renderSnapshots.splice(index, 1);
  }

  private syncRendererSources(): void {
    const sources = this.balls.map(stripPhysicalBall);
    const denseRadius = calculateDenseBallRadius(this.width, this.height, sources.length);
    const denseAppearance = sources.length > 120 && denseRadius * 2 <= DENSE_APPEARANCE_MAX_DIAMETER_PX;
    this.renderer.updateAppearanceProfile(denseAppearance ? "dense-gloss" : "faithful", denseAppearance ? "dense" : "normal");
    if (!this.renderer.updateSources(sources)) {
      this.renderer.mount(sources, this.settings.radius);
    }
    this.options.onPopulationChange?.(sources.length, this.sourceCount);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const point = this.pointerPoint(event);
    if (this.interactionMode === "parent") {
      event.preventDefault();
      this.audio.unlock();
      this.markClassificationAgitation(performance.now());
      this.createParentActor(point, event.pointerId, performance.now());
      this.field.setPointerCapture(event.pointerId);
      return;
    }
    const target = this.findBallAtPoint(point);
    if (!target) {
      this.markClassificationAgitation(performance.now());
      return;
    }

    event.preventDefault();
    this.audio.unlock();
    this.markClassificationAgitation(performance.now());
    this.dragging = target;
    const position = target.body.translation();
    const velocity = target.body.linvel();
    const now = performance.now();
    this.dragOffset = { x: position.x - point.x, y: position.y - point.y };
    this.dragVelocity = { x: 0, y: 0 };
    this.lastPointer = { x: position.x, y: position.y, time: now };
    this.tapStart = { x: point.x, y: point.y, time: now, ball: target };
    this.heldBallMotion = {
      position: { x: position.x, y: position.y },
      linvel: { x: velocity.x, y: velocity.y },
      angvel: target.body.angvel(),
    };
    this.field.setPointerCapture(event.pointerId);
    this.onSelect(target.ballId);
  };

  private readonly preventPlaySelection = (event: Event): void => {
    event.preventDefault();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.interactionMode === "parent" && this.parentActor?.pointerId === event.pointerId) {
      event.preventDefault();
      const point = this.pointerPoint(event);
      const now = performance.now();
      this.markClassificationAgitation(now);
      const dt = Math.max(0.016, (now - this.parentActor.lastPoint.time) / 1000);
      this.parentActor.velocity = this.limitVelocity({
        x: ((point.x - this.parentActor.lastPoint.x) / dt) * this.motionTuning.flickPower,
        y: ((point.y - this.parentActor.lastPoint.y) / dt) * this.motionTuning.flickPower,
      });
      const x = clamp(point.x, this.parentActor.radius + DRAG_WALL_CLEARANCE_PX, this.width - this.parentActor.radius - DRAG_WALL_CLEARANCE_PX);
      const y = clamp(point.y, this.parentActor.radius + DRAG_WALL_CLEARANCE_PX, this.height - this.parentActor.radius - DRAG_WALL_CLEARANCE_PX);
      this.parentActor.body.setNextKinematicTranslation({ x, y });
      this.parentActor.lastPoint = { x: point.x, y: point.y, time: now };
      return;
    }
    if (!this.dragging) {
      return;
    }

    event.preventDefault();
    const point = this.pointerPoint(event);
    const now = performance.now();
    this.markClassificationAgitation(now);
    const x = clamp(point.x + this.dragOffset.x, this.dragging.radius + DRAG_WALL_CLEARANCE_PX, this.width - this.dragging.radius - DRAG_WALL_CLEARANCE_PX);
    const y = clamp(point.y + this.dragOffset.y, this.dragging.radius + DRAG_WALL_CLEARANCE_PX, this.height - this.dragging.radius - DRAG_WALL_CLEARANCE_PX);
    const pointerTravel = this.tapStart ? Math.hypot(point.x - this.tapStart.x, point.y - this.tapStart.y) : Infinity;
    if (pointerTravel <= BALL_DRAG_START_PX) {
      return;
    }

    if (!this.dragActive) {
      this.dragActive = true;
      this.dragging.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      this.dragging.body.setNextKinematicTranslation({ x, y });
      this.dragging.body.setLinvel({ x: 0, y: 0 }, true);
      this.dragging.body.setAngvel(0, true);
      this.renderer.setDragging(this.dragging.id);
    }

    if (this.lastPointer) {
      const dt = Math.max(0.016, (now - this.lastPointer.time) / 1000);
      this.dragVelocity = this.limitVelocity({
        x: ((x - this.lastPointer.x) / dt) * this.motionTuning.flickPower,
        y: ((y - this.lastPointer.y) / dt) * this.motionTuning.flickPower,
      });
    }

    this.dragging.body.setNextKinematicTranslation({ x, y });
    this.lastPointer = { x, y, time: now };
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.parentActor?.pointerId === event.pointerId) {
      event.preventDefault();
      this.releaseParentActor(this.pointerPoint(event), performance.now(), event.type === "pointercancel");
      if (this.field.hasPointerCapture(event.pointerId)) {
        this.field.releasePointerCapture(event.pointerId);
      }
      return;
    }
    if (!this.dragging) {
      return;
    }

    const released = this.dragging;
    const point = this.pointerPoint(event);
    const now = performance.now();
    this.markClassificationAgitation(now);
    const tapDistance = this.tapStart ? Math.hypot(point.x - this.tapStart.x, point.y - this.tapStart.y) : Infinity;
    const isTap = event.type !== "pointercancel"
      && this.tapStart?.ball === released
      && tapDistance <= BALL_TAP_MOVE_PX
      && now - this.tapStart.time <= BALL_TAP_MAX_MS;
    if (this.dragActive) {
      released.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      this.renderer.setDragging(null);
    }
    if (isTap && this.heldBallMotion) {
      released.body.setTranslation(this.heldBallMotion.position, true);
      released.body.setLinvel(this.limitVelocity(this.heldBallMotion.linvel), true);
      released.body.setAngvel(this.heldBallMotion.angvel, true);
    } else if (this.dragActive) {
      released.body.setLinvel(this.limitVelocity(this.dragVelocity), true);
      released.body.setAngvel(this.dragVelocity.x / Math.max(released.radius, 1), true);
    }
    this.dragging = null;
    this.dragOffset = { x: 0, y: 0 };
    this.dragVelocity = { x: 0, y: 0 };
    this.lastPointer = null;
    this.tapStart = null;
    this.dragActive = false;
    this.heldBallMotion = null;
    if (this.field.hasPointerCapture(event.pointerId)) {
      this.field.releasePointerCapture(event.pointerId);
    }
    if (isTap) {
      this.onOpenDetail(released.ballId);
    }
    this.paint();
  };

  private pointerPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.field.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private findBallAtPoint(point: { x: number; y: number }): RapierBall | null {
    for (let index = this.balls.length - 1; index >= 0; index -= 1) {
      const ball = this.balls[index];
      const position = ball.body.translation();
      if (Math.hypot(point.x - position.x, point.y - position.y) <= ball.radius) {
        return ball;
      }
    }
    return null;
  }

  private createParentActor(point: { x: number; y: number }, pointerId: number, now: number): void {
    this.removeParentActor();
    const radius = calculateParentRadius(this.settings.parentBallDiameterPx, this.width, this.height);
    const profile = getParentMotionProfile(
      this.settings.classificationDensityRatio,
      this.settings.classificationDampingRatio,
    );
    const x = clamp(point.x, radius, this.width - radius);
    const y = clamp(point.y, radius, this.height - radius);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(x, y)
        .setLinearDamping(resolveParentDamping(
          this.motionTuning.linearDamping,
          this.settings.classificationDampingRatio,
        ))
        .setAdditionalSolverIterations(2)
        .setCcdEnabled(true),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(radius)
        .setDensity(profile.density)
        .setRestitution(this.motionTuning.contactRestitution)
        .setFriction(CONTACT_FRICTION)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    const element = document.createElement("div");
    element.className = "parent-ball-actor";
    element.setAttribute("aria-hidden", "true");
    element.style.width = `${radius * 2}px`;
    element.style.height = `${radius * 2}px`;
    this.field.appendChild(element);
    this.parentActor = {
      id: this.nextParentId++,
      body,
      collider,
      radius,
      element,
      processedBallIds: new Set(),
      pointerId,
      startPoint: { ...point },
      lastPoint: { x: point.x, y: point.y, time: now },
      velocity: { x: 0, y: 0 },
      releasedAt: null,
      removeAfterSteps: null,
      stoppedSince: null,
      maxLifetimeMs: this.settings.parentBallLifetimeSeconds * 1000,
    };
    this.paintParentActor();
  }

  private releaseParentActor(point: { x: number; y: number }, now: number, cancelled: boolean): void {
    const parent = this.parentActor;
    if (!parent) {
      return;
    }
    parent.pointerId = null;
    const travel = Math.hypot(point.x - parent.startPoint.x, point.y - parent.startPoint.y);
    if (cancelled || !shouldThrowParent(travel)) {
      parent.removeAfterSteps = 1;
      return;
    }
    parent.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    parent.body.setLinvel(this.limitVelocity(parent.velocity), true);
    parent.body.setAngvel(parent.velocity.x / Math.max(parent.radius, 1), true);
    parent.releasedAt = now;
  }

  private updateParentLifecycle(now: number): void {
    const parent = this.parentActor;
    if (!parent || parent.pointerId !== null) {
      return;
    }
    if (parent.removeAfterSteps !== null) {
      parent.removeAfterSteps -= 1;
      if (parent.removeAfterSteps <= 0) {
        this.removeParentActor();
      }
      return;
    }
    if (parent.releasedAt === null) {
      return;
    }
    const age = now - parent.releasedAt;
    const velocity = parent.body.linvel();
    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed < PARENT_STOP_SPEED_PX_PER_SECOND) {
      parent.stoppedSince ??= now;
    } else {
      parent.stoppedSince = null;
    }
    if (age >= parent.maxLifetimeMs || (parent.stoppedSince !== null && now - parent.stoppedSince >= PARENT_STOP_HOLD_MS)) {
      this.removeParentActor();
      return;
    }
    if (age > parent.maxLifetimeMs - PARENT_FADE_MS) {
      parent.element.style.opacity = String(Math.max(0, (parent.maxLifetimeMs - age) / PARENT_FADE_MS));
    }
  }

  private paintParentActor(): void {
    const parent = this.parentActor;
    if (!parent) {
      return;
    }
    if (!parent.element.isConnected) {
      this.field.appendChild(parent.element);
    }
    const position = parent.body.translation();
    parent.element.style.transform = `translate3d(${position.x - parent.radius}px, ${position.y - parent.radius}px, 0) rotate(${parent.body.rotation()}rad)`;
  }

  private removeParentActor(): void {
    const parent = this.parentActor;
    if (!parent) {
      return;
    }
    if (parent.pointerId !== null && this.field.hasPointerCapture(parent.pointerId)) {
      this.field.releasePointerCapture(parent.pointerId);
    }
    parent.element.remove();
    try {
      this.world.removeRigidBody(parent.body);
    } catch {
      // The world may already be released while a fault is being cleaned up.
    }
    this.parentActor = null;
    this.classificationAgitationUntilMs = Math.max(this.classificationAgitationUntilMs, performance.now() + CLASSIFICATION_AGITATION_DECAY_MS);
  }

  private markClassificationAgitation(now: number): void {
    if (this.gravityMode !== "fixed-down" || this.buoyancyMode !== "on") {
      return;
    }
    this.classificationAgitationUntilMs = Math.max(this.classificationAgitationUntilMs, now + CLASSIFICATION_AGITATION_DECAY_MS);
    for (const ball of this.balls) {
      ball.body.wakeUp();
    }
  }

  private applyClassificationBuoyancy(now: number): void {
    const activeActor = this.parentActor !== null || (this.dragging !== null && this.dragActive);
    const agitation = this.gravityMode === "fixed-down" && this.buoyancyMode === "on"
      ? activeActor
        ? 1
        : clamp((this.classificationAgitationUntilMs - now) / CLASSIFICATION_AGITATION_DECAY_MS, 0, 1)
      : 0;
    const activation = clamp(this.settings.classificationBuoyancyStrength, 0, 1) * agitation;
    this.publishBuoyancyActivation(activation);
    for (const ball of this.balls) {
      ball.body.setGravityScale(resolveClassificationGravityScale(
        ball.motionClass,
        this.settings.classificationDensityRatio,
        this.buoyancyMode === "on" ? this.settings.classificationBuoyancyStrength : 0,
        agitation,
      ), false);
    }
  }

  private publishBuoyancyActivation(activation: number, force = false): void {
    const clampedActivation = clamp(Number.isFinite(activation) ? activation : 0, 0, 1);
    const safeActivation = clampedActivation < 0.002 ? 0 : clampedActivation;
    if (!force && Math.abs(safeActivation - this.lastBuoyancyActivation) < 0.002) {
      return;
    }
    this.lastBuoyancyActivation = safeActivation;
    this.field.dataset.fluidActivation = safeActivation.toFixed(3);
    this.options.onBuoyancyActivationChange?.(safeActivation);
  }
}

export function findWallImpactCandidates(
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  radius: number,
  width: number,
  height: number,
): WallImpactCandidate[] {
  const impacts: WallImpactCandidate[] = [];

  if (position.x < radius) {
    impacts.push({ side: "left", energy: Math.max(0, -velocity.x) });
  } else if (position.x > width - radius) {
    impacts.push({ side: "right", energy: Math.max(0, velocity.x) });
  }

  if (position.y < radius) {
    impacts.push({ side: "top", energy: Math.max(0, -velocity.y) });
  } else if (position.y > height - radius) {
    impacts.push({ side: "bottom", energy: Math.max(0, velocity.y) });
  }

  return impacts;
}

export function scheduleFixedPhysicsSteps(accumulatorMs: number, elapsedMs: number): PhysicsStepSchedule {
  const safeAccumulatorMs = Number.isFinite(accumulatorMs) ? Math.max(0, accumulatorMs) : 0;
  const safeElapsedMs = Number.isFinite(elapsedMs)
    ? clamp(elapsedMs, 0, MAX_PHYSICS_FRAME_DELTA_MS)
    : 0;
  let nextAccumulatorMs = safeAccumulatorMs + safeElapsedMs;
  const steps = Math.min(Math.floor(nextAccumulatorMs / PHYSICS_TIMESTEP_MS), MAX_PHYSICS_STEPS_PER_FRAME);
  nextAccumulatorMs -= steps * PHYSICS_TIMESTEP_MS;
  if (steps === MAX_PHYSICS_STEPS_PER_FRAME && nextAccumulatorMs >= PHYSICS_TIMESTEP_MS) {
    nextAccumulatorMs = 0;
  }

  return {
    steps,
    accumulatorMs: nextAccumulatorMs,
  };
}

export function applyBallColliderSettings(collider: MutableBallCollider, settings: BallColliderSettings): void {
  collider.setRestitution(settings.contactRestitution);
  collider.setFriction(settings.friction);
  collider.setFrictionCombineRule?.(RAPIER.CoefficientCombineRule.Min);
}

export function shouldEnableFragmentCcd(fragmentGeneration: number): boolean {
  return Number.isFinite(fragmentGeneration) && fragmentGeneration >= SMALL_FRAGMENT_HARD_CCD_GENERATION;
}

export function calculateFragmentMergeState(samples: readonly FragmentMergeSample[]): FragmentMergeState {
  if (samples.length === 0) {
    throw new Error("At least one fragment is required to calculate a merge state.");
  }
  const weights = samples.map((sample) => Number.isFinite(sample.mass) && sample.mass > 0 ? sample.mass : 1);
  const totalMass = weights.reduce((sum, mass) => sum + mass, 0);
  const weighted = (read: (sample: FragmentMergeSample) => number) => samples.reduce(
    (sum, sample, index) => sum + read(sample) * weights[index],
    0,
  ) / totalMass;
  const sinRotation = weighted((sample) => Math.sin(sample.rotation));
  const cosRotation = weighted((sample) => Math.cos(sample.rotation));
  const rotation = Math.abs(sinRotation) < 1e-9 && Math.abs(cosRotation) < 1e-9
    ? samples[0].rotation
    : Math.atan2(sinRotation, cosRotation);
  return {
    position: {
      x: weighted((sample) => sample.position.x),
      y: weighted((sample) => sample.position.y),
    },
    linvel: {
      x: weighted((sample) => sample.linvel.x),
      y: weighted((sample) => sample.linvel.y),
    },
    rotation,
    angvel: weighted((sample) => sample.angvel),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function findBoundarySide(boundaries: ReadonlyMap<WallImpactSide, Collider>, handle: number): WallImpactSide | null {
  for (const [side, collider] of boundaries) {
    if (collider.handle === handle) {
      return side;
    }
  }
  return null;
}

function stripPhysicalBall(ball: RapierBall): VisualBallSource {
  const { body: _body, collider: _collider, ...source } = ball;
  return source;
}
