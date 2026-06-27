import RAPIER, { type RigidBody, type World } from "@dimforge/rapier2d-compat";
import {
  loadCategoryColorPresets,
  normalizeCategoryColorPresets,
  resetCategoryColorPresets,
  saveCategoryColorPresets,
  toneLabels,
  type CategoryColorPreset,
  type CategoryTone,
} from "./categories";
import "./style.css";
import { issuerLabels, visibilityLabels, type BallDraft, type HappyBall, type NameBookEntry, type NameRole } from "./models";
import {
  PACKET_TYPE,
  createLinePacketImportUrl,
  createPacketImportUrl,
  normalizePacketBall,
  parsePacketLocation,
  reviewPacketImport,
  type UrlPacketParseResult,
} from "./packet";
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
} from "./storage";

const appRoot = getAppRoot();

let ledger = loadLedger();
let draft = createDefaultDraft(getPrimarySelfName(ledger));
let appSettings: AppSettings;
let editableCategories: CategoryColorPreset[] = loadCategoryColorPresets();
let selectedBallId: string | null = ledger.balls[0]?.id ?? null;
let activeOverlay: ActiveOverlay = "none";
let selectedDateFilter: string | null = null;
let calendarMonth = createDefaultDraft().date.slice(0, 7);
let pendingUrlPacket: UrlPacketParseResult | null = parsePacketLocation(window.location.search, window.location.hash);
let snoozedUrlPacket: UrlPacketParseResult | null = null;
let pendingJsonImport: JsonImportReview | null = null;
let physicsStage: RapierStage | null = null;
const physicsSnapshots = new Map<string, PhysicsBallSnapshot>();
let rapierReady = false;
let audioEngine: TinyImpactAudio;
let deviceGravity: DeviceGravityController;

const BALL_DIALOG_ROOT_ID = "ball-dialog-root";
const BALL_TAP_MAX_MS = 520;
const BALL_TAP_MOVE_PX = 10;
type ActiveOverlay = "none" | "create" | "list" | "settings" | "calendar";
type ExportSection = "ledger" | "appSettings" | "categories";
type EmotionEchoStrength = "off" | "weak" | "medium" | "strong";
type JsonImportSection = ExportSection;

interface JsonImportReview {
  fileName: string;
  sections: JsonImportSection[];
  ledger?: {
    newItems: HappyBall[];
    duplicates: HappyBall[];
    conflicts: HappyBall[];
    rejectedItemCount: number;
    nameBookToAdd: NameBookEntry[];
  };
  appSettings?: AppSettings;
  categories?: CategoryColorPreset[];
  error?: string;
}

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

void boot();

