import RAPIER from "@dimforge/rapier2d-compat";
import {
  loadCategoryColorPresets,
  resetCategoryColorPresets,
  saveCategoryColorPresets,
  toneLabels,
  type CategoryColorPreset,
  type CategoryTone,
} from "./categories";
import "./style.css";
import {
  createExportFileName,
  createExportPayload,
  isExportSection,
  reviewJsonImport,
  type JsonImportReview,
} from "./json-transfer";
import { DeviceGravityController, requestDeviceGravityPermission } from "./device-gravity";
import { TinyImpactAudio } from "./impact-audio";
import { issuerLabels, visibilityLabels, visibilityValues, type BallDraft, type HappyBall, type NameBookEntry, type NameRole } from "./models";
import {
  createLinePacketImportUrl,
  createPacketImportUrl,
  parsePacketLocation,
  reviewPacketImport,
  type UrlPacketParseResult,
} from "./packet";
import { createQrCode, createQrSvg, type QrCodeMatrix } from "./qr-code";
import { RapierStage, type PhysicsBallSnapshot, type VisualBallSource } from "./rapier-stage";
import {
  loadAppSettings,
  normalizeAppSettings,
  readEchoStrength,
  saveAppSettings,
  type AppSettings,
  type BallLabelMode,
  type EmotionEchoStrength,
} from "./settings";
import { canShowMemoText, getMemoSurfaceMode, type MemoSurfaceMode } from "./visibility";
import {
  addBall,
  applyCategoryRenames,
  clearLedger,
  createDefaultDraft,
  DEFAULT_SAMPLE_NAME,
  deleteBall,
  getPrimarySelfName,
  importNewAndReplaceBalls,
  importNewBalls,
  loadLedger,
  markReceiptCreated,
  MAX_NAME_BOOK_ENTRIES,
  serializeLedger,
  todayIsoDate,
  updateBall,
  updateNameBook,
  type BallSaveMode,
} from "./storage";

const appRoot = getAppRoot();
const MIN_APP_VIEWPORT_HEIGHT = 320;

let ledger = loadLedger();
let draft = createDefaultDraft(getPrimarySelfName(ledger));
let appSettings: AppSettings;
let editableCategories: CategoryColorPreset[] = loadCategoryColorPresets();
let selectedBallId: string | null = ledger.balls[0]?.id ?? null;
let activeOverlay: ActiveOverlay = "none";
let displayMode: DisplayMode = "day";
let displayAnchorDate = ledger.balls[0]?.date ?? todayIsoDate();
let calendarMonth = createDefaultDraft().date.slice(0, 7);
let pendingUrlPacket: UrlPacketParseResult | null = parsePacketLocation(window.location.search, window.location.hash);
let snoozedUrlPacket: UrlPacketParseResult | null = null;
let pendingJsonImport: JsonImportReview | null = null;
let physicsStage: RapierStage | null = null;
const physicsSnapshots = new Map<string, PhysicsBallSnapshot>();
let rapierReady = false;
let audioEngine: TinyImpactAudio;
let deviceGravity: DeviceGravityController;
let appViewportHeightFrame = 0;
let stageSwipeStart: { x: number; y: number; pointerId: number } | null = null;
let activeBallDialogEscapeHandler: (() => void) | null = null;

const BALL_DIALOG_ROOT_ID = "ball-dialog-root";
type ActiveOverlay = "none" | "create" | "list" | "settings" | "calendar";
type DisplayMode = "day" | "week" | "month";

const receiptTitleLabels = {
  self: "お預け状",
  assisted: "お預け状",
  proxy: "預かり証",
} satisfies typeof issuerLabels;

const nameRoleLabels: Record<NameRole, string> = {
  self: "自分",
  proxy: "代理",
};

window.addEventListener("error", (event) => {
  showFatalError(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  showFatalError(event.reason);
});

window.addEventListener("keydown", handleDisplayNavigationKey);
installAppViewportHeightSync();
void boot();

function installAppViewportHeightSync(): void {
  syncAppViewportHeight();

  const queueSettlingSync = () => {
    queueAppViewportHeightSync();
    window.setTimeout(queueAppViewportHeightSync, 80);
    window.setTimeout(queueAppViewportHeightSync, 240);
  };

  window.visualViewport?.addEventListener("resize", queueSettlingSync, { passive: true });
  window.visualViewport?.addEventListener("scroll", queueAppViewportHeightSync, { passive: true });
  window.addEventListener("resize", queueSettlingSync, { passive: true });
  window.addEventListener("orientationchange", queueSettlingSync, { passive: true });
}

function queueAppViewportHeightSync(): void {
  if (appViewportHeightFrame !== 0) {
    return;
  }

  appViewportHeightFrame = window.requestAnimationFrame(() => {
    appViewportHeightFrame = 0;
    syncAppViewportHeight();
  });
}

function syncAppViewportHeight(): void {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return;
  }

  document.documentElement.style.setProperty(
    "--app-viewport-height",
    `${Math.max(MIN_APP_VIEWPORT_HEIGHT, Math.round(viewportHeight))}px`,
  );
}

async function boot(): Promise<void> {
  try {
    appRoot.innerHTML = `<main class="loading-shell">Rapierを起動しています...</main>`;
    await RAPIER.init();
    appSettings = loadAppSettings();
    audioEngine = new TinyImpactAudio();
    installAudioLifecycleHandlers();
    deviceGravity = new DeviceGravityController((gravity) => {
      physicsStage?.setGravityVector(gravity);
    });
    syncGravityController();
    rapierReady = true;
    render();
  } catch (error) {
    showFatalError(error);
  }
}

function installAudioLifecycleHandlers(): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      audioEngine.suspend();
    }
  });

  window.addEventListener("pagehide", () => {
    audioEngine.close();
  });
}

function render(): void {
  if (physicsStage) {
    for (const snapshot of physicsStage.captureSnapshots()) {
      physicsSnapshots.set(snapshot.id, snapshot);
    }
  }
  closeBallDialog();
  const visibleBalls = getVisibleBalls();
  const selectedBall = visibleBalls.find((ball) => ball.id === selectedBallId) ?? visibleBalls[0] ?? null;
  selectedBallId = selectedBall?.id ?? null;

  physicsStage?.destroy();
  physicsStage = null;

  appRoot.innerHTML = `
    <main class="app-shell ball-world-shell">
      <section class="stage ${appSettings.ballLabelMode !== "none" ? "show-ball-labels" : ""} label-mode-${appSettings.ballLabelMode}" aria-label="えもい玉">
        <div class="stage-topline">
          <div>
            <h1 id="stage-title">${escapeHtml(selectedBall ? createVisibilitySafeSummaryLabel(selectedBall) : "最初の玉を置く")}</h1>
            <p class="stage-filter">${escapeHtml(renderDisplayRangeLabel())}</p>
          </div>
        </div>
        <div id="ball-field" class="ball-field" aria-label="触って転がせるえもい玉"></div>
        <div class="world-actions" aria-label="操作">
          <button type="button" data-open-panel="create" aria-label="玉を作る">＋</button>
          <button type="button" data-open-panel="calendar" aria-label="カレンダー">Cal</button>
          <div class="display-mode-control" role="group" aria-label="表示期間">
            ${renderDisplayModeButton("day", "日")}
            ${renderDisplayModeButton("week", "週")}
            ${renderDisplayModeButton("month", "月")}
          </div>
          <button type="button" id="label-toggle" class="${appSettings.ballLabelMode !== "none" ? "is-on" : ""}" aria-label="${renderBallLabelModeAriaLabel()}">${renderBallLabelModeButtonText()}</button>
          <button type="button" data-open-panel="settings" aria-label="設定">⚙</button>
        </div>
      </section>
      ${renderActiveOverlay()}
      ${renderSnoozedUrlPacketReminder()}
      ${renderPendingUrlPacketDialog()}
      ${renderPendingJsonImportDialog()}
    </main>
  `;

  bindEvents();
  mountRapierStage(visibleBalls);
}

function getVisibleBalls(): HappyBall[] {
  const range = getDisplayDateRange(displayMode, displayAnchorDate);
  return ledger.balls.filter((ball) => ball.date >= range.start && ball.date <= range.end);
}

function renderDisplayModeButton(mode: DisplayMode, label: string): string {
  return `
    <button
      class="${displayMode === mode ? "is-on" : ""}"
      type="button"
      data-display-mode="${mode}"
      aria-label="${renderDisplayModeAriaLabel(mode)}"
      aria-pressed="${displayMode === mode ? "true" : "false"}"
    >${label}</button>
  `;
}

function renderDisplayModeAriaLabel(mode: DisplayMode): string {
  if (mode === "day") {
    return "選択した日の玉";
  }
  if (mode === "week") {
    return "選択した日を含む週の玉";
  }
  return "選択した日を含む月の玉";
}

function renderDisplayRangeLabel(): string {
  const range = getDisplayDateRange(displayMode, displayAnchorDate);
  if (displayMode === "day") {
    return `${displayAnchorDate} の玉`;
  }
  if (displayMode === "week") {
    return `${range.start} - ${range.end} の週`;
  }
  return `${displayAnchorDate.slice(0, 7)} の月`;
}

function renderBallLabelModeButtonText(): string {
  if (appSettings.ballLabelMode === "date") {
    return "日";
  }
  if (appSettings.ballLabelMode === "title") {
    return "題";
  }
  return "無";
}

function renderBallLabelModeAriaLabel(): string {
  if (appSettings.ballLabelMode === "date") {
    return "玉の文字表示: 日付";
  }
  if (appSettings.ballLabelMode === "title") {
    return "玉の文字表示: タイトル";
  }
  return "玉の文字表示: なし";
}

function renderActiveOverlay(): string {
  if (activeOverlay === "none") {
    return "";
  }

  if (activeOverlay === "calendar") {
    return renderCalendarOverlay();
  }

  if (activeOverlay === "create") {
    draft = { ...draft, date: displayAnchorDate };
    return renderPanelOverlay("玉を置く", renderCreateForm(), "create");
  }

  if (activeOverlay === "list") {
    return renderPanelOverlay("保存された玉", renderLedgerList(), "list");
  }

  return renderPanelOverlay("設定とデータ", renderToolsPanel(), "settings");
}

function renderPendingUrlPacketDialog(): string {
  if (!pendingUrlPacket) {
    return "";
  }

  if (!pendingUrlPacket.ok) {
    return `
      <div class="ball-dialog-backdrop import-dialog-backdrop">
        <section class="ball-dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
          <h2 id="import-dialog-title">玉URLを読めませんでした</h2>
          <p class="dialog-detail">${escapeHtml(pendingUrlPacket.error)}</p>
          <div class="dialog-actions">
            <button class="ghost-action" type="button" id="clear-url-packet">URLを消す</button>
            <button class="primary-action" type="button" id="dismiss-url-packet">閉じる</button>
          </div>
        </section>
      </div>
    `;
  }

  const review = reviewPacketImport(pendingUrlPacket.packet, ledger.balls);
  const canImport = review.newItems.length > 0;
  const canReplace = review.conflicts.length > 0;
  const importStatus = renderUrlImportStatus(review);
  const localConflictBalls = getExistingBallsForIncoming(review.conflicts);
  const previewBall = pendingUrlPacket.packet.items[0];
  const receiptTitle = previewBall ? receiptTitleLabels[previewBall.issuerType] : "お預け状";
  return `
    <div class="ball-dialog-backdrop import-dialog-backdrop">
      <section class="ball-dialog import-dialog receive-dialog" role="dialog" aria-modal="true" aria-label="届いたえもい玉 ${escapeAttribute(receiptTitle)}">
        <p class="receive-dialog-title">貴方に届いた${escapeHtml(receiptTitle)}です</p>
        ${previewBall ? renderReceiptPaper(previewBall, { idPrefix: "receive", showUrl: false }) : ""}
        ${importStatus}
        <div class="import-counts" aria-label="読み込み結果">
          ${renderImportCountChip(review.newItems.length, "新しい玉", "new")}
          ${renderImportCountChip(review.duplicates.length, "登録済み", "duplicate")}
          ${renderImportCountChip(review.conflicts.length, "同じIDで別内容", "conflict")}
          ${pendingUrlPacket.rejectedItemCount > 0 ? renderImportCountChip(pendingUrlPacket.rejectedItemCount, "読めない項目", "conflict") : ""}
        </div>
        ${renderImportBallList("受け取る玉", review.newItems)}
        ${renderImportBallList("すでに手元にある玉", review.duplicates)}
        ${renderImportBallList("手元にある同じIDの玉", localConflictBalls)}
        <div class="dialog-actions">
          <button class="ghost-action" type="button" id="dismiss-url-packet">あとで見る</button>
          <button class="ghost-action" type="button" id="clear-url-packet">${escapeHtml(receiptTitle)}を消す</button>
          ${canReplace ? `<button class="ghost-action danger-action" type="button" id="replace-url-import">上書きして受け取る</button>` : ""}
          ${canImport ? `<button class="primary-action" type="button" id="confirm-url-import">新しい玉を受け取る</button>` : ""}
        </div>
      </section>
    </div>
  `;
}

