import { toneLabels, type CategoryColorPreset, type CategoryTone } from "./categories.js";
import { findLatestBallSendMode, formatActivityActionLabel, formatSendModeLabel, type ActivityLogEntry } from "./activity-log.js";
import { renderOptions } from "./form-renderers.js";
import { issuerLabels, type HappyBall, type LifecycleStatus, type NameBookEntry, type NameRole } from "./models.js";
import { DAMPING_SLIDER_RANGE, MOVEMENT_SETTING_RANGES, dampingValueToSlider } from "./motion-tuning.js";
import { CLASSIFICATION_RATIO_SLIDER, classificationRatioToSlider } from "./play-physics-classification.js";
import type { AppSettings, BackgroundTexture, EmotionEchoStrength, PhysicsSettingsProfile, StartupScreen } from "./settings.js";

export interface ToolsPanelRenderContext {
  appSettings: AppSettings;
  appVersion: string;
  developmentToolsEnabled: boolean;
  categories: CategoryColorPreset[];
  openSettingsGroups: string[];
  activityLogHelpOpen: boolean;
  nameBook: NameBookEntry[];
  activityLog: ActivityLogEntry[];
  maxNameBookEntries: number;
  defaultSampleName: string;
  physicsSettingsProfile: PhysicsSettingsProfile;
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
  activityLog?: ActivityLogEntry[];
  showAllControl?: boolean;
  showScope?: boolean;
}

