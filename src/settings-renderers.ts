import { toneLabels, type CategoryColorPreset, type CategoryTone } from "./categories.js";
import { renderOptions } from "./form-renderers.js";
import { issuerLabels, type HappyBall, type LifecycleStatus, type NameBookEntry, type NameRole } from "./models.js";
import type { AppSettings, BackgroundTexture, EmotionEchoStrength, StartupScreen } from "./settings.js";

export interface ToolsPanelRenderContext {
  appSettings: AppSettings;
  appVersion: string;
  categories: CategoryColorPreset[];
  openSettingsGroups: string[];
  nameBook: NameBookEntry[];
  maxNameBookEntries: number;
  defaultSampleName: string;
}

const nameRoleLabels: Record<NameRole, string> = {
  self: "自分",
  proxy: "代理",
};

const lifecycleLabels: Record<LifecycleStatus, string> = {
  active: "現役",
  archived: "しまい中",
  memorial: "記憶",
  offered: "供養済み",
};

export interface LedgerListRenderOptions {
  dateFilter: string | null;
  emptyCopy?: string;
  showAllControl?: boolean;
  showScope?: boolean;
}

export function renderToolsPanel(context: ToolsPanelRenderContext): string {
  const { appSettings } = context;
  return `
    <div class="tools-panel">
      <div class="settings-brand-mark" aria-hidden="true">
        <span class="settings-brand-ball">
          <span class="settings-brand-word">えもい玉</span>
        </span>
      </div>
      <details class="settings-group name-book-settings"${renderDetailsOpen(context, "name-book-settings")}>
        <summary class="panel-title">
          <h2>名前帳</h2>
          <span class="settings-feedback" data-name-book-settings-feedback role="status" aria-live="polite"></span>
        </summary>
        <form id="name-book-form" class="name-book-form">
          ${renderNameBookSettingsFields(context)}
          <div class="name-book-reset-zone">
            <button id="reset-name-book" class="danger-action name-book-reset-action" type="button">名前帳を初期化</button>
          </div>
        </form>
      </details>

      <details class="settings-group category-settings"${renderDetailsOpen(context, "category-settings")}>
        <summary class="panel-title">
          <h2>カテゴリ</h2>
        </summary>
        <form id="category-settings-form" class="category-settings-form">
          ${renderCategorySettingsFields(context.categories)}
          <div class="category-reset-zone">
            <button id="reset-categories" class="danger-action category-reset-action" type="button">カテゴリを初期化</button>
          </div>
        </form>
      </details>

      <details class="settings-group display-settings"${renderDetailsOpen(context, "display-settings")}>
        <summary class="panel-title">
          <h2>表示</h2>
        </summary>
        <div class="display-setting-item display-setting-item-with-help">
          <label class="inline-toggle">
            <input id="setting-memo-field" type="checkbox" ${appSettings.showMemoField ? "checked" : ""} />
            <span>メモ欄表示</span>
          </label>
          <p class="settings-copy">メモ本文を公開しない設定でも、伏せ字でメモ欄が表示されます。</p>
        </div>
        <div class="display-setting-item">
          <label class="select-control">
            <span>余韻光芒</span>
            <select id="setting-echo-strength">
              ${renderEchoStrengthOption(appSettings.emotionEchoStrength, "off", "無効")}
              ${renderEchoStrengthOption(appSettings.emotionEchoStrength, "weak", "弱")}
              ${renderEchoStrengthOption(appSettings.emotionEchoStrength, "medium", "中")}
              ${renderEchoStrengthOption(appSettings.emotionEchoStrength, "strong", "強")}
            </select>
          </label>
        </div>
        <div class="display-setting-item">
          <label class="select-control">
            <span>背景質感</span>
            <select id="setting-background-texture">
              ${renderBackgroundTextureOption(appSettings.backgroundTexture, "grid", "ほの格子")}
              ${renderBackgroundTextureOption(appSettings.backgroundTexture, "paper", "ざら紙")}
              ${renderBackgroundTextureOption(appSettings.backgroundTexture, "grain", "粒の余韻")}
              ${renderBackgroundTextureOption(appSettings.backgroundTexture, "mist", "霞")}
              ${renderBackgroundTextureOption(appSettings.backgroundTexture, "random", "ランダム粒")}
            </select>
          </label>
        </div>
        <div class="display-setting-item">
          <label class="select-control">
            <span>開始画面</span>
            <select id="setting-startup-screen">
              ${renderStartupScreenOption(appSettings.startupScreen, "main", "ボール")}
              ${renderStartupScreenOption(appSettings.startupScreen, "calendarMonth", "カレンダー")}
              ${renderStartupScreenOption(appSettings.startupScreen, "calendarDayList", "玉リスト")}
            </select>
          </label>
        </div>
      </details>

      <details class="settings-group descent-settings"${renderDetailsOpen(context, "descent-settings")}>
        <summary class="panel-title">
          <h2>降臨</h2>
        </summary>
        <p class="settings-copy">直近の降臨地からこの距離以上離れると、同じ玉を再び降臨できます。</p>
        <div class="tuning-section">
          ${renderRange("setting-descent-distance", "再降臨距離 m", appSettings.descentMinDistanceMeters, 10, 5000, 10)}
        </div>
      </details>

      <details class="settings-group tuning-panel"${renderDetailsOpen(context, "tuning-panel")}>
        <summary class="panel-title">
          <h2>サウンド・ビジュアル</h2>
        </summary>
        <div class="tuning-section">
          <h3>玉の動き</h3>
          ${renderRange("setting-wall", "Wall Bounce", appSettings.wallRestitution, 0, 1, 0.01)}
          ${renderRange("setting-contact", "Contact Bounce", appSettings.contactRestitution, 0, 1, 0.01)}
          ${renderRange("setting-damping", "Damping", appSettings.linearDamping, 0, 2, 0.01)}
          ${renderRange("setting-flick", "Flick Power", appSettings.flickPower, 0.2, 2.2, 0.01)}
          ${renderRange("setting-speed", "Max Speed", appSettings.maxSpeed, 400, 5000, 50)}
          ${renderRange("setting-gravity-strength", "Gravity", appSettings.gravityStrength, 80, 1800, 20)}
          <label class="inline-toggle">
            <input id="setting-gravity" type="checkbox" ${appSettings.gravityEnabled ? "checked" : ""} />
            <span>重力センサー</span>
          </label>
        </div>
        <div class="tuning-section">
          <h3>サウンド</h3>
          <label class="inline-toggle">
            <input id="setting-sound" type="checkbox" ${appSettings.soundEnabled ? "checked" : ""} />
            <span>Sound</span>
          </label>
          ${renderRange("setting-volume", "Volume", appSettings.masterVolume, 0, 1, 0.01)}
          ${renderRange("setting-pitch", "Pitch", appSettings.frequencyHz, 200, 4200, 20)}
          ${renderRange("setting-duration", "Sound Len.", appSettings.durationMs, 30, 420, 10)}
        </div>
      </details>

      <details class="settings-group backup-settings"${renderDetailsOpen(context, "backup-settings")}>
        <summary class="panel-title">
          <h2>バックアップ・復元</h2>
        </summary>
        <p class="settings-copy">選んだ内容を1つのバックアップファイルにまとめて書き出します。</p>
        <div class="export-options">
          <label class="inline-toggle">
            <input type="checkbox" name="export-section" value="ledger" checked />
            <span>台帳データ</span>
          </label>
          <label class="inline-toggle">
            <input type="checkbox" name="export-section" value="appSettings" />
            <span>アプリ設定</span>
          </label>
          <label class="inline-toggle">
            <input type="checkbox" name="export-section" value="categories" />
            <span>カテゴリ設定</span>
          </label>
        </div>
        <div class="settings-group-actions">
          <button id="export-json" class="primary-action" type="button">書き出し</button>
          <button id="import-json" class="ghost-action" type="button">読み込み</button>
          <input id="import-json-file" type="file" accept="application/json,.json" hidden />
        </div>
      </details>

      <details class="settings-group ball-management-panel"${renderDetailsOpen(context, "ball-management-panel")}>
        <summary class="panel-title">
          <h2>玉データ管理</h2>
        </summary>
        <p class="settings-copy">保存された玉の選択、編集、削除、共有URLコピーを行います。</p>
        <div class="settings-group-actions">
          <button class="ghost-action" type="button" data-open-panel="list">保存された玉を開く</button>
        </div>
        <div class="ball-data-clear-zone">
          <button class="danger-action ball-data-clear-action" id="clear-ball-data" type="button">玉データを空にする</button>
        </div>
      </details>

      <details class="settings-group app-about-panel"${renderDetailsOpen(context, "app-about-panel")}>
        <summary class="panel-title">
          <h2>アプリバージョン</h2>
        </summary>
        <dl class="app-version-list">
          <div>
            <dt>バージョン</dt>
            <dd>${escapeHtml(context.appVersion)}</dd>
          </div>
          <div>
            <dt>公開版</dt>
            <dd>未付与</dd>
          </div>
          <div>
            <dt>Pages参考</dt>
            <dd>0.8.0</dd>
          </div>
        </dl>
      </details>
    </div>
  `;
}

