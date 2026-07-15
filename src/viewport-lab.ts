import "./viewport-lab.css";

type LabMode = "current" | "candidate";
type LabRoute = "play" | "calendar" | "list";

interface LabSnapshot {
  sequence: number;
  event: string;
  timestamp: string;
  mode: LabMode;
  route: LabRoute;
  window: { scrollX: number; scrollY: number; innerWidth: number; innerHeight: number };
  document: {
    scrollTop: number;
    clientWidth: number;
    clientHeight: number;
    scrollWidth: number;
    scrollHeight: number;
    bodyTop: number;
    bodyHeight: number;
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
  rootRect: RectSnapshot;
  dockRect: RectSnapshot;
  target: string;
  owner: ScrollOwnerSnapshot | null;
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
  range: "zero" | "scrollable";
  touchAction: string;
  scrollTop: number;
  maxScrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  rect: RectSnapshot;
}

declare global {
  interface Window {
    __viewportLab?: {
      getSnapshot: () => LabSnapshot;
      getHistory: () => LabSnapshot[];
    };
  }
}

const root = requireElement<HTMLDivElement>("#viewport-lab");
const requestedMode = new URLSearchParams(window.location.search).get("mode");
const mode: LabMode = requestedMode === "current" ? "current" : "candidate";
let route: LabRoute = "calendar";
let lastTarget: Element | null = null;
let lastOwner: HTMLElement | null = null;
let pendingEvent = "install";
let sequence = 0;
let frame = 0;
const history: LabSnapshot[] = [];
const historyLimit = 3000;

document.documentElement.dataset.labMode = mode;
document.body.dataset.labMode = mode;
root.dataset.labMode = mode;
root.innerHTML = renderLab();

bindControls();
installTelemetry();
renderRoute();
scheduleCapture("install");

function renderLab(): string {
  const alternateMode: LabMode = mode === "candidate" ? "current" : "candidate";
  return `
    <main class="lab-shell" data-lab-shell>
      <section class="lab-layer lab-base-layer lab-surface" data-lab-base aria-label="Persistent Play base">
        <div class="lab-play-field" data-lab-play-zone>
          <p class="lab-kicker">PERSISTENT BASE / PLAY</p>
          <h1>Touch-action: none</h1>
          <p>この領域はPlayと同様にブラウザのパンを受け渡しません。</p>
          <div class="lab-ball" aria-hidden="true"></div>
        </div>
      </section>
      <section class="lab-layer lab-primary-layer lab-surface" data-lab-primary></section>
      <section class="lab-layer lab-modal-layer lab-surface" data-lab-modal hidden></section>

      <pre class="lab-telemetry" data-lab-telemetry aria-hidden="true"></pre>
      <output class="lab-telemetry-compact" data-lab-telemetry-compact aria-live="polite"></output>

      <div class="lab-meta-controls">
        <span class="lab-version">v${__APP_VERSION__}</span>
        <strong>${mode === "current" ? "MINIMAL CURRENT CONTROL" : "FIXED BODY + NO-PAN SUBTREE"}</strong>
        <a href="./viewport-lab.html?mode=${alternateMode}">${alternateMode}へ</a>
        <button type="button" data-download-lab-log>JSON保存</button>
      </div>

      <nav class="lab-dock" data-lab-dock aria-label="Viewport lab routes">
        <button type="button" data-lab-route="play">Play</button>
        <button type="button" data-lab-route="calendar">Calendar</button>
        <button type="button" data-lab-route="list">List</button>
        <button type="button" data-open-lab-modal>Modal</button>
      </nav>
    </main>
  `;
}

function renderRoute(): void {
  const primary = requireElement<HTMLElement>("[data-lab-primary]");
  primary.hidden = route === "play";
  primary.innerHTML = route === "calendar" ? renderCalendarSurface() : route === "list" ? renderListSurface() : "";
  document.querySelectorAll<HTMLButtonElement>("[data-lab-route]").forEach((button) => {
    if (button.dataset.labRoute === route) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
  updateOwnerScrollRanges();
  scheduleCapture(`route:${route}`);
}

function renderCalendarSurface(): string {
  return `
    <div class="lab-surface-shell">
      <header class="lab-surface-header">
        <p class="lab-kicker">PRIMARY / CALENDAR</p>
        <h1>非scroll領域とscroll量0のowner</h1>
      </header>
      <div class="lab-calendar-body lab-scroll-owner" data-scroll-owner data-lab-owner="zero">
        <section class="lab-static-zone" data-lab-static-zone>
          <strong>空白・長押し・上下スワイプ領域</strong>
          <span>候補型ではSurface外殻がno-pan、ownerだけpan-yです。</span>
        </section>
        <div class="lab-calendar-grid" aria-label="短いカレンダー">
          ${Array.from({ length: 14 }, (_, index) => `<button type="button">${index + 1}</button>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderListSurface(): string {
  return `
    <div class="lab-surface-shell">
      <header class="lab-surface-header">
        <p class="lab-kicker">PRIMARY / LIST</p>
        <h1>内部ownerだけが縦scroll</h1>
      </header>
      <div class="lab-list-body lab-scroll-owner" data-scroll-owner data-lab-owner="long">
        ${Array.from({ length: 28 }, (_, index) => `
          <article class="lab-list-item">
            <span class="lab-mini-ball" aria-hidden="true"></span>
            <div><strong>検証項目 ${index + 1}</strong><p>上端・中間・下端で上下スワイプします。</p></div>
            <button type="button">中身</button>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function openModal(): void {
  const modal = requireElement<HTMLElement>("[data-lab-modal]");
  modal.hidden = false;
  modal.innerHTML = `
    <div class="lab-modal-backdrop" data-close-lab-modal>
      <section class="lab-modal-panel" role="dialog" aria-modal="true" aria-labelledby="lab-modal-title">
        <header><p class="lab-kicker">MODAL</p><h1 id="lab-modal-title">入力とキーボード</h1></header>
        <div class="lab-modal-scroll lab-scroll-owner" data-scroll-owner data-lab-owner="modal">
          <label>タイトル<input type="text" value="Viewport lab" /></label>
          <label>メモ<textarea rows="5">キーボード開閉後に全体位置が戻るか確認します。</textarea></label>
          ${Array.from({ length: 10 }, (_, index) => `<p class="lab-modal-row">Modal scroll row ${index + 1}</p>`).join("")}
        </div>
        <button class="lab-close-modal" type="button" data-close-lab-modal-button>閉じる</button>
      </section>
    </div>
  `;
  modal.querySelector<HTMLElement>("[data-close-lab-modal]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeModal();
  });
  modal.querySelector<HTMLButtonElement>("[data-close-lab-modal-button]")?.addEventListener("click", closeModal);
  updateOwnerScrollRanges();
  scheduleCapture("modal:open");
}

function closeModal(): void {
  const modal = requireElement<HTMLElement>("[data-lab-modal]");
  modal.hidden = true;
  modal.replaceChildren();
  scheduleCapture("modal:close");
}

function bindControls(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-lab-route]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.labRoute;
      if (next === "play" || next === "calendar" || next === "list") {
        route = next;
        closeModal();
        renderRoute();
      }
    });
  });
  requireElement<HTMLButtonElement>("[data-open-lab-modal]").addEventListener("click", openModal);
  requireElement<HTMLButtonElement>("[data-download-lab-log]").addEventListener("click", downloadHistory);
}

