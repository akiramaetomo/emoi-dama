import RAPIER, { type Collider, type RigidBody, type World } from "@dimforge/rapier2d-compat";
import { createGlobalMotionTuning, type MotionTuning } from "./motion-tuning.js";
import type { AppSettings } from "./settings.js";

const BALL_TAP_MAX_MS = 520;
const BALL_TAP_MOVE_PX = 10;
const BALL_DRAG_START_PX = 0;
const WALL_COLLISION_COOLDOWN_MS = 140;
const PHYSICS_TIMESTEP_SECONDS = 1 / 60;
const PHYSICS_TIMESTEP_MS = 1000 / 60;
const MAX_PHYSICS_FRAME_DELTA_MS = 100;
const MAX_PHYSICS_STEPS_PER_FRAME = 4;

export interface VisualBallSource {
  id: string;
  ballId: string;
  hue: number;
  saturation: number;
  lightness: number;
  visualKind: "filled" | "ring";
  lifecycleStatus: "active" | "archived" | "memorial" | "offered";
  descentBadgeCount: number;
  isKamiBall: boolean;
  echo: { hue: number; saturation: number; lightness: number } | null;
  snapshot: PhysicsBallSnapshot | null;
  label: string;
  labelClass: string;
  title: string;
}

export interface PhysicsBallSnapshot {
  id: string;
  position: { x: number; y: number };
  linvel: { x: number; y: number };
  rotation: number;
  angvel: number;
}

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
}

export interface BallColliderSettings {
  contactRestitution: number;
  friction: number;
}

export interface ImpactAudio {
  unlock(): void;
  play(impacts: ImpactEvent[], settings: AppSettings): void;
}

interface RapierBall extends VisualBallSource {
  body: RigidBody;
  collider: Collider;
  radius: number;
  element: HTMLButtonElement;
}