function renderDetailsOpen(context: ToolsPanelRenderContext, groupClass: string): string {
  return context.openSettingsGroups.includes(groupClass) ? " open" : "";
}

export function renderLedgerList(
  balls: HappyBall[],
  selectedBallId: string | null,
  options: LedgerListRenderOptions = { dateFilter: null },
): string {
  if (balls.length === 0) {
    return `
      ${renderLedgerListScope(options)}
      <p class="empty-copy">${escapeHtml(options.emptyCopy ?? "まだ保存された玉はありません。")}</p>
    `;
  }

  return `
    ${renderLedgerListScope(options)}
    <div class="ledger-list">
      ${balls
        .map(
          (ball) => `
            <article class="ledger-item lifecycle-${ball.lifecycleStatus} ${ball.id === selectedBallId ? "is-selected" : ""}">
              <button class="ledger-select" type="button" data-select-ball-id="${escapeAttribute(ball.id)}">
                <span class="ledger-ball-visual-wrap">
                  ${renderCompactDescentBadge(ball)}
                  <span class="mini-ball ledger-ball-visual lifecycle-${ball.lifecycleStatus} ${renderVisualKindClass(ball.visual)}" style="${renderVisualStyle(ball.visual)}" aria-hidden="true"></span>
                  ${renderBallCountUnderIcon(ball, "ledger-count-under-icon")}
                </span>
                <span class="ledger-text-block">
                  <span>${escapeHtml(ball.date)} / ${escapeHtml(ball.subject)}</span>
                  <strong>${escapeHtml(ball.title)}</strong>
                  <small>${escapeHtml(issuerLabels[ball.issuerType])} / ${escapeHtml(ball.category)} / ${escapeHtml(lifecycleLabels[ball.lifecycleStatus])}${renderLedgerDescentText(ball)}</small>
                </span>
              </button>
              <div class="ledger-actions">
                <button class="share-ball" type="button" data-copy-ball-url-id="${escapeAttribute(ball.id)}" aria-label="${escapeAttribute(ball.title)}のURLをコピー">URL</button>
                <button class="share-ball" type="button" data-copy-ball-line-url-id="${escapeAttribute(ball.id)}" aria-label="${escapeAttribute(ball.title)}のLINE用URLをコピー">LINE</button>
                <button class="edit-ball" type="button" data-edit-ball-id="${escapeAttribute(ball.id)}" aria-label="${escapeAttribute(ball.title)}を編集">編集</button>
                ${renderArchiveToggleButton(ball)}
                <button class="lifecycle-ball" type="button" data-lifecycle-ball-id="${escapeAttribute(ball.id)}" data-lifecycle-status="offered" aria-label="${escapeAttribute(ball.title)}を供養">供養</button>
                <button class="delete-ball" type="button" data-delete-ball-id="${escapeAttribute(ball.id)}" aria-label="${escapeAttribute(ball.title)}をお焚上">お焚上</button>
                <button class="descend-ball" type="button" data-descend-ball-id="${escapeAttribute(ball.id)}" aria-label="${escapeAttribute(ball.title)}に降臨">降臨</button>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderLedgerDescentText(ball: HappyBall): string {
  const count = ball.descents?.length ?? 0;
  const badges = ball.descentBadgeCount ?? 0;
  if (count === 0 && badges === 0) {
    return "";
  }
  return count > 0 ? ` / 降臨${count}回` : ` / ${badges}星`;
}

function renderCompactDescentBadge(ball: HappyBall): string {
  const count = ball.descentBadgeCount ?? 0;
  if (count <= 0) {
    return "";
  }
  return `<span class="compact-descent-badge ledger-descent-badge" aria-label="降臨 ${count}星">✦${count}</span>`;
}

function renderBallCountUnderIcon(ball: HappyBall, className: string): string {
  if (ball.count <= 1) {
    return "";
  }
  return `<span class="ball-count-under-icon ${className}" aria-label="玉数 ${ball.count}玉">${ball.count}玉</span>`;
}

function renderArchiveToggleButton(ball: HappyBall): string {
  if (ball.lifecycleStatus === "archived") {
    return `<button class="lifecycle-ball" type="button" data-lifecycle-ball-id="${escapeAttribute(ball.id)}" data-lifecycle-status="active" aria-label="${escapeAttribute(ball.title)}を通常表示に戻す">戻す</button>`;
  }
  return `<button class="lifecycle-ball" type="button" data-lifecycle-ball-id="${escapeAttribute(ball.id)}" data-lifecycle-status="archived" aria-label="${escapeAttribute(ball.title)}をしまう">しまう</button>`;
}

function renderLedgerListScope(options: LedgerListRenderOptions): string {
  if (options.showScope === false) {
    return "";
  }
  if (!options.dateFilter) {
    return `<p class="ledger-scope">すべての保存された玉</p>`;
  }
  if (options.showAllControl === false) {
    return `<p class="ledger-scope">${escapeHtml(options.dateFilter)} の保存された玉</p>`;
  }
  return `
    <div class="ledger-scope-row">
      <p class="ledger-scope">${escapeHtml(options.dateFilter)} の保存された玉</p>
      <button class="ghost-action ledger-scope-clear" type="button" data-clear-ledger-list-date>全て表示</button>
    </div>
  `;
}

export function formatSettingValue(value: number): string {
  if (Math.abs(value) >= 100) {
    return String(Math.round(value));
  }
  return value.toFixed(2);
}

function renderNameBookSettingsFields(context: ToolsPanelRenderContext): string {
  const rows: NameBookEntry[] = Array.from({ length: context.maxNameBookEntries }, (_, index) => (
    context.nameBook[index] ?? { id: "", name: "", role: index === 0 ? "self" : "proxy" }
  ));

  return `
    <div class="name-book-grid">
      <div class="name-book-header" aria-hidden="true">
        <span>番号</span>
        <span>名前</span>
        <span>属性</span>
      </div>
      ${rows.map((entry, index) => `
        <div class="name-book-row">
          <input type="hidden" name="name-book-id-${index}" value="${escapeAttribute(entry.id)}" />
          <span class="name-book-number">${index + 1}</span>
          <input name="name-book-name-${index}" type="text" value="${escapeAttribute(entry.name)}" placeholder="${index === 0 ? context.defaultSampleName : "名前"}" aria-label="${index + 1}番の名前" />
          <select name="name-book-role-${index}" aria-label="${index + 1}番の属性">
            ${renderOptions(nameRoleLabels, entry.role)}
          </select>
        </div>
      `).join("")}
    </div>
  `;
}

function renderCategorySettingsFields(categories: CategoryColorPreset[]): string {
  const tones: CategoryTone[] = ["bright", "dark", "neutral", "future"];
  return tones.map((tone) => `
    <div class="category-edit-tone">
      <div class="category-edit-tone-title">
        <h3>${escapeHtml(toneLabels[tone])}</h3>
        <span class="settings-feedback" data-category-settings-feedback role="status" aria-live="polite"></span>
      </div>
      <div class="category-edit-grid">
        ${categories
          .map((preset, index) => ({ preset, index }))
          .filter(({ preset }) => preset.tone === tone)
          .map(({ preset, index }) => `
            <label class="category-edit-item">
              <span class="category-swatch ${renderVisualKindClass(preset)}" style="${renderVisualStyle(preset)}" aria-hidden="true"></span>
              <input name="category-${index}" type="text" maxlength="12" value="${escapeAttribute(preset.name)}" />
            </label>
          `).join("")}
      </div>
    </div>
  `).join("");
}

function renderRange(id: string, label: string, value: number, min: number, max: number, step: number): string {
  return `
    <label class="range-control">
      <span>${escapeHtml(label)} <strong id="${id}-value">${formatSettingValue(value)}</strong></span>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
    </label>
  `;
}

function renderEchoStrengthOption(
  selected: EmotionEchoStrength,
  value: EmotionEchoStrength,
  label: string,
): string {
  return `<option value="${value}"${selected === value ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderBackgroundTextureOption(
  selected: BackgroundTexture,
  value: BackgroundTexture,
  label: string,
): string {
  return `<option value="${value}"${selected === value ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderStartupScreenOption(
  selected: StartupScreen,
  value: StartupScreen,
  label: string,
): string {
  return `<option value="${value}"${selected === value ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderVisualStyle(visual: { hue: number; saturation: number; lightness: number }): string {
  return `--ball-hue: ${visual.hue}; --ball-saturation: ${visual.saturation}%; --ball-lightness: ${visual.lightness}%;`;
}

function renderVisualKindClass(visual: { visualKind?: string; kind?: string }): string {
  return visual.visualKind === "ring" || visual.kind === "ring" ? "is-ring-ball" : "is-filled-ball";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