async function boot(): Promise<void> {
  try {
    appRoot.innerHTML = `<main class="loading-shell">Rapierを起動しています...</main>`;
    await RAPIER.init();
    appSettings = loadAppSettings();
    audioEngine = new TinyImpactAudio();
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
      <section class="stage ${appSettings.showBallLabels ? "show-ball-labels" : ""}" aria-label="えもい玉">
        <div class="stage-topline">
          <div>
            <h1 id="stage-title">${escapeHtml(selectedBall?.title || "最初の玉を置く")}</h1>
            <p class="stage-filter">${selectedDateFilter ? `${escapeHtml(selectedDateFilter)} の玉` : "全ての玉"}</p>
          </div>
        </div>
        <div id="ball-field" class="ball-field" aria-label="触って転がせるえもい玉"></div>
        <div class="world-actions" aria-label="操作">
          <button type="button" data-open-panel="create" aria-label="玉を作る">＋</button>
          <button type="button" data-open-panel="calendar" aria-label="カレンダー">Cal</button>
          <button type="button" data-open-panel="list" aria-label="保存された玉">玉</button>
          <button type="button" id="label-toggle" class="${appSettings.showBallLabels ? "is-on" : ""}" aria-label="玉の文字表示">字</button>
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
  return selectedDateFilter ? ledger.balls.filter((ball) => ball.date === selectedDateFilter) : ledger.balls;
}

function renderActiveOverlay(): string {
  if (activeOverlay === "none") {
    return "";
  }

  if (activeOverlay === "calendar") {
    return renderCalendarOverlay();
  }

  if (activeOverlay === "create") {
    if (selectedDateFilter) {
      draft = { ...draft, date: selectedDateFilter };
    }
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
        <span>できかた</span>
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
          <span>見せかた</span>
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
    const selectedClass = selectedDateFilter === date ? " is-selected" : "";
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
      <div class="calendar-actions">
        <button class="ghost-action" type="button" id="clear-date-filter">全ての玉</button>
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

function renderBallDialog(ball: HappyBall): string {
  const keepers = ball.keepers.length > 0 ? ball.keepers.join(", ") : "未設定";
  const approvedBy = ball.approvedBy || "なし";
  const receiptTitle = receiptTitleLabels[ball.issuerType];
  const issueLabel = formatIssueLabel(ball);
  const receiptCreated = Boolean(ball.receiptCreatedAt);

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
            <span class="ball-label">${escapeHtml(ball.visual.label)}</span>
          </div>
          <div class="dialog-title-block">
            <span>${escapeHtml(ball.date)}</span>
            <h2 id="ball-dialog-title">${escapeHtml(ball.title)}</h2>
          </div>
        </div>
        ${renderDialogDetail(ball)}
        <div class="detail-card-grid">
          <article class="detail-info-card">
            <span>発行者</span>
            <strong>${escapeHtml(ball.issuedBy)}</strong>
            <small>${escapeHtml(issueLabel)}</small>
          </article>
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
            <summary>見せ方・ID</summary>
            <dl class="dialog-meta compact">
              ${renderDialogMetaRow("見せ方", visibilityLabels[ball.visibility])}
              ${renderDialogMetaRow("玉ID", renderExpandableBallId(ball.id), "html")}
            </dl>
          </details>
          <details class="detail-fold">
            <summary>その他</summary>
            <p class="detail-fold-note">入力者、承認、預かりは台帳の正式情報です。今は作成時の情報から自動で入ります。</p>
            <dl class="dialog-meta compact">
              ${renderDialogMetaRow("対象", ball.subject)}
              ${renderDialogMetaRow("日付", ball.date)}
              ${renderDialogMetaRow("できかた", issueLabel)}
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
          <button class="ghost-action" type="button" data-copy-ball-url-id="${escapeAttribute(ball.id)}">URLコピー</button>
          <button class="ghost-action" type="button" data-copy-ball-line-url-id="${escapeAttribute(ball.id)}">LINE用URL</button>
        </div>
        ${renderReceiptPaper(ball, { idPrefix: "receipt-dialog", showUrl: true })}
      </section>
    </div>
  `;
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
          <span class="ball-label">${escapeHtml(ball.visual.label)}</span>
        </div>
        <div>
          <span>${escapeHtml(ball.date)}</span>
          <strong>${escapeHtml(ball.title)}</strong>
        </div>
      </div>
      <dl class="receipt-info">
        ${renderReceiptRow("発行者", ball.issuedBy)}
        ${renderReceiptRow(keeperLabel, keepers)}
        ${renderReceiptFeelingRow(ball)}
        ${renderReceiptMemoRow(ball)}
      </dl>
      ${options.showUrl ? `
        <div class="receipt-url">
          <span>URL packet</span>
          <code>${escapeHtml(packetUrl)}</code>
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
  if (ball.visibility === "open") {
    if (!memo && !appSettings.showMemoField) {
      return "";
    }

    return renderReceiptRow("メモ", memo, "wide");
  }

  if (!appSettings.showMemoField) {
    return "";
  }

  return `
    <div class="receipt-info-wide ${memo ? "receipt-private-memo" : "receipt-empty-memo"}">
      <dt>メモ</dt>
      <dd aria-label="${memo ? "非公開メモがあります" : "空のメモ欄"}">
        ${memo ? `
          <span style="--memo-line: 68%"></span>
          <span style="--memo-line: 42%"></span>
          <span style="--memo-line: 56%"></span>
        ` : ""}
      </dd>
    </div>
  `;
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
          <span>${escapeHtml(ball.date)}</span>
          <div class="edit-dialog-title-row">
            <h2 id="ball-edit-title">玉を編集</h2>
            <button class="primary-action edit-save-top" form="ball-edit-form" type="submit">保存</button>
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
              <input name="subject" type="text" value="${escapeAttribute(ball.subject)}" />
              <small class="form-hint">登録名選択または自由に入力</small>
            </div>
          </label>

          <label class="inline-field">
            <span>できかた</span>
            <select name="issuerType">
              ${renderOptions(issuerLabels, ball.issuerType)}
            </select>
          </label>

          <label class="inline-field">
            <span>タイトル</span>
            <input name="title" type="text" maxlength="48" value="${escapeAttribute(ball.title)}" />
          </label>

          <label class="inline-field">
            <span>見せかた</span>
            <select name="visibility">
              ${renderOptions(visibilityLabels, ball.visibility)}
            </select>
          </label>

          <details class="edit-category-fold">
            <summary>カテゴリ</summary>
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
  document.addEventListener("keydown", closeBallDialogOnEscape);
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
  root.querySelector<HTMLButtonElement>("[data-copy-ball-url-id]")?.addEventListener("click", () => {
    void copyBallUrl(ballId);
  });
  root.querySelector<HTMLButtonElement>("[data-copy-ball-line-url-id]")?.addEventListener("click", () => {
    void copyBallLineUrl(ballId);
  });
  document.addEventListener("keydown", closeBallDialogOnEscape);
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
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeBallDialog();
    }
  });
  closeButtons.forEach((button) => button.addEventListener("click", closeBallDialog));
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const editingId = form.dataset.editingBallId;
    if (!editingId) {
      return;
    }
    ledger = updateBall(ledger, editingId, readDraft(form));
    selectedBallId = editingId;
    render();
    showBallDialog(editingId);
  });
  bindNamePresetEvents(root);
  document.addEventListener("keydown", closeBallDialogOnEscape);
  form?.querySelector<HTMLInputElement>("input[name='title']")?.focus({ preventScroll: true });
}

function closeBallDialog(): void {
  document.querySelector(`#${BALL_DIALOG_ROOT_ID}`)?.remove();
  document.removeEventListener("keydown", closeBallDialogOnEscape);
}

function closeBallDialogOnEscape(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    closeBallDialog();
  }
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
        <p class="settings-copy">メモ本文を見せない玉でも、空欄や伏せたメモ欄として存在感だけを表示します。</p>
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
    return Array.from({ length: count }, (_, index) => ({
      id: `${ball.id}_${index}`,
      ballId: ball.id,
      hue: ball.visual.hue,
      saturation: ball.visual.saturation,
      lightness: ball.visual.lightness,
      echo: shouldShowEmotionEcho(ball) ? ball.emotionEcho?.visual ?? null : null,
      snapshot: physicsSnapshots.get(`${ball.id}_${index}`) ?? null,
      label: count > 1 ? `${ball.visual.label}${index + 1}` : ball.visual.label,
      title: ball.title,
    }));
  });
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
    title.textContent = selectedBall?.title || "最初の玉を置く";
  }
}

function getVisibleDetail(ball: HappyBall): string {
  if (ball.visibility === "hidden") {
    return "内容は伏せて預かっています。";
  }

  if (ball.visibility === "category") {
    return `${ball.category} の玉`;
  }

  return ball.note ? `${ball.title} - ${ball.note}` : ball.title;
}

function renderDialogDetail(ball: HappyBall): string {
  if (ball.visibility === "category") {
    return appSettings.showMemoField ? renderPrivateMemoSurface(ball.note) : "";
  }

  if (ball.visibility === "open") {
    return renderVisibleMemoSurface(ball.note);
  }

  const notice = `<p class="dialog-detail">${escapeHtml(getVisibleDetail(ball))}</p>`;
  return appSettings.showMemoField ? `${notice}${renderPrivateMemoSurface(ball.note)}` : notice;
}

