import "./style.css";
import "./ball-color-lab.css";
import { categoryColorPresets } from "./categories.js";
import {
  BALL_COLOR_LAB_STORAGE_KEY,
  BALL_COLOR_LAB_DRAFT_VERSION,
  BALL_COLOR_LAB_DIFF_VERSION,
  canRedoAllBallColorLab,
  canRedoSelectedBallColorLab,
  canUndoAllBallColorLab,
  canUndoSelectedBallColorLab,
  commitBallColorLabWorkingValues,
  createBallColorLabChanges,
  createBallColorLabDiffJson,
  createBallColorLabHistoryState,
  createBallColorLabTypeScript,
  discardAllBallColorLabWorkingValues,
  discardBallColorLabWorkingValue,
  getCommittedBallColorLabValues,
  getDirtyBallColorLabIndexes,
  normalizeBallColorLabDraft,
  redoAllBallColorLab,
  redoSelectedBallColorLab,
  resetAllBallColorLabWorkingValues,
  resetBallColorLabWorkingValue,
  serializeBallColorLabDraft,
  undoAllBallColorLab,
  undoSelectedBallColorLab,
  updateBallColorLabWorkingValue,
  type BallColorLabHistoryState,
  type BallColorLabValue,
} from "./ball-color-lab-model.js";
import type { BallRenderSnapshot, VisualBallSource } from "./ball-stage-renderer.js";
import { PixiBallStageRenderer } from "./pixi-ball-stage-renderer.js";
import { resolveMotionClass } from "./play-physics-classification.js";
import { DEFAULT_APP_SETTINGS } from "./settings.js";

const root = requireElement<HTMLDivElement>("#ball-color-lab");

if (!import.meta.env.DEV) {
  root.innerHTML = `<main class="ball-color-lab-unavailable"><h1>玉色ラボは開発環境専用です</h1></main>`;
} else {
  initializeBallColorLab();
}