function renderSnoozedUrlPacketReminder(): string {
  if (!snoozedUrlPacket?.ok) {
    return "";
  }

  const firstBall = snoozedUrlPacket.packet.items[0];
  const receiptTitle = firstBall ? receiptTitleLabels[firstBall.issuerType] : "お預け状";
  return `
    <aside class="receive-reminder" aria-label="保留中のお預け状">
      <span>届いた${escapeHtml(receiptTitle)}があります</span>
      <button class="ghost-action" type="button" id="show-snoozed-url-packet">見る</button>
    </aside>
  `;
}

function renderUrlImportStatus(review: {
  newItems: HappyBall[];
  duplicates: HappyBall[];
  conflicts: HappyBall[];
}): string {
  if (review.newItems.length > 0) {
    return `<p class="import-status is-new">新しい玉があります</p>`;
  }
  if (review.duplicates.length > 0 && review.conflicts.length === 0) {
    return `<p class="import-status is-duplicate">登録済みの玉です</p>`;
  }
  if (review.conflicts.length > 0) {
    return `<p class="import-status is-conflict">同じIDで内容が違う玉があります</p>`;
  }
  return `<p class="import-status">追加できる玉はありません</p>`;
}

function renderImportCountChip(count: number, label: string, tone: "new" | "duplicate" | "conflict"): string {
  return `<span class="is-${tone}"><strong>${count}</strong> ${escapeHtml(label)}</span>`;
}

function renderPendingJsonImportDialog(): string {
  if (!pendingJsonImport) {
    return "";
  }

  if (pendingJsonImport.error) {
    return `
      <div class="ball-dialog-backdrop import-dialog-backdrop">
        <section class="ball-dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="json-import-title">
          <div class="dialog-title-block">
            <span>${escapeHtml(pendingJsonImport.fileName)}</span>
            <h2 id="json-import-title">JSONを読めませんでした</h2>
          </div>
          <p class="dialog-detail">${escapeHtml(pendingJsonImport.error)}</p>
          <div class="dialog-actions">
            <button class="primary-action" type="button" id="dismiss-json-import">閉じる</button>
          </div>
        </section>
      </div>
    `;
  }

  const ledgerReview = pendingJsonImport.ledger;
  const canApply = Boolean(
    ledgerReview || pendingJsonImport.appSettings || pendingJsonImport.categories,
  );
  return `
    <div class="ball-dialog-backdrop import-dialog-backdrop">
      <section class="ball-dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="json-import-title">
        <div class="dialog-title-block">
          <span>${escapeHtml(pendingJsonImport.fileName)}</span>
          <h2 id="json-import-title">JSONを読み込みますか</h2>
        </div>
        <p class="dialog-detail">内容を確認して、適用する項目だけ選んでください。台帳の玉は新しいIDだけ追加します。</p>
        <div class="import-counts" aria-label="読み込み内容">
          ${ledgerReview ? `
            <span><strong>${ledgerReview.newItems.length}</strong> 新しい玉</span>
            <span><strong>${ledgerReview.duplicates.length}</strong> 登録済み</span>
            <span><strong>${ledgerReview.conflicts.length}</strong> 同じIDの別内容</span>
            <span><strong>${ledgerReview.nameBookToAdd.length}</strong> 追加する名前</span>
            ${ledgerReview.rejectedItemCount > 0 ? `<span><strong>${ledgerReview.rejectedItemCount}</strong> 読めない玉</span>` : ""}
          ` : ""}
          ${pendingJsonImport.appSettings ? `<span><strong>あり</strong> アプリ設定</span>` : ""}
          ${pendingJsonImport.categories ? `<span><strong>あり</strong> カテゴリ設定</span>` : ""}
        </div>
        <div class="json-import-options">
          ${ledgerReview ? `
            <label class="inline-toggle">
              <input type="checkbox" name="json-import-section" value="ledger" checked />
              <span>台帳データを追加</span>
            </label>
          ` : ""}
          ${pendingJsonImport.appSettings ? `
            <label class="inline-toggle">
              <input type="checkbox" name="json-import-section" value="appSettings" checked />
              <span>アプリ設定を置き換え</span>
            </label>
          ` : ""}
          ${pendingJsonImport.categories ? `
            <label class="inline-toggle">
              <input type="checkbox" name="json-import-section" value="categories" checked />
              <span>カテゴリ設定を置き換え</span>
            </label>
          ` : ""}
        </div>
        ${ledgerReview ? renderImportBallList("追加する玉", ledgerReview.newItems) : ""}
        <div class="dialog-actions">
          <button class="ghost-action" type="button" id="dismiss-json-import">キャンセル</button>
          <button class="primary-action" type="button" id="confirm-json-import" ${canApply ? "" : "disabled"}>読み込む</button>
        </div>
      </section>
    </div>
  `;
}

function renderImportBallList(title: string, balls: HappyBall[]): string {
  if (balls.length === 0) {
    return "";
  }

  return `
    <section class="import-ball-list">
      <h3>${escapeHtml(title)}</h3>
      ${balls.slice(0, 4).map((ball) => `
        <article class="import-ball-item">
          <span class="mini-ball ${renderEchoClass(ball)}" style="${renderBallVisualStyle(ball)}" aria-hidden="true"></span>
          <div>
            <strong>${escapeHtml(ball.title)}</strong>
            <small>${escapeHtml(ball.date)} / ${escapeHtml(ball.subject)} / ${escapeHtml(ball.category)}</small>
          </div>
        </article>
      `).join("")}
      ${balls.length > 4 ? `<p class="import-more">ほか ${balls.length - 4} 件</p>` : ""}
    </section>
  `;
}

function renderPanelOverlay(title: string, body: string, kind: string): string {
  return `
    <div class="panel-backdrop panel-backdrop-${kind}" data-close-panel>
      <aside class="floating-panel floating-panel-${kind}" aria-label="${escapeAttribute(title)}">
        <div class="floating-panel-head">
          <h2>${escapeHtml(title)}</h2>
          <button class="dialog-close" type="button" data-close-panel aria-label="閉じる">&times;</button>
        </div>
        ${body}
      </aside>
    </div>
  `;
}

function renderCreateForm(): string {
  return `
    <form id="ball-form" class="create-form">
      <div class="form-row two">
        <label>
          <span>日付</span>
          <input name="date" type="date" value="${escapeAttribute(draft.date)}" />
        </label>
        <label>
          <span>玉数</span>
          <input name="count" type="number" min="1" max="12" value="${draft.count}" />
        </label>
      </div>

      <label>
        <span>だれの玉？</span>
        ${renderNamePresetSelect(draft.subject)}
        <input name="subject" type="text" value="${escapeAttribute(draft.subject)}" />
        <small class="form-hint">登録名選択または自由に入力</small>
      </label>

      <label>
        <span>作り方</span>
        <select name="issuerType">
          ${renderOptions(issuerLabels, draft.issuerType)}
        </select>
      </label>

      <label>
        <span>タイトル</span>
        <input name="title" type="text" maxlength="48" value="${escapeAttribute(draft.title)}" placeholder="小さなえもいゴト" />
      </label>

      <div class="form-row two">
        <label>
          <span>見せる範囲</span>
          <select name="visibility">
            ${renderOptions(visibilityLabels, draft.visibility)}
          </select>
        </label>
      </div>

      ${renderCategoryPalette(draft.category)}

      <label>
        <span>メモ</span>
        <textarea name="note" rows="3" maxlength="180">${escapeHtml(draft.note)}</textarea>
      </label>

      <div class="button-row">
        <button class="primary-action" type="submit">玉を置く</button>
      </div>
    </form>
  `;
}

function renderCalendarOverlay(): string {
  const [year, month] = calendarMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const offset = firstDay.getDay();
  const cells: string[] = [];

  for (let i = 0; i < offset; i += 1) {
    cells.push(`<div class="calendar-cell is-empty" aria-hidden="true"></div>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${calendarMonth}-${String(day).padStart(2, "0")}`;
    const balls = ledger.balls.filter((ball) => ball.date === date);
    const total = countVisualBalls(balls);
    const selectedClass = displayAnchorDate === date ? " is-selected" : "";
    cells.push(`
      <button class="calendar-cell${selectedClass}" type="button" data-filter-date="${date}" aria-label="${date} ${total}玉">
        <span class="calendar-day">${day}</span>
        ${renderCalendarMarkers(balls)}
      </button>
    `);
  }

  return `
    <section class="calendar-overlay" aria-label="カレンダー">
      <div class="calendar-head">
        <button class="calendar-nav" type="button" data-calendar-month="${escapeAttribute(shiftCalendarMonth(-1))}" aria-label="前の月">‹</button>
        <h2>${year}年 ${month}月</h2>
        <button class="calendar-nav" type="button" data-calendar-month="${escapeAttribute(shiftCalendarMonth(1))}" aria-label="次の月">›</button>
        <button class="dialog-close" type="button" data-close-panel aria-label="閉じる">&times;</button>
      </div>
      <div class="calendar-weekdays" aria-hidden="true">
        <span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span>
      </div>
      <div class="calendar-grid">
        ${cells.join("")}
      </div>
    </section>
  `;
}

function renderCalendarMarkers(balls: HappyBall[]): string {
  const total = countVisualBalls(balls);
  if (total === 0) {
    return `<span class="mini-ball-row" aria-hidden="true"></span>`;
  }

  if (total > 6) {
    return `<span class="calendar-overflow">${total}</span>`;
  }

  const markers = balls.flatMap((ball) => (
    Array.from({ length: Math.max(1, Math.min(ball.count, 6)) }, () => ball)
  )).slice(0, 6);
  return `
    <span class="mini-ball-row" aria-hidden="true">
      ${markers.map((ball) => `<span class="mini-ball ${renderEchoClass(ball)}" style="${renderBallVisualStyle(ball)}"></span>`).join("")}
    </span>
  `;
}

function shiftCalendarMonth(delta: number): string {
  const [year, month] = calendarMonth.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function getDisplayDateRange(mode: DisplayMode, anchorDate: string): { start: string; end: string } {
  const date = parseIsoLocalDate(anchorDate);
  if (mode === "day") {
    return { start: anchorDate, end: anchorDate };
  }

  if (mode === "week") {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: formatIsoLocalDate(start), end: formatIsoLocalDate(end) };
  }

  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: formatIsoLocalDate(start), end: formatIsoLocalDate(end) };
}

function shiftDisplayAnchor(delta: -1 | 1): void {
  const current = parseIsoLocalDate(displayAnchorDate);
  if (displayMode === "day") {
    current.setDate(current.getDate() + delta);
  } else if (displayMode === "week") {
    current.setDate(current.getDate() + delta * 7);
  } else {
    const next = addMonthsClamped(current, delta);
    current.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
  }
  displayAnchorDate = formatIsoLocalDate(current);
  calendarMonth = displayAnchorDate.slice(0, 7);
  draft = { ...draft, date: displayAnchorDate };
}

function parseIsoLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatIsoLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addMonthsClamped(date: Date, delta: -1 | 1): Date {
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + delta;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return new Date(targetYear, targetMonth, Math.min(date.getDate(), lastDay));
}

