import {
  getReceiptTitle,
  renderReceiptPaper,
  type DialogRenderContext,
} from "./dialog-renderers";
import type { JsonImportReview } from "./json-transfer";
import type { HappyBall, SendMode } from "./models";
import { reviewPacketImport, type PacketImportReview, type UrlPacketParseResult } from "./packet";
import type { EmotionEchoStrength } from "./settings";

export interface ImportDialogRenderContext {
  localBalls: HappyBall[];
  dialogContext: DialogRenderContext;
  emotionEchoStrength: EmotionEchoStrength;
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
        ${renderImportBallList("受け取る玉", review.newItems, context.emotionEchoStrength)}
        ${renderImportBallList("すでに手元にある玉", review.duplicates, context.emotionEchoStrength)}
        ${renderImportBallList("手元にある同じIDの玉", localConflictBalls, context.emotionEchoStrength)}
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
        ${ledgerReview ? renderImportBallList("追加する玉", ledgerReview.newItems, emotionEchoStrength) : ""}
        <div class="dialog-actions">
          <button class="ghost-action" type="button" id="dismiss-json-import">キャンセル</button>
          <button class="primary-action" type="button" id="confirm-json-import" ${canApply ? "" : "disabled"}>読み込む</button>
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
): string {
  if (balls.length === 0) {
    return "";
  }

  return `
    <section class="import-ball-list">
      <h3>${escapeHtml(title)}</h3>
      ${balls.slice(0, 4).map((ball) => `
        <article class="import-ball-item">
          <span class="mini-ball ${renderVisualKindClass(ball.visual)} ${renderEchoClass(ball, emotionEchoStrength)}" style="${renderBallVisualStyle(ball, emotionEchoStrength)}" aria-hidden="true"></span>
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

function getExistingBallsForIncoming(incomingBalls: HappyBall[], localBalls: HappyBall[]): HappyBall[] {
  const existingById = new Map(localBalls.map((ball) => [ball.id, ball]));
  return incomingBalls
    .map((ball) => existingById.get(ball.id))
    .filter((ball): ball is HappyBall => Boolean(ball));
}

function renderBallVisualStyle(ball: HappyBall, emotionEchoStrength: EmotionEchoStrength): string {
  const base = renderVisualStyle(ball.visual);
  const echo = shouldShowEmotionEcho(ball, emotionEchoStrength) ? ball.emotionEcho?.visual : null;
  if (!echo) {
    return base;
  }
  return `${base} --echo-hue: ${echo.hue}; --echo-saturation: ${echo.saturation}%; --echo-lightness: ${echo.lightness}%;`;
}

function renderVisualStyle(visual: { hue: number; saturation: number; lightness: number }): string {
  return `--ball-hue: ${visual.hue}; --ball-saturation: ${visual.saturation}%; --ball-lightness: ${visual.lightness}%;`;
}

function renderVisualKindClass(visual: { kind?: string }): string {
  return visual.kind === "ring" ? "is-ring-ball" : "is-filled-ball";
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
