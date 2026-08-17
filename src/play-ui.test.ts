import {
  isPlayJutsuActive,
  nextPlayDisplayMode,
  renderPlayDisplayModeName,
  renderPlayDisplayRangeLabel,
  renderPlayPopulationStatus,
  renderPlaySurface,
} from "./play-ui.js";
import { createInitialPlayJutsuState } from "./play-jutsu-state.js";
import "./tamawari.test.js";

assertEqual(renderPlayDisplayRangeLabel("day", "2026-07-27"), "2026-07-27", "day label should use the anchor date");
assertEqual(renderPlayDisplayRangeLabel("week", "2026-07-27"), "2026-07-26 – 08-01", "week label should use the inclusive range");
assertEqual(renderPlayDisplayRangeLabel("month", "2026-07-27"), "2026-07", "month label should use year and month");
assertEqual(renderPlayDisplayModeName("week"), "週", "week mode should keep its Japanese accessibility name");
assertEqual(nextPlayDisplayMode("day"), "week", "day should cycle to week");
assertEqual(nextPlayDisplayMode("week"), "month", "week should cycle to month");
assertEqual(nextPlayDisplayMode("month"), "day", "month should cycle to day");

assertEqual(renderPlayPopulationStatus(120, 120, false), "", "normal populations should omit status text");
assertIncludes(renderPlayPopulationStatus(120, 160, true), "表示中 120 / 全160玉", "limited populations should describe both counts");

const initialJutsu = createInitialPlayJutsuState();
assertEqual(isPlayJutsuActive(initialJutsu), false, "the initial Jutsu state should be inactive");
assertEqual(isPlayJutsuActive({ ...initialJutsu, gravityMode: "fixed-down" }), true, "fixed gravity should activate Jutsu styling");

const html = renderPlaySurface({
  ballLabelMode: "title",
  backgroundTexture: "grid",
  displayMode: "week",
  displayAnchorDate: "2026-07-27",
  stageTitle: "<確認>",
  workspaceScreenNameHtml: '<button data-cycle-workspace>Emotion Play</button>',
  gravityDebugHtml: "",
  populationStatusHtml: renderPlayPopulationStatus(120, 160, true),
  developmentDiagnostics: true,
  jutsuState: initialJutsu,
  controlsOpen: false,
  jutsuFeedback: "<待機>",
  worldDisclosureOpen: true,
  parentDisclosureOpen: false,
  ballSieve: { presetId: "usual", open: false },
  ballSieveFeedback: "",
  sieveTransitioning: false,
  devicePlayMode: "normal",
  tamawariPhase: "ready",
  tamawariTreasureTitles: [],
  tamawariTargetCount: 0,
  tamawariCanStart: false,
  tamawariFeedback: "",
});
assertIncludes(html, "2026-07-26 – 08-01", "the Play surface should render the explicit period input");
assertIncludes(html, "label-mode-title", "the Play surface should render the explicit label mode");
assertIncludes(html, "&lt;確認&gt;", "the Play title should be escaped");
assertIncludes(html, "&lt;待機&gt;", "Jutsu feedback should be escaped");
assertIncludes(html, 'data-play-mode-disclosure="world" open', "the explicit world disclosure state should render open");
assertIncludes(html, "data-fragmentation-status", "development diagnostics should render only when requested");

const tamawariReadyContext = {
  ...{
    ballLabelMode: "none" as const,
    backgroundTexture: "grid" as const,
    displayMode: "day" as const,
    displayAnchorDate: "2026-07-27",
    stageTitle: "玉割：お宝を探そう",
    workspaceScreenNameHtml: '<button data-cycle-workspace>Emotion Play</button>',
    gravityDebugHtml: "",
    populationStatusHtml: "",
    developmentDiagnostics: false,
    jutsuState: initialJutsu,
    controlsOpen: true,
    jutsuFeedback: "",
    worldDisclosureOpen: false,
    parentDisclosureOpen: false,
    ballSieve: { presetId: "usual" as const, open: false },
    ballSieveFeedback: "",
    sieveTransitioning: false,
  },
  devicePlayMode: "tamawari",
  tamawariPhase: "ready",
  tamawariTreasureTitles: ["🎂", "👑"],
  tamawariTargetCount: 12,
  tamawariCanStart: true,
  tamawariFeedback: "準備完了",
} satisfies import("./play-ui.js").PlayUiRenderContext;
const tamawariHtml = renderPlaySurface(tamawariReadyContext);
assertIncludes(tamawariHtml, ">玉割</button>", "Tamawari mode should replace the Jutsu button");
assertIncludes(tamawariHtml, 'class="play-mode-button is-tamawari-mode"', "Tamawari preparation should not glow as active");
assertIncludes(tamawariHtml, 'aria-pressed="false"', "Tamawari preparation should not report an active round");
assertIncludes(tamawariHtml, "🎂", "Tamawari preparation should show treasure examples");
assertIncludes(tamawariHtml, "対象 12 個", "Tamawari preparation should show the target count");
assertIncludes(tamawariHtml, "data-start-tamawari", "Tamawari preparation should offer Start");

const tamawariPlayingHtml = renderPlaySurface({ ...tamawariReadyContext, tamawariPhase: "playing" });
assertIncludes(tamawariPlayingHtml, 'class="play-mode-button is-tamawari-mode is-on"', "Tamawari play should reuse the active Jutsu glow");
assertIncludes(tamawariPlayingHtml, 'aria-pressed="true"', "Tamawari play should expose its active state");

console.log("play UI tests passed");

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertIncludes(actual: string, expected: string, message: string): void {
  if (!actual.includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(actual)} to include ${JSON.stringify(expected)}`);
  }
}
