export interface ImeViewportState {
  active: boolean;
  top: number;
  height: number;
}

export function resolveImeViewport(input: {
  editableSurface: boolean;
  editableFocused: boolean;
  baselineHeight: number;
  currentHeight: number;
  offsetTop: number;
}): ImeViewportState {
  const minimumShrink = Math.max(80, input.baselineHeight * 0.15);
  const active = input.editableSurface
    && input.editableFocused
    && input.currentHeight <= input.baselineHeight - minimumShrink;
  return {
    active,
    top: active ? Math.max(0, input.offsetTop) : 0,
    height: active ? input.currentHeight : input.baselineHeight,
  };
}

export class ImeViewportCoordinator {
  private baselineHeight = window.visualViewport?.height ?? window.innerHeight;
  private editableFocused = false;
  private frame = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly isEditableSurface: () => boolean,
  ) {}

  install(): void {
    document.addEventListener("focusin", this.handleFocusIn);
    document.addEventListener("focusout", this.handleFocusOut);
    window.visualViewport?.addEventListener("resize", this.queueSettlingSync, { passive: true });
    window.visualViewport?.addEventListener("scroll", this.queueSync, { passive: true });
    window.addEventListener("orientationchange", this.resetBaseline, { passive: true });
    this.sync();
  }

  notifySurfaceChange(): void {
    if (!this.editableFocused) {
      this.captureBaseline();
    }
    this.sync();
  }

  private readonly handleFocusIn = (event: FocusEvent): void => {
    const target = event.target;
    this.editableFocused = target instanceof HTMLElement && isEditable(target);
    this.queueSettlingSync();
  };

  private readonly handleFocusOut = (): void => {
    window.setTimeout(() => {
      const active = document.activeElement;
      this.editableFocused = active instanceof HTMLElement && isEditable(active);
      if (!this.editableFocused) {
        this.captureBaseline();
      }
      this.queueSettlingSync();
    }, 0);
  };

  private readonly resetBaseline = (): void => {
    this.editableFocused = false;
    this.captureBaseline();
    this.queueSettlingSync();
  };

  private captureBaseline(): void {
    this.baselineHeight = window.visualViewport?.height ?? window.innerHeight;
  }

  private readonly queueSettlingSync = (): void => {
    this.queueSync();
    window.setTimeout(this.queueSync, 80);
    window.setTimeout(this.queueSync, 240);
  };

  private readonly queueSync = (): void => {
    if (this.frame !== 0) {
      return;
    }
    this.frame = window.requestAnimationFrame(() => {
      this.frame = 0;
      this.sync();
    });
  };

  private sync(): void {
    const viewport = window.visualViewport;
    const state = resolveImeViewport({
      editableSurface: this.isEditableSurface(),
      editableFocused: this.editableFocused,
      baselineHeight: this.baselineHeight,
      currentHeight: viewport?.height ?? window.innerHeight,
      offsetTop: viewport?.offsetTop ?? 0,
    });
    this.root.dataset.imeActive = state.active ? "true" : "false";
    this.root.style.setProperty("--ui-ime-top", `${Math.round(state.top)}px`);
    this.root.style.setProperty("--ui-ime-height", `${Math.round(state.height)}px`);
  }
}

function isEditable(element: HTMLElement): boolean {
  return element instanceof HTMLInputElement
    || element instanceof HTMLTextAreaElement
    || element instanceof HTMLSelectElement
    || element.isContentEditable;
}
