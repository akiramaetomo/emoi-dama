import RAPIER, { type RigidBody, type World } from "@dimforge/rapier2d-compat";
import type { AppSettings } from "./settings.js";

const BALL_TAP_MAX_MS = 520;
const BALL_TAP_MOVE_PX = 10;

export interface VisualBallSource {
  id: string;
  ballId: string;
  hue: number;
  saturation: number;
  lightness: number;
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

export interface ImpactAudio {
  unlock(): void;
  play(impacts: ImpactEvent[], settings: AppSettings): void;
}

interface RapierBall extends VisualBallSource {
  body: RigidBody;
  radius: number;
  element: HTMLButtonElement;
}

export class RapierStage {
  private world: World;
  private readonly balls: RapierBall[] = [];
  private readonly resizeObserver: ResizeObserver;
  private readonly collisionCooldown = new Map<string, number>();
  private animationId = 0;
  private width = 0;
  private height = 0;
  private dragging: RapierBall | null = null;
  private dragOffset = { x: 0, y: 0 };
  private dragVelocity = { x: 0, y: 0 };
  private lastPointer: { x: number; y: number; time: number } | null = null;
  private tapStart: { x: number; y: number; time: number; ball: RapierBall } | null = null;
  private movedBeyondTap = false;
  private dragActive = false;
  private heldBallMotion: { position: { x: number; y: number }; linvel: { x: number; y: number }; angvel: number } | null = null;
  private gravityVector: GravityVector = { x: 0, y: 0 };
  private disposed = false;

  constructor(
    private readonly field: HTMLDivElement,
    sources: VisualBallSource[],
    private readonly onSelect: (ballId: string) => void,
    private readonly onOpenDetail: (ballId: string) => void,
    private settings: AppSettings,
    private readonly audio: ImpactAudio,
  ) {
    this.world = new RAPIER.World({ x: 0, y: 0 });
    this.world.timestep = 1 / 60;
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
  }

  start(): void {
    if (this.disposed || this.balls.length === 0) {
      return;
    }
    this.animationId = requestAnimationFrame(this.tick);
  }

  destroy(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    this.field.removeEventListener("pointerdown", this.handlePointerDown);
    this.field.removeEventListener("pointermove", this.handlePointerMove);
    this.field.removeEventListener("pointerup", this.handlePointerUp);
    this.field.removeEventListener("pointercancel", this.handlePointerUp);
    this.safeFreeWorld();
  }

  updateSettings(settings: AppSettings): void {
    if (this.disposed) {
      return;
    }
    this.settings = settings;
    if (!settings.gravityEnabled) {
      this.setGravityVector({ x: 0, y: 0 });
    }
    for (const ball of this.balls) {
      ball.radius = settings.radius;
      ball.element.style.width = `${ball.radius * 2}px`;
      ball.element.style.height = `${ball.radius * 2}px`;
      ball.body.setLinearDamping(settings.linearDamping);
      ball.body.setAngularDamping(settings.angularDamping);
    }
  }