function renderBallDialog(ball: HappyBall): string {
  const keepers = ball.keepers.length > 0 ? ball.keepers.join(", ") : "未設定";
  const approvedBy = ball.approvedBy || "なし";
  const receiptTitle = receiptTitleLabels[ball.issuerType];
  const issueLabel = formatIssueLabel(ball);
  const issuerCardHelper = formatIssuerCardHelper(ball);
  const receiptCreated = Boolean(ball.receiptCreatedAt);
  const showIssuer = canShowIssuer(ball);

  return `
    <div class="ball-dialog-backdrop ball-detail-backdrop" data-dialog-backdrop>
      <section class="ball-dialog ball-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="ball-dialog-title">
        <button class="dialog-close" type="button" data-dialog-close aria-label="閉じる">&times;</button>
        <button class="primary-action detail-edit-top" type="button" data-dialog-edit-ball-id="${escapeAttribute(ball.id)}">編集</button>
        <p class="detail-screen-name">玉の中身</p>
        <div class="dialog-head">
          <div class="dialog-ball ${renderEchoClass(ball)}" style="${renderBallVisualStyle(ball)} --ball-rotation: 0.34rad;" aria-hidden="true">
            <span class="ball-body">
              <span class="ball-core"></span>
              <span class="ball-shade"></span>
              <span class="ball-highlight"></span>
            </span>
            <span class="ball-label">${escapeHtml(createVisibilitySafeTitleLabel(ball))}</span>
          </div>
          <div class="dialog-title-block">
            <span>${escapeHtml(ball.date)}</span>
            <h2 id="ball-dialog-title">${escapeHtml(createVisibilitySafeSummaryLabel(ball))}</h2>
          </div>
        </div>
        ${renderDialogDetail(ball)}
        <div class="detail-card-grid">
          ${showIssuer ? `<article class="detail-info-card">
            <span>発行者</span>
            <strong>${escapeHtml(ball.issuedBy)}</strong>
            ${issuerCardHelper ? `<small>${escapeHtml(issuerCardHelper)}</small>` : ""}
          </article>` : ""}
          <article class="detail-info-card detail-feeling-card">
            <div>
              <span>カテゴリ</span>
              <strong>${escapeHtml(ball.category)}</strong>
            </div>
            <div>
              <span>余韻</span>
              ${renderDetailEcho(ball)}
            </div>
          </article>
          <article class="detail-info-card detail-receipt-card">
            <div>
              <span>${escapeHtml(receiptTitle)}</span>
              <strong data-receipt-status-ball-id="${escapeAttribute(ball.id)}">${receiptCreated ? "作成済み" : "未作成"}</strong>
            </div>
            <span class="receipt-thumb" data-receipt-thumb-ball-id="${escapeAttribute(ball.id)}"${receiptCreated ? "" : " hidden"} aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
            <button class="ghost-action detail-card-action" type="button" data-dialog-receipt-ball-id="${escapeAttribute(ball.id)}">見る</button>
          </article>
        </div>
        <div class="detail-folds">
          <details class="detail-fold">
            <summary>見せる範囲・ID</summary>
            <dl class="dialog-meta compact">
              ${renderDialogMetaRow("見せる範囲", visibilityLabels[ball.visibility])}
              ${renderDialogMetaRow("玉ID", renderExpandableBallId(ball.id), "html")}
            </dl>
          </details>
          <details class="detail-fold">
            <summary>その他</summary>
            <p class="detail-fold-note">入力者、承認、預かりは台帳の正式情報です。今は作成時の情報から自動で入ります。</p>
            <dl class="dialog-meta compact">
              ${renderDialogMetaRow("対象", ball.subject)}
              ${renderDialogMetaRow("日付", ball.date)}
              ${renderDialogMetaRow("作り方", issueLabel)}
              ${renderDialogMetaRow("玉数", `${ball.count}玉`)}
              ${renderDialogMetaRow("預かり", keepers)}
              ${renderDialogMetaRow("入力者", ball.enteredBy)}
              ${renderDialogMetaRow("承認", approvedBy)}
            </dl>
          </details>
        </div>
        <div class="dialog-actions">
          <button class="primary-action" type="button" data-dialog-edit-ball-id="${escapeAttribute(ball.id)}">編集</button>
        </div>
      </section>
    </div>
  `;
}

function renderDetailEcho(ball: HappyBall): string {
  if (!ball.emotionEcho) {
    return `<strong>ー</strong>`;
  }

  return `
    <span class="detail-echo-value">
      <span class="mini-ball detail-info-ball" style="${renderVisualStyle(ball.emotionEcho.visual)}" aria-hidden="true"></span>
      <strong>${escapeHtml(ball.emotionEcho.category)}</strong>
    </span>
  `;
}

function renderDialogMetaRow(label: string, value: string, mode: "text" | "html" = "text"): string {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${mode === "html" ? value : escapeHtml(value)}</dd>
    </div>
  `;
}

function renderExpandableBallId(id: string): string {
  return `
    <span class="detail-id-value">${escapeHtml(id)}</span>
    <button class="detail-id-toggle" type="button" data-detail-id-toggle>全表示</button>
  `;
}

function renderReceiptDialog(ball: HappyBall): string {
  return `
    <div class="ball-dialog-backdrop" data-dialog-backdrop>
      <section class="ball-dialog receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-dialog-title">
        <button class="dialog-close" type="button" data-dialog-close aria-label="閉じる">&times;</button>
        <div class="dialog-actions receipt-dialog-actions">
          <button class="ghost-action" type="button" data-dialog-back-to-ball-id="${escapeAttribute(ball.id)}">詳細へ戻る</button>
          <button class="ghost-action" type="button" data-show-ball-qr-id="${escapeAttribute(ball.id)}">QR表示</button>
          <button class="ghost-action" type="button" data-share-receipt-image-id="${escapeAttribute(ball.id)}">画像で送る</button>
          <button class="ghost-action" type="button" data-download-receipt-image-id="${escapeAttribute(ball.id)}">画像保存</button>
          <button class="ghost-action" type="button" data-copy-ball-url-id="${escapeAttribute(ball.id)}">URLコピー</button>
          <button class="ghost-action" type="button" data-copy-ball-line-url-id="${escapeAttribute(ball.id)}">LINE用URL</button>
        </div>
        ${renderReceiptPaper(ball, { idPrefix: "receipt-dialog", showUrl: true })}
      </section>
    </div>
  `;
}

function renderReceiptQrDialog(ball: HappyBall): string {
  const receiptTitle = receiptTitleLabels[ball.issuerType];
  const packetUrl = createPacketImportUrl(ball, window.location.href);
  let qrSvg: string;
  try {
    qrSvg = createQrSvg(packetUrl);
  } catch {
    qrSvg = `
      <div class="receipt-qr-error">
        <strong>QRを作れませんでした</strong>
        <span>玉URLが長すぎます。URLコピーまたはLINE用URLを使ってください。</span>
      </div>
    `;
  }

  return `
    <div class="ball-dialog-backdrop" data-dialog-backdrop>
      <section class="ball-dialog receipt-qr-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-qr-dialog-title">
        <button class="dialog-close" type="button" data-dialog-close aria-label="閉じる">&times;</button>
        <div class="dialog-actions receipt-dialog-actions">
          <button class="ghost-action" type="button" data-dialog-receipt-ball-id="${escapeAttribute(ball.id)}">${escapeHtml(receiptTitle)}へ戻る</button>
          <button class="ghost-action" type="button" data-copy-ball-url-id="${escapeAttribute(ball.id)}">URLコピー</button>
        </div>
        <div class="receipt-qr-panel">
          <div class="receipt-qr-heading">
            <span>えもい玉 ${escapeHtml(receiptTitle)}</span>
            <h2 id="receipt-qr-dialog-title">QRで預ける</h2>
          </div>
          <div class="receipt-qr-frame">${qrSvg}</div>
          <p class="receipt-qr-note">相手のスマホで読み取ると、届いた${escapeHtml(receiptTitle)}が開きます。</p>
        </div>
      </section>
    </div>
  `;
}

function renderReceiptQrBlock(packetUrl: string, receiptTitle: string): string {
  try {
    return `
      <div class="receipt-qr-frame">${createQrSvg(packetUrl)}</div>
      <p class="receipt-qr-note">相手のスマホで読み取ると、届いた${escapeHtml(receiptTitle)}が開きます。</p>
    `;
  } catch {
    return `
      <div class="receipt-qr-error">
        <strong>QRを作れませんでした</strong>
        <span>玉URLが長すぎます。URLコピーまたはLINE用URLを使ってください。</span>
      </div>
    `;
  }
}

function renderReceiptPaper(
  ball: HappyBall,
  options: { idPrefix: string; showUrl: boolean },
): string {
  const keepers = ball.keepers.length > 0 ? ball.keepers.join(", ") : "未設定";
  const packetUrl = options.showUrl ? createPacketImportUrl(ball, window.location.href) : "";
  const receiptTitle = receiptTitleLabels[ball.issuerType];
  const receiptStamp = ball.issuerType === "proxy" ? "預" : "託";
  const keeperLabel = ball.issuerType === "proxy" ? "預かり者" : "預け先";
  const showIssuer = canShowIssuer(ball);
  const showTitle = canShowTitle(ball);

  return `
    <article class="receipt-paper" aria-label="えもい玉 ${escapeAttribute(receiptTitle)}">
      <div class="receipt-stamp" aria-hidden="true">${escapeHtml(receiptStamp)}</div>
      <div class="receipt-head">
        <span>emoi dama app</span>
        <h2 id="${escapeAttribute(options.idPrefix)}-title">
          <span>えもい玉</span>
          <span>${escapeHtml(receiptTitle)}</span>
        </h2>
      </div>
      <div class="receipt-hero">
        <div class="dialog-ball receipt-ball ${renderEchoClass(ball)}" style="${renderBallVisualStyle(ball)} --ball-rotation: 0.18rad;" aria-hidden="true">
          <span class="ball-body">
            <span class="ball-core"></span>
            <span class="ball-shade"></span>
            <span class="ball-highlight"></span>
          </span>
          <span class="ball-label">${escapeHtml(createVisibilitySafeTitleLabel(ball))}</span>
        </div>
        <div>
          <span>${escapeHtml(ball.date)}</span>
          <strong>${escapeHtml(createVisibilitySafeSummaryLabel(ball))}</strong>
        </div>
      </div>
      <dl class="receipt-info">
        ${showIssuer ? renderReceiptRow("発行者", ball.issuedBy) : ""}
        ${showIssuer ? renderReceiptRow(keeperLabel, keepers) : ""}
        ${showTitle ? renderReceiptRow("タイトル", ball.title, "wide") : ""}
        ${renderReceiptFeelingRow(ball)}
        ${renderReceiptMemoRow(ball)}
      </dl>
      ${options.showUrl ? `
        <div class="receipt-url">
          <span>QRで開く</span>
          ${renderReceiptQrBlock(packetUrl, receiptTitle)}
        </div>
      ` : ""}
    </article>
  `;
}

function getExistingBallsForIncoming(incomingBalls: HappyBall[]): HappyBall[] {
  const existingById = new Map(ledger.balls.map((ball) => [ball.id, ball]));
  return incomingBalls
    .map((ball) => existingById.get(ball.id))
    .filter((ball): ball is HappyBall => Boolean(ball));
}

function renderReceiptFeelingRow(ball: HappyBall): string {
  const echo = ball.emotionEcho?.category ?? "ー";
  return `
    <div class="receipt-feeling-row">
      <dt>カテゴリ／余韻</dt>
      <dd>${escapeHtml(ball.category)}／${escapeHtml(echo)}</dd>
    </div>
  `;
}

function renderReceiptMemoRow(ball: HappyBall): string {
  const memo = ball.note.trim();
  if (!canShowMemo(ball) || (!memo && !appSettings.showMemoField)) {
    return "";
  }
  return renderReceiptRow("メモ", memo, "wide");
}

function formatIssueLabel(ball: HappyBall): string {
  if (ball.issuerType === "proxy") {
    return "代理発行";
  }

  const issuer = formatExternalPersonName(ball.issuedBy || ball.subject);
  if (ball.issuerType === "assisted") {
    return `${issuer}さん発行（いっしょに）`;
  }
  return `${issuer}さん発行`;
}

function formatIssuerCardHelper(ball: HappyBall): string {
  if (ball.issuerType === "proxy") {
    return `${formatSentencePersonName(ball.enteredBy)}さんが代理作成`;
  }
  if (ball.issuerType === "assisted") {
    return "いっしょに作成";
  }
  return "";
}

function formatSentencePersonName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "代理者";
  }
  return trimmed.endsWith("さん") ? trimmed.slice(0, -2) : trimmed;
}

function formatExternalPersonName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "自分" || trimmed === "本人") {
    return "発行者";
  }
  return trimmed.endsWith("さん") ? trimmed.slice(0, -2) : trimmed;
}

function renderReceiptRow(label: string, value: string, layout: "normal" | "wide" = "normal"): string {
  return `
    <div class="${layout === "wide" ? "receipt-info-wide" : ""}">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}

