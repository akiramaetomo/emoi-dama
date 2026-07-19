import type { AppSettings } from "./settings.js";
import type { MotionClass } from "./play-physics-classification.js";

export type BallDensityMode = "normal" | "dense";
export type BallAppearanceProfile = "faithful" | "dense-gloss" | "radiant-experiment";
export type BallRendererKind = "dom" | "pixi";

export interface PhysicsBallSnapshot {
  id: string;
  position: { x: number; y: number };
  linvel: { x: number; y: number };
  rotation: number;
  angvel: number;
}

export interface VisualBallSource {
  id: string;
  ballId: string;
  fragmentIndex: number;
  baseInstanceId: string;
  fragmentGeneration: number;
  fragmentOrdinal: number;
  radius: number;
  motionClass: MotionClass;
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

export interface BallRenderSnapshot {
  id: string;
  x: number;
  y: number;
  rotation: number;
  angularVelocity: number;
  radius: number;
}

export interface BallStageRenderer {
  readonly kind: BallRendererKind;
  mount(sources: VisualBallSource[], radius: number): void;
  updateSources(sources: VisualBallSource[]): boolean;
  update(snapshots: BallRenderSnapshot[]): void;
  updateRadius(radius: number): void;
  updateAppearanceProfile(profile: BallAppearanceProfile, densityMode: BallDensityMode): void;
  updateSettings(settings: AppSettings): void;
  setDragging(id: string | null): void;
  setPaused(paused: boolean): void;
  destroy(): void;
}

export class DomBallStageRenderer implements BallStageRenderer {
  readonly kind = "dom" as const;
  private readonly elements = new Map<string, HTMLButtonElement>();
  private sources: VisualBallSource[] = [];
  private radius = 2;

  constructor(
    private readonly field: HTMLDivElement,
    private settings: AppSettings,
  ) {}

  mount(sources: VisualBallSource[], radius: number): void {
    this.sources = sources;
    this.radius = radius;
    this.elements.clear();
    this.field.innerHTML = "";
    if (sources.length === 0) {
      this.field.innerHTML = `<div class="empty-state" aria-hidden="true"></div>`;
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const source of sources) {
      const element = document.createElement("button");
      element.type = "button";
      element.draggable = false;
      element.tabIndex = -1;
      element.className = `physics-ball ${source.labelClass} lifecycle-${source.lifecycleStatus} ${source.visualKind === "ring" ? "is-ring-ball" : "is-filled-ball"}${source.echo ? ` has-echo echo-${this.settings.emotionEchoStrength}` : ""}${source.descentBadgeCount > 0 ? " has-descent-badges" : ""}${source.isKamiBall ? " is-kami-ball" : ""}`;
      element.dataset.visualBallId = source.id;
      element.style.width = `${source.radius * 2}px`;
      element.style.height = `${source.radius * 2}px`;
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
      fragment.appendChild(element);
      this.elements.set(source.id, element);
    }
    this.field.appendChild(fragment);
  }

  updateSources(sources: VisualBallSource[]): boolean {
    if (sources.length !== this.sources.length || sources.some((source) => !this.elements.has(source.id))) {
      this.mount(sources, this.radius);
      return true;
    }
    this.sources = sources;
    for (const source of sources) {
      const element = this.elements.get(source.id);
      const label = element?.querySelector<HTMLElement>(".ball-label");
      if (!element || !label) {
        return false;
      }
      element.classList.remove("label-short", "label-medium", "label-long", "label-xlong");
      element.classList.add(source.labelClass);
      element.setAttribute("aria-label", source.title);
      label.textContent = source.label;
    }
    return true;
  }

  update(snapshots: BallRenderSnapshot[]): void {
    for (const snapshot of snapshots) {
      const element = this.elements.get(snapshot.id);
      if (!element) {
        continue;
      }
      element.style.transform = `translate3d(${snapshot.x - snapshot.radius}px, ${snapshot.y - snapshot.radius}px, 0)`;
      if (element.dataset.renderRadius !== String(snapshot.radius)) {
        element.dataset.renderRadius = String(snapshot.radius);
        element.style.width = `${snapshot.radius * 2}px`;
        element.style.height = `${snapshot.radius * 2}px`;
      }
      element.style.setProperty("--ball-rotation", `${snapshot.rotation}rad`);
    }
  }

  updateRadius(radius: number): void {
    this.radius = radius;
  }

  updateAppearanceProfile(_profile: BallAppearanceProfile, _densityMode: BallDensityMode): void {}

  updateSettings(settings: AppSettings): void {
    const echoStrengthChanged = this.settings.emotionEchoStrength !== settings.emotionEchoStrength;
    this.settings = settings;
    if (echoStrengthChanged && this.sources.length > 0) {
      this.mount(this.sources, this.radius);
    }
  }

  setDragging(id: string | null): void {
    for (const [elementId, element] of this.elements) {
      element.classList.toggle("is-dragging", elementId === id);
    }
  }

  setPaused(_paused: boolean): void {}

  destroy(): void {
    this.elements.clear();
    this.sources = [];
    this.field.innerHTML = "";
  }
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
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