export class RapierStage {
  private world: World;
  private readonly balls: RapierBall[] = [];
  private readonly resizeObserver: ResizeObserver;
  private readonly collisionCooldown = new Map<string, number>();
  private readonly wallCollisionCooldown = new Map<string, number>();
  private animationId = 0;
  private lastTickTimeMs: number | null = null;
  private physicsAccumulatorMs = 0;
  private width = 0;
  private height = 0;
  private dragging: RapierBall | null = null;
  private dragOffset = { x: 0, y: 0 };
  private dragVelocity = { x: 0, y: 0 };
  private lastPointer: { x: number; y: number; time: number } | null = null;
  private tapStart: { x: number; y: number; time: number; ball: RapierBall } | null = null;
  private dragActive = false;
  private heldBallMotion: { position: { x: number; y: number }; linvel: { x: number; y: number }; angvel: number } | null = null;
  private gravityVector: GravityVector = { x: 0, y: 0 };
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
  ) {
    this.world = new RAPIER.World({ x: 0, y: 0 });
    this.motionTuning = createGlobalMotionTuning(settings);
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
    this.field.removeEventListener("pointerdown", this.handlePointerDown);
    this.field.removeEventListener("pointermove", this.handlePointerMove);
    this.field.removeEventListener("pointerup", this.handlePointerUp);
    this.field.removeEventListener("pointercancel", this.handlePointerUp);
    this.field.removeEventListener("selectstart", this.preventPlaySelection);
    this.field.removeEventListener("dragstart", this.preventPlaySelection);
    this.field.removeEventListener("contextmenu", this.preventPlaySelection);
    this.safeFreeWorld();
  }

  updateSettings(settings: AppSettings): void {
    if (this.disposed) {
      return;
    }
    this.settings = settings;
    this.motionTuning = createGlobalMotionTuning(settings);
    if (!settings.gravityEnabled) {
      this.setGravityVector({ x: 0, y: 0 });
    }
    for (const ball of this.balls) {
      ball.radius = settings.radius;
      ball.element.style.width = `${ball.radius * 2}px`;
      ball.element.style.height = `${ball.radius * 2}px`;
      ball.body.setLinearDamping(this.motionTuning.linearDamping);
      ball.body.setAngularDamping(settings.angularDamping);
      applyBallColliderSettings(ball.collider, {
        contactRestitution: this.motionTuning.contactRestitution,
        friction: settings.friction,
      });
    }
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

  private rebuild(sources: VisualBallSource[]): void {
    if (this.disposed) {
      return;
    }
    this.resetPointerState();
    this.updateBounds();
    this.field.innerHTML = "";
    this.balls.length = 0;
    this.safeFreeWorld();
    this.world = new RAPIER.World({ x: 0, y: 0 });
    this.world.timestep = PHYSICS_TIMESTEP_SECONDS;
    this.lastTickTimeMs = null;
    this.physicsAccumulatorMs = 0;
    this.collisionCooldown.clear();
    this.wallCollisionCooldown.clear();

    if (sources.length === 0) {
      this.field.innerHTML = `<div class="empty-state" aria-hidden="true"></div>`;
      return;
    }

    this.createBalls(sources);
  }

  private updateBounds(): void {
    const rect = this.field.getBoundingClientRect();
    this.width = Math.max(280, rect.width);
    this.height = Math.max(280, rect.height);
  }

  private resetPointerState(): void {
    this.dragging?.element.classList.remove("is-dragging");
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
      const radius = this.settings.radius;
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = ((column + 1) / (columns + 1)) * this.width + (index % 2) * 12;
      const y = Math.min(this.height - radius, 80 + row * (radius * 1.78));
      const snapshot = source.snapshot;
      const startX = snapshot ? snapshot.position.x : x;
      const startY = snapshot ? snapshot.position.y : y;
      const startLinvel = snapshot?.linvel ?? { x: (index % 2 === 0 ? 1 : -1) * (20 + index * 3), y: 8 + index * 2 };
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(clamp(startX, radius, this.width - radius), clamp(startY, radius, this.height - radius))
          .setRotation(snapshot?.rotation ?? 0)
          .setLinvel(startLinvel.x, startLinvel.y)
          .setAngularDamping(this.settings.angularDamping)
          .setLinearDamping(this.motionTuning.linearDamping)
          .setCanSleep(false)
          .setCcdEnabled(true),
      );
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.ball(radius)
          .setRestitution(this.motionTuning.contactRestitution)
          .setFriction(this.settings.friction)
          .setDensity(0.7),
        body,
      );
      if (snapshot) {
        body.setAngvel(snapshot.angvel, true);
      }

      const element = document.createElement("button");
      element.type = "button";
      element.draggable = false;
      element.tabIndex = -1;
      element.className = `physics-ball ${source.labelClass} lifecycle-${source.lifecycleStatus} ${source.visualKind === "ring" ? "is-ring-ball" : "is-filled-ball"}${source.echo ? ` has-echo echo-${this.settings.emotionEchoStrength}` : ""}${source.descentBadgeCount > 0 ? " has-descent-badges" : ""}${source.isKamiBall ? " is-kami-ball" : ""}`;
      element.dataset.visualBallId = source.id;
      element.style.width = `${radius * 2}px`;
      element.style.height = `${radius * 2}px`;
      element.style.setProperty("--ball-hue", String(source.hue));
      element.style.setProperty("--ball-saturation", `${source.saturation}%`);
      element.style.setProperty("--ball-lightness", `${source.lightness}%`);
      if (source.echo) {
        element.style.setProperty("--echo-hue", String(source.echo.hue));
        element.style.setProperty("--echo-saturation", `${source.echo.saturation}%`);
        element.style.setProperty("--echo-lightness", `${source.echo.lightness}%`);
      }
      element.setAttribute("aria-label", source.title);
      element.innerHTML = `
        <span class="ball-body" aria-hidden="true">
          <span class="ball-core"></span>
          <span class="ball-shade"></span>
          <span class="ball-highlight"></span>
        </span>
        ${renderDescentBadges(source.descentBadgeCount)}
        <span class="ball-label">${escapeHtml(source.label)}</span>
      `;
      this.field.appendChild(element);
      this.balls.push({ ...source, body, collider, radius, element });
    });
    this.paint();
  }

  private readonly tick = (timestampMs: number): void => {
    if (this.disposed || !this.running) {
      return;
    }
    try {
      const previousTimestampMs = this.lastTickTimeMs ?? timestampMs - PHYSICS_TIMESTEP_MS;
      this.lastTickTimeMs = timestampMs;
      const schedule = scheduleFixedPhysicsSteps(this.physicsAccumulatorMs, timestampMs - previousTimestampMs);
      this.physicsAccumulatorMs = schedule.accumulatorMs;
      const impacts: ImpactEvent[] = [];
      for (let step = 0; step < schedule.steps; step += 1) {
        this.world.gravity = this.settings.gravityEnabled ? this.gravityVector : { x: 0, y: 0 };
        this.world.step();
        impacts.push(
          ...this.containBalls(),
          ...this.resolveBallOverlaps(),
          ...this.detectContactImpacts(),
        );
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

  private containBalls(): ImpactEvent[] {
    const now = performance.now();
    const impacts: ImpactEvent[] = [];

    for (const ball of this.balls) {
      const position = ball.body.translation();
      const velocity = ball.body.linvel();
      const nextX = clamp(position.x, ball.radius, this.width - ball.radius);
      const nextY = clamp(position.y, ball.radius, this.height - ball.radius);
      const outX = Math.abs(nextX - position.x) > 0.001;
      const outY = Math.abs(nextY - position.y) > 0.001;
      const speed = Math.hypot(velocity.x, velocity.y);
      let nextVx = velocity.x;
      let nextVy = velocity.y;

      if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(speed)) {
        ball.body.setTranslation({ x: this.width / 2, y: this.height / 2 }, true);
        ball.body.setLinvel({ x: 0, y: 0 }, true);
        continue;
      }

      if (outX) {
        nextVx = position.x < nextX
          ? Math.abs(nextVx) * this.motionTuning.wallRestitution
          : -Math.abs(nextVx) * this.motionTuning.wallRestitution;
      }

      if (outY) {
        nextVy = position.y < nextY
          ? Math.abs(nextVy) * this.motionTuning.wallRestitution
          : -Math.abs(nextVy) * this.motionTuning.wallRestitution;
      }

      if (outX || outY) {
        const wallImpacts = findWallImpactCandidates(position, velocity, ball.radius, this.width, this.height);
        ball.body.setTranslation({ x: nextX, y: nextY }, true);
        ball.body.setLinvel(this.limitVelocity({ x: nextVx, y: nextVy }), true);

        for (const impact of wallImpacts) {
          const key = `${ball.id}:${impact.side}`;
          if (impact.energy <= this.settings.soundThreshold || (this.wallCollisionCooldown.get(key) ?? 0) > now) {
            continue;
          }
          impacts.push({ kind: "wall", energy: impact.energy });
          this.wallCollisionCooldown.set(key, now + WALL_COLLISION_COOLDOWN_MS);
        }
        continue;
      }

      if (speed > this.motionTuning.maxSpeed) {
        ball.body.setLinvel(this.limitVelocity(velocity), true);
      }
    }

    return impacts;
  }

  private detectContactImpacts(): ImpactEvent[] {
    const now = performance.now();
    const impacts: ImpactEvent[] = [];

    for (let i = 0; i < this.balls.length; i += 1) {
      for (let j = i + 1; j < this.balls.length; j += 1) {
        const a = this.balls[i];
        const b = this.balls[j];
        const pa = a.body.translation();
        const pb = b.body.translation();
        const distance = Math.hypot(pa.x - pb.x, pa.y - pb.y);
        if (distance > a.radius + b.radius + 2) {
          continue;
        }

        const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        if ((this.collisionCooldown.get(key) ?? 0) > now) {
          continue;
        }

        const va = a.body.linvel();
        const vb = b.body.linvel();
        const energy = Math.hypot(va.x - vb.x, va.y - vb.y);
        if (energy > this.settings.soundThreshold) {
          impacts.push({ kind: "contact", energy });
          this.collisionCooldown.set(key, now + 95);
        }
      }
    }

    return impacts;
  }

  private resolveBallOverlaps(): ImpactEvent[] {
    const impacts: ImpactEvent[] = [];
    const slop = 0.35;

    for (let i = 0; i < this.balls.length; i += 1) {
      for (let j = i + 1; j < this.balls.length; j += 1) {
        const a = this.balls[i];
        const b = this.balls[j];
        const pa = a.body.translation();
        const pb = b.body.translation();
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const distance = Math.hypot(dx, dy);
        const minDistance = a.radius + b.radius;
        const overlap = minDistance - distance;

        if (overlap <= slop) {
          continue;
        }

        const normal = distance > 0.001
          ? { x: dx / distance, y: dy / distance }
          : separationNormal(i, j);
        const aDragging = a === this.dragging;
        const bDragging = b === this.dragging;
        const correction = overlap + slop;

        if (aDragging || bDragging) {
          continue;
        }

        this.moveBallTo(a, pa.x - normal.x * correction * 0.5, pa.y - normal.y * correction * 0.5);
        this.moveBallTo(b, pb.x + normal.x * correction * 0.5, pb.y + normal.y * correction * 0.5);

        const va = a.body.linvel();
        const vb = b.body.linvel();
        const relativeNormalSpeed = ((va.x - vb.x) * normal.x) + ((va.y - vb.y) * normal.y);
        if (relativeNormalSpeed > 0) {
          const impulse = relativeNormalSpeed * this.motionTuning.contactRestitution;
          if (!aDragging) {
            a.body.setLinvel(this.limitVelocity({ x: va.x - normal.x * impulse * 0.5, y: va.y - normal.y * impulse * 0.5 }), true);
          }
          if (!bDragging) {
            b.body.setLinvel(this.limitVelocity({ x: vb.x + normal.x * impulse * 0.5, y: vb.y + normal.y * impulse * 0.5 }), true);
          }
        }

        const energy = Math.hypot(va.x - vb.x, va.y - vb.y);
        if (energy > this.settings.soundThreshold) {
          impacts.push({ kind: "contact", energy });
        }
      }
    }

    return impacts;
  }

  private moveBallTo(ball: RapierBall, x: number, y: number): void {
    ball.body.setTranslation(
      {
        x: clamp(x, ball.radius, this.width - ball.radius),
        y: clamp(y, ball.radius, this.height - ball.radius),
      },
      true,
    );
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
    for (const ball of this.balls) {
      const position = ball.body.translation();
      ball.element.style.transform = `translate3d(${position.x - ball.radius}px, ${position.y - ball.radius}px, 0)`;
      ball.element.style.setProperty("--ball-rotation", `${ball.body.rotation()}rad`);
    }
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const target = this.findBallFromTarget(event.target);
    if (!target) {
      return;
    }

    const point = this.pointerPoint(event);
    event.preventDefault();
    this.audio.unlock();
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
    if (!this.dragging) {
      return;
    }

    event.preventDefault();
    const point = this.pointerPoint(event);
    const now = performance.now();
    const x = clamp(point.x + this.dragOffset.x, this.dragging.radius, this.width - this.dragging.radius);
    const y = clamp(point.y + this.dragOffset.y, this.dragging.radius, this.height - this.dragging.radius);
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
      this.dragging.element.classList.add("is-dragging");
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
    if (!this.dragging) {
      return;
    }

    const released = this.dragging;
    const point = this.pointerPoint(event);
    const now = performance.now();
    const tapDistance = this.tapStart ? Math.hypot(point.x - this.tapStart.x, point.y - this.tapStart.y) : Infinity;
    const isTap = event.type !== "pointercancel"
      && this.tapStart?.ball === released
      && tapDistance <= BALL_TAP_MOVE_PX
      && now - this.tapStart.time <= BALL_TAP_MAX_MS;
    if (this.dragActive) {
      released.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      released.element.classList.remove("is-dragging");
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

  private findBallFromTarget(target: EventTarget | null): RapierBall | null {
    if (!(target instanceof Element)) {
      return null;
    }
    const element = target.closest<HTMLElement>(".physics-ball");
    const visualBallId = element?.dataset.visualBallId;
    return this.balls.find((ball) => ball.id === visualBallId) ?? null;
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
}

function renderDescentBadges(count: number): string {
  const safeCount = Math.max(0, Math.min(20, Math.floor(count)));
  if (safeCount === 0) {
    return "";
  }
  return `
    <span class="descent-badge-ring" aria-hidden="true">
      ${Array.from({ length: safeCount }, (_, index) => `<span class="descent-star-badge" style="--descent-star-index: ${index}; --descent-star-total: ${safeCount};"></span>`).join("")}
    </span>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function separationNormal(a: number, b: number): { x: number; y: number } {
  const angle = ((a * 41 + b * 17) % 360) * (Math.PI / 180);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}
