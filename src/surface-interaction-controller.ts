export interface SurfacePanInput {
  deltaX: number;
  deltaY: number;
  hasScrollOwner: boolean;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export function shouldBlockSurfacePan(input: SurfacePanInput): boolean {
  if (Math.hypot(input.deltaX, input.deltaY) < 10) {
    return false;
  }
  if (Math.abs(input.deltaX) > Math.abs(input.deltaY)) {
    return true;
  }
  if (!input.hasScrollOwner) {
    return true;
  }
  const maxScrollTop = Math.max(0, input.scrollHeight - input.clientHeight);
  if (maxScrollTop === 0) {
    return true;
  }
  return (input.deltaY > 0 && input.scrollTop <= 0)
    || (input.deltaY < 0 && input.scrollTop >= maxScrollTop - 1);
}

export class SurfaceInteractionController {
  private touchStart: { x: number; y: number; scrollOwner: HTMLElement | null; nativeRange: boolean } | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly isBlockingSurfaceActive: () => boolean,
  ) {}

  install(): void {
    this.root.addEventListener("selectstart", this.preventNonEditableSelection);
    this.root.addEventListener("contextmenu", this.preventNonEditableSelection);
    this.root.addEventListener("dblclick", this.preventControlDoubleTap);
    this.root.addEventListener("touchstart", this.handleTouchStart, { passive: true });
    this.root.addEventListener("touchmove", this.handleTouchMove, { passive: false });
    this.root.addEventListener("touchend", this.clearTouch, { passive: true });
    this.root.addEventListener("touchcancel", this.clearTouch, { passive: true });
    for (const name of ["gesturestart", "gesturechange", "gestureend"]) {
      this.root.addEventListener(name, this.preventBlockingGesture, { passive: false });
    }
  }

  private readonly preventNonEditableSelection = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, textarea, select, [contenteditable='true'], [data-text-selectable]")) {
      return;
    }
    if (target?.closest(".app-interaction-surface, .world-actions")) {
      event.preventDefault();
    }
  };

  private readonly preventControlDoubleTap = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".world-actions")) {
      event.preventDefault();
    }
  };

  private readonly handleTouchStart = (event: TouchEvent): void => {
    if (event.touches.length !== 1) {
      this.touchStart = null;
      return;
    }
    const touch = event.touches[0];
    const target = event.target instanceof Element ? event.target : null;
    this.touchStart = {
      x: touch.clientX,
      y: touch.clientY,
      scrollOwner: target?.closest<HTMLElement>("[data-scroll-owner]") ?? null,
      nativeRange: Boolean(target?.closest("input[type='range']")),
    };
  };

  private readonly handleTouchMove = (event: TouchEvent): void => {
    if (event.touches.length > 1) {
      const target = event.target instanceof Element ? event.target : null;
      if (this.isBlockingSurfaceActive() || target?.closest(".world-actions")) {
        event.preventDefault();
      }
      return;
    }
    if (!this.isBlockingSurfaceActive() || event.touches.length !== 1 || !this.touchStart) {
      return;
    }
    const touch = event.touches[0];
    const deltaX = touch.clientX - this.touchStart.x;
    const deltaY = touch.clientY - this.touchStart.y;
    if (this.touchStart.nativeRange && Math.abs(deltaX) > Math.abs(deltaY)) {
      return;
    }
    const owner = this.touchStart.scrollOwner;
    if (shouldBlockSurfacePan({
      deltaX,
      deltaY,
      hasScrollOwner: Boolean(owner),
      scrollTop: owner?.scrollTop ?? 0,
      scrollHeight: owner?.scrollHeight ?? 0,
      clientHeight: owner?.clientHeight ?? 0,
    })) {
      event.preventDefault();
    }
  };

  private readonly preventBlockingGesture = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (this.isBlockingSurfaceActive() || target?.closest(".world-actions")) {
      event.preventDefault();
    }
  };

  private readonly clearTouch = (): void => {
    this.touchStart = null;
  };
}
