import { SurfaceInteractionController, shouldBlockSurfacePan } from "./surface-interaction-controller.js";

assert(!shouldBlockSurfacePan({ deltaX: 3, deltaY: 4, hasScrollOwner: false, scrollTop: 0, scrollHeight: 0, clientHeight: 0 }), "tap jitter must not cancel a click");
assert(shouldBlockSurfacePan({ deltaX: 20, deltaY: 3, hasScrollOwner: true, scrollTop: 50, scrollHeight: 500, clientHeight: 200 }), "horizontal surface pans should be blocked");
assert(shouldBlockSurfacePan({ deltaX: 1, deltaY: -30, hasScrollOwner: false, scrollTop: 0, scrollHeight: 0, clientHeight: 0 }), "vertical pans without an owner should be blocked");
assert(shouldBlockSurfacePan({ deltaX: 1, deltaY: 30, hasScrollOwner: true, scrollTop: 0, scrollHeight: 200, clientHeight: 200 }), "zero-range owners should not leak upward pans");
assert(shouldBlockSurfacePan({ deltaX: 1, deltaY: -30, hasScrollOwner: true, scrollTop: 0, scrollHeight: 200, clientHeight: 200 }), "zero-range owners should not leak downward pans");
assert(!shouldBlockSurfacePan({ deltaX: 2, deltaY: -30, hasScrollOwner: true, scrollTop: 50, scrollHeight: 500, clientHeight: 200 }), "internal vertical scroll should remain available");
assert(shouldBlockSurfacePan({ deltaX: 1, deltaY: 30, hasScrollOwner: true, scrollTop: 0, scrollHeight: 500, clientHeight: 200 }), "top overscroll should not chain to lower layers");
assert(!shouldBlockSurfacePan({ deltaX: 1, deltaY: -30, hasScrollOwner: true, scrollTop: 0, scrollHeight: 500, clientHeight: 200 }), "the top of an owner should still allow inward scrolling");
assert(shouldBlockSurfacePan({ deltaX: 1, deltaY: -30, hasScrollOwner: true, scrollTop: 300, scrollHeight: 500, clientHeight: 200 }), "bottom overscroll should not chain to lower layers");
assert(!shouldBlockSurfacePan({ deltaX: 1, deltaY: 30, hasScrollOwner: true, scrollTop: 300, scrollHeight: 500, clientHeight: 200 }), "the bottom of an owner should still allow inward scrolling");

class FakeElement {
  constructor(
    private readonly editable = false,
    private readonly interactionSurface = false,
    private readonly owner: HTMLElement | null = null,
    private readonly horizontalDragControl = false,
  ) {}

  closest(selectors: string): Element | null {
    if (selectors === "[data-scroll-owner]") {
      return this.owner;
    }
    if (selectors === "input[type='range'], [data-horizontal-drag-control]") {
      return this.horizontalDragControl ? this as unknown as Element : null;
    }
    if (selectors.startsWith("input, textarea")) {
      return this.editable ? this as unknown as Element : null;
    }
    if (selectors === ".app-interaction-surface, .world-actions") {
      return this.interactionSurface ? this as unknown as Element : null;
    }
    return null;
  }
}

(globalThis as unknown as { Element: typeof Element }).Element = FakeElement as unknown as typeof Element;

const listeners = new Map<string, (event: Event) => void>();
const fakeRoot = {
  addEventListener: (name: string, listener: EventListenerOrEventListenerObject) => {
    if (typeof listener === "function") {
      listeners.set(name, listener);
    }
  },
} as unknown as HTMLElement;
const controller = new SurfaceInteractionController(fakeRoot, () => true);
controller.install();

let prevented = false;
listener("selectstart")({
  target: new FakeElement(true, true),
  preventDefault: () => { prevented = true; },
} as unknown as Event);
assert(!prevented, "editable elements should retain native selection");

listener("selectstart")({
  target: new FakeElement(false, true),
  preventDefault: () => { prevented = true; },
} as unknown as Event);
assert(prevented, "non-editable interaction surfaces should suppress selection");

prevented = false;
listener("touchmove")({
  target: new FakeElement(),
  touches: [{ clientX: 0, clientY: 0 }, { clientX: 10, clientY: 10 }],
  preventDefault: () => { prevented = true; },
} as unknown as Event);
assert(prevented, "multi-touch gestures should be blocked on an active surface");

listener("touchstart")({
  target: new FakeElement(),
  touches: [{ clientX: 20, clientY: 20 }],
} as unknown as Event);
listener("touchcancel")({} as Event);
prevented = false;
listener("touchmove")({
  target: new FakeElement(),
  touches: [{ clientX: 20, clientY: 60 }],
  preventDefault: () => { prevented = true; },
} as unknown as Event);
assert(!prevented, "touchcancel should clear the active gesture state");

listener("touchstart")({
  target: new FakeElement(false, true, null, true),
  touches: [{ clientX: 20, clientY: 20 }],
} as unknown as Event);
prevented = false;
listener("touchmove")({
  target: new FakeElement(false, true, null, true),
  touches: [{ clientX: 80, clientY: 22 }],
  preventDefault: () => { prevented = true; },
} as unknown as Event);
assert(!prevented, "horizontal drag controls should bypass one-finger surface pan suppression");

listener("touchstart")({
  target: new FakeElement(false, true, null, true),
  touches: [{ clientX: 20, clientY: 20 }],
} as unknown as Event);
prevented = false;
listener("touchmove")({
  target: new FakeElement(false, true, null, true),
  touches: [{ clientX: 22, clientY: 80 }],
  preventDefault: () => { prevented = true; },
} as unknown as Event);
assert(prevented, "vertical movement from a horizontal drag control should retain surface pan suppression");

listener("touchstart")({
  target: new FakeElement(false, true),
  touches: [{ clientX: 20, clientY: 20 }],
} as unknown as Event);
prevented = false;
listener("touchmove")({
  target: new FakeElement(false, true),
  touches: [{ clientX: 80, clientY: 22 }],
  preventDefault: () => { prevented = true; },
} as unknown as Event);
assert(prevented, "ordinary horizontal surface pan should remain suppressed");

function listener(name: string): (event: Event) => void {
  const registered = listeners.get(name);
  if (!registered) {
    throw new Error(`missing ${name} listener`);
  }
  return registered;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