function installTelemetry(): void {
  const handleEvent = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target && !target.closest(".lab-telemetry, .lab-telemetry-compact")) {
      lastTarget = target;
      lastOwner = target.closest<HTMLElement>("[data-scroll-owner]");
    }
    scheduleCapture(event.type);
  };
  for (const name of ["touchstart", "touchmove", "touchend", "touchcancel", "scroll", "focusin", "focusout", "contextmenu"]) {
    document.addEventListener(name, handleEvent, { capture: true, passive: true });
  }
  window.addEventListener("scroll", () => scheduleCapture("window:scroll"), { passive: true });
  window.addEventListener("resize", () => scheduleCapture("window:resize"), { passive: true });
  window.visualViewport?.addEventListener("scroll", () => scheduleCapture("visualViewport:scroll"), { passive: true });
  window.visualViewport?.addEventListener("resize", () => scheduleCapture("visualViewport:resize"), { passive: true });
  window.visualViewport?.addEventListener("scrollend", () => scheduleCapture("visualViewport:scrollend"), { passive: true });
  window.__viewportLab = {
    getSnapshot: () => captureSnapshot(pendingEvent),
    getHistory: () => history.map((entry) => structuredClone(entry)),
  };
}

function scheduleCapture(eventName: string): void {
  pendingEvent = eventName;
  if (frame !== 0) return;
  frame = window.requestAnimationFrame(() => {
    frame = 0;
    updateOwnerScrollRanges();
    const snapshot = captureSnapshot(pendingEvent);
    history.push(snapshot);
    if (history.length > historyLimit) history.splice(0, history.length - historyLimit);
    renderTelemetry(snapshot);
  });
}

