import {
  getReceiptTitle,
  renderReceiptPaper,
  type DialogRenderContext,
} from "./dialog-renderers";
import {
  renderDisplayVisualKindClass,
  renderDisplayVisualStyle,
  renderEchoVisualStyle,
  resolveBallDisplayVisual,
  resolveEchoDisplayVisual,
} from "./ball-visual-display.js";
import { categoryColorPresets, type CategoryColorPreset } from "./categories.js";
import type { JsonImportReview } from "./json-transfer";
import type { HappyBall, SendMode } from "./models";
import { reviewPacketImport, type PacketImportReview, type UrlPacketParseResult } from "./packet";
import type { EmotionEchoStrength } from "./settings";

export interface ImportDialogRenderContext {
  localBalls: HappyBall[];
  dialogContext: DialogRenderContext;
  emotionEchoStrength: EmotionEchoStrength;
}

export interface WorkspaceImportDialogContext {
  targets: Array<{
    value: string;
    label: string;
  }>;
  selectedTarget: string;
  selectedReview: PacketImportReview;
  selectedTargetIsNew: boolean;
  missingNameCount: number;
  displayCode: string;
}

export function renderPendingUrlPacketDialog(
  pendingUrlPacket: UrlPacketParseResult | null,
  context: ImportDialogRenderContext,
): string {
  if (!pendingUrlPacket) {
    return "";
  }

  if (!pendingUrlPacket.ok) {
    return `
      <div class="ball-dialog-backdrop import-dialog-backdrop">
        <section class="ball-dialog import-dialog app-modal-scroll" data-scroll-owner role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
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

  const review = reviewPacketImport(pendingUrlPacket.packet, context.localBalls);
  const canImport = review.newItems.length > 0;
  const canReplace = review.conflicts.length > 0;
  const importStatus = renderUrlImportStatus(review);
  const localConflictBalls = getExistingBallsForIncoming(review.conflicts, context.localBalls);
  const previewBall = pendingUrlPacket.packet.items[0];
  const sendMode = getPacketSendMode(pendingUrlPacket.packet.sendMode);
  const receiptTitle = previewBall ? getReceiptTitle(previewBall, sendMode) : "お預け状";
  return `
    <div class="ball-dialog-backdrop import-dialog-backdrop">
      <section class="ball-dialog import-dialog receive-dialog app-modal-scroll" data-scroll-owner role="dialog" aria-modal="true" aria-label="届いたえもい玉 ${escapeAttribute(receiptTitle)}">
        <p class="receive-dialog-title">貴方に届いた${escapeHtml(receiptTitle)}です</p>
        ${previewBall ? renderReceiptPaper(previewBall, { idPrefix: "receive", showUrl: false, sendMode }, context.dialogContext) : ""}
        ${importStatus}
        <div class="import-counts" aria-label="読み込み結果">
          ${renderImportCountChip(review.newItems.length, "新しい玉", "new")}
          ${renderImportCountChip(review.duplicates.length, "登録済み", "duplicate")}
          ${renderImportCountChip(review.conflicts.length, "同じIDで別内容", "conflict")}
          ${pendingUrlPacket.rejectedItemCount > 0 ? renderImportCountChip(pendingUrlPacket.rejectedItemCount, "読めない項目", "conflict") : ""}
        </div>
        ${renderImportBallList("受け取る玉", review.newItems, context.emotionEchoStrength, context.dialogContext.categories)}
        ${renderImportBallList("すでに手元にある玉", review.duplicates, context.emotionEchoStrength, context.dialogContext.categories)}
        ${renderImportBallList("手元にある同じIDの玉", localConflictBalls, context.emotionEchoStrength, context.dialogContext.categories)}
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

export function renderSnoozedUrlPacketReminder(snoozedUrlPacket: UrlPacketParseResult | null): string {
  if (!snoozedUrlPacket?.ok) {
    return "";
  }

  const firstBall = snoozedUrlPacket.packet.items[0];
  const sendMode = getPacketSendMode(snoozedUrlPacket.packet.sendMode);
  const receiptTitle = firstBall ? getReceiptTitle(firstBall, sendMode) : "お預け状";
  return `
    <aside class="receive-reminder" aria-label="保留中の送付紙面">
      <span>届いた${escapeHtml(receiptTitle)}があります</span>
      <button class="ghost-action" type="button" id="show-snoozed-url-packet">見る</button>
    </aside>
  `;
}

function getPacketSendMode(packetSendMode: SendMode | undefined): SendMode {
  return packetSendMode === "casual" ? "casual" : "formal";
}

export function renderPendingJsonImportDialog(
  pendingJsonImport: JsonImportReview | null,
  emotionEchoStrength: EmotionEchoStrength,
  categories: CategoryColorPreset[] = categoryColorPresets,
  workspaceContext?: WorkspaceImportDialogContext,
): string {
  if (!pendingJsonImport) {
    return "";
  }

  if (pendingJsonImport.error) {
    return `
      <div class="ball-dialog-backdrop import-dialog-backdrop">
        <section class="ball-dialog import-dialog app-modal-scroll" data-scroll-owner role="dialog" aria-modal="true" aria-labelledby="json-import-title">
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


  if (pendingJsonImport.workspaceShare) {
    return renderWorkspaceImportDialog(pendingJsonImport, emotionEchoStrength, categories, workspaceContext);
  }

  if (pendingJsonImport.deviceBackup) {
    return renderDeviceBackupImportDialog(pendingJsonImport);
  }

  const ledgerReview = pendingJsonImport.ledger;
  const canApply = Boolean(
    ledgerReview || pendingJsonImport.appSettings || pendingJsonImport.categories,
  );
  return `
    <div class="ball-dialog-backdrop import-dialog-backdrop">
      <section class="ball-dialog import-dialog app-modal-scroll" data-scroll-owner role="dialog" aria-modal="true" aria-labelledby="json-import-title">
        <div class="dialog-title-block">
          <span>${escapeHtml(pendingJsonImport.fileName)}</span>
          <h2 id="json-import-title">JSONを読み込みますか</h2>
        </div>
        <p class="dialog-detail">内容を確認して、適用する項目だけ選んでください。台帳の玉は新しいIDだけ追加します。</p>
        <div class="import-counts" aria-label="読み込み内容">
          ${pendingJsonImport.workspaceStore ? `<span><strong>${pendingJsonImport.workspaceStore.workspaces.length}</strong> 利用環境一式（置き換え復元）</span>` : ""}
          ${ledgerReview ? `
            <span><strong>${ledgerReview.newItems.length}</strong> 新しい玉</span>
            <span><strong>${ledgerReview.duplicates.length}</strong> 登録済み</span>
            <span><strong>${ledgerReview.conflicts.length}</strong> 同じIDの別内容</span>
            <span><strong>${ledgerReview.nameBookToAdd.length}</strong> 追加する名前</span>
            ${ledgerReview.rejectedItemCount > 0 ? `<span><strong>${ledgerReview.rejectedItemCount}</strong> 読めない玉</span>` : ""}
          ` : ""}
          ${pendingJsonImport.appSettings ? `<span><strong>あり</strong> アプリ設定</span><span><strong>降臨GPS共有: ${pendingJsonImport.appSettings.includeDescentGpsInHandoff ? "ON" : "OFF"}</strong></span>` : ""}
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
        ${ledgerReview ? renderImportBallList("追加する玉", ledgerReview.newItems, emotionEchoStrength, categories) : ""}
        <div class="dialog-actions">
          <button class="ghost-action" type="button" id="dismiss-json-import">キャンセル</button>
          <button class="primary-action" type="button" id="confirm-json-import" ${canApply ? "" : "disabled"}>読み込む</button>
        </div>
      </section>
    </div>
  `;
}

function renderWorkspaceImportDialog(
  pendingJsonImport: JsonImportReview,
  emotionEchoStrength: EmotionEchoStrength,
  categories: CategoryColorPreset[],
  workspaceContext?: WorkspaceImportDialogContext,
): string {
  const workspaceShare = pendingJsonImport.workspaceShare;
  if (!workspaceShare) {
    return "";
  }
  const selectedReview = workspaceContext?.selectedReview ?? workspaceShare.review;
  const selectedTargetIsNew = workspaceContext?.selectedTargetIsNew ?? false;
  const canApplyExistingByDefault = selectedReview.newItems.length > 0;
  return `
    <div class="ball-dialog-backdrop import-dialog-backdrop" data-cancel-workspace-import>
      <section class="ball-dialog import-dialog workspace-import-dialog app-modal-scroll" data-scroll-owner role="dialog" aria-modal="true" aria-labelledby="json-import-title">
        <div class="dialog-title-block">
          <span>${escapeHtml(pendingJsonImport.fileName)}</span>
          <h2 id="json-import-title">利用環境ファイルを確認</h2>
        </div>
        <p class="dialog-detail">${escapeHtml(workspaceShare.bundle.sourceDisplayName)} / ID=${escapeHtml(workspaceContext?.displayCode ?? workspaceShare.bundle.sourceDisplayCode)}</p>
        <p class="dialog-detail import-cancel-safety">まだ保存データは変更されていません。「今回はやめる」なら何も変更されません。</p>
        ${workspaceContext ? `
          <fieldset class="workspace-import-targets">
            <legend>読み込み先</legend>
            ${workspaceContext.targets.map((target) => `
              <label class="inline-toggle">
                <input type="radio" name="workspace-import-target" value="${escapeAttribute(target.value)}" ${target.value === workspaceContext.selectedTarget ? "checked" : ""} />
                <span>${escapeHtml(target.label)}</span>
              </label>
            `).join("")}
          </fieldset>
        ` : ""}
        <div class="import-counts" aria-label="選択した利用環境への読み込み結果">
          ${renderImportCountChip(selectedReview.newItems.length, "新しい玉", "new")}
          ${renderImportCountChip(selectedReview.duplicates.length, "登録済み", "duplicate")}
          ${renderImportCountChip(selectedReview.conflicts.length, "同じIDで別内容", "conflict")}
          ${workspaceShare.rejectedItemCount > 0 ? renderImportCountChip(workspaceShare.rejectedItemCount, "読めない玉", "conflict") : ""}
        </div>
        ${renderImportBallList("追加できる玉", selectedReview.newItems, emotionEchoStrength, categories)}
        ${renderImportBallList("登録済みの玉", selectedReview.duplicates, emotionEchoStrength, categories)}
        ${renderImportBallList("競合している玉", selectedReview.conflicts, emotionEchoStrength, categories)}
        ${selectedTargetIsNew ? `
          <p class="dialog-detail">玉・名前帳・カテゴリ・アプリ設定を、新しい別利用環境として保存します。</p>
        ` : `
          <fieldset class="workspace-import-options">
            <legend>読み込む内容</legend>
            <label class="inline-toggle">
              <input type="checkbox" name="workspace-import-option" value="newBalls" ${selectedReview.newItems.length > 0 ? "checked" : "disabled"} />
              <span>新しい玉を追加（${selectedReview.newItems.length}件）</span>
            </label>
            <label class="inline-toggle">
              <input type="checkbox" name="workspace-import-option" value="nameBook" ${workspaceContext?.missingNameCount ? "" : "disabled"} />
              <span>未登録の名前帳人物を追加（${workspaceContext?.missingNameCount ?? 0}件）</span>
            </label>
            <label class="inline-toggle">
              <input type="checkbox" name="workspace-import-option" value="categories" />
              <span>カテゴリ設定をファイル内容に置き換える</span>
            </label>
            <label class="inline-toggle">
              <input type="checkbox" name="workspace-import-option" value="appSettings" />
              <span>アプリ設定をファイル内容に置き換える</span>
            </label>
            ${selectedReview.conflicts.length > 0 ? `
              <label class="inline-toggle">
                <input type="checkbox" name="workspace-import-option" value="conflicts" />
                <span>競合する${selectedReview.conflicts.length}玉をファイル内容で上書き</span>
              </label>
            ` : ""}
          </fieldset>
        `}
        <div class="dialog-actions workspace-import-actions">
          <button class="ghost-action" type="button" id="dismiss-json-import">今回はやめる</button>
          <button class="primary-action" type="button" id="confirm-workspace-import" ${selectedTargetIsNew || canApplyExistingByDefault ? "" : "disabled"}>${selectedTargetIsNew ? "別利用環境として保存" : "選んだ内容を読み込む"}</button>
        </div>
      </section>
    </div>
  `;
}

function renderDeviceBackupImportDialog(pendingJsonImport: JsonImportReview): string {
  const backup = pendingJsonImport.deviceBackup;
  if (!backup) {
    return "";
  }
  const ballCount = backup.workspaces.reduce((total, workspace) => total + workspace.ledger.balls.length, 0);
  return `
    <div class="ball-dialog-backdrop import-dialog-backdrop" data-cancel-device-backup-import>
      <section class="ball-dialog import-dialog app-modal-scroll" data-scroll-owner role="dialog" aria-modal="true" aria-labelledby="json-import-title">
        <div class="dialog-title-block">
          <span>${escapeHtml(pendingJsonImport.fileName)}</span>
          <h2 id="json-import-title">端末全体を復元しますか</h2>
        </div>
        <p class="dialog-detail import-cancel-safety">まだ保存データは変更されていません。「今回はやめる」なら何も変更されません。</p>
        <div class="import-counts" aria-label="バックアップ内容">
          <span><strong>${backup.workspaces.length}</strong> 利用環境</span>
          <span><strong>${ballCount}</strong> 玉レコード</span>
        </div>
        <p class="dialog-detail">現在この端末にある利用環境、玉、名前帳、カテゴリ、アプリ設定を、バックアップ時点の内容に置き換えます。</p>
        <div class="dialog-actions">
          <button class="ghost-action" type="button" id="dismiss-json-import">今回はやめる</button>
          <button class="danger-action" type="button" id="confirm-device-backup-import">端末全体を復元</button>
        </div>
      </section>
    </div>
  `;
}

function renderUrlImportStatus(review: PacketImportReview): string {
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

function renderImportBallList(
  title: string,
  balls: HappyBall[],
  emotionEchoStrength: EmotionEchoStrength,
  categories: readonly CategoryColorPreset[],
): string {
  if (balls.length === 0) {
    return "";
  }

  return `
    <section class="import-ball-list">
      <h3>${escapeHtml(title)}</h3>
      ${balls.slice(0, 4).map((ball) => {
        const visual = resolveBallDisplayVisual(ball, categories);
        return `
        <article class="import-ball-item">
          <span class="mini-ball ${renderDisplayVisualKindClass(visual)} ${renderEchoClass(ball, emotionEchoStrength)}" style="${renderBallVisualStyle(ball, emotionEchoStrength, categories)}" aria-hidden="true"></span>
          <div>
            <strong>${escapeHtml(ball.title)}</strong>
            <small>${escapeHtml(ball.date)} / ${escapeHtml(ball.subject)} / ${escapeHtml(ball.category)}</small>
          </div>
        </article>
      `;
      }).join("")}
      ${balls.length > 4 ? `<p class="import-more">ほか ${balls.length - 4} 件</p>` : ""}
    </section>
  `;
}

function getExistingBallsForIncoming(incomingBalls: HappyBall[], localBalls: HappyBall[]): HappyBall[] {
  const existingById = new Map(localBalls.map((ball) => [ball.id, ball]));
  return incomingBalls
    .map((ball) => existingById.get(ball.id))
    .filter((ball): ball is HappyBall => Boolean(ball));
}

function renderBallVisualStyle(
  ball: HappyBall,
  emotionEchoStrength: EmotionEchoStrength,
  categories: readonly CategoryColorPreset[],
): string {
  const base = renderDisplayVisualStyle(resolveBallDisplayVisual(ball, categories));
  const echo = shouldShowEmotionEcho(ball, emotionEchoStrength) && ball.emotionEcho
    ? resolveEchoDisplayVisual(ball.emotionEcho, categories)
    : null;
  if (!echo) {
    return base;
  }
  return `${base} ${renderEchoVisualStyle(echo)}`;
}

function renderEchoClass(ball: HappyBall, emotionEchoStrength: EmotionEchoStrength): string {
  return shouldShowEmotionEcho(ball, emotionEchoStrength) ? `has-echo echo-${emotionEchoStrength}` : "";
}

function shouldShowEmotionEcho(ball: HappyBall, emotionEchoStrength: EmotionEchoStrength): boolean {
  return Boolean(ball.emotionEcho) && emotionEchoStrength !== "off";
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