function renderBallEditDialog(ball: HappyBall): string {
  return `
    <div class="ball-dialog-backdrop" data-dialog-backdrop>
      <section class="ball-dialog" role="dialog" aria-modal="true" aria-labelledby="ball-edit-title">
        <button class="dialog-close" type="button" data-dialog-close aria-label="閉じる">&times;</button>
        <div class="dialog-title-block">
          <div class="edit-dialog-title-row">
            <h2 id="ball-edit-title">玉を編集</h2>
          </div>
        </div>
        <form id="ball-edit-form" class="edit-form" data-editing-ball-id="${escapeAttribute(ball.id)}">
          <div class="edit-inline-grid two">
            <label class="inline-field">
              <span>日付</span>
              <input name="date" type="date" value="${escapeAttribute(ball.date)}" />
            </label>
            <label class="inline-field">
              <span>玉数</span>
              <input name="count" type="number" min="1" max="12" value="${ball.count}" />
            </label>
          </div>

          <label class="inline-field">
            <span>だれの玉？</span>
            <div class="inline-field-stack">
              ${renderNamePresetSelect(ball.subject)}
              <input name="subject" type="text" value="${escapeAttribute(ball.subject)}" placeholder="自由に入力" />
            </div>
          </label>

          <label class="inline-field">
            <span>作り方</span>
            <select name="issuerType">
              ${renderOptions(issuerLabels, ball.issuerType)}
            </select>
          </label>

          <label class="inline-field">
            <span>タイトル</span>
            <input name="title" type="text" maxlength="48" value="${escapeAttribute(ball.title)}" />
          </label>

          <label class="inline-field">
            <span>見せる範囲</span>
            <select name="visibility">
              ${renderOptions(visibilityLabels, ball.visibility)}
            </select>
          </label>

          <details class="edit-category-fold">
            <summary>
              <span>カテゴリ</span>
              ${renderCurrentCategoryBadge(ball.category)}
            </summary>
            ${renderCategoryPalette(ball.category)}
          </details>

          <label class="inline-field textarea-field">
            <span>メモ</span>
            <textarea name="note" rows="4" maxlength="180">${escapeHtml(ball.note)}</textarea>
          </label>

          <div class="dialog-actions">
            <button class="primary-action" type="submit">保存</button>
            <button class="ghost-action" type="button" data-dialog-close>キャンセル</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function showBallDialog(ballId: string): void {
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }

  closeBallDialog();
  const root = document.createElement("div");
  root.id = BALL_DIALOG_ROOT_ID;
  root.innerHTML = renderBallDialog(ball);
  document.body.appendChild(root);

  const backdrop = root.querySelector<HTMLElement>("[data-dialog-backdrop]");
  const closeButton = root.querySelector<HTMLButtonElement>("[data-dialog-close]");
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeBallDialog();
    }
  });
  closeButton?.addEventListener("click", closeBallDialog);
  root.querySelectorAll<HTMLButtonElement>("[data-dialog-edit-ball-id]").forEach((button) => {
    button.addEventListener("click", () => {
      showBallEditDialog(ballId);
    });
  });
  root.querySelector<HTMLButtonElement>("[data-dialog-receipt-ball-id]")?.addEventListener("click", () => {
    showReceiptDialog(ballId);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-detail-id-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest("div");
      const expanded = row?.classList.toggle("is-expanded-id") ?? false;
      button.textContent = expanded ? "省略" : "全表示";
    });
  });
  installBallDialogEscapeHandler(closeBallDialog);
  closeButton?.focus({ preventScroll: true });
}

function showReceiptDialog(ballId: string): void {
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }

  closeBallDialog();
  const root = document.createElement("div");
  root.id = BALL_DIALOG_ROOT_ID;
  root.innerHTML = renderReceiptDialog(ball);
  document.body.appendChild(root);

  const backdrop = root.querySelector<HTMLElement>("[data-dialog-backdrop]");
  const closeButton = root.querySelector<HTMLButtonElement>("[data-dialog-close]");
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeBallDialog();
    }
  });
  closeButton?.addEventListener("click", closeBallDialog);
  root.querySelector<HTMLButtonElement>("[data-dialog-back-to-ball-id]")?.addEventListener("click", () => {
    showBallDialog(ballId);
  });
  root.querySelector<HTMLButtonElement>("[data-show-ball-qr-id]")?.addEventListener("click", () => {
    showReceiptQrDialog(ballId);
  });
  root.querySelector<HTMLButtonElement>("[data-share-receipt-image-id]")?.addEventListener("click", () => {
    void shareReceiptImage(ballId);
  });
  root.querySelector<HTMLButtonElement>("[data-download-receipt-image-id]")?.addEventListener("click", () => {
    void downloadReceiptImage(ballId);
  });
  root.querySelector<HTMLButtonElement>("[data-copy-ball-url-id]")?.addEventListener("click", () => {
    void copyBallUrl(ballId);
  });
  root.querySelector<HTMLButtonElement>("[data-copy-ball-line-url-id]")?.addEventListener("click", () => {
    void copyBallLineUrl(ballId);
  });
  installBallDialogEscapeHandler(closeBallDialog);
  closeButton?.focus({ preventScroll: true });
}

function showReceiptQrDialog(ballId: string): void {
  ledger = markReceiptCreated(ledger, ballId);
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }
  updateReceiptCreatedIndicators(ball);

  closeBallDialog();
  const root = document.createElement("div");
  root.id = BALL_DIALOG_ROOT_ID;
  root.innerHTML = renderReceiptQrDialog(ball);
  document.body.appendChild(root);

  const backdrop = root.querySelector<HTMLElement>("[data-dialog-backdrop]");
  const closeButton = root.querySelector<HTMLButtonElement>("[data-dialog-close]");
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeBallDialog();
    }
  });
  closeButton?.addEventListener("click", closeBallDialog);
  root.querySelector<HTMLButtonElement>("[data-dialog-receipt-ball-id]")?.addEventListener("click", () => {
    showReceiptDialog(ballId);
  });
  root.querySelector<HTMLButtonElement>("[data-copy-ball-url-id]")?.addEventListener("click", () => {
    void copyBallUrl(ballId);
  });
  installBallDialogEscapeHandler(closeBallDialog);
  closeButton?.focus({ preventScroll: true });
}

function showBallEditDialog(ballId: string): void {
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }

  closeBallDialog();
  const root = document.createElement("div");
  root.id = BALL_DIALOG_ROOT_ID;
  root.innerHTML = renderBallEditDialog(ball);
  document.body.appendChild(root);

  const backdrop = root.querySelector<HTMLElement>("[data-dialog-backdrop]");
  const closeButtons = root.querySelectorAll<HTMLButtonElement>("[data-dialog-close]");
  const form = root.querySelector<HTMLFormElement>("#ball-edit-form");
  const requestClose = () => requestCloseBallEditDialog(root, form, ball);
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      requestClose();
    }
  });
  closeButtons.forEach((button) => button.addEventListener("click", requestClose));
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    requestSaveBallEditDialog(root, form, ball);
  });
  bindNamePresetEvents(root);
  installBallDialogEscapeHandler(requestClose);
  root.querySelector<HTMLButtonElement>("[data-dialog-close]")?.focus({ preventScroll: true });
}

function closeBallDialog(): void {
  document.querySelector(`#${BALL_DIALOG_ROOT_ID}`)?.remove();
  document.removeEventListener("keydown", closeBallDialogOnEscape);
  activeBallDialogEscapeHandler = null;
}

function closeBallDialogOnEscape(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    activeBallDialogEscapeHandler?.();
  }
}

function installBallDialogEscapeHandler(handler: () => void): void {
  document.removeEventListener("keydown", closeBallDialogOnEscape);
  activeBallDialogEscapeHandler = handler;
  document.addEventListener("keydown", closeBallDialogOnEscape);
}

function saveBallEditForm(form: HTMLFormElement | null, saveMode: BallSaveMode): void {
  const editingId = form?.dataset.editingBallId;
  if (!form || !editingId) {
    return;
  }
  ledger = updateBall(ledger, editingId, readDraft(form), saveMode);
  selectedBallId = editingId;
  render();
  showBallDialog(editingId);
}

function requestSaveBallEditDialog(root: HTMLElement, form: HTMLFormElement | null, originalBall: HappyBall): void {
  if (!form) {
    return;
  }
  if (!hasEditDraftChanged(originalBall, readDraft(form))) {
    closeBallDialog();
    showBallDialog(originalBall.id);
    return;
  }

  showEditSaveModeConfirm(root, form, "save");
}

function requestCloseBallEditDialog(root: HTMLElement, form: HTMLFormElement | null, originalBall: HappyBall): void {
  if (!form || !hasEditDraftChanged(originalBall, readDraft(form))) {
    closeBallDialog();
    return;
  }

  showEditSaveModeConfirm(root, form, "close");
}

function showEditSaveModeConfirm(root: HTMLElement, form: HTMLFormElement, reason: "save" | "close"): void {
  const existing = root.querySelector<HTMLDivElement>("[data-edit-unsaved-confirm]");
  if (existing) {
    existing.remove();
  }

  const confirmRoot = document.createElement("div");
  confirmRoot.className = "edit-unsaved-backdrop";
  confirmRoot.dataset.editUnsavedConfirm = "true";
  const isClose = reason === "close";
  confirmRoot.innerHTML = `
    <section class="edit-unsaved-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-unsaved-title">
      <h3 id="edit-unsaved-title">${isClose ? "保存しますか？" : "保存方法を選んでください"}</h3>
      <p>${isClose ? "変更した内容があります。" : "前の状態を余韻に残すか、訂正として保存できます。"}</p>
      <div class="edit-unsaved-actions">
        <button class="primary-action" type="button" data-edit-save-echo>${isClose ? "余韻として保存して閉じる" : "余韻として保存"}</button>
        <button class="ghost-action" type="button" data-edit-save-correction>${isClose ? "訂正として保存して閉じる" : "訂正として保存"}</button>
        <button class="ghost-action" type="button" data-edit-continue>編集を続ける</button>
        ${isClose ? `<button class="ghost-action danger-action" type="button" data-edit-discard-close>保存せず閉じる</button>` : ""}
      </div>
    </section>
  `;
  root.appendChild(confirmRoot);
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-save-echo]")?.addEventListener("click", () => {
    saveBallEditForm(form, "withEcho");
  });
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-save-correction]")?.addEventListener("click", () => {
    saveBallEditForm(form, "correction");
  });
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-continue]")?.addEventListener("click", () => {
    confirmRoot.remove();
  });
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-discard-close]")?.addEventListener("click", closeBallDialog);
  confirmRoot.querySelector<HTMLButtonElement>("[data-edit-save-echo]")?.focus({ preventScroll: true });
}

function hasEditDraftChanged(ball: HappyBall, next: BallDraft): boolean {
  return (
    next.date !== ball.date ||
    next.subject.trim() !== ball.subject ||
    next.issuerType !== ball.issuerType ||
    Number(next.count) !== ball.count ||
    next.title.trim() !== ball.title ||
    next.category.trim() !== ball.category ||
    next.note.trim() !== ball.note ||
    next.visibility !== ball.visibility
  );
}