function renderVisibleMemoSurface(note: string): string {
  const memo = note.trim();
  if (!memo && !appSettings.showMemoField) {
    return "";
  }

  return `
    <section class="dialog-memo ${memo ? "" : "is-empty"}" aria-label="メモ">
      <span>メモ</span>
      <p>${memo ? escapeHtml(memo) : ""}</p>
    </section>
  `;
}

function renderPrivateMemoSurface(note: string): string {
  const hasMemo = note.trim().length > 0;
  const body = hasMemo
    ? `
      <p class="memo-obscured" aria-label="非公開メモがあります">
        <span style="--memo-line: 68%"></span>
        <span style="--memo-line: 42%"></span>
        <span style="--memo-line: 56%"></span>
      </p>
    `
    : `<p aria-label="メモは未入力です"></p>`;

  return `
    <section class="dialog-memo ${hasMemo ? "is-private" : "is-empty"}" aria-label="メモ欄">
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
        calendarMonth = (selectedDateFilter ?? draft.date).slice(0, 7);
      }
      activeOverlay = panel;
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
    updateAppSettings({ showBallLabels: !appSettings.showBallLabels });
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
      selectedDateFilter = button.dataset.filterDate ?? null;
      if (selectedDateFilter) {
        draft = { ...draft, date: selectedDateFilter };
      }
      activeOverlay = "none";
      render();
    });
  });

  document.querySelector("#clear-date-filter")?.addEventListener("click", () => {
    selectedDateFilter = null;
    draft = { ...draft, date: todayIsoDate() };
    activeOverlay = "none";
    render();
  });

  const form = document.querySelector<HTMLFormElement>("#ball-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    audioEngine.unlock();
    draft = readDraft(form);
    ledger = addBall(ledger, draft);
    selectedBallId = ledger.balls[0]?.id ?? null;
    selectedDateFilter = null;
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

const exportSectionSlugs: Record<ExportSection, string> = {
  ledger: "ledger",
  appSettings: "app-settings",
  categories: "categories",
};

function exportSelectedJson(): void {
  const sections = Array.from(document.querySelectorAll<HTMLInputElement>("input[name='export-section']:checked"))
    .map((input) => input.value)
    .filter(isExportSection);

  if (sections.length === 0) {
    alert("書き出す内容を選んでください。");
    return;
  }

  const payload = createExportPayload(sections);
  downloadJsonFile(payload, createExportFileName(sections));
}

function isExportSection(value: string): value is ExportSection {
  return value === "ledger" || value === "appSettings" || value === "categories";
}

function createExportPayload(sections: ExportSection[]): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    v: 1,
    type: "happy-ball-export",
    exportedAt: new Date().toISOString(),
    sections,
  };

  if (sections.includes("ledger")) {
    payload.ledger = ledger;
  }
  if (sections.includes("appSettings")) {
    payload.appSettings = appSettings;
  }
  if (sections.includes("categories")) {
    payload.categories = editableCategories;
  }

  return payload;
}

function createExportFileName(sections: ExportSection[]): string {
  const selected = sections.map((section) => exportSectionSlugs[section]).join("-");
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "")
    .replace("T", "-");
  return `emoi-dama-export-${selected}-${stamp}.json`;
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
    pendingJsonImport = reviewJsonImport(parsed, file.name);
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

function reviewJsonImport(value: unknown, fileName: string): JsonImportReview {
  if (!isPlainObject(value)) {
    return { fileName, sections: [], error: "対応していないJSON形式です。" };
  }

  const exportSections = readExportSections(value.sections);
  const isExportPackage = value.v === 1 && value.type === "happy-ball-export";
  const ledgerSource = isExportPackage ? value.ledger : value;
  const settingsSource = isExportPackage ? value.appSettings : value;
  const categoriesSource = isExportPackage ? value.categories : value;
  const review: JsonImportReview = {
    fileName,
    sections: [],
  };

  const ledgerReview = reviewLedgerImport(ledgerSource);
  if (ledgerReview && (isExportPackage ? exportSections.includes("ledger") : true)) {
    review.sections.push("ledger");
    review.ledger = ledgerReview;
  }

  if ((isExportPackage ? exportSections.includes("appSettings") && isPlainObject(settingsSource) : looksLikeAppSettings(settingsSource))) {
    review.sections.push("appSettings");
    review.appSettings = normalizeAppSettings(settingsSource);
  }

  const categoryReview = reviewCategoryImport(categoriesSource);
  if (categoryReview && (isExportPackage ? exportSections.includes("categories") : true)) {
    review.sections.push("categories");
    review.categories = categoryReview;
  }

  if (!review.ledger && !review.appSettings && !review.categories) {
    return { fileName, sections: [], error: "読み込める台帳データ、アプリ設定、カテゴリ設定が見つかりませんでした。" };
  }

  return review;
}

function readExportSections(value: unknown): ExportSection[] {
  return Array.isArray(value) ? value.filter((item): item is ExportSection => typeof item === "string" && isExportSection(item)) : [];
}

function reviewLedgerImport(value: unknown): JsonImportReview["ledger"] | null {
  if (!isPlainObject(value) || !Array.isArray(value.balls)) {
    return null;
  }

  const balls = value.balls.map(normalizePacketBall).filter((ball): ball is HappyBall => Boolean(ball));
  const packet = {
    v: 1,
    type: PACKET_TYPE,
    mode: "append",
    exportedAt: new Date().toISOString(),
    items: balls,
  } as const;
  const ballReview = reviewPacketImport(packet, ledger.balls);
  return {
    ...ballReview,
    rejectedItemCount: value.balls.length - balls.length,
    nameBookToAdd: collectImportNameBookAdditions(value.ownerProfile),
  };
}

function collectImportNameBookAdditions(ownerProfile: unknown): NameBookEntry[] {
  if (!isPlainObject(ownerProfile) || !Array.isArray(ownerProfile.nameBook)) {
    return [];
  }

  const existing = new Set(ledger.ownerProfile.nameBook.map((entry) => entry.name));
  const additions: NameBookEntry[] = [];
  for (const item of ownerProfile.nameBook) {
    if (ledger.ownerProfile.nameBook.length + additions.length >= MAX_NAME_BOOK_ENTRIES) {
      break;
    }
    if (!isPlainObject(item)) {
      continue;
    }
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const role = item.role === "proxy" ? "proxy" : item.role === "self" ? "self" : null;
    if (!name || !role || existing.has(name)) {
      continue;
    }
    additions.push({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `imported-${additions.length + 1}`,
      name,
      role,
    });
    existing.add(name);
  }
  return additions;
}

function looksLikeAppSettings(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }
  return [
    "wallRestitution",
    "contactRestitution",
    "linearDamping",
    "gravityEnabled",
    "soundEnabled",
    "showBallLabels",
    "showMemoField",
    "emotionEchoStrength",
  ].some((key) => key in value);
}

function reviewCategoryImport(value: unknown): CategoryColorPreset[] | null {
  return Array.isArray(value) ? normalizeCategoryColorPresets(value) : null;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    selectedDateFilter = null;
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
    selectedDateFilter = null;
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

function isActiveOverlay(value: string | undefined): value is ActiveOverlay {
  return value === "create" || value === "list" || value === "settings" || value === "calendar";
}

async function toggleGravitySensor(): Promise<void> {
  audioEngine.unlock();
  if (appSettings.gravityEnabled) {
    updateAppSettings({ gravityEnabled: false });
    render();
    return;
  }

  const granted = await requestDeviceOrientationPermission();
  if (!granted) {
    alert("この端末またはブラウザでは重力センサーを有効にできませんでした。");
    return;
  }

  updateAppSettings({ gravityEnabled: true });
  render();
}

async function requestDeviceOrientationPermission(): Promise<boolean> {
  const hasOrientation = "DeviceOrientationEvent" in window;
  const hasMotion = "DeviceMotionEvent" in window;
  if (!hasOrientation && !hasMotion) {
    return false;
  }

  const permissionChecks: Promise<boolean>[] = [];
  if (hasOrientation) {
    permissionChecks.push(requestSensorPermission(DeviceOrientationEvent as DeviceSensorEventConstructorWithPermission));
  }
  if (hasMotion) {
    permissionChecks.push(requestSensorPermission(DeviceMotionEvent as DeviceSensorEventConstructorWithPermission));
  }

  const results = await Promise.all(permissionChecks);
  return results.some(Boolean);
}

async function requestSensorPermission(eventConstructor: DeviceSensorEventConstructorWithPermission): Promise<boolean> {
  if (typeof eventConstructor.requestPermission !== "function") {
    return true;
  }

  try {
    return (await eventConstructor.requestPermission()) === "granted";
  } catch {
    return false;
  }
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
    visibility: readUnion(data.get("visibility"), ["hidden", "category", "open"], "category"),
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

interface VisualBallSource {
  id: string;
  ballId: string;
  hue: number;
  saturation: number;
  lightness: number;
  echo: { hue: number; saturation: number; lightness: number } | null;
  snapshot: PhysicsBallSnapshot | null;
  label: string;
  title: string;
}

interface PhysicsBallSnapshot {
  id: string;
  position: { x: number; y: number };
  linvel: { x: number; y: number };
  rotation: number;
  angvel: number;
}

interface AppSettings {
  wallRestitution: number;
  contactRestitution: number;
  linearDamping: number;
  angularDamping: number;
  friction: number;
  flickPower: number;
  maxSpeed: number;
  radius: number;
  soundEnabled: boolean;
  gravityEnabled: boolean;
  gravityStrength: number;
  masterVolume: number;
  frequencyHz: number;
  frequencySpread: number;
  durationMs: number;
  soundThreshold: number;
  showBallLabels: boolean;
  showMemoField: boolean;
  emotionEchoStrength: EmotionEchoStrength;
}

const SETTINGS_KEY = "happyBall.settings.v2";

const DEFAULT_APP_SETTINGS: AppSettings = {
  wallRestitution: 0.38,
  contactRestitution: 0.34,
  linearDamping: 0.12,
  angularDamping: 0.28,
  friction: 0.02,
  flickPower: 0.92,
  maxSpeed: 1900,
  radius: 42,
  soundEnabled: true,
  gravityEnabled: false,
  gravityStrength: 720,
  masterVolume: 0.28,
  frequencyHz: 1100,
  frequencySpread: 1.35,
  durationMs: 130,
  soundThreshold: 85,
  showBallLabels: false,
  showMemoField: false,
  emotionEchoStrength: "weak",
};

function loadAppSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? normalizeAppSettings(JSON.parse(stored)) : DEFAULT_APP_SETTINGS;
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

function saveAppSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings, null, 2));
}

function normalizeAppSettings(value: unknown): AppSettings {
  const source = typeof value === "object" && value ? (value as Partial<AppSettings>) : {};
  return {
    wallRestitution: clampNumber(source.wallRestitution, 0, 1, DEFAULT_APP_SETTINGS.wallRestitution),
    contactRestitution: clampNumber(source.contactRestitution, 0, 1, DEFAULT_APP_SETTINGS.contactRestitution),
    linearDamping: clampNumber(source.linearDamping, 0, 2, DEFAULT_APP_SETTINGS.linearDamping),
    angularDamping: clampNumber(source.angularDamping, 0, 2, DEFAULT_APP_SETTINGS.angularDamping),
    friction: clampNumber(source.friction, 0, 1, DEFAULT_APP_SETTINGS.friction),
    flickPower: clampNumber(source.flickPower, 0.2, 2.2, DEFAULT_APP_SETTINGS.flickPower),
    maxSpeed: clampNumber(source.maxSpeed, 400, 5000, DEFAULT_APP_SETTINGS.maxSpeed),
    radius: clampNumber(source.radius, 24, 64, DEFAULT_APP_SETTINGS.radius),
    soundEnabled: source.soundEnabled ?? DEFAULT_APP_SETTINGS.soundEnabled,
    gravityEnabled: source.gravityEnabled ?? DEFAULT_APP_SETTINGS.gravityEnabled,
    gravityStrength: clampNumber(source.gravityStrength, 80, 1800, DEFAULT_APP_SETTINGS.gravityStrength),
    masterVolume: clampNumber(source.masterVolume, 0, 1, DEFAULT_APP_SETTINGS.masterVolume),
    frequencyHz: clampNumber(source.frequencyHz, 200, 4200, DEFAULT_APP_SETTINGS.frequencyHz),
    frequencySpread: clampNumber(source.frequencySpread, 1, 3, DEFAULT_APP_SETTINGS.frequencySpread),
    durationMs: clampNumber(source.durationMs, 30, 420, DEFAULT_APP_SETTINGS.durationMs),
    soundThreshold: clampNumber(source.soundThreshold, 20, 500, DEFAULT_APP_SETTINGS.soundThreshold),
    showBallLabels: source.showBallLabels ?? DEFAULT_APP_SETTINGS.showBallLabels,
    showMemoField: source.showMemoField ?? DEFAULT_APP_SETTINGS.showMemoField,
    emotionEchoStrength: readEchoStrength(source.emotionEchoStrength),
  };
}

function readEchoStrength(value: unknown): EmotionEchoStrength {
  return value === "off" || value === "medium" || value === "strong" || value === "weak"
    ? value
    : DEFAULT_APP_SETTINGS.emotionEchoStrength;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

type ImpactKind = "wall" | "contact";

interface ImpactEvent {
  kind: ImpactKind;
  energy: number;
}

type GravityVector = { x: number; y: number };

interface DeviceSensorEventConstructorWithPermission {
  requestPermission?: () => Promise<"granted" | "denied">;
}

class DeviceGravityController {
  private active = false;
  private strength = DEFAULT_APP_SETTINGS.gravityStrength;

  constructor(private readonly onGravity: (gravity: GravityVector) => void) {}

  start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    window.addEventListener("deviceorientation", this.handleOrientation);
    window.addEventListener("devicemotion", this.handleMotion);
  }

  stop(): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    window.removeEventListener("deviceorientation", this.handleOrientation);
    window.removeEventListener("devicemotion", this.handleMotion);
    this.onGravity({ x: 0, y: 0 });
  }

  updateStrength(strength: number): void {
    this.strength = strength;
  }

  private readonly handleOrientation = (event: DeviceOrientationEvent): void => {
    const beta = typeof event.beta === "number" ? event.beta : 0;
    const gamma = typeof event.gamma === "number" ? event.gamma : 0;
    const x = clamp(gamma / 35, -1, 1) * this.strength;
    const y = clamp(beta / 45, -1, 1) * this.strength;
    this.onGravity({ x, y });
  };

  private readonly handleMotion = (event: DeviceMotionEvent): void => {
    const gravity = event.accelerationIncludingGravity;
    if (!gravity) {
      return;
    }
    const x = typeof gravity.x === "number" ? clamp(gravity.x / 6, -1, 1) * this.strength : 0;
    const y = typeof gravity.y === "number" ? clamp(-gravity.y / 6, -1, 1) * this.strength : 0;
    if (x !== 0 || y !== 0) {
      this.onGravity({ x, y });
    }
  };
}

class TinyImpactAudio {
  private context: AudioContext | null = null;
  private voices = 0;
  private lastPlayedAt = 0;

  unlock(): void {
    const context = this.ensureContext();
    if (context?.state === "suspended") {
      void context.resume();
    }
  }

  play(impacts: ImpactEvent[], settings: AppSettings): void {
    if (!settings.soundEnabled || impacts.length === 0) {
      return;
    }

    const context = this.ensureContext();
    if (!context || context.state !== "running") {
      return;
    }

    const nowMs = performance.now();
    if (nowMs - this.lastPlayedAt < 28) {
      return;
    }

    const selected = impacts
      .filter((impact) => impact.energy >= settings.soundThreshold)
      .sort((a, b) => b.energy - a.energy)
      .slice(0, 3);

    selected.forEach((impact, index) => this.playPing(context, impact, settings, index * 0.018));
    if (selected.length > 0) {
      this.lastPlayedAt = nowMs;
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.context) {
      return this.context;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    this.context = new AudioContextCtor();
    return this.context;
  }

  private playPing(context: AudioContext, impact: ImpactEvent, settings: AppSettings, offset: number): void {
    if (this.voices >= 8) {
      return;
    }

    const now = context.currentTime;
    const start = now + offset;
    const duration = settings.durationMs / 1000;
    const energyGain = Math.min(1, Math.log1p(impact.energy / 70) / Math.log1p(3000 / 70));
    const gainValue = Math.max(0.001, settings.masterVolume * (0.16 + energyGain * 0.84));
    const spread = impact.kind === "wall" ? 1 : settings.frequencySpread;
    const pitchJitter = 1 + (Math.random() - 0.5) * (spread - 1);
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    this.voices += 1;
    oscillator.type = impact.kind === "wall" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(settings.frequencyHz * pitchJitter, start);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(7400, start);
    filter.Q.setValueAtTime(0.4, start);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
    oscillator.addEventListener("ended", () => {
      this.voices = Math.max(0, this.voices - 1);
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
    });
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

interface RapierBall extends VisualBallSource {
  body: RigidBody;
  radius: number;
  element: HTMLButtonElement;
}

class RapierStage {
  private world: World;
  private readonly balls: RapierBall[] = [];
  private readonly resizeObserver: ResizeObserver;
  private readonly collisionCooldown = new Map<string, number>();
  private animationId = 0;
  private width = 0;
  private height = 0;
  private dragging: RapierBall | null = null;
  private dragOffset = { x: 0, y: 0 };
  private dragVelocity = { x: 0, y: 0 };
  private lastPointer: { x: number; y: number; time: number } | null = null;
  private tapStart: { x: number; y: number; time: number; ball: RapierBall } | null = null;
  private movedBeyondTap = false;
  private dragActive = false;
  private heldBallMotion: { position: { x: number; y: number }; linvel: { x: number; y: number }; angvel: number } | null = null;
  private gravityVector: GravityVector = { x: 0, y: 0 };
  private disposed = false;

  constructor(
    private readonly field: HTMLDivElement,
    sources: VisualBallSource[],
    private readonly onSelect: (ballId: string) => void,
    private readonly onOpenDetail: (ballId: string) => void,
    private settings: AppSettings,
    private readonly audio: TinyImpactAudio,
  ) {
    this.world = new RAPIER.World({ x: 0, y: 0 });
    this.world.timestep = 1 / 60;
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.disposed) {
        this.updateBounds();
      }
    });
    this.rebuild(sources);
    this.resizeObserver.observe(this.field);
    this.field.addEventListener("pointerdown", this.handlePointerDown);
    this.field.addEventListener("pointermove", this.handlePointerMove);
    this.field.addEventListener("pointerup", this.handlePointerUp);
    this.field.addEventListener("pointercancel", this.handlePointerUp);
  }

  start(): void {
    if (this.disposed || this.balls.length === 0) {
      return;
    }
    this.animationId = requestAnimationFrame(this.tick);
  }

  destroy(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    this.field.removeEventListener("pointerdown", this.handlePointerDown);
    this.field.removeEventListener("pointermove", this.handlePointerMove);
    this.field.removeEventListener("pointerup", this.handlePointerUp);
    this.field.removeEventListener("pointercancel", this.handlePointerUp);
    this.safeFreeWorld();
  }

  updateSettings(settings: AppSettings): void {
    if (this.disposed) {
      return;
    }
    this.settings = settings;
    if (!settings.gravityEnabled) {
      this.setGravityVector({ x: 0, y: 0 });
    }
    for (const ball of this.balls) {
      ball.radius = settings.radius;
      ball.element.style.width = `${ball.radius * 2}px`;
      ball.element.style.height = `${ball.radius * 2}px`;
      ball.body.setLinearDamping(settings.linearDamping);
      ball.body.setAngularDamping(settings.angularDamping);
    }
  }

  captureSnapshots(): PhysicsBallSnapshot[] {
    if (this.disposed) {
      return [];
    }

    return this.balls.map((ball) => {
      const position = ball.body.translation();
      const linvel = ball.body.linvel();
      return {
        id: ball.id,
        position: { x: position.x, y: position.y },
        linvel: { x: linvel.x, y: linvel.y },
        rotation: ball.body.rotation(),
        angvel: ball.body.angvel(),
      };
    });
  }

  setGravityVector(gravity: GravityVector): void {
    if (this.disposed) {
      return;
    }
    this.gravityVector = gravity;
  }

  private rebuild(sources: VisualBallSource[]): void {
    if (this.disposed) {
      return;
    }
    this.resetPointerState();
    this.updateBounds();
    this.field.innerHTML = "";
    this.balls.length = 0;
    this.safeFreeWorld();
    this.world = new RAPIER.World({ x: 0, y: 0 });
    this.world.timestep = 1 / 60;
    this.collisionCooldown.clear();

    if (sources.length === 0) {
      this.field.innerHTML = `<div class="empty-state"><div class="seed-ball" aria-hidden="true"></div></div>`;
      return;
    }

    this.createBalls(sources);
  }

  private updateBounds(): void {
    const rect = this.field.getBoundingClientRect();
    this.width = Math.max(280, rect.width);
    this.height = Math.max(280, rect.height);
  }

  private resetPointerState(): void {
    this.dragging?.element.classList.remove("is-dragging");
    this.dragging = null;
    this.dragOffset = { x: 0, y: 0 };
    this.dragVelocity = { x: 0, y: 0 };
    this.lastPointer = null;
    this.tapStart = null;
    this.movedBeyondTap = false;
    this.dragActive = false;
    this.heldBallMotion = null;
  }

  private safeFreeWorld(): void {
    try {
      this.world.free();
    } catch {
      // Rapier may already have invalidated the WASM-side world after an error.
    }
  }

  private createBalls(sources: VisualBallSource[]): void {
    const columns = Math.max(1, Math.ceil(Math.sqrt(sources.length)));

    sources.forEach((source, index) => {
      const radius = this.settings.radius;
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = ((column + 1) / (columns + 1)) * this.width + (index % 2) * 12;
      const y = Math.min(this.height - radius, 80 + row * (radius * 1.78));
      const snapshot = source.snapshot;
      const startX = snapshot ? snapshot.position.x : x;
      const startY = snapshot ? snapshot.position.y : y;
      const startLinvel = snapshot?.linvel ?? { x: (index % 2 === 0 ? 1 : -1) * (20 + index * 3), y: 8 + index * 2 };
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(clamp(startX, radius, this.width - radius), clamp(startY, radius, this.height - radius))
          .setRotation(snapshot?.rotation ?? 0)
          .setLinvel(startLinvel.x, startLinvel.y)
          .setAngularDamping(this.settings.angularDamping)
          .setLinearDamping(this.settings.linearDamping)
          .setCanSleep(false)
          .setCcdEnabled(true),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.ball(radius)
          .setRestitution(this.settings.contactRestitution)
          .setFriction(this.settings.friction)
          .setDensity(0.7),
        body,
      );
      if (snapshot) {
        body.setAngvel(snapshot.angvel, true);
      }

      const element = document.createElement("button");
      element.type = "button";
      element.tabIndex = -1;
      element.className = `physics-ball${source.echo ? ` has-echo echo-${this.settings.emotionEchoStrength}` : ""}`;
      element.dataset.visualBallId = source.id;
      element.style.width = `${radius * 2}px`;
      element.style.height = `${radius * 2}px`;
      element.style.setProperty("--ball-hue", String(source.hue));
      element.style.setProperty("--ball-saturation", `${source.saturation}%`);
      element.style.setProperty("--ball-lightness", `${source.lightness}%`);
      if (source.echo) {
        element.style.setProperty("--echo-hue", String(source.echo.hue));
        element.style.setProperty("--echo-saturation", `${source.echo.saturation}%`);
        element.style.setProperty("--echo-lightness", `${source.echo.lightness}%`);
      }
      element.setAttribute("aria-label", source.title);
      element.innerHTML = `
        <span class="ball-body" aria-hidden="true">
          <span class="ball-core"></span>
          <span class="ball-shade"></span>
          <span class="ball-highlight"></span>
        </span>
        <span class="ball-label">${escapeHtml(source.label)}</span>
      `;
      this.field.appendChild(element);
      this.balls.push({ ...source, body, radius, element });
    });
    this.paint();
  }

  private readonly tick = (): void => {
    if (this.disposed) {
      return;
    }
    try {
      this.world.gravity = this.settings.gravityEnabled ? this.gravityVector : { x: 0, y: 0 };
      this.world.step();
      const impacts = [
        ...this.containBalls(),
        ...this.resolveBallOverlaps(),
        ...this.detectContactImpacts(),
      ];
      this.audio.play(impacts, this.settings);
      this.paint();
      if (!this.disposed) {
        this.animationId = requestAnimationFrame(this.tick);
      }
    } catch (error) {
      console.error("Rapier stage stopped after physics error.", error);
      this.disposed = true;
    }
  };

  private containBalls(): ImpactEvent[] {
    const impacts: ImpactEvent[] = [];

    for (const ball of this.balls) {
      const position = ball.body.translation();
      const velocity = ball.body.linvel();
      const nextX = clamp(position.x, ball.radius, this.width - ball.radius);
      const nextY = clamp(position.y, ball.radius, this.height - ball.radius);
      const outX = Math.abs(nextX - position.x) > 0.001;
      const outY = Math.abs(nextY - position.y) > 0.001;
      const speed = Math.hypot(velocity.x, velocity.y);
      let nextVx = velocity.x;
      let nextVy = velocity.y;

      if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(speed)) {
        ball.body.setTranslation({ x: this.width / 2, y: this.height / 2 }, true);
        ball.body.setLinvel({ x: 0, y: 0 }, true);
        continue;
      }

      if (outX) {
        nextVx = position.x < nextX
          ? Math.abs(nextVx) * this.settings.wallRestitution
          : -Math.abs(nextVx) * this.settings.wallRestitution;
      }

      if (outY) {
        nextVy = position.y < nextY
          ? Math.abs(nextVy) * this.settings.wallRestitution
          : -Math.abs(nextVy) * this.settings.wallRestitution;
      }

      if (outX || outY) {
        ball.body.setTranslation({ x: nextX, y: nextY }, true);
        ball.body.setLinvel(this.limitVelocity({ x: nextVx, y: nextVy }), true);
        if (speed > this.settings.soundThreshold) {
          impacts.push({ kind: "wall", energy: speed });
        }
        continue;
      }

      if (speed > this.settings.maxSpeed) {
        ball.body.setLinvel(this.limitVelocity(velocity), true);
      }
    }

    return impacts;
  }

  private detectContactImpacts(): ImpactEvent[] {
    const now = performance.now();
    const impacts: ImpactEvent[] = [];

    for (let i = 0; i < this.balls.length; i += 1) {
      for (let j = i + 1; j < this.balls.length; j += 1) {
        const a = this.balls[i];
        const b = this.balls[j];
        const pa = a.body.translation();
        const pb = b.body.translation();
        const distance = Math.hypot(pa.x - pb.x, pa.y - pb.y);
        if (distance > a.radius + b.radius + 2) {
          continue;
        }

        const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        if ((this.collisionCooldown.get(key) ?? 0) > now) {
          continue;
        }

        const va = a.body.linvel();
        const vb = b.body.linvel();
        const energy = Math.hypot(va.x - vb.x, va.y - vb.y);
        if (energy > this.settings.soundThreshold) {
          impacts.push({ kind: "contact", energy });
          this.collisionCooldown.set(key, now + 95);
        }
      }
    }

    return impacts;
  }

  private resolveBallOverlaps(): ImpactEvent[] {
    const impacts: ImpactEvent[] = [];
    const slop = 0.35;

    for (let i = 0; i < this.balls.length; i += 1) {
      for (let j = i + 1; j < this.balls.length; j += 1) {
        const a = this.balls[i];
        const b = this.balls[j];
        const pa = a.body.translation();
        const pb = b.body.translation();
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const distance = Math.hypot(dx, dy);
        const minDistance = a.radius + b.radius;
        const overlap = minDistance - distance;

        if (overlap <= slop) {
          continue;
        }

        const normal = distance > 0.001
          ? { x: dx / distance, y: dy / distance }
          : separationNormal(i, j);
        const aDragging = a === this.dragging;
        const bDragging = b === this.dragging;
        const correction = overlap + slop;

        if (aDragging || bDragging) {
          continue;
        }

        this.moveBallTo(a, pa.x - normal.x * correction * 0.5, pa.y - normal.y * correction * 0.5);
        this.moveBallTo(b, pb.x + normal.x * correction * 0.5, pb.y + normal.y * correction * 0.5);

        const va = a.body.linvel();
        const vb = b.body.linvel();
        const relativeNormalSpeed = ((va.x - vb.x) * normal.x) + ((va.y - vb.y) * normal.y);
        if (relativeNormalSpeed > 0) {
          const impulse = relativeNormalSpeed * this.settings.contactRestitution;
          if (!aDragging) {
            a.body.setLinvel(this.limitVelocity({ x: va.x - normal.x * impulse * 0.5, y: va.y - normal.y * impulse * 0.5 }), true);
          }
          if (!bDragging) {
            b.body.setLinvel(this.limitVelocity({ x: vb.x + normal.x * impulse * 0.5, y: vb.y + normal.y * impulse * 0.5 }), true);
          }
        }

        const energy = Math.hypot(va.x - vb.x, va.y - vb.y);
        if (energy > this.settings.soundThreshold) {
          impacts.push({ kind: "contact", energy });
        }
      }
    }

    return impacts;
  }

  private moveBallTo(ball: RapierBall, x: number, y: number): void {
    ball.body.setTranslation(
      {
        x: clamp(x, ball.radius, this.width - ball.radius),
        y: clamp(y, ball.radius, this.height - ball.radius),
      },
      true,
    );
  }

  private limitVelocity(velocity: { x: number; y: number }): { x: number; y: number } {
    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed <= this.settings.maxSpeed || speed === 0) {
      return velocity;
    }
    const scale = this.settings.maxSpeed / speed;
    return {
      x: velocity.x * scale,
      y: velocity.y * scale,
    };
  }

  private paint(): void {
    for (const ball of this.balls) {
      const position = ball.body.translation();
      ball.element.style.transform = `translate3d(${position.x - ball.radius}px, ${position.y - ball.radius}px, 0)`;
      ball.element.style.setProperty("--ball-rotation", `${ball.body.rotation()}rad`);
    }
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const point = this.pointerPoint(event);
    const target = this.findBall(point.x, point.y);
    if (!target) {
      return;
    }

    event.preventDefault();
    this.dragging = target;
    const position = target.body.translation();
    const velocity = target.body.linvel();
    const now = performance.now();
    this.dragOffset = { x: position.x - point.x, y: position.y - point.y };
    this.dragVelocity = { x: 0, y: 0 };
    this.lastPointer = { x: position.x, y: position.y, time: now };
    this.tapStart = { x: point.x, y: point.y, time: now, ball: target };
    this.movedBeyondTap = false;
    this.heldBallMotion = {
      position: { x: position.x, y: position.y },
      linvel: { x: velocity.x, y: velocity.y },
      angvel: target.body.angvel(),
    };
    this.field.setPointerCapture(event.pointerId);
    this.onSelect(target.ballId);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.dragging) {
      return;
    }

    event.preventDefault();
    const point = this.pointerPoint(event);
    const now = performance.now();
    const x = clamp(point.x + this.dragOffset.x, this.dragging.radius, this.width - this.dragging.radius);
    const y = clamp(point.y + this.dragOffset.y, this.dragging.radius, this.height - this.dragging.radius);
    if (this.tapStart && Math.hypot(point.x - this.tapStart.x, point.y - this.tapStart.y) > BALL_TAP_MOVE_PX) {
      this.movedBeyondTap = true;
    }

    if (!this.movedBeyondTap) {
      return;
    }

    if (!this.dragActive) {
      this.dragActive = true;
      this.dragging.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      this.dragging.body.setNextKinematicTranslation({ x, y });
      this.dragging.body.setLinvel({ x: 0, y: 0 }, true);
      this.dragging.body.setAngvel(0, true);
      this.dragging.element.classList.add("is-dragging");
    }

    if (this.lastPointer) {
      const dt = Math.max(0.016, (now - this.lastPointer.time) / 1000);
      this.dragVelocity = this.limitVelocity({
        x: ((x - this.lastPointer.x) / dt) * this.settings.flickPower,
        y: ((y - this.lastPointer.y) / dt) * this.settings.flickPower,
      });
    }

    this.dragging.body.setNextKinematicTranslation({ x, y });
    this.lastPointer = { x, y, time: now };
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.dragging) {
      return;
    }

    const released = this.dragging;
    const point = this.pointerPoint(event);
    const now = performance.now();
    const tapDistance = this.tapStart ? Math.hypot(point.x - this.tapStart.x, point.y - this.tapStart.y) : Infinity;
    const isTap = event.type !== "pointercancel"
      && this.tapStart?.ball === released
      && !this.movedBeyondTap
      && tapDistance <= BALL_TAP_MOVE_PX
      && now - this.tapStart.time <= BALL_TAP_MAX_MS;
    if (this.dragActive) {
      released.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      released.body.setLinvel(this.limitVelocity(this.dragVelocity), true);
      released.body.setAngvel(this.dragVelocity.x / Math.max(released.radius, 1), true);
      released.element.classList.remove("is-dragging");
    } else if (isTap && this.heldBallMotion) {
      released.body.setTranslation(this.heldBallMotion.position, true);
      released.body.setLinvel(this.limitVelocity(this.heldBallMotion.linvel), true);
      released.body.setAngvel(this.heldBallMotion.angvel, true);
    }
    this.dragging = null;
    this.dragOffset = { x: 0, y: 0 };
    this.dragVelocity = { x: 0, y: 0 };
    this.lastPointer = null;
    this.tapStart = null;
    this.movedBeyondTap = false;
    this.dragActive = false;
    this.heldBallMotion = null;
    if (this.field.hasPointerCapture(event.pointerId)) {
      this.field.releasePointerCapture(event.pointerId);
    }
    if (isTap) {
      this.onOpenDetail(released.ballId);
    }
    this.paint();
  };

  private pointerPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.field.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private findBall(x: number, y: number): RapierBall | null {
    let best: RapierBall | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const ball of this.balls) {
      const position = ball.body.translation();
      const distance = Math.hypot(position.x - x, position.y - y);
      if (distance <= ball.radius && distance < bestDistance) {
        best = ball;
        bestDistance = distance;
      }
    }
    return best;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function separationNormal(a: number, b: number): { x: number; y: number } {
  const angle = ((a * 41 + b * 17) % 360) * (Math.PI / 180);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}