export function renderToolsPanel(context: ToolsPanelRenderContext): string {
  const { appSettings } = context;
  const physicsSettings = context.physicsSettingsProfile === "jutsu"
    ? appSettings.jutsuPhysicsSettings
    : appSettings;
  const officialVersion = context.appVersion.includes("-") ? "未付与" : context.appVersion;
  return `
    <div class="tools-panel">
      <div class="settings-brand-mark" aria-hidden="true">
        <span class="settings-brand-ball">
          <span class="settings-brand-word">えもい玉</span>
        </span>
      </div>
      <section class="settings-cluster settings-cluster-tailoring" aria-labelledby="settings-cluster-tailoring-title">
        <p class="settings-cluster-title" id="settings-cluster-tailoring-title">玉の仕立て</p>
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
              ${renderEchoStrengthOption(appSettings.emotionEchoStrength, "weak", "狭い")}
              ${renderEchoStrengthOption(appSettings.emotionEchoStrength, "medium", "標準")}
              ${renderEchoStrengthOption(appSettings.emotionEchoStrength, "strong", "広い")}
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
          <label class="inline-toggle privacy-setting-toggle">
            <input id="setting-handoff-descent-gps" type="checkbox" ${appSettings.includeDescentGpsInHandoff ? "checked" : ""} />
            <span>送るQRに降臨GPSを含める</span>
          </label>
          <p class="settings-copy privacy-setting-note">初期値はOFFです。「送る」で作るQRと共有画像だけに適用され、台帳や地図には影響しません。</p>
        </div>
      </details>
      </section>

      <section class="settings-cluster settings-cluster-behavior" aria-labelledby="settings-cluster-behavior-title">
        <p class="settings-cluster-title" id="settings-cluster-behavior-title">玉のふるまい</p>
      <details class="settings-group physics-settings"${renderDetailsOpen(context, "physics-settings")}>
        <summary class="panel-title">
          <h2>物理パラメータ</h2>
        </summary>
        <div class="tuning-section">
          <label class="inline-toggle">
            <input id="setting-gravity" type="checkbox" ${appSettings.gravityEnabled ? "checked" : ""} />
            <span>重力センサー</span>
          </label>
          ${context.developmentToolsEnabled ? `
            <label class="inline-toggle">
              <input id="setting-gravity-debug" type="checkbox" ${appSettings.gravityDebugEnabled ? "checked" : ""} />
              <span>センサー値表示</span>
            </label>
          ` : ""}
        </div>
        <div class="physics-profile-control">
          <span class="physics-profile-label">調整対象</span>
          <div class="physics-profile-options" role="group" aria-label="物理パラメータの調整対象">
            <button type="button" data-physics-settings-profile="normal" aria-pressed="${context.physicsSettingsProfile === "normal"}">通常</button>
            <button type="button" data-physics-settings-profile="jutsu" aria-pressed="${context.physicsSettingsProfile === "jutsu"}">術専用</button>
          </div>
          <p class="settings-copy">術が有効な間は、術専用の値へ自動で切り替わります。</p>
        </div>
        <div class="tuning-section">
          <h3>世界の物理</h3>
          ${renderRange("setting-wall", "Wall Bounce", physicsSettings.wallRestitution, MOVEMENT_SETTING_RANGES.wallRestitution)}
          ${renderRange("setting-contact", "Contact Bounce", physicsSettings.contactRestitution, MOVEMENT_SETTING_RANGES.contactRestitution)}
          ${renderDampingRange(physicsSettings.linearDamping)}
          ${renderRange("setting-flick", "Flick Power", physicsSettings.flickPower, MOVEMENT_SETTING_RANGES.flickPower)}
          ${renderRange("setting-speed", "Max Speed", physicsSettings.maxSpeed, MOVEMENT_SETTING_RANGES.maxSpeed)}
          ${renderRange("setting-gravity-strength", "Gravity", physicsSettings.gravityStrength, MOVEMENT_SETTING_RANGES.gravityStrength)}
        </div>
        <div class="tuning-section">
          <h3>玉・親玉の性質</h3>
          ${renderClassificationRatioRange("setting-density-ratio", "密度の相対比", physicsSettings.classificationDensityRatio)}
          ${renderClassificationRatioRange("setting-class-damping-ratio", "ダンピング倍率の相対比", physicsSettings.classificationDampingRatio)}
          ${renderRange("setting-class-buoyancy", "攪拌時の疑似浮力", physicsSettings.classificationBuoyancyStrength, 0, 1, 0.05)}
          ${renderRange("setting-parent-diameter", "親玉直径 px", physicsSettings.parentBallDiameterPx, 40, 160, 4)}
          ${renderRange("setting-parent-lifetime", "親玉残存秒", physicsSettings.parentBallLifetimeSeconds, 1, 30, 1)}
        </div>
        ${context.physicsSettingsProfile === "jutsu" ? `
          <div class="jutsu-physics-reset-zone">
            <button id="reset-jutsu-physics" class="ghost-action" type="button">術専用設定をデフォルト値に戻す</button>
          </div>
        ` : ""}
      </details>

      <details class="settings-group sound-settings"${renderDetailsOpen(context, "sound-settings")}>
        <summary class="panel-title">
          <h2>サウンド</h2>
        </summary>
        <div class="tuning-section">
          <label class="inline-toggle">
            <input id="setting-sound" type="checkbox" ${appSettings.soundEnabled ? "checked" : ""} />
            <span>Sound</span>
          </label>
          ${renderRange("setting-volume", "Volume", appSettings.masterVolume, 0, 1, 0.01)}
          ${renderRange("setting-pitch", "Pitch", appSettings.frequencyHz, 200, 4200, 20)}
          ${renderRange("setting-duration", "Sound Len.", appSettings.durationMs, 30, 420, 10)}
        </div>
      </details>
      </section>

      <section class="settings-cluster settings-cluster-management" aria-labelledby="settings-cluster-management-title">
        <p class="settings-cluster-title" id="settings-cluster-management-title">管理</p>
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
          <label class="inline-toggle">
            <input type="checkbox" name="export-section" value="activityLog" />
            <span>操作ログ</span>
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

      <details class="settings-group activity-log-panel"${renderDetailsOpen(context, "activity-log-panel")}>
        <summary class="panel-title">
          <h2>操作ログ</h2>
        </summary>
        <p class="settings-copy">受領、送付準備、お焚上、降臨など、原因調査に必要な最近の操作だけをこの端末に残します。</p>
        ${renderActivityLogHelp(context.activityLogHelpOpen)}
        ${renderActivityLogList(context.activityLog)}
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
            <dd>${escapeHtml(officialVersion)}</dd>
          </div>
        </dl>
      </details>
      </section>
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
                  <small>${escapeHtml(renderLedgerRelationshipMeta(ball, options.activityLog ?? []))}</small>
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

function renderLedgerRelationshipMeta(ball: HappyBall, activityLog: ActivityLogEntry[]): string {
  const sendMode = findLatestBallSendMode(activityLog, ball.id);
  const parts = [`発行者: ${ball.issuedBy}`];
  if (sendMode) {
    parts.push(`送り手段: ${formatSendModeLabel(sendMode)}`);
  }
  return parts.join(" / ");
}

function renderActivityLogList(entries: ActivityLogEntry[]): string {
  if (entries.length === 0) {
    return `<p class="empty-copy">まだ操作ログはありません。</p>`;
  }
  return `
    <div class="activity-log-list">
      ${entries.slice(0, 30).map((entry) => `
        <article class="activity-log-item">
          <strong>${escapeHtml(formatActivityActionLabel(entry.action))}${entry.status === "failure" ? "（失敗）" : ""}</strong>
          <span>${escapeHtml(formatActivityLogTime(entry.recordedAt))}${entry.sendMode ? ` / ${escapeHtml(formatSendModeLabel(entry.sendMode))}` : ""}</span>
          <small>${escapeHtml(renderActivityLogSummary(entry))}</small>
        </article>
      `).join("")}
    </div>
  `;
}

function renderActivityLogHelp(isOpen: boolean): string {
  return `
    <div class="feature-help activity-log-help">
      <button class="feature-help-button" type="button" data-toggle-activity-log-help aria-label="操作ログの簡易仕様を見る" aria-expanded="${isOpen ? "true" : "false"}" aria-controls="activity-log-help-body">
        <span class="feature-help-mark" aria-hidden="true">?</span>
      </button>
      ${isOpen ? `<div id="activity-log-help-body" class="feature-help-body">
        <p>操作ログは、受領、送付準備、JSON読み書き、しまう・供養・お焚上、降臨/GPS操作など、原因調査に必要な操作をこの端末だけに残します。</p>
        <p>玉を置くだけの通常作成は、現在は操作ログに記録しません。</p>
        <p>バックアップJSONには「操作ログ」を選んだ場合だけ含めます。URL、LINE、QRで渡す1玉データには含めません。</p>
      </div>` : ""}
    </div>
  `;
}

function renderActivityLogSummary(entry: ActivityLogEntry): string {
  const title = entry.title || entry.ballSnapshot?.title || entry.ballId || "対象なし";
  const issuer = entry.issuedBy || entry.ballSnapshot?.issuedBy;
  const parts = [title];
  if (issuer) {
    parts.push(`発行者: ${issuer}`);
  }
  if (entry.descentSequence) {
    parts.push(`No.${entry.descentSequence}`);
  }
  if (entry.message) {
    parts.push(entry.message);
  }
  return parts.join(" / ");
}

function formatActivityLogTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
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

function renderRange(
  id: string,
  label: string,
  value: number,
  rangeOrMin: { min: number; max: number; step: number } | number,
  max?: number,
  step?: number,
): string {
  const range = typeof rangeOrMin === "number"
    ? { min: rangeOrMin, max: max ?? rangeOrMin, step: step ?? 1 }
    : rangeOrMin;
  return `
    <label class="range-control">
      <span>${escapeHtml(label)} <strong id="${id}-value">${formatSettingValue(value)}</strong></span>
      <input id="${id}" type="range" min="${range.min}" max="${range.max}" step="${range.step}" value="${value}" />
    </label>
  `;
}

function renderDampingRange(value: number): string {
  return `
    <label class="range-control">
      <span>Damping <strong id="setting-damping-value">${formatSettingValue(value)}</strong></span>
      <input id="setting-damping" type="range" min="${DAMPING_SLIDER_RANGE.min}" max="${DAMPING_SLIDER_RANGE.max}" step="${DAMPING_SLIDER_RANGE.step}" value="${dampingValueToSlider(value)}" />
    </label>
  `;
}

function renderClassificationRatioRange(id: string, label: string, value: number): string {
  const listId = `${id}-ticks`;
  return `
    <label class="range-control classification-ratio-control">
      <span>${escapeHtml(label)} <strong id="${id}-value">${formatSettingValue(value)}</strong></span>
      <input id="${id}" type="range" min="${CLASSIFICATION_RATIO_SLIDER.min}" max="${CLASSIFICATION_RATIO_SLIDER.max}" step="${CLASSIFICATION_RATIO_SLIDER.step}" value="${classificationRatioToSlider(value)}" list="${listId}" />
      <datalist id="${listId}">
        <option value="-2" label="1/4"></option>
        <option value="-1" label="1/2"></option>
        <option value="0" label="1"></option>
        <option value="1" label="2"></option>
        <option value="2" label="4"></option>
      </datalist>
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