function renderToolsPanel(): string {
  return `
    <div class="tools-panel">
      <details class="settings-group name-book-settings">
        <summary class="panel-title">
          <h2>名前帳</h2>
          <button class="primary-action summary-action" form="name-book-form" type="submit">保存</button>
        </summary>
        <form id="name-book-form" class="name-book-form">
          ${renderNameBookSettingsFields()}
        </form>
      </details>

      <details class="settings-group category-settings">
        <summary class="panel-title">
          <h2>カテゴリ</h2>
          <button class="primary-action summary-action" form="category-settings-form" type="submit">保存</button>
        </summary>
        <div class="settings-group-actions">
          <button id="reset-categories" class="ghost-action" type="button">初期化</button>
        </div>
        <form id="category-settings-form" class="category-settings-form">
          ${renderCategorySettingsFields()}
        </form>
      </details>

      <details class="settings-group display-settings">
        <summary class="panel-title">
          <h2>表示</h2>
        </summary>
        <label class="inline-toggle">
          <input id="setting-memo-field" type="checkbox" ${appSettings.showMemoField ? "checked" : ""} />
          <span>メモ欄表示</span>
        </label>
        <p class="settings-copy">メモ本文を見せない玉でも、欄だけを伏せて表示します。メモも表示の玉では空欄も表示します。</p>
        <label class="select-control">
          <span>余韻光芒</span>
          <select id="setting-echo-strength">
            ${renderEchoStrengthOption("off", "無効")}
            ${renderEchoStrengthOption("weak", "弱")}
            ${renderEchoStrengthOption("medium", "中")}
            ${renderEchoStrengthOption("strong", "強")}
          </select>
        </label>
        <p class="settings-copy">カテゴリ再評価で残る前の感じの光を調整します。</p>
      </details>

      <details class="settings-group tuning-panel">
        <summary class="panel-title">
          <h2>質感設定</h2>
        </summary>
        <label class="inline-toggle">
          <input id="setting-sound" type="checkbox" ${appSettings.soundEnabled ? "checked" : ""} />
          <span>Sound</span>
        </label>
        <label class="inline-toggle">
          <input id="setting-gravity" type="checkbox" ${appSettings.gravityEnabled ? "checked" : ""} />
          <span>重力センサー</span>
        </label>
        ${renderRange("setting-wall", "Wall Bounce", appSettings.wallRestitution, 0, 1, 0.01)}
        ${renderRange("setting-contact", "Contact Bounce", appSettings.contactRestitution, 0, 1, 0.01)}
        ${renderRange("setting-damping", "Damping", appSettings.linearDamping, 0, 2, 0.01)}
        ${renderRange("setting-flick", "Flick Power", appSettings.flickPower, 0.2, 2.2, 0.01)}
        ${renderRange("setting-speed", "Max Speed", appSettings.maxSpeed, 400, 5000, 50)}
        ${renderRange("setting-gravity-strength", "Gravity", appSettings.gravityStrength, 80, 1800, 20)}
        ${renderRange("setting-volume", "Volume", appSettings.masterVolume, 0, 1, 0.01)}
        ${renderRange("setting-pitch", "Pitch", appSettings.frequencyHz, 200, 4200, 20)}
        ${renderRange("setting-duration", "Sound Len.", appSettings.durationMs, 30, 420, 10)}
        <details class="settings-json">
          <summary>設定JSON</summary>
          <textarea id="settings-json" rows="8">${escapeHtml(JSON.stringify(appSettings, null, 2))}</textarea>
          <div class="button-row">
            <button id="apply-settings-json" class="ghost-action" type="button">JSONを適用</button>
            <button id="copy-settings-json" class="ghost-action" type="button">コピー</button>
          </div>
        </details>
      </details>

      <details class="settings-group export-panel">
        <summary class="panel-title">
          <h2>JSONエクスポート</h2>
          <button id="export-json" class="primary-action summary-action" type="button">書き出し</button>
        </summary>
        <p class="settings-copy">ファイル名に選択した内容が入ります。個人情報を含む台帳データは必要なときだけ共有してください。</p>
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
          <button id="import-json" class="ghost-action" type="button">JSON読み込み</button>
          <input id="import-json-file" type="file" accept="application/json,.json" hidden />
        </div>
      </details>

      <details class="settings-group ledger-panel">
        <summary class="panel-title">
          <h2>台帳JSON</h2>
          <button id="copy-json" class="primary-action summary-action" type="button">コピー</button>
        </summary>
        <pre>${escapeHtml(serializeLedger(ledger))}</pre>
      </details>

      <details class="settings-group ball-management-panel">
        <summary class="panel-title">
          <h2>玉管理</h2>
        </summary>
        <p class="settings-copy">保存された玉の選択、編集、削除、共有URLコピーを行います。</p>
        <div class="settings-group-actions">
          <button class="ghost-action" type="button" data-open-panel="list">保存された玉を開く</button>
        </div>
      </details>

      <details class="settings-group danger-zone">
        <summary class="panel-title">
          <h2>データ管理</h2>
        </summary>
        <button class="danger-action" id="clear-ledger" type="button">台帳を空にする</button>
      </details>
    </div>
  `;
}

function renderLedgerList(): string {
  if (ledger.balls.length === 0) {
    return `<p class="empty-copy">まだ保存された玉はありません。</p>`;
  }

  return `
    <div class="ledger-list">
      ${ledger.balls
        .map(
          (ball) => `
            <article class="ledger-item ${ball.id === selectedBallId ? "is-selected" : ""}">
              <button class="ledger-select" type="button" data-select-ball-id="${escapeAttribute(ball.id)}">
                <span>${escapeHtml(ball.date)} / ${escapeHtml(ball.subject)}</span>
                <strong>${escapeHtml(ball.title)}</strong>
                <small>${escapeHtml(issuerLabels[ball.issuerType])} / ${escapeHtml(ball.category)} / ${ball.count}玉</small>
              </button>
              <div class="ledger-actions">
                <button class="share-ball" type="button" data-copy-ball-url-id="${escapeAttribute(ball.id)}" aria-label="${escapeAttribute(ball.title)}のURLをコピー">URL</button>
                <button class="share-ball" type="button" data-copy-ball-line-url-id="${escapeAttribute(ball.id)}" aria-label="${escapeAttribute(ball.title)}のLINE用URLをコピー">LINE</button>
                <button class="edit-ball" type="button" data-edit-ball-id="${escapeAttribute(ball.id)}" aria-label="${escapeAttribute(ball.title)}を編集">編集</button>
                <button class="delete-ball" type="button" data-delete-ball-id="${escapeAttribute(ball.id)}" aria-label="${escapeAttribute(ball.title)}を削除">削除</button>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function mountRapierStage(balls: HappyBall[]): void {
  const field = document.querySelector<HTMLDivElement>("#ball-field");
  if (!field || !rapierReady) {
    return;
  }

  physicsStage = new RapierStage(
    field,
    expandVisualBalls(balls),
    (ballId) => {
      selectedBallId = ballId;
      updateSelectedState();
      updateSelectedSummary();
    },
    (ballId) => {
      selectedBallId = ballId;
      updateSelectedState();
      updateSelectedSummary();
      showBallDialog(ballId);
    },
    appSettings,
    audioEngine,
  );
  physicsStage.start();
}

function expandVisualBalls(balls: HappyBall[]): VisualBallSource[] {
  return balls.flatMap((ball) => {
    const count = Math.max(1, Math.min(ball.count, 12));
    return Array.from({ length: count }, (_, index) => {
      const label = createBallDisplayLabel(ball, appSettings.ballLabelMode);
      return {
        id: `${ball.id}_${index}`,
        ballId: ball.id,
        hue: ball.visual.hue,
        saturation: ball.visual.saturation,
        lightness: ball.visual.lightness,
        echo: shouldShowEmotionEcho(ball) ? ball.emotionEcho?.visual ?? null : null,
        snapshot: physicsSnapshots.get(`${ball.id}_${index}`) ?? null,
        label,
        labelClass: createBallLabelClass(label),
        title: ball.title,
      };
    });
  });
}

function createBallDisplayLabel(ball: HappyBall, mode: BallLabelMode): string {
  if (mode === "date") {
    return formatBallDateLabel(ball.date);
  }
  if (mode === "title") {
    return createVisibilitySafeTitleLabel(ball);
  }
  return "";
}

function createVisibilitySafeTitleLabel(ball: HappyBall): string {
  if (ball.visibility === "category") {
    return Array.from(ball.category.trim() || "玉").slice(0, 16).join("");
  }
  if (ball.visibility === "issuer") {
    return Array.from(ball.issuedBy.trim() || ball.subject.trim() || "発行者").slice(0, 16).join("");
  }
  return Array.from(ball.title.trim() || ball.visual.label).slice(0, 32).join("");
}

function createBallLabelClass(label: string): string {
  const length = Array.from(label).length;
  if (length <= 4) {
    return "label-short";
  }
  if (length <= 8) {
    return "label-medium";
  }
  if (length <= 16) {
    return "label-long";
  }
  return "label-xlong";
}

function formatBallDateLabel(date: string): string {
  const [, month, day] = date.split("-");
  return month && day ? `${Number(month)}/${Number(day)}` : date;
}

function countVisualBalls(balls: HappyBall[]): number {
  return balls.reduce((sum, ball) => sum + Math.max(1, Math.min(ball.count, 12)), 0);
}

function updateSelectedState(): void {
  document.querySelectorAll(".ledger-item").forEach((item) => {
    const select = item.querySelector<HTMLElement>("[data-select-ball-id]");
    item.classList.toggle("is-selected", select?.dataset.selectBallId === selectedBallId);
  });
}

function updateSelectedSummary(): void {
  const selectedBall = getVisibleBalls().find((ball) => ball.id === selectedBallId) ?? null;
  const title = document.querySelector<HTMLElement>("#stage-title");
  if (title) {
    title.textContent = selectedBall ? createVisibilitySafeSummaryLabel(selectedBall) : "最初の玉を置く";
  }
}

function renderDialogDetail(ball: HappyBall): string {
  return renderMemoSurface(getMemoSurfaceMode(ball.visibility, ball.note, appSettings.showMemoField), ball.note);
}

function createVisibilitySafeSummaryLabel(ball: HappyBall): string {
  if (ball.visibility === "category") {
    return ball.category || "玉";
  }
  if (ball.visibility === "issuer") {
    return ball.issuedBy || ball.subject || "発行者";
  }
  return ball.title || ball.visual.label || ball.category || "玉";
}

function canShowIssuer(ball: HappyBall): boolean {
  return ball.visibility === "issuer" || ball.visibility === "title" || ball.visibility === "open";
}

function canShowTitle(ball: HappyBall): boolean {
  return ball.visibility === "title" || ball.visibility === "open";
}

function canShowMemo(ball: HappyBall): boolean {
  return canShowMemoText(ball.visibility);
}

function renderMemoSurface(mode: MemoSurfaceMode, note: string): string {
  if (mode === "none") {
    return "";
  }
  if (mode === "visible" || mode === "visible-empty") {
    return renderVisibleMemoSurface(note);
  }
  return renderPrivateMemoSurface(mode);
}

function renderVisibleMemoSurface(note: string): string {
  const memo = note.trim();
  return `
    <section class="dialog-memo ${memo ? "" : "is-empty"}" aria-label="メモ">
      <span>メモ</span>
      <p>${memo ? escapeHtml(memo) : ""}</p>
    </section>
  `;
}

function renderPrivateMemoSurface(mode: Extract<MemoSurfaceMode, "private-obscured" | "private-empty">): string {
  const body = mode === "private-obscured"
    ? `
      <p class="memo-obscured" aria-label="非公開メモがあります">
        <span style="--memo-line: 68%"></span>
        <span style="--memo-line: 42%"></span>
        <span style="--memo-line: 56%"></span>
      </p>
    `
    : `<p aria-label="メモは未入力です"></p>`;

  return `
    <section class="dialog-memo ${mode === "private-obscured" ? "is-private" : "is-empty"}" aria-label="メモ欄">
      <span>メモ</span>
      ${body}
    </section>
  `;
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-open-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = button.dataset.openPanel;
      if (!isActiveOverlay(panel)) {
        return;
      }
      if (panel === "calendar") {
        calendarMonth = displayAnchorDate.slice(0, 7);
      }
      activeOverlay = panel;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-display-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = readDisplayMode(button.dataset.displayMode);
      if (!mode) {
        return;
      }
      displayMode = mode;
      draft = { ...draft, date: displayAnchorDate };
      render();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-close-panel]").forEach((element) => {
    element.addEventListener("click", (event) => {
      const isBackdrop = element.classList.contains("panel-backdrop");
      if (isBackdrop && event.target !== element) {
        return;
      }
      activeOverlay = "none";
      render();
    });
  });

  document.querySelector("#label-toggle")?.addEventListener("click", () => {
    updateAppSettings({ ballLabelMode: nextBallLabelMode(appSettings.ballLabelMode) });
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-calendar-month]").forEach((button) => {
    button.addEventListener("click", () => {
      calendarMonth = button.dataset.calendarMonth || calendarMonth;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-filter-date]").forEach((button) => {
    button.addEventListener("click", () => {
      displayAnchorDate = button.dataset.filterDate ?? displayAnchorDate;
      displayMode = "day";
      if (displayAnchorDate) {
        draft = { ...draft, date: displayAnchorDate };
      }
      activeOverlay = "none";
      render();
    });
  });

  bindDisplaySwipeEvents();

  const form = document.querySelector<HTMLFormElement>("#ball-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    audioEngine.unlock();
    draft = readDraft(form);
    ledger = addBall(ledger, draft);
    selectedBallId = ledger.balls[0]?.id ?? null;
    displayAnchorDate = draft.date;
    displayMode = "day";
    activeOverlay = "none";
    draft = { ...createDefaultDraft(getPrimarySelfName(ledger)), subject: draft.subject, issuerType: draft.issuerType };
    render();
  });

  form?.addEventListener("input", () => {
    draft = readDraft(form);
  });

  bindSummaryActionEvents();
  bindPendingUrlPacketEvents();
  bindNamePresetEvents();
  bindNameBookSettingsEvents();
  bindTuningEvents();
  bindCategorySettingsEvents();

  document.querySelector("#clear-ledger")?.addEventListener("click", () => {
    if (!confirm("保存された玉をすべて消しますか？")) {
      return;
    }
    ledger = clearLedger();
    selectedBallId = null;
    render();
  });

  document.querySelector("#copy-json")?.addEventListener("click", async () => {
    await copyTextWithFallback(serializeLedger(ledger), "台帳JSONをコピーしました。");
  });

  document.querySelector("#export-json")?.addEventListener("click", () => {
    exportSelectedJson();
  });

  document.querySelector("#import-json")?.addEventListener("click", () => {
    document.querySelector<HTMLInputElement>("#import-json-file")?.click();
  });
  document.querySelector<HTMLInputElement>("#import-json-file")?.addEventListener("change", (event) => {
    const input = event.currentTarget;
    if (input instanceof HTMLInputElement) {
      void handleJsonImportFile(input);
    }
  });

  bindJsonImportEvents();

  document.querySelectorAll<HTMLButtonElement>("[data-select-ball-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedBallId = button.dataset.selectBallId ?? selectedBallId;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-edit-ball-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.editBallId;
      if (!id) {
        return;
      }
      selectedBallId = id;
      updateSelectedState();
      updateSelectedSummary();
      showBallEditDialog(id);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-copy-ball-url-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.copyBallUrlId;
      if (id) {
        void copyBallUrl(id);
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-copy-ball-line-url-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.copyBallLineUrlId;
      if (id) {
        void copyBallLineUrl(id);
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-delete-ball-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteBallId;
      if (!id) {
        return;
      }
      const target = ledger.balls.find((ball) => ball.id === id);
      if (!target || !confirm(`「${target.title}」を削除しますか？`)) {
        return;
      }
      ledger = deleteBall(ledger, id);
      selectedBallId = ledger.balls[0]?.id ?? null;
      render();
    });
  });
}

