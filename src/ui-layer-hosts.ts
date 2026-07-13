import type { AppUiSnapshot, ConfirmRoute, ModalRoute, PrimaryRoute } from "./app-ui-state.js";

export class UiLayerHosts {
  readonly base: HTMLElement;
  readonly primary: HTMLElement;
  readonly modal: HTMLElement;
  readonly confirm: HTMLElement;
  readonly transient: HTMLElement;
  private transientCritical = false;

  constructor(private readonly root: HTMLElement, buildVersion: string) {
    this.base = createHost("base");
    this.primary = createHost("primary");
    this.modal = createHost("modal");
    this.confirm = createHost("confirm");
    this.transient = createHost("transient");
    this.root.replaceChildren(this.base, this.primary, this.modal, this.confirm, this.transient);
    if (buildVersion.includes("-")) {
      const badge = document.createElement("div");
      badge.className = "app-build-badge";
      badge.textContent = `v${buildVersion}`;
      badge.setAttribute("aria-hidden", "true");
      this.root.append(badge);
    }
  }

  renderBase(html: string): void {
    this.base.innerHTML = html;
  }

  renderPrimary(route: PrimaryRoute, html: string): HTMLElement {
    const surface = createSurface(route, html);
    this.primary.replaceChildren(surface);
    return surface;
  }

  clearPrimary(): void {
    this.primary.replaceChildren();
  }

  replaceModal(route: ModalRoute, html: string): HTMLElement {
    const surface = createSurface(route, html);
    this.modal.replaceChildren(surface);
    return surface;
  }

  pushModal(route: ModalRoute, html: string): HTMLElement {
    const previous = this.modal.lastElementChild as HTMLElement | null;
    if (previous) {
      setBlocked(previous, true);
    }
    const surface = createSurface(route, html);
    this.modal.append(surface);
    return surface;
  }

  closeTopModal(): void {
    this.modal.lastElementChild?.remove();
    const next = this.modal.lastElementChild as HTMLElement | null;
    if (next) {
      setBlocked(next, false);
    }
  }

  clearModals(): void {
    this.modal.replaceChildren();
  }

  renderConfirm(route: ConfirmRoute, html: string): HTMLElement {
    const surface = createSurface(route, html);
    this.confirm.replaceChildren(surface);
    return surface;
  }

  clearConfirm(): void {
    this.confirm.replaceChildren();
  }

  renderTransient(html: string, critical = false): void {
    this.transientCritical = critical;
    this.transient.innerHTML = html;
    this.transient.hidden = html.length === 0;
  }

  apply(snapshot: AppUiSnapshot): void {
    this.root.dataset.primaryRoute = snapshot.primary;
    this.root.dataset.topRoute = snapshot.topRoute;
    this.root.dataset.worldChrome = snapshot.hidesPlayChrome ? "hidden" : "visible";
    this.root.dataset.physics = snapshot.pausesPhysics ? "paused" : "running";
    this.root.dataset.editableSurface = snapshot.editableSurface ? "true" : "false";
    this.primary.dataset.imeOwner = snapshot.editableSurface && snapshot.modals.length === 0 ? "true" : "false";
    this.modal.dataset.imeOwner = snapshot.editableSurface && snapshot.modals.length > 0 ? "true" : "false";

    setCurrent(this.base.querySelector<HTMLButtonElement>("[data-cycle-ball-label-mode]"), snapshot.primary === "play");

    setBlocked(this.base, snapshot.blocksBase);
    setBlocked(this.primary, snapshot.modals.length > 0 || snapshot.confirm !== null);
    setBlocked(this.modal, snapshot.confirm !== null);
    this.primary.hidden = snapshot.primary === "play";
    this.modal.hidden = snapshot.modals.length === 0;
    this.confirm.hidden = snapshot.confirm === null;
    this.transient.hidden = this.transient.innerHTML.length === 0 || (snapshot.blocksBase && !this.transientCritical);
  }
}

function setCurrent(element: HTMLElement | null, current: boolean): void {
  if (current) {
    element?.setAttribute("aria-current", "page");
  } else {
    element?.removeAttribute("aria-current");
  }
}

function createHost(slot: string): HTMLElement {
  const host = document.createElement("div");
  host.className = `ui-layer ui-${slot}-layer`;
  host.dataset.layerSlot = slot;
  return host;
}

function createSurface(route: string, html: string): HTMLElement {
  const surface = document.createElement("div");
  surface.className = "ui-layer-surface app-interaction-surface";
  surface.dataset.route = route;
  surface.innerHTML = html;
  return surface;
}

function setBlocked(element: HTMLElement, blocked: boolean): void {
  element.inert = blocked;
  if (blocked) {
    element.setAttribute("aria-hidden", "true");
  } else {
    element.removeAttribute("aria-hidden");
  }
}
