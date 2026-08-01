import { renderBallSieveControl, renderBallSieveStatus } from "./ball-sieve-ui.js";

const closed = renderBallSieveControl({ presetId: "usual", open: false });
assert(closed.includes('aria-label="ふるい分け：いつもの玉"'), "icon control should expose the current preset accessibly");
assert(closed.includes('aria-expanded="false"'), "closed control should expose state");
assert(closed.includes('aria-pressed="false"'), "usual preset should leave the sieve button unlit");
assert(closed.includes('class="ball-sieve-trigger play-mode-button"'), "usual preset should reuse the unlit Jutsu button treatment");
assert(closed.includes('aria-controls="ball-sieve-popover"'), "trigger should identify its controlled popover");
assert(closed.includes("data-ball-sieve-popover") && closed.includes('aria-label="玉のふるい分け" hidden'), "closed control should keep a hidden popover ready without rebuilding Play");
assert(!closed.includes("ball-sieve-feedback"), "control should not contain a layout-changing feedback row");

const open = renderBallSieveControl({ presetId: "offered", open: true });
assert(open.includes('data-ball-sieve-popover'), "open control should render a lightweight popover");
assert(count(open, "data-ball-sieve-preset=") === 4, "popover should render the four approved presets");
assert(open.includes('data-ball-sieve-preset="offered" aria-pressed="true"'), "current preset should be pressed");
assert(open.includes('data-toggle-ball-sieve aria-label="ふるい分け：供養済み"') && open.includes('aria-pressed="true"'), "non-usual preset should light the icon button");
assert(open.includes('class="ball-sieve-trigger play-mode-button is-active is-on"'), "non-usual preset should reuse the active Jutsu glow");
assert(open.includes("ball-sieve-option-visual"), "options should include ball visuals instead of text alone");
assert(!open.includes("いま会いたい玉を呼びます"), "popover should omit the redundant explanatory subtitle");

const usualStatus = renderBallSieveStatus({ presetId: "usual", feedback: "" });
assert(usualStatus.includes(" hidden"), "usual preset should not render a visible text label");
assert(!usualStatus.includes(">いつもの玉<"), "usual preset should not expose a redundant visible label");

const descentStatus = renderBallSieveStatus({ presetId: "descent", feedback: "" });
assert(descentStatus.includes("ふるい分け：降臨"), "non-usual preset should render inside-field status text");

const restoreStatus = renderBallSieveStatus({ presetId: "offered", feedback: "いつもの玉へ戻しました。" });
assert(restoreStatus.includes("いつもの玉へ戻しました。"), "completion feedback should temporarily replace selection status");
assert(restoreStatus.includes('data-ball-sieve-status-kind="feedback"'), "completion feedback should expose its status kind");

function count(value: string, search: string): number {
  return value.split(search).length - 1;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