function bindSummaryActionEvents(): void {
  document.querySelectorAll<HTMLButtonElement>(".summary-action").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });
}

function exportSelectedJson(): void {
  const sections = Array.from(document.querySelectorAll<HTMLInputElement>("input[name='export-section']:checked"))
    .map((input) => input.value)
    .filter(isExportSection);

  if (sections.length === 0) {
    alert("書き出す内容を選んでください。");
    return;
  }

  const payload = createExportPayload(sections, { ledger, appSettings, categories: editableCategories });
  downloadJsonFile(payload, createExportFileName(sections));
}

function downloadJsonFile(payload: unknown, fileName: string): void {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function handleJsonImportFile(input: HTMLInputElement): Promise<void> {
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }

  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    pendingJsonImport = reviewJsonImport(parsed, file.name, ledger);
  } catch {
    pendingJsonImport = {
      fileName: file.name,
      sections: [],
      error: "JSONファイルを読み込めませんでした。",
    };
  }
  activeOverlay = "none";
  render();
}

function bindJsonImportEvents(): void {
  document.querySelector("#dismiss-json-import")?.addEventListener("click", () => {
    pendingJsonImport = null;
    render();
  });

  document.querySelector("#confirm-json-import")?.addEventListener("click", () => {
    applyPendingJsonImport();
  });
}

function applyPendingJsonImport(): void {
  if (!pendingJsonImport || pendingJsonImport.error) {
    return;
  }

  const selected = new Set(
    Array.from(document.querySelectorAll<HTMLInputElement>("input[name='json-import-section']:checked"))
      .map((input) => input.value)
      .filter(isExportSection),
  );

  if (selected.size === 0) {
    alert("読み込む内容を選んでください。");
    return;
  }

  if (selected.has("ledger") && pendingJsonImport.ledger) {
    ledger = importNewBalls(ledger, pendingJsonImport.ledger.newItems);
    if (pendingJsonImport.ledger.nameBookToAdd.length > 0) {
      ledger = updateNameBook(ledger, [...ledger.ownerProfile.nameBook, ...pendingJsonImport.ledger.nameBookToAdd]);
    }
    selectedBallId = pendingJsonImport.ledger.newItems[0]?.id ?? selectedBallId;
  }

  if (selected.has("appSettings") && pendingJsonImport.appSettings) {
    appSettings = pendingJsonImport.appSettings;
    saveAppSettings(appSettings);
  }

  if (selected.has("categories") && pendingJsonImport.categories) {
    editableCategories = saveCategoryColorPresets(pendingJsonImport.categories);
  }

  pendingJsonImport = null;
  activeOverlay = "none";
  render();
}

async function shareReceiptImage(ballId: string): Promise<void> {
  const prepared = prepareReceiptImageBall(ballId);
  if (!prepared) {
    return;
  }

  const { ball } = prepared;
  const fileName = createReceiptImageFileName(ball);
  const blob = await createReceiptImageBlob(ball);
  const file = new File([blob], fileName, { type: "image/png" });

  try {
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      throw new Error("File sharing is unavailable.");
    }
    await navigator.share({
      files: [file],
      title: `えもい玉 ${receiptTitleLabels[ball.issuerType]}`,
      text: `${receiptTitleLabels[ball.issuerType]}です。`,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    downloadBlob(blob, fileName);
    alert("この端末では直接共有できなかったため、画像として保存しました。LINEで画像添付してください。");
  }
}

async function downloadReceiptImage(ballId: string): Promise<void> {
  const prepared = prepareReceiptImageBall(ballId);
  if (!prepared) {
    return;
  }

  const blob = await createReceiptImageBlob(prepared.ball);
  downloadBlob(blob, createReceiptImageFileName(prepared.ball));
}

function prepareReceiptImageBall(ballId: string): { ball: HappyBall } | null {
  ledger = markReceiptCreated(ledger, ballId);
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return null;
  }
  updateReceiptCreatedIndicators(ball);
  return { ball };
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function createReceiptImageFileName(ball: HappyBall): string {
  const title = (ball.title || ball.category || "emoi-dama")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .slice(0, 32) || "emoi-dama";
  return `emoi-dama-${ball.date}-${receiptTitleLabels[ball.issuerType]}-${title}.png`;
}

async function createReceiptImageBlob(ball: HappyBall): Promise<Blob> {
  const width = 1080;
  const height = 1800;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable.");
  }

  drawReceiptImage(context, ball, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error("Receipt image could not be created."));
      }
    }, "image/png");
  });
  return blob;
}

function drawReceiptImage(context: CanvasRenderingContext2D, ball: HappyBall, width: number, height: number): void {
  const receiptTitle = receiptTitleLabels[ball.issuerType];
  const stamp = ball.issuerType === "proxy" ? "預" : "託";
  const packetUrl = createPacketImportUrl(ball, window.location.href);
  const margin = 72;
  const contentWidth = width - margin * 2;
  let y = 86;

  context.fillStyle = "#f4e6c9";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(255, 255, 255, 0.32)";
  context.fillRect(0, 0, width, 360);
  context.strokeStyle = "rgba(96, 63, 23, 0.2)";
  context.lineWidth = 3;
  drawRoundedRect(context, 38, 38, width - 76, height - 76, 18);
  context.stroke();

  context.fillStyle = "#6b5638";
  context.font = "900 28px sans-serif";
  context.fillText("emoi dama app", margin, y);
  y += 76;

  context.fillStyle = "#2c2418";
  context.font = "900 62px 'Yu Mincho', 'Hiragino Mincho ProN', serif";
  context.fillText("えもい玉", margin, y);
  y += 72;
  context.fillText(receiptTitle, margin, y);

  drawReceiptStamp(context, width - margin - 92, 86, 92, stamp);

  y += 82;
  drawReceiptHero(context, ball, margin, y, contentWidth);
  y += 174;

  const rows = createReceiptImageRows(ball);
  y = drawReceiptRows(context, rows, margin, y, contentWidth);
  y += 34;

  context.fillStyle = "#6b5638";
  context.font = "900 28px sans-serif";
  context.textAlign = "center";
  context.fillText("QRで開く", width / 2, y);
  y += 28;

  const qr = createQrCode(packetUrl);
  drawQrImage(context, qr, width / 2 - 180, y, 360);
  y += 392;

  context.fillStyle = "#5e4a2f";
  context.font = "900 28px sans-serif";
  drawCenteredWrappedText(context, `相手のスマホで読み取ると、届いた${receiptTitle}が開きます。`, width / 2, y, contentWidth, 36);
  context.textAlign = "left";
}

