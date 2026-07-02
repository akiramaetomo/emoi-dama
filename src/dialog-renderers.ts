import { visibilityLabels, type HappyBall, type IssuerType } from "./models";
import { createPacketImportUrl } from "./packet";
import { createQrSvg } from "./qr-code";
import type { EmotionEchoStrength } from "./settings";
import { canShowMemoText, getMemoSurfaceMode, type MemoSurfaceMode } from "./visibility";

export interface DialogRenderContext {
  currentUrl: string;
  showMemoField: boolean;
  emotionEchoStrength: EmotionEchoStrength;
}

export const receiptTitleLabels: Record<IssuerType, string> = {
  self: "お預け状",
  assisted: "お預け状",
  proxy: "預かり証",
};

export function renderBallDialog(ball: HappyBall, context: DialogRenderContext): string {
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
          <div class="dialog-ball ${renderVisualKindClass(ball.visual)} ${renderEchoClass(ball, context)}" style="${renderBallVisualStyle(ball, context)} --ball-rotation: 0.34rad;" aria-hidden="true">
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
        ${renderDialogDetail(ball, context)}
        <div class="detail-card-grid detail-info-list">
          ${showIssuer ? `<article class="detail-info-card detail-info-row">
            <span>発行者</span>
            <div class="detail-info-value">
              <strong>${escapeHtml(ball.issuedBy)}</strong>
            </div>
            ${issuerCardHelper ? `<small>${escapeHtml(issuerCardHelper)}</small>` : ""}
          </article>` : ""}
          <article class="detail-info-card detail-feeling-card">
            <div class="detail-info-row">
              <span>カテゴリ</span>
              ${renderDetailCategory(ball)}
            </div>
            <div class="detail-info-row">
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

export function renderReceiptDialog(ball: HappyBall, context: DialogRenderContext): string {
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
        ${renderReceiptPaper(ball, { idPrefix: "receipt-dialog", showUrl: true }, context)}
      </section>
    </div>
  `;
}

export function renderReceiptQrDialog(ball: HappyBall, context: DialogRenderContext): string {
  const receiptTitle = receiptTitleLabels[ball.issuerType];
  const packetUrl = createPacketImportUrl(ball, context.currentUrl);
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

export function renderReceiptPaper(
  ball: HappyBall,
  options: { idPrefix: string; showUrl: boolean },
  context: DialogRenderContext,
): string {
  const keepers = ball.keepers.length > 0 ? ball.keepers.join(", ") : "未設定";
  const packetUrl = options.showUrl ? createPacketImportUrl(ball, context.currentUrl) : "";
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
        <div class="dialog-ball receipt-ball ${renderVisualKindClass(ball.visual)} ${renderEchoClass(ball, context)}" style="${renderBallVisualStyle(ball, context)} --ball-rotation: 0.18rad;" aria-hidden="true">
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
        ${renderReceiptMemoRow(ball, context)}
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

export function createVisibilitySafeSummaryLabel(ball: HappyBall): string {
  if (ball.visibility === "category") {
    return ball.category || "玉";
  }
  if (ball.visibility === "issuer") {
    return ball.issuedBy || ball.subject || "発行者";
  }
  return ball.title || ball.visual.label || ball.category || "玉";
}

export function createVisibilitySafeTitleLabel(ball: HappyBall): string {
  if (ball.visibility === "category") {
    return Array.from(ball.category.trim() || "玉").slice(0, 16).join("");
  }
  if (ball.visibility === "issuer") {
    return Array.from(ball.issuedBy.trim() || ball.subject.trim() || "発行者").slice(0, 16).join("");
  }
  return Array.from(ball.title.trim() || ball.visual.label).slice(0, 32).join("");
}

export function canShowIssuer(ball: HappyBall): boolean {
  return ball.visibility === "issuer" || ball.visibility === "title" || ball.visibility === "open";
}

export function canShowTitle(ball: HappyBall): boolean {
  return ball.visibility === "title" || ball.visibility === "open";
}

export function canShowMemo(ball: HappyBall): boolean {
  return canShowMemoText(ball.visibility);
}

function renderDialogDetail(ball: HappyBall, context: DialogRenderContext): string {
  return renderMemoSurface(getMemoSurfaceMode(ball.visibility, ball.note, context.showMemoField), ball.note);
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

function renderDetailCategory(ball: HappyBall): string {
  return `
    <span class="detail-info-value detail-category-value">
      <span class="mini-ball detail-info-ball ${renderVisualKindClass(ball.visual)}" style="${renderVisualStyle(ball.visual)}" aria-hidden="true"></span>
      <strong>${escapeHtml(ball.category)}</strong>
    </span>
  `;
}

function renderDetailEcho(ball: HappyBall): string {
  if (!ball.emotionEcho) {
    return `<span class="detail-info-value"><strong>ー</strong></span>`;
  }

  return `
    <span class="detail-info-value detail-echo-value">
      <span class="mini-ball detail-info-ball ${renderVisualKindClass(ball.emotionEcho.visual)}" style="${renderVisualStyle(ball.emotionEcho.visual)}" aria-hidden="true"></span>
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

function renderReceiptFeelingRow(ball: HappyBall): string {
  const echo = ball.emotionEcho?.category ?? "ー";
  return `
    <div class="receipt-feeling-row">
      <dt>カテゴリ／余韻</dt>
      <dd>${escapeHtml(ball.category)}／${escapeHtml(echo)}</dd>
    </div>
  `;
}

function renderReceiptMemoRow(ball: HappyBall, context: DialogRenderContext): string {
  const memo = ball.note.trim();
  if (!canShowMemo(ball) || (!memo && !context.showMemoField)) {
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

function renderBallVisualStyle(ball: HappyBall, context: DialogRenderContext): string {
  const base = renderVisualStyle(ball.visual);
  const echo = shouldShowEmotionEcho(ball, context) ? ball.emotionEcho?.visual : null;
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

function renderEchoClass(ball: HappyBall, context: DialogRenderContext): string {
  return shouldShowEmotionEcho(ball, context) ? `has-echo echo-${context.emotionEchoStrength}` : "";
}

function shouldShowEmotionEcho(ball: HappyBall, context: DialogRenderContext): boolean {
  return Boolean(ball.emotionEcho) && context.emotionEchoStrength !== "off";
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
