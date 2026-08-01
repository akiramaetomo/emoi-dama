import {
  BALL_SIEVE_PRESETS,
  getBallSieveLabel,
  type BallSievePresetId,
} from "./ball-sieve.js";

export interface BallSieveUiState {
  presetId: BallSievePresetId;
  open: boolean;
}

export interface BallSieveStatusState {
  presetId: BallSievePresetId;
  feedback: string;
}

const PRESET_ORDER: readonly BallSievePresetId[] = ["usual", "archived", "offered", "descent"];

export function renderBallSieveControl(state: BallSieveUiState): string {
  const label = getBallSieveLabel(state.presetId);
  return `
    <div class="ball-sieve-control" data-ball-sieve-control>
      <button class="ball-sieve-trigger play-mode-button${state.presetId === "usual" ? "" : " is-active is-on"}" type="button" data-toggle-ball-sieve aria-label="ふるい分け：${escapeHtml(label)}" aria-expanded="${state.open}" aria-pressed="${state.presetId !== "usual"}" aria-haspopup="dialog" aria-controls="ball-sieve-popover">
        <span class="ball-sieve-trigger-icon" aria-hidden="true"></span>
      </button>
      ${renderBallSievePopover(state)}
    </div>
  `;
}

export function renderBallSieveStatus(state: BallSieveStatusState): string {
  const message = getBallSieveStatusMessage(state);
  return `<p class="ball-sieve-status" data-ball-sieve-status data-ball-sieve-status-kind="${state.feedback ? "feedback" : "selection"}" role="status" aria-live="polite"${message ? "" : " hidden"}>${escapeHtml(message)}</p>`;
}

export function getBallSieveStatusMessage(state: BallSieveStatusState): string {
  if (state.feedback) {
    return state.feedback;
  }
  return state.presetId === "usual" ? "" : `ふるい分け：${getBallSieveLabel(state.presetId)}`;
}

function renderBallSievePopover(state: BallSieveUiState): string {
  return `
    <button class="ball-sieve-backdrop" type="button" data-close-ball-sieve aria-label="ふるい分けを閉じる" tabindex="-1"${state.open ? "" : " hidden"}></button>
    <section id="ball-sieve-popover" class="ball-sieve-popover" data-ball-sieve-popover role="dialog" aria-label="玉のふるい分け"${state.open ? "" : " hidden"}>
      <header>
        <span>ふるい分け</span>
      </header>
      <div class="ball-sieve-options" role="group" aria-label="呼び出す玉">
        ${PRESET_ORDER.map((presetId) => renderPresetButton(presetId, state.presetId)).join("")}
      </div>
    </section>
  `;
}

function renderPresetButton(presetId: BallSievePresetId, selectedId: BallSievePresetId): string {
  const preset = BALL_SIEVE_PRESETS[presetId];
  return `
    <button class="ball-sieve-option sieve-option-${presetId}${presetId === selectedId ? " is-selected" : ""}" type="button" data-ball-sieve-preset="${presetId}" aria-pressed="${presetId === selectedId}">
      <span class="ball-sieve-option-visual" aria-hidden="true">${renderPresetVisual(presetId)}</span>
      <span>${escapeHtml(preset.label)}</span>
    </button>
  `;
}

function renderPresetVisual(presetId: BallSievePresetId): string {
  if (presetId === "usual") {
    return '<i class="sieve-ball sieve-ball-gold"></i><i class="sieve-ball sieve-ball-green"></i>';
  }
  if (presetId === "archived") {
    return '<i class="sieve-ball sieve-ball-archived"></i>';
  }
  if (presetId === "offered") {
    return '<i class="sieve-ball sieve-ball-offered"></i>';
  }
  return '<i class="sieve-ball sieve-ball-descent"><b>✦</b></i>';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