function drawReceiptStamp(context: CanvasRenderingContext2D, x: number, y: number, size: number, text: string): void {
  context.save();
  context.translate(x + size / 2, y + size / 2);
  context.rotate(-0.16);
  context.strokeStyle = "rgba(129, 36, 30, 0.62)";
  context.lineWidth = 5;
  context.beginPath();
  context.arc(0, 0, size / 2, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "rgba(129, 36, 30, 0.72)";
  context.font = "900 46px 'Yu Mincho', 'Hiragino Mincho ProN', serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 0, 3);
  context.restore();
}

function drawReceiptHero(context: CanvasRenderingContext2D, ball: HappyBall, x: number, y: number, width: number): void {
  context.fillStyle = "rgba(255, 250, 237, 0.68)";
  context.strokeStyle = "rgba(96, 63, 23, 0.18)";
  context.lineWidth = 2;
  drawRoundedRect(context, x, y, width, 132, 16);
  context.fill();
  context.stroke();

  drawReceiptBall(context, ball, x + 76, y + 66, 84);
  context.fillStyle = "#6b5638";
  context.font = "900 28px sans-serif";
  context.fillText(ball.date, x + 154, y + 48);
  context.fillStyle = "#2c2418";
  context.font = "900 40px sans-serif";
  drawWrappedText(context, createVisibilitySafeSummaryLabel(ball), x + 154, y + 92, width - 190, 45, 2);
}

function drawReceiptBall(context: CanvasRenderingContext2D, ball: HappyBall, cx: number, cy: number, size: number): void {
  const radius = size / 2;
  const gradient = context.createRadialGradient(cx - radius * 0.34, cy - radius * 0.38, 6, cx, cy, radius);
  gradient.addColorStop(0, "#fff8dd");
  gradient.addColorStop(0.28, `hsl(${ball.visual.hue} ${ball.visual.saturation}% ${Math.min(ball.visual.lightness + 12, 86)}%)`);
  gradient.addColorStop(1, `hsl(${ball.visual.hue} ${ball.visual.saturation}% ${Math.max(ball.visual.lightness - 14, 18)}%)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();
}

function createReceiptImageRows(ball: HappyBall): Array<{ label: string; value: string; wide?: boolean }> {
  const keeperLabel = ball.issuerType === "proxy" ? "預かり者" : "預け先";
  const keepers = ball.keepers.length > 0 ? ball.keepers.join(", ") : "未設定";
  const rows: Array<{ label: string; value: string; wide?: boolean }> = [];
  if (canShowIssuer(ball)) {
    rows.push({ label: "発行者", value: ball.issuedBy });
    rows.push({ label: keeperLabel, value: keepers });
  }
  if (canShowTitle(ball)) {
    rows.push({ label: "タイトル", value: ball.title, wide: true });
  }
  rows.push({ label: "カテゴリ／余韻", value: `${ball.category}／${ball.emotionEcho?.category ?? "ー"}`, wide: true });
  if (canShowMemo(ball) && (ball.note.trim() || appSettings.showMemoField)) {
    rows.push({ label: "メモ", value: ball.note.trim(), wide: true });
  }
  return rows;
}

function drawReceiptRows(
  context: CanvasRenderingContext2D,
  rows: Array<{ label: string; value: string; wide?: boolean }>,
  x: number,
  y: number,
  width: number,
): number {
  const gap = 12;
  const columnWidth = (width - gap) / 2;
  let cursorY = y;
  let halfRow: { label: string; value: string } | null = null;

  for (const row of rows) {
    if (row.wide) {
      if (halfRow) {
        drawReceiptRowBox(context, halfRow, x, cursorY, columnWidth);
        cursorY += 102 + gap;
        halfRow = null;
      }
      const height = Math.max(102, estimateWrappedLineCount(context, row.value, width - 44) * 34 + 62);
      drawReceiptRowBox(context, row, x, cursorY, width, height);
      cursorY += height + gap;
    } else if (halfRow) {
      drawReceiptRowBox(context, halfRow, x, cursorY, columnWidth);
      drawReceiptRowBox(context, row, x + columnWidth + gap, cursorY, columnWidth);
      cursorY += 102 + gap;
      halfRow = null;
    } else {
      halfRow = row;
    }
  }

  if (halfRow) {
    drawReceiptRowBox(context, halfRow, x, cursorY, columnWidth);
    cursorY += 102 + gap;
  }

  return cursorY;
}

function drawReceiptRowBox(
  context: CanvasRenderingContext2D,
  row: { label: string; value: string },
  x: number,
  y: number,
  width: number,
  height = 102,
): void {
  context.fillStyle = "rgba(255, 250, 237, 0.54)";
  context.strokeStyle = "rgba(96, 63, 23, 0.16)";
  context.lineWidth = 2;
  drawRoundedRect(context, x, y, width, height, 10);
  context.fill();
  context.stroke();

  context.fillStyle = "#6b5638";
  context.font = "900 25px sans-serif";
  context.fillText(row.label, x + 22, y + 33);
  context.fillStyle = "#2c2418";
  context.font = "900 31px sans-serif";
  drawWrappedText(context, row.value || "ー", x + 22, y + 76, width - 44, 34, Math.max(1, Math.floor((height - 54) / 34)));
}

function drawQrImage(context: CanvasRenderingContext2D, qr: QrCodeMatrix, x: number, y: number, size: number): void {
  const quietZone = 4;
  const totalModules = qr.size + quietZone * 2;
  const moduleSize = size / totalModules;
  context.fillStyle = "#fffdf4";
  context.fillRect(x, y, size, size);
  context.fillStyle = "#17241f";
  qr.modules.forEach((row, rowIndex) => {
    row.forEach((isDark, columnIndex) => {
      if (isDark) {
        context.fillRect(
          x + (columnIndex + quietZone) * moduleSize,
          y + (rowIndex + quietZone) * moduleSize,
          Math.ceil(moduleSize),
          Math.ceil(moduleSize),
        );
      }
    });
  });
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
): number {
  const lines = wrapCanvasText(context, text, maxWidth, maxLines);
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function drawCenteredWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const lines = wrapCanvasText(context, text, maxWidth, 3);
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
}

function estimateWrappedLineCount(context: CanvasRenderingContext2D, text: string, maxWidth: number): number {
  return wrapCanvasText(context, text || "ー", maxWidth, 6).length;
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const source = Array.from((text || "ー").replace(/\s+/g, " ").trim() || "ー");
  const lines: string[] = [];
  let current = "";

  for (const char of source) {
    const next = `${current}${char}`;
    if (current && context.measureText(next).width > maxWidth) {
      lines.push(current);
      current = char;
      if (lines.length === maxLines) {
        const last = lines[maxLines - 1];
        lines[maxLines - 1] = `${Array.from(last).slice(0, Math.max(1, Array.from(last).length - 1)).join("")}…`;
        return lines;
      }
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
}

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function bindPendingUrlPacketEvents(): void {
  document.querySelector("#dismiss-url-packet")?.addEventListener("click", () => {
    if (pendingUrlPacket?.ok) {
      snoozedUrlPacket = pendingUrlPacket;
    }
    pendingUrlPacket = null;
    render();
  });

  document.querySelector("#clear-url-packet")?.addEventListener("click", () => {
    pendingUrlPacket = null;
    snoozedUrlPacket = null;
    clearLocationPacketParams();
    render();
  });

  document.querySelector("#show-snoozed-url-packet")?.addEventListener("click", () => {
    pendingUrlPacket = snoozedUrlPacket;
    snoozedUrlPacket = null;
    render();
  });

  document.querySelector("#clear-snoozed-url-packet")?.addEventListener("click", () => {
    pendingUrlPacket = null;
    snoozedUrlPacket = null;
    clearLocationPacketParams();
    render();
  });

  document.querySelector("#confirm-url-import")?.addEventListener("click", () => {
    if (!pendingUrlPacket?.ok) {
      return;
    }
    const review = reviewPacketImport(pendingUrlPacket.packet, ledger.balls);
    ledger = importNewBalls(ledger, review.newItems);
    selectedBallId = review.newItems[0]?.id ?? selectedBallId;
    displayAnchorDate = review.newItems[0]?.date ?? displayAnchorDate;
    displayMode = "day";
    activeOverlay = "none";
    pendingUrlPacket = null;
    snoozedUrlPacket = null;
    clearLocationPacketParams();
    render();
  });

  document.querySelector("#replace-url-import")?.addEventListener("click", () => {
    if (!pendingUrlPacket?.ok) {
      return;
    }
    const review = reviewPacketImport(pendingUrlPacket.packet, ledger.balls);
    if (review.conflicts.length === 0) {
      return;
    }
    ledger = importNewAndReplaceBalls(ledger, review.newItems, review.conflicts);
    selectedBallId = review.newItems[0]?.id ?? review.conflicts[0]?.id ?? selectedBallId;
    displayAnchorDate = review.newItems[0]?.date ?? review.conflicts[0]?.date ?? displayAnchorDate;
    displayMode = "day";
    activeOverlay = "none";
    pendingUrlPacket = null;
    snoozedUrlPacket = null;
    clearLocationPacketParams();
    render();
  });
}

async function copyBallUrl(ballId: string): Promise<void> {
  ledger = markReceiptCreated(ledger, ballId);
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }
  updateReceiptCreatedIndicators(ball);

  const url = createPacketImportUrl(ball, window.location.href);
  await copyTextWithFallback(url, "玉URLをコピーしました。");
}

async function copyBallLineUrl(ballId: string): Promise<void> {
  ledger = markReceiptCreated(ledger, ballId);
  const ball = ledger.balls.find((item) => item.id === ballId);
  if (!ball) {
    return;
  }
  updateReceiptCreatedIndicators(ball);

  const url = createLinePacketImportUrl(ball, window.location.href);
  await copyTextWithFallback(url, "LINE用の玉URLをコピーしました。");
}

function updateReceiptCreatedIndicators(ball: HappyBall): void {
  if (!ball.receiptCreatedAt) {
    return;
  }

  document.querySelectorAll<HTMLElement>("[data-receipt-status-ball-id]").forEach((element) => {
    if (element.dataset.receiptStatusBallId === ball.id) {
      element.textContent = "作成済み";
    }
  });
  document.querySelectorAll<HTMLElement>("[data-receipt-thumb-ball-id]").forEach((element) => {
    if (element.dataset.receiptThumbBallId === ball.id) {
      element.hidden = false;
    }
  });
}

async function copyTextWithFallback(text: string, successMessage: string): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API is unavailable.");
    }
    await navigator.clipboard.writeText(text);
    alert(successMessage);
    return;
  } catch {
    if (copyTextWithLegacySelection(text)) {
      alert(successMessage);
      return;
    }

    showManualCopyDialog(text);
  }
}

function copyTextWithLegacySelection(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  textarea.remove();
  if (previousRange && selection) {
    selection.removeAllRanges();
    selection.addRange(previousRange);
  }
  return copied;
}

function showManualCopyDialog(text: string): void {
  const root = document.createElement("div");
  root.id = "manual-copy-root";
  root.innerHTML = `
    <div class="ball-dialog-backdrop" data-manual-copy-backdrop>
      <section class="ball-dialog manual-copy-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-copy-title">
        <button class="dialog-close" type="button" data-manual-copy-close aria-label="閉じる">&times;</button>
        <div class="dialog-title-block">
          <span>コピー補助</span>
          <h2 id="manual-copy-title">自動コピーできませんでした</h2>
        </div>
        <p class="dialog-detail">下の欄は全選択されています。端末のコピー操作でコピーしてください。</p>
        <textarea class="manual-copy-text" rows="10" readonly>${escapeHtml(text)}</textarea>
      </section>
    </div>
  `;
  document.body.appendChild(root);

  const close = () => root.remove();
  const textarea = root.querySelector<HTMLTextAreaElement>(".manual-copy-text");
  root.querySelector("[data-manual-copy-close]")?.addEventListener("click", close);
  root.querySelector("[data-manual-copy-backdrop]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      close();
    }
  });
  textarea?.focus({ preventScroll: true });
  textarea?.select();
}

function clearLocationPacketParams(): void {
  const params = new URLSearchParams(location.search);
  params.delete("import");
  params.delete("ball");
  params.delete("openExternalBrowser");
  const search = params.toString();
  history.replaceState(null, document.title, `${location.pathname}${search ? `?${search}` : ""}`);
}

function bindDisplaySwipeEvents(): void {
  const field = document.querySelector<HTMLElement>("#ball-field");
  if (!field) {
    return;
  }

  field.addEventListener("pointerdown", (event) => {
    if (isBallInteractionTarget(event.target)) {
      stageSwipeStart = null;
      return;
    }
    stageSwipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  });

  field.addEventListener("pointerup", (event) => {
    if (!stageSwipeStart || stageSwipeStart.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - stageSwipeStart.x;
    const deltaY = event.clientY - stageSwipeStart.y;
    stageSwipeStart = null;
    if (Math.abs(deltaX) < 72 || Math.abs(deltaY) > 64) {
      return;
    }
    navigateDisplayPeriod(deltaX < 0 ? 1 : -1);
  });

  field.addEventListener("pointercancel", () => {
    stageSwipeStart = null;
  });
}

function isBallInteractionTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(".physics-ball"));
}

function handleDisplayNavigationKey(event: KeyboardEvent): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
    return;
  }
  if (activeOverlay !== "none" || document.querySelector(`#${BALL_DIALOG_ROOT_ID}`)) {
    return;
  }
  if (isEditableKeyboardTarget(event.target)) {
    return;
  }
  event.preventDefault();
  navigateDisplayPeriod(event.key === "ArrowRight" ? 1 : -1);
}

function navigateDisplayPeriod(delta: -1 | 1): void {
  if (activeOverlay !== "none") {
    return;
  }
  shiftDisplayAnchor(delta);
  render();
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest("input, textarea, select, button, [contenteditable='true']"));
}

function isActiveOverlay(value: string | undefined): value is ActiveOverlay {
  return value === "create" || value === "list" || value === "settings" || value === "calendar";
}

function readDisplayMode(value: string | undefined): DisplayMode | null {
  return value === "day" || value === "week" || value === "month" ? value : null;
}

function nextBallLabelMode(mode: BallLabelMode): BallLabelMode {
  if (mode === "none") {
    return "date";
  }
  if (mode === "date") {
    return "title";
  }
  return "none";
}

async function toggleGravitySensor(): Promise<void> {
  audioEngine.unlock();
  if (appSettings.gravityEnabled) {
    updateAppSettings({ gravityEnabled: false });
    render();
    return;
  }

  const granted = await requestDeviceGravityPermission();
  if (!granted) {
    alert("この端末またはブラウザでは重力センサーを有効にできませんでした。");
    return;
  }

  updateAppSettings({ gravityEnabled: true });
  render();
}

function syncGravityController(): void {
  if (!deviceGravity) {
    return;
  }
  deviceGravity.updateStrength(appSettings.gravityStrength);
  if (appSettings.gravityEnabled) {
    deviceGravity.start();
  } else {
    deviceGravity.stop();
    physicsStage?.setGravityVector({ x: 0, y: 0 });
  }
}

