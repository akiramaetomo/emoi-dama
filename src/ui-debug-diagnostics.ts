export interface UiDebugSnapshot {
  build: string;
  event: string;
  timestamp: string;
  route: string;
  window: {
    scrollX: number;
    scrollY: number;
    innerWidth: number;
    innerHeight: number;
  };
  document: {
    scrollingTag: string;
    scrollTop: number;
    clientWidth: number;
    clientHeight: number;
    scrollWidth: number;
    scrollHeight: number;
    bodyScrollTop: number;
    bodyScrollHeight: number;
  };
  visualViewport: {
    offsetLeft: number;
    offsetTop: number;
    pageLeft: number;
    pageTop: number;
    width: number;
    height: number;
    scale: number;
  } | null;
  appRect: RectSnapshot;
  target: string;
  scrollOwner: ScrollOwnerSnapshot | null;
}

interface RectSnapshot {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface ScrollOwnerSnapshot {
  element: string;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  maxScrollTop: number;
  overscrollBehaviorY: string;
  touchAction: string;
  rect: RectSnapshot;
}

interface UiDebugHandle {
  getSnapshot: () => UiDebugSnapshot;
  getHistory: () => UiDebugSnapshot[];
}

declare global {
  interface Window {
    __happyBallUiDebug?: UiDebugHandle;
  }
}

export function isUiDebugEnabled(search = window.location.search): boolean {
  return new URLSearchParams(search).get("uiDebug") === "1";
}

export class UiDebugDiagnostics {
  private readonly overlay = document.createElement("pre");
  private readonly history: UiDebugSnapshot[] = [];
  private lastTarget: Element | null = null;
  private lastScrollOwner: HTMLElement | null = null;
  private pendingEvent = "install";
  private frameId = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly buildLabel: string,
  ) {
    this.overlay.className = "ui-debug-diagnostics";
    this.overlay.dataset.uiDebugOverlay = "true";
    this.overlay.setAttribute("aria-hidden", "true");
  }

  install(): void {
    document.body.append(this.overlay);
    for (const eventName of ["touchstart", "touchmove", "touchend", "contextmenu", "selectionchange", "scroll"]) {
      document.addEventListener(eventName, this.handleDocumentEvent, { capture: true, passive: true });
    }
    window.addEventListener("scroll", this.handleWindowEvent, { passive: true });
    window.addEventListener("resize", this.handleWindowEvent, { passive: true });
    window.visualViewport?.addEventListener("scroll", this.handleVisualViewportEvent, { passive: true });
    window.visualViewport?.addEventListener("resize", this.handleVisualViewportEvent, { passive: true });
    new MutationObserver(() => this.schedule("ui-state")).observe(this.root, {
      attributes: true,
      attributeFilter: ["data-primary-route", "data-top-route"],
    });
    window.__happyBallUiDebug = {
      getSnapshot: () => this.capture(this.pendingEvent),
      getHistory: () => this.history.map((entry) => structuredClone(entry)),
    };
    this.schedule("install");
  }