  captureSnapshots(): PhysicsBallSnapshot[] {
    if (this.disposed) {
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
    if (this.disposed) {
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
    this.world.timestep = 1 / 60;
    this.collisionCooldown.clear();

    if (sources.length === 0) {
      this.field.innerHTML = `<div class="empty-state"><div class="seed-ball" aria-hidden="true"></div></div>`;
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
    this.movedBeyondTap = false;
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
          .setLinearDamping(this.settings.linearDamping)
          .setCanSleep(false)
          .setCcdEnabled(true),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.ball(radius)
          .setRestitution(this.settings.contactRestitution)
          .setFriction(this.settings.friction)
          .setDensity(0.7),
        body,
      );
      if (snapshot) {
        body.setAngvel(snapshot.angvel, true);
      }

      const element = document.createElement("button");
      element.type = "button";
      element.tabIndex = -1;
      element.className = `physics-ball ${source.labelClass}${source.echo ? ` has-echo echo-${this.settings.emotionEchoStrength}` : ""}`;
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
        <span class="ball-label">${escapeHtml(source.label)}</span>
      `;
      this.field.appendChild(element);
      this.balls.push({ ...source, body, radius, element });
    });
    this.paint();
  }

  private readonly tick = (): void => {
    if (this.disposed) {
      return;
    }
    try {
      this.world.gravity = this.settings.gravityEnabled ? this.gravityVector : { x: 0, y: 0 };
      this.world.step();
      const impacts = [
        ...this.containBalls(),
        ...this.resolveBallOverlaps(),
        ...this.detectContactImpacts(),
      ];
      this.audio.play(impacts, this.settings);
      this.paint();
      if (!this.disposed) {
        this.animationId = requestAnimationFrame(this.tick);
      }
    } catch (error) {
      console.error("Rapier stage stopped after physics error.", error);
      this.disposed = true;
    }
  };

  private containBalls(): ImpactEvent[] {
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
          ? Math.abs(nextVx) * this.settings.wallRestitution
          : -Math.abs(nextVx) * this.settings.wallRestitution;
      }

      if (outY) {
        nextVy = position.y < nextY
          ? Math.abs(nextVy) * this.settings.wallRestitution
          : -Math.abs(nextVy) * this.settings.wallRestitution;
      }

      if (outX || outY) {
        ball.body.setTranslation({ x: nextX, y: nextY }, true);
        ball.body.setLinvel(this.limitVelocity({ x: nextVx, y: nextVy }), true);
        if (speed > this.settings.soundThreshold) {
          impacts.push({ kind: "wall", energy: speed });
        }
        continue;
      }

      if (speed > this.settings.maxSpeed) {
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
          const impulse = relativeNormalSpeed * this.settings.contactRestitution;
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
    if (speed <= this.settings.maxSpeed || speed === 0) {
      return velocity;
    }
    const scale = this.settings.maxSpeed / speed;
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
    const point = this.pointerPoint(event);
    const target = this.findBall(point.x, point.y);
    if (!target) {
      return;
    }

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
    this.movedBeyondTap = false;
    this.heldBallMotion = {
      position: { x: position.x, y: position.y },
      linvel: { x: velocity.x, y: velocity.y },
      angvel: target.body.angvel(),
    };
    this.field.setPointerCapture(event.pointerId);
    this.onSelect(target.ballId);
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
    if (this.tapStart && Math.hypot(point.x - this.tapStart.x, point.y - this.tapStart.y) > BALL_TAP_MOVE_PX) {
      this.movedBeyondTap = true;
    }

    if (!this.movedBeyondTap) {
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
        x: ((x - this.lastPointer.x) / dt) * this.settings.flickPower,
        y: ((y - this.lastPointer.y) / dt) * this.settings.flickPower,
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
      && !this.movedBeyondTap
      && tapDistance <= BALL_TAP_MOVE_PX
      && now - this.tapStart.time <= BALL_TAP_MAX_MS;
    if (this.dragActive) {
      released.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      released.body.setLinvel(this.limitVelocity(this.dragVelocity), true);
      released.body.setAngvel(this.dragVelocity.x / Math.max(released.radius, 1), true);
      released.element.classList.remove("is-dragging");
    } else if (isTap && this.heldBallMotion) {
      released.body.setTranslation(this.heldBallMotion.position, true);
      released.body.setLinvel(this.limitVelocity(this.heldBallMotion.linvel), true);
      released.body.setAngvel(this.heldBallMotion.angvel, true);
    }
    this.dragging = null;
    this.dragOffset = { x: 0, y: 0 };
    this.dragVelocity = { x: 0, y: 0 };
    this.lastPointer = null;
    this.tapStart = null;
    this.movedBeyondTap = false;
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

  private findBall(x: number, y: number): RapierBall | null {
    let best: RapierBall | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const ball of this.balls) {
      const position = ball.body.translation();
      const distance = Math.hypot(position.x - x, position.y - y);
      if (distance <= ball.radius && distance < bestDistance) {
        best = ball;
        bestDistance = distance;
      }
    }
    return best;
  }
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