function bindTuningEvents(): void {
  const sound = document.querySelector<HTMLInputElement>("#setting-sound");
  sound?.addEventListener("change", () => {
    audioEngine.unlock();
    updateAppSettings({ soundEnabled: sound.checked });
  });

  const gravity = document.querySelector<HTMLInputElement>("#setting-gravity");
  gravity?.addEventListener("change", () => {
    void toggleGravitySensor();
  });

  const memoField = document.querySelector<HTMLInputElement>("#setting-memo-field");
  memoField?.addEventListener("change", () => {
    updateAppSettings({ showMemoField: memoField.checked });
  });

  const echoStrength = document.querySelector<HTMLSelectElement>("#setting-echo-strength");
  echoStrength?.addEventListener("change", () => {
    updateAppSettings({ emotionEchoStrength: readEchoStrength(echoStrength.value) });
  });

  bindNumberSetting("setting-wall", "wallRestitution");
  bindNumberSetting("setting-contact", "contactRestitution");
  bindNumberSetting("setting-damping", "linearDamping");
  bindNumberSetting("setting-flick", "flickPower");
  bindNumberSetting("setting-speed", "maxSpeed");
  bindNumberSetting("setting-gravity-strength", "gravityStrength");
  bindNumberSetting("setting-volume", "masterVolume");
  bindNumberSetting("setting-pitch", "frequencyHz");
  bindNumberSetting("setting-duration", "durationMs");

  document.querySelector("#apply-settings-json")?.addEventListener("click", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>("#settings-json");
    if (!textarea) {
      return;
    }
    try {
      appSettings = normalizeAppSettings(JSON.parse(textarea.value));
      saveAppSettings(appSettings);
      render();
    } catch {
      alert("設定JSONを読み込めませんでした。");
    }
  });

  document.querySelector("#copy-settings-json")?.addEventListener("click", async () => {
    await copyTextWithFallback(JSON.stringify(appSettings, null, 2), "設定JSONをコピーしました。");
  });
}

function bindCategorySettingsEvents(): void {
  const form = document.querySelector<HTMLFormElement>("#category-settings-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const previous = editableCategories;
    const next = previous.map((preset, index) => ({
      ...preset,
      name: String(data.get(`category-${index}`) || preset.name).trim() || preset.name,
    }));
    editableCategories = saveCategoryColorPresets(next);
    const renames = previous
      .map((preset, index) => ({
        from: preset.name,
        to: editableCategories[index].name,
        preset: editableCategories[index],
      }))
      .filter((item) => item.from !== item.to);
    ledger = applyCategoryRenames(ledger, renames);
    for (const rename of renames) {
      if (draft.category === rename.from) {
        draft = { ...draft, category: rename.to };
      }
    }
    render();
  });

  document.querySelector("#reset-categories")?.addEventListener("click", () => {
    const previous = editableCategories;
    editableCategories = resetCategoryColorPresets();
    const renames = previous
      .map((preset, index) => ({
        from: preset.name,
        to: editableCategories[index].name,
        preset: editableCategories[index],
      }))
      .filter((item) => item.from !== item.to);
    ledger = applyCategoryRenames(ledger, renames);
    render();
  });
}

function bindNamePresetEvents(root: ParentNode = document): void {
  root.querySelectorAll<HTMLSelectElement>("[data-name-preset]").forEach((select) => {
    select.addEventListener("change", () => {
      const selected = select.selectedOptions[0];
      const name = select.value.trim();
      const role = selected?.dataset.nameRole;
      const form = select.closest("form");
      const subjectInput = form?.querySelector<HTMLInputElement>("input[name='subject']");
      const issuerSelect = form?.querySelector<HTMLSelectElement>("select[name='issuerType']");
      if (!form || !subjectInput || !name) {
        return;
      }

      subjectInput.value = name;
      if (role === "proxy") {
        if (issuerSelect) {
          issuerSelect.value = "proxy";
        }
      } else if (issuerSelect?.value === "proxy") {
        issuerSelect.value = "self";
      }

      if (form.id === "ball-form") {
        draft = readDraft(form);
      }
    });
  });
}

function bindNameBookSettingsEvents(): void {
  const form = document.querySelector<HTMLFormElement>("#name-book-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const previousDefaultName = getPrimarySelfName(ledger);
    const data = new FormData(form);
    const entries: NameBookEntry[] = [];
    for (let index = 0; index < MAX_NAME_BOOK_ENTRIES; index += 1) {
      const name = String(data.get(`name-book-name-${index}`) || "").trim();
      if (!name) {
        continue;
      }
      entries.push({
        id: String(data.get(`name-book-id-${index}`) || "").trim(),
        name,
        role: readUnion(data.get(`name-book-role-${index}`), ["self", "proxy"], "self"),
      });
    }

    ledger = updateNameBook(ledger, entries);
    const nextDefaultName = getPrimarySelfName(ledger);
    if (!draft.subject.trim() || draft.subject === previousDefaultName || draft.subject === "自分") {
      draft = { ...draft, subject: nextDefaultName };
    }
    render();
  });
}

function bindNumberSetting(id: string, prop: keyof AppSettings): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  input?.addEventListener("input", () => {
    audioEngine.unlock();
    updateRangeValue(id, Number(input.value));
    updateAppSettings({ [prop]: Number(input.value) });
  });
}

function updateAppSettings(patch: Partial<AppSettings>): void {
  appSettings = normalizeAppSettings({ ...appSettings, ...patch });
  saveAppSettings(appSettings);
  syncGravityController();
  physicsStage?.updateSettings(appSettings);
  const textarea = document.querySelector<HTMLTextAreaElement>("#settings-json");
  if (textarea) {
    textarea.value = JSON.stringify(appSettings, null, 2);
  }
}

function readDraft(form: HTMLFormElement): BallDraft {
  const data = new FormData(form);
  return {
    date: String(data.get("date") || draft.date),
    subject: String(data.get("subject") || getPrimarySelfName(ledger) || DEFAULT_SAMPLE_NAME),
    issuerType: readUnion(data.get("issuerType"), ["self", "assisted", "proxy"], "self"),
    count: Number(data.get("count") || 1),
    title: String(data.get("title") || ""),
    category: String(data.get("category") || "日常"),
    note: String(data.get("note") || ""),
    visibility: readUnion(data.get("visibility"), visibilityValues, "open"),
  };
}

function readUnion<const T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function renderOptions<T extends string>(labels: Record<T, string>, selected: T): string {
  return Object.entries(labels)
    .map(([value, label]) => {
      const isSelected = value === selected ? " selected" : "";
      return `<option value="${escapeAttribute(value)}"${isSelected}>${escapeHtml(String(label))}</option>`;
    })
    .join("");
}

function renderNamePresetSelect(selectedName: string): string {
  if (ledger.ownerProfile.nameBook.length === 0) {
    return "";
  }

  const options = ledger.ownerProfile.nameBook.map((entry) => {
    const selected = entry.name === selectedName ? " selected" : "";
    return `
      <option value="${escapeAttribute(entry.name)}" data-name-role="${entry.role}"${selected}>
        ${escapeHtml(entry.name)}（${escapeHtml(nameRoleLabels[entry.role])}）
      </option>
    `;
  }).join("");

  return `
    <select class="name-preset-select" data-name-preset aria-label="登録名から選ぶ">
      <option value="">登録名から選ぶ</option>
      ${options}
    </select>
  `;
}

function renderCurrentCategoryBadge(category: string): string {
  const preset = editableCategories.find((item) => item.name === category) ?? editableCategories[0];
  const visualStyle = preset ? renderVisualStyle(preset) : "";

  return `
    <span class="edit-category-current">
      <span class="category-swatch" style="${visualStyle}" aria-hidden="true"></span>
      <strong>${escapeHtml(category || preset?.name || "日常")}</strong>
    </span>
  `;
}

function renderNameBookSettingsFields(): string {
  const rows: NameBookEntry[] = Array.from({ length: MAX_NAME_BOOK_ENTRIES }, (_, index) => (
    ledger.ownerProfile.nameBook[index] ?? { id: "", name: "", role: index === 0 ? "self" : "proxy" }
  ));

  return `
    <p class="settings-copy">自分の名前や、代理発行する相手の名前を10件まで登録します。空欄は保存しません。</p>
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
          <input name="name-book-name-${index}" type="text" value="${escapeAttribute(entry.name)}" placeholder="${index === 0 ? DEFAULT_SAMPLE_NAME : "名前"}" aria-label="${index + 1}番の名前" />
          <select name="name-book-role-${index}" aria-label="${index + 1}番の属性">
            ${renderOptions(nameRoleLabels, entry.role)}
          </select>
        </div>
      `).join("")}
    </div>
  `;
}

function renderCategoryPalette(selectedCategory: string): string {
  const tones: CategoryTone[] = ["bright", "dark", "neutral"];
  const selected = editableCategories.some((preset) => preset.name === selectedCategory)
    ? selectedCategory
    : editableCategories[0]?.name ?? "日常";

  return `
    <fieldset class="category-palette">
      <legend>カテゴリ</legend>
      ${tones.map((tone) => `
        <div class="category-tone">
          <span>${escapeHtml(toneLabels[tone])}</span>
          <div class="category-options">
            ${editableCategories
              .filter((preset) => preset.tone === tone)
              .map((preset) => {
                const checked = preset.name === selected ? " checked" : "";
                return `
                  <label class="category-option">
                    <input type="radio" name="category" value="${escapeAttribute(preset.name)}"${checked} />
                    <span class="category-swatch" style="${renderVisualStyle(preset)}" aria-hidden="true"></span>
                    <span>${escapeHtml(preset.name)}</span>
                  </label>
                `;
              }).join("")}
          </div>
        </div>
      `).join("")}
    </fieldset>
  `;
}

function renderCategorySettingsFields(): string {
  const tones: CategoryTone[] = ["bright", "dark", "neutral"];
  return tones.map((tone) => `
    <div class="category-edit-tone">
      <h3>${escapeHtml(toneLabels[tone])}</h3>
      <div class="category-edit-grid">
        ${editableCategories
          .map((preset, index) => ({ preset, index }))
          .filter(({ preset }) => preset.tone === tone)
          .map(({ preset, index }) => `
            <label class="category-edit-item">
              <span class="category-swatch" style="${renderVisualStyle(preset)}" aria-hidden="true"></span>
              <input name="category-${index}" type="text" maxlength="12" value="${escapeAttribute(preset.name)}" />
            </label>
          `).join("")}
      </div>
    </div>
  `).join("");
}

function renderVisualStyle(visual: { hue: number; saturation: number; lightness: number }): string {
  return `--ball-hue: ${visual.hue}; --ball-saturation: ${visual.saturation}%; --ball-lightness: ${visual.lightness}%;`;
}

function renderBallVisualStyle(ball: HappyBall): string {
  const base = renderVisualStyle(ball.visual);
  const echo = shouldShowEmotionEcho(ball) ? ball.emotionEcho?.visual : null;
  if (!echo) {
    return base;
  }
  return `${base} --echo-hue: ${echo.hue}; --echo-saturation: ${echo.saturation}%; --echo-lightness: ${echo.lightness}%;`;
}

function shouldShowEmotionEcho(ball: HappyBall): boolean {
  return Boolean(ball.emotionEcho) && appSettings.emotionEchoStrength !== "off";
}

function renderEchoClass(ball: HappyBall): string {
  return shouldShowEmotionEcho(ball) ? `has-echo echo-${appSettings.emotionEchoStrength}` : "";
}

function renderRange(id: string, label: string, value: number, min: number, max: number, step: number): string {
  return `
    <label class="range-control">
      <span>${escapeHtml(label)} <strong id="${id}-value">${formatSettingValue(value)}</strong></span>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
    </label>
  `;
}

function renderEchoStrengthOption(value: EmotionEchoStrength, label: string): string {
  return `<option value="${value}"${appSettings.emotionEchoStrength === value ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function updateRangeValue(id: string, value: number): void {
  const label = document.querySelector<HTMLElement>(`#${id}-value`);
  if (label) {
    label.textContent = formatSettingValue(value);
  }
}

function formatSettingValue(value: number): string {
  if (Math.abs(value) >= 100) {
    return String(Math.round(value));
  }
  return value.toFixed(2);
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

function getAppRoot(): HTMLDivElement {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("App root was not found.");
  }
  return root;
}

function showFatalError(error: unknown): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  appRoot.innerHTML = `
    <main class="loading-shell error-shell">
      <div>
        <strong>起動に失敗しました</strong>
        <pre>${escapeHtml(message)}</pre>
      </div>
    </main>
  `;
}