function captureSnapshot(eventName: string): LabSnapshot {
  const scrollingElement = document.scrollingElement ?? document.documentElement;
  const viewport = window.visualViewport;
  const owner = lastOwner;
  return {
    sequence: ++sequence,
    event: eventName,
    timestamp: new Date().toISOString(),
    mode,
    route,
    window: {
      scrollX: round(window.scrollX), scrollY: round(window.scrollY),
      innerWidth: round(window.innerWidth), innerHeight: round(window.innerHeight),
    },
    document: {
      scrollTop: round(scrollingElement.scrollTop),
      clientWidth: round(document.documentElement.clientWidth),
      clientHeight: round(document.documentElement.clientHeight),
      scrollWidth: round(document.documentElement.scrollWidth),
      scrollHeight: round(document.documentElement.scrollHeight),
      bodyTop: captureRect(document.body).top,
      bodyHeight: captureRect(document.body).height,
    },
    visualViewport: viewport ? {
      offsetLeft: round(viewport.offsetLeft), offsetTop: round(viewport.offsetTop),
      pageLeft: round(viewport.pageLeft), pageTop: round(viewport.pageTop),
      width: round(viewport.width), height: round(viewport.height), scale: round(viewport.scale),
    } : null,
    rootRect: captureRect(root),
    dockRect: captureRect(requireElement("[data-lab-dock]")),
    target: describeElement(lastTarget),
    owner: owner ? {
      element: describeElement(owner),
      range: owner.dataset.scrollRange === "scrollable" ? "scrollable" : "zero",
      touchAction: getComputedStyle(owner).touchAction,
      scrollTop: round(owner.scrollTop),
      maxScrollTop: round(Math.max(0, owner.scrollHeight - owner.clientHeight)),
      clientHeight: round(owner.clientHeight),
      scrollHeight: round(owner.scrollHeight),
      rect: captureRect(owner),
    } : null,
  };
}

function renderTelemetry(snapshot: LabSnapshot): void {
  const vv = snapshot.visualViewport;
  const owner = snapshot.owner;
  requireElement<HTMLElement>("[data-lab-telemetry]").textContent = [
    `VIEWPORT LAB v${__APP_VERSION__} ${snapshot.mode} #${snapshot.sequence} ${snapshot.event}`,
    `route ${snapshot.route}  win ${snapshot.window.scrollX},${snapshot.window.scrollY} ${snapshot.window.innerWidth}x${snapshot.window.innerHeight}`,
    `doc top ${snapshot.document.scrollTop} client ${snapshot.document.clientWidth}x${snapshot.document.clientHeight} scroll ${snapshot.document.scrollWidth}x${snapshot.document.scrollHeight}`,
    `body top/h ${snapshot.document.bodyTop}/${snapshot.document.bodyHeight}`,
    vv ? `vv off ${vv.offsetLeft},${vv.offsetTop} page ${vv.pageLeft},${vv.pageTop} ${vv.width}x${vv.height} @${vv.scale}` : "vv unavailable",
    `root ${formatRect(snapshot.rootRect)}`,
    `dock ${formatRect(snapshot.dockRect)}`,
    `target ${snapshot.target}`,
    owner ? `owner ${owner.element} ${owner.range}/${owner.touchAction} top ${owner.scrollTop}/${owner.maxScrollTop} h ${owner.clientHeight}/${owner.scrollHeight} ${formatRect(owner.rect)}` : "owner none",
  ].join("\n");
  requireElement<HTMLOutputElement>("[data-lab-telemetry-compact]").textContent =
    `winY ${snapshot.window.scrollY} / vvY ${vv?.offsetTop ?? "-"} / pageY ${vv?.pageTop ?? "-"} / rootT ${snapshot.rootRect.top} / dockB ${snapshot.dockRect.bottom}`;
}

function updateOwnerScrollRanges(): void {
  document.querySelectorAll<HTMLElement>("[data-scroll-owner]").forEach((owner) => {
    owner.dataset.scrollRange = owner.scrollHeight - owner.clientHeight > 1 ? "scrollable" : "zero";
  });
}

function downloadHistory(): void {
  const blob = new Blob([JSON.stringify({ version: __APP_VERSION__, mode, historyLimit, history }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `viewport-lab-${mode}-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function captureRect(element: Element): RectSnapshot {
  const rect = element.getBoundingClientRect();
  return {
    left: round(rect.left), top: round(rect.top), right: round(rect.right), bottom: round(rect.bottom),
    width: round(rect.width), height: round(rect.height),
  };
}

function formatRect(rect: RectSnapshot): string {
  return `l${rect.left} t${rect.top} r${rect.right} b${rect.bottom} ${rect.width}x${rect.height}`;
}

function describeElement(element: Element | null): string {
  if (!element) return "none";
  const id = element.id ? `#${element.id}` : "";
  const classes = [...element.classList].slice(0, 3).map((name) => `.${name}`).join("");
  return `${element.tagName.toLowerCase()}${id}${classes}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function requireElement<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Viewport lab element not found: ${selector}`);
  return element;
}