function initializeBallColorLab(): void {
  let history = loadDraft();
  let selectedIndex = 0;
  let renderFrame = 0;
  let feedbackTimer = 0;

  root.innerHTML = renderLabShell();
  const renderField = requireElement<HTMLDivElement>("[data-ball-color-render-field]");
  const grid = requireElement<HTMLDivElement>("[data-ball-color-grid]");
  const feedback = requireElement<HTMLOutputElement>("[data-ball-color-feedback]");
  const help = requireElement<HTMLElement>("[data-ball-color-help]");
  const renderer = new PixiBallStageRenderer(renderField, {
    ...DEFAULT_APP_SETTINGS,
    soundEnabled: false,
    ballLabelMode: "none",
    emotionEchoStrength: "off",
    backgroundTexture: "grid",
  }, {
    densityMode: "normal",
    appearanceProfile: "faithful",
    onFault: (error) => {
      root.dataset.rendererStatus = "fault";
      const message = error instanceof Error ? error.message : String(error);
      requireElement<HTMLElement>("[data-ball-color-renderer-error]").textContent = `Pixi描画を開始できませんでした: ${message}`;
    },
  });

  root.dataset.rendererStatus = "loading";
  renderState();
  bindEvents();
  schedulePixiRender();

  const resizeObserver = new ResizeObserver(schedulePixiRender);
  resizeObserver.observe(grid);
  window.addEventListener("pagehide", () => {
    resizeObserver.disconnect();
    renderer.destroy();
  }, { once: true });

  function renderLabShell(): string {
    return `
      <main class="stage ball-color-lab-shell" data-ball-color-lab>
        <header class="ball-color-lab-header">
          <div><p>DEVELOPMENT ONLY</p><h1>玉色ラボ</h1></div>
          <div class="ball-color-lab-header-tools">
            <span>app ${escapeHtml(__APP_VERSION__)}・draft v${BALL_COLOR_LAB_DRAFT_VERSION}・24玉</span>
            <button type="button" data-open-help aria-label="玉色ラボのヘルプを開く">?</button>
          </div>
        </header>
        <div class="ball-color-lab-workspace">
          <section class="ball-color-lab-preview" aria-label="24玉の色比較">
            <div class="ball-field texture-grid ball-color-lab-render-field" data-ball-color-render-field></div>
            <div class="ball-color-lab-grid" data-ball-color-grid>
              ${categoryColorPresets.map((preset, index) => `
                <button type="button" class="ball-color-lab-cell" data-ball-color-index="${index}" aria-label="${escapeHtml(preset.name)}を調整">
                  <span class="ball-color-lab-anchor" data-ball-color-anchor aria-hidden="true"></span>
                  <span class="ball-color-lab-dirty-mark" aria-hidden="true">未</span>
                  <span class="ball-color-lab-cell-meta"><strong>${escapeHtml(preset.name)}</strong><small data-ball-color-cell-value></small></span>
                </button>
              `).join("")}
            </div>
            <p class="ball-color-lab-renderer-error" data-ball-color-renderer-error role="alert"></p>
          </section>
          <aside class="ball-color-lab-editor" aria-label="選択した玉の色調整">
            <div class="ball-color-lab-selection">
              <div><small data-ball-color-tone></small><h2 data-ball-color-name></h2></div>
              <output data-ball-color-change-count></output>
            </div>
            <div class="ball-color-lab-controls">
              ${renderChannelControl("hue", "H", 359)}
              ${renderChannelControl("saturation", "S", 100)}
              ${renderChannelControl("lightness", "L", 100)}
            </div>
            <div class="ball-color-lab-actions" aria-label="仮確定と履歴">
              <button type="button" class="primary" data-commit-selected>この玉を仮確定</button>
              <button type="button" class="primary" data-commit-all>未確定を全体確定</button>
              <button type="button" data-discard-selected>この玉の未確定を破棄</button>
              <button type="button" data-discard-all>未確定を全体破棄</button>
              <button type="button" data-undo-selected>この玉 Undo</button>
              <button type="button" data-redo-selected>この玉 redo</button>
              <button type="button" data-undo-all>全体 Undo</button>
              <button type="button" data-redo-all>全体 redo</button>
              <button type="button" data-reset-selected>この玉を初期色へ</button>
              <button type="button" data-reset-all>全体を初期色へ</button>
            </div>
            <div class="ball-color-lab-copy-actions">
              <button type="button" data-copy-json>JSON差分をコピー</button>
              <button type="button" data-download-json>JSONファイル保存</button>
              <button type="button" data-copy-typescript>TypeScript全配列</button>
            </div>
            <output class="ball-color-lab-feedback" data-ball-color-feedback aria-live="polite"></output>
          </aside>
        </div>
      </main>
      <section class="ball-color-lab-help" data-ball-color-help hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="ball-color-lab-help-title">
        <div class="ball-color-lab-help-panel">
          <header><h2 id="ball-color-lab-help-title">玉色ラボ ヘルプ</h2><button type="button" data-close-help aria-label="ヘルプを閉じる">×</button></header>
          <div class="ball-color-lab-help-content">
            <h3>基本の流れ</h3>
            <ol><li>玉を選び、H/S/Lを調整します。</li><li>「この玉を仮確定」または「未確定を全体確定」で履歴にします。</li><li>必要なら玉単位／全体のUndo・redoで比較します。</li><li>未確定をなくしてからJSON差分をコピーまたは保存します。</li></ol>
            <h3>表示の凡例</h3>
            <p><span class="legend-frame"></span>外周枠＝選択中　<span class="legend-changed"></span>丸印＝初期値との差　<span class="legend-dirty">未</span>＝未確定</p>
            <h3>えもい玉app開発（Codex）へ渡す</h3>
            <p><strong>before/afterを持つJSON差分が推奨です。</strong>保存しただけではCodexは自動認識しません。次のいずれかで渡してください。</p>
            <ul><li>JSONをチャットへ貼り「この差分を categories.ts へ反映」と依頼する。</li><li>保存したJSONファイルをチャットへ添付する。</li><li><code>docs/user_data/ball-color-lab/</code>などへ置き、正確なファイルパスを伝える。</li></ul>
            <p>TypeScript全配列は、<code>categories.ts</code>の直接置換や完全比較用です。通常の変更依頼には変更箇所が明確なJSON差分を推奨します。</p>
            <h3>安全境界</h3>
            <p>履歴と下書きはこのタブ専用のsessionStorageだけに保存します。通常データとlocalStorageには触れず、本番ビルドにも含まれません。</p>
            <h3>管理情報</h3>
            <p>このラボはえもい玉app ${escapeHtml(__APP_VERSION__)} と同じリポジトリで管理します。下書きschemaはv${BALL_COLOR_LAB_DRAFT_VERSION}、受け渡しJSONはv${BALL_COLOR_LAB_DIFF_VERSION}です。保守場所と更新手順は <code>docs/workflow/ball-color-lab.md</code> を参照してください。</p>
          </div>
        </div>
      </section>
    `;
  }

  function renderChannelControl(channel: keyof BallColorLabValue, label: string, max: number): string {
    return `<div class="ball-color-lab-control" data-ball-color-control="${channel}">
      <label for="ball-color-${channel}">${label}</label>
      <button type="button" data-step="-1" aria-label="${label}を1下げる">−1</button>
      <input id="ball-color-${channel}" type="range" min="0" max="${max}" step="1" data-channel-range="${channel}" />
      <input type="number" min="0" max="${max}" step="1" inputmode="numeric" data-channel-number="${channel}" aria-label="${label}の数値" />
      <button type="button" data-step="1" aria-label="${label}を1上げる">＋1</button>
    </div>`;
  }

  function bindEvents(): void {
    grid.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-ball-color-index]") : null;
      const index = Number(button?.dataset.ballColorIndex);
      if (!button || !Number.isInteger(index) || index < 0 || index >= categoryColorPresets.length) return;
      selectedIndex = index;
      renderState();
    });
    root.querySelectorAll<HTMLInputElement>("[data-channel-range], [data-channel-number]").forEach((input) => {
      input.addEventListener("input", () => {
        const channel = readChannel(input.dataset.channelRange ?? input.dataset.channelNumber);
        if (!channel || input.value.trim() === "") return;
        applyValue(channel, Number(input.value));
      });
      input.addEventListener("change", renderState);
    });
    root.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((button) => {
      button.addEventListener("click", () => {
        const channel = readChannel(button.closest<HTMLElement>("[data-ball-color-control]")?.dataset.ballColorControl);
        if (channel) applyValue(channel, history.workingValues[selectedIndex][channel] + Number(button.dataset.step));
      });
    });

    bindAction("[data-commit-selected]", () => {
      history = commitBallColorLabWorkingValues(history, categoryColorPresets, "single", selectedIndex);
      finishStateChange("この玉の未確定値を仮確定しました。", false);
    });
    bindAction("[data-commit-all]", () => {
      history = commitBallColorLabWorkingValues(history, categoryColorPresets, "all", selectedIndex);
      finishStateChange("未確定値を1件の全体履歴として仮確定しました。", false);
    });
    bindAction("[data-discard-selected]", () => {
      history = discardBallColorLabWorkingValue(history, selectedIndex);
      finishStateChange("この玉の未確定値を破棄しました。", true);
    });
    bindAction("[data-discard-all]", () => {
      history = discardAllBallColorLabWorkingValues(history);
      finishStateChange("全ての未確定値を破棄しました。", true);
    });
    bindAction("[data-undo-selected]", () => {
      history = undoSelectedBallColorLab(history, selectedIndex);
      finishStateChange("この玉の直近の仮確定をUndoしました。", true);
    });
    bindAction("[data-redo-selected]", () => {
      history = redoSelectedBallColorLab(history, selectedIndex);
      finishStateChange("この玉の仮確定をredoしました。", true);
    });
    bindAction("[data-undo-all]", () => {
      history = undoAllBallColorLab(history);
      finishStateChange("直近の仮確定トランザクションをUndoしました。", true);
    });
    bindAction("[data-redo-all]", () => {
      history = redoAllBallColorLab(history);
      finishStateChange("直近の全体Undoをredoしました。", true);
    });
    bindAction("[data-reset-selected]", () => {
      history = resetBallColorLabWorkingValue(history, categoryColorPresets, selectedIndex);
      finishStateChange("この玉を初期色へ変更しました（未確定）。", true);
    });
    bindAction("[data-reset-all]", () => {
      history = resetAllBallColorLabWorkingValues(history, categoryColorPresets);
      finishStateChange("全24玉を初期色へ変更しました（未確定）。", true);
    });
    bindAction("[data-copy-json]", () => void outputCommitted("json-copy"));
    bindAction("[data-download-json]", () => void outputCommitted("json-download"));
    bindAction("[data-copy-typescript]", () => void outputCommitted("typescript-copy"));

    requireElement<HTMLButtonElement>("[data-open-help]").addEventListener("click", openHelp);
    requireElement<HTMLButtonElement>("[data-close-help]").addEventListener("click", closeHelp);
    help.addEventListener("click", (event) => { if (event.target === help) closeHelp(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !help.hidden) closeHelp(); });
  }

  function bindAction(selector: string, action: () => void): void {
    requireElement<HTMLButtonElement>(selector).addEventListener("click", action);
  }

  function applyValue(channel: keyof BallColorLabValue, nextValue: number): void {
    history = updateBallColorLabWorkingValue(history, selectedIndex, channel, nextValue);
    persistDraft();
    renderState();
    schedulePixiRender();
  }

  function finishStateChange(message: string, redraw: boolean): void {
    persistDraft();
    renderState();
    if (redraw) schedulePixiRender();
    showFeedback(message);
  }

  function persistDraft(): void {
    try {
      sessionStorage.setItem(BALL_COLOR_LAB_STORAGE_KEY, serializeBallColorLabDraft(history, categoryColorPresets));
    } catch {
      showFeedback("ラボ専用sessionStorageへ保存できませんでした。");
    }
  }

  function renderState(): void {
    const working = history.workingValues;
    const changed = new Set(createBallColorLabChanges(working, categoryColorPresets).map((change) => change.index));
    const dirtyIndexes = getDirtyBallColorLabIndexes(history);
    const dirty = new Set(dirtyIndexes);
    grid.querySelectorAll<HTMLButtonElement>("[data-ball-color-index]").forEach((cell) => {
      const index = Number(cell.dataset.ballColorIndex);
      const preset = categoryColorPresets[index];
      const value = working[index];
      if (!preset || !value) return;
      cell.classList.toggle("is-selected", index === selectedIndex);
      cell.classList.toggle("is-changed", changed.has(index));
      cell.classList.toggle("is-dirty", dirty.has(index));
      cell.setAttribute("aria-pressed", String(index === selectedIndex));
      cell.dataset.hue = String(value.hue);
      cell.dataset.saturation = String(value.saturation);
      cell.dataset.lightness = String(value.lightness);
      requireElement<HTMLElement>("[data-ball-color-cell-value]", cell).textContent = `${preset.visualKind === "ring" ? "RING" : "BALL"} · ${value.hue}/${value.saturation}/${value.lightness}`;
    });
    requireElement<HTMLOutputElement>("[data-ball-color-change-count]").textContent = `差 ${changed.size}・未確定 ${dirty.size}`;
    const selectedDirty = dirty.has(selectedIndex);
    setDisabled("[data-commit-selected]", !selectedDirty);
    setDisabled("[data-discard-selected]", !selectedDirty);
    setDisabled("[data-commit-all]", dirty.size === 0);
    setDisabled("[data-discard-all]", dirty.size === 0);
    setDisabled("[data-undo-selected]", !canUndoSelectedBallColorLab(history, selectedIndex));
    setDisabled("[data-redo-selected]", !canRedoSelectedBallColorLab(history, selectedIndex));
    setDisabled("[data-undo-all]", !canUndoAllBallColorLab(history));
    setDisabled("[data-redo-all]", !canRedoAllBallColorLab(history));
    for (const selector of ["[data-copy-json]", "[data-download-json]", "[data-copy-typescript]"]) setDisabled(selector, dirty.size > 0);
    syncEditor();
  }

  function setDisabled(selector: string, disabled: boolean): void {
    const button = requireElement<HTMLButtonElement>(selector);
    button.disabled = disabled;
    if (disabled && selector.includes("copy") || disabled && selector.includes("download")) {
      button.title = "未確定値を仮確定または破棄してください";
    } else {
      button.removeAttribute("title");
    }
  }

  function syncEditor(): void {
    const preset = categoryColorPresets[selectedIndex];
    const value = history.workingValues[selectedIndex];
    requireElement<HTMLElement>("[data-ball-color-name]").textContent = preset.name;
    requireElement<HTMLElement>("[data-ball-color-tone]").textContent = `${preset.tone} / ${preset.visualKind}`;
    for (const channel of ["hue", "saturation", "lightness"] as const) {
      requireElement<HTMLInputElement>(`[data-channel-range="${channel}"]`).value = String(value[channel]);
      requireElement<HTMLInputElement>(`[data-channel-number="${channel}"]`).value = String(value[channel]);
    }
  }

  async function outputCommitted(kind: "json-copy" | "json-download" | "typescript-copy"): Promise<void> {
    if (getDirtyBallColorLabIndexes(history).length > 0) {
      showFeedback("未確定値を仮確定または破棄してから出力してください。");
      return;
    }
    const committed = getCommittedBallColorLabValues(history);
    if (kind === "json-download") {
      downloadText(createBallColorLabDiffJson(committed, categoryColorPresets), createDownloadFilename(), "application/json");
      showFeedback("JSON差分ファイルを保存しました。Codexへは添付・貼付・パス指定が必要です。");
      return;
    }
    const text = kind === "json-copy"
      ? createBallColorLabDiffJson(committed, categoryColorPresets)
      : createBallColorLabTypeScript(committed, categoryColorPresets);
    await copyText(text, kind === "json-copy" ? "JSON差分をコピーしました。" : "TypeScript全配列をコピーしました。");
  }

  function schedulePixiRender(): void {
    if (renderFrame !== 0) return;
    renderFrame = window.requestAnimationFrame(() => {
      renderFrame = 0;
      const cells = [...grid.querySelectorAll<HTMLElement>("[data-ball-color-index]")];
      const fieldRect = renderField.getBoundingClientRect();
      if (fieldRect.width <= 0 || fieldRect.height <= 0 || cells.length !== categoryColorPresets.length) return;
      const firstCellRect = cells[0].getBoundingClientRect();
      const radius = Math.max(18, Math.min(42, firstCellRect.width * 0.28, firstCellRect.height * 0.31));
      const sources = createVisualSources(radius);
      const snapshots = cells.map((cell, index): BallRenderSnapshot => {
        const anchorRect = requireElement<HTMLElement>("[data-ball-color-anchor]", cell).getBoundingClientRect();
        return { id: sources[index].id, x: anchorRect.left - fieldRect.left + anchorRect.width / 2, y: anchorRect.top - fieldRect.top + anchorRect.height / 2, rotation: 0, angularVelocity: 0, radius };
      });
      renderer.mount(sources, radius);
      renderer.update(snapshots);
      if (renderField.dataset.ballRenderer === "pixi") root.dataset.rendererStatus = "ready";
      else window.setTimeout(schedulePixiRender, 40);
    });
  }

  function createVisualSources(radius: number): VisualBallSource[] {
    return categoryColorPresets.map((preset, index) => ({
      id: `ball-color-lab-${index}`, ballId: `ball-color-lab-${index}`, fragmentIndex: 0,
      baseInstanceId: `ball-color-lab-${index}`, fragmentGeneration: 0, fragmentOrdinal: 0, radius,
      motionClass: resolveMotionClass(preset.tone, preset.visualKind), ...history.workingValues[index],
      visualKind: preset.visualKind, lifecycleStatus: "active", descentBadgeCount: 0, isKamiBall: false,
      echo: null, snapshot: null, label: "", labelClass: "label-short", labelIsSingleGrapheme: false,
      forceLabel: false, revealEffect: "none", concealTitle: false, title: preset.name,
    }));
  }

  function openHelp(): void {
    help.hidden = false;
    help.setAttribute("aria-hidden", "false");
    requireElement<HTMLButtonElement>("[data-close-help]").focus();
  }

  function closeHelp(): void {
    help.hidden = true;
    help.setAttribute("aria-hidden", "true");
    requireElement<HTMLButtonElement>("[data-open-help]").focus();
  }

  async function copyText(text: string, successMessage: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      showFeedback(successMessage);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.className = "ball-color-lab-copy-fallback";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      showFeedback(copied ? successMessage : "コピーできませんでした。");
    }
  }

  function showFeedback(message: string): void {
    feedback.textContent = message;
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => { feedback.textContent = ""; }, 3200);
  }
}

function loadDraft(): BallColorLabHistoryState {
  try {
    const stored = sessionStorage.getItem(BALL_COLOR_LAB_STORAGE_KEY);
    if (!stored) return createBallColorLabHistoryState(categoryColorPresets);
    const normalized = normalizeBallColorLabDraft(JSON.parse(stored), categoryColorPresets);
    if (normalized) return normalized;
  } catch {
    // Invalid lab-only session data is discarded below.
  }
  sessionStorage.removeItem(BALL_COLOR_LAB_STORAGE_KEY);
  return createBallColorLabHistoryState(categoryColorPresets);
}

function downloadText(text: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function createDownloadFilename(now = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `happy-ball-color-diff-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
}

function readChannel(value: string | undefined): keyof BallColorLabValue | null {
  return value === "hue" || value === "saturation" || value === "lightness" ? value : null;
}

function requireElement<T extends Element = HTMLElement>(selector: string, owner: ParentNode = document): T {
  const element = owner.querySelector<T>(selector);
  if (!element) throw new Error(`Ball color lab element not found: ${selector}`);
  return element;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}