  private readonly handleDocumentEvent = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (target && !target.closest("[data-ui-debug-overlay]")) {
      this.lastTarget = target;
      this.lastScrollOwner = target.closest<HTMLElement>("[data-scroll-owner]");
    }
    this.schedule(event.type);
  };

  private readonly handleWindowEvent = (event: Event): void => {
    this.schedule(`window:${event.type}`);
  };

  private readonly handleVisualViewportEvent = (event: Event): void => {
    this.schedule(`visualViewport:${event.type}`);
  };

  private schedule(eventName: string): void {
    this.pendingEvent = eventName;
    if (this.frameId !== 0) {
      return;
    }
    this.frameId = window.requestAnimationFrame(() => {
      this.frameId = 0;
      const snapshot = this.capture(this.pendingEvent);
      this.history.push(snapshot);
      if (this.history.length > 80) {
        this.history.splice(0, this.history.length - 80);
      }
      this.overlay.textContent = formatUiDebugSnapshot(snapshot);
    });
  }

  private capture(eventName: string): UiDebugSnapshot {
    const scrollingElement = document.scrollingElement ?? document.documentElement;
    const viewport = window.visualViewport;
    const owner = this.lastScrollOwner;
    const ownerStyle = owner ? getComputedStyle(owner) : null;
    return {
      build: this.buildLabel,
      event: eventName,
      timestamp: new Date().toISOString(),
      route: `${this.root.dataset.primaryRoute ?? "?"}/${this.root.dataset.topRoute ?? "?"}`,
      window: {
        scrollX: round(window.scrollX),
        scrollY: round(window.scrollY),
        innerWidth: round(window.innerWidth),
        innerHeight: round(window.innerHeight),
      },
      document: {
        scrollingTag: scrollingElement.tagName.toLowerCase(),
        scrollTop: round(scrollingElement.scrollTop),
        clientWidth: round(document.documentElement.clientWidth),
        clientHeight: round(document.documentElement.clientHeight),
        scrollWidth: round(document.documentElement.scrollWidth),
        scrollHeight: round(document.documentElement.scrollHeight),
        bodyScrollTop: round(document.body.scrollTop),
        bodyScrollHeight: round(document.body.scrollHeight),
      },
      visualViewport: viewport ? {
        offsetLeft: round(viewport.offsetLeft),
        offsetTop: round(viewport.offsetTop),
        pageLeft: round(viewport.pageLeft),
        pageTop: round(viewport.pageTop),
        width: round(viewport.width),
        height: round(viewport.height),
        scale: round(viewport.scale),
      } : null,
      appRect: captureRect(this.root),
      target: describeElement(this.lastTarget),
      scrollOwner: owner && ownerStyle ? {
        element: describeElement(owner),
        scrollTop: round(owner.scrollTop),
        scrollHeight: round(owner.scrollHeight),
        clientHeight: round(owner.clientHeight),
        maxScrollTop: round(Math.max(0, owner.scrollHeight - owner.clientHeight)),
        overscrollBehaviorY: ownerStyle.overscrollBehaviorY,
        touchAction: ownerStyle.touchAction,
        rect: captureRect(owner),
      } : null,
    };
  }
}

export function formatUiDebugSnapshot(snapshot: UiDebugSnapshot): string {
  const vv = snapshot.visualViewport;
  const owner = snapshot.scrollOwner;
  return [
    `UI DEBUG v${snapshot.build}  ${snapshot.event}  ${snapshot.route}`,
    `win scroll ${snapshot.window.scrollX},${snapshot.window.scrollY}  inner ${snapshot.window.innerWidth}x${snapshot.window.innerHeight}`,
    `doc ${snapshot.document.scrollingTag} top ${snapshot.document.scrollTop}  client ${snapshot.document.clientWidth}x${snapshot.document.clientHeight}`,
    `doc scroll ${snapshot.document.scrollWidth}x${snapshot.document.scrollHeight}  body top/h ${snapshot.document.bodyScrollTop}/${snapshot.document.bodyScrollHeight}`,
    vv
      ? `vv off ${vv.offsetLeft},${vv.offsetTop}  page ${vv.pageLeft},${vv.pageTop}  ${vv.width}x${vv.height} @${vv.scale}`
      : "vv unavailable",
    `#app ${formatRect(snapshot.appRect)}`,
    `target ${snapshot.target}`,
    owner
      ? `owner ${owner.element} top ${owner.scrollTop}/${owner.maxScrollTop} h ${owner.clientHeight}/${owner.scrollHeight}`
      : "owner none",
    owner
      ? `owner css overscroll-y:${owner.overscrollBehaviorY} touch:${owner.touchAction} rect ${formatRect(owner.rect)}`
      : "",
  ].filter(Boolean).join("\n");
}

function captureRect(element: Element): RectSnapshot {
  const rect = element.getBoundingClientRect();
  return {
    left: round(rect.left),
    top: round(rect.top),
    right: round(rect.right),
    bottom: round(rect.bottom),
    width: round(rect.width),
    height: round(rect.height),
  };
}

function formatRect(rect: RectSnapshot): string {
  return `l${rect.left} t${rect.top} r${rect.right} b${rect.bottom} ${rect.width}x${rect.height}`;
}

function describeElement(element: Element | null): string {
  if (!element) {
    return "none";
  }
  const id = element.id ? `#${element.id}` : "";
  const classes = [...element.classList].slice(0, 3).map((name) => `.${name}`).join("");
  const route = element.getAttribute("data-route");
  return `${element.tagName.toLowerCase()}${id}${classes}${route ? `[route=${route}]` : ""}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
