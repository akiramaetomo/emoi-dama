import type { HappyBall } from "./models";
import {
  renderBallDialog,
  renderReceiptDialog,
  renderReceiptQrDialog,
  renderReceiptPaper,
  type DialogRenderContext,
} from "./dialog-renderers.js";

const context: DialogRenderContext = {
  currentUrl: "https://example.test/happy-ball/",
  showMemoField: true,
  emotionEchoStrength: "medium",
};

const sampleBall: HappyBall = {
  id: "ball_20260705_self_send",
  date: "2026-07-05",
  time: "09:18",
  subject: "自分",
  issuerType: "self",
  issuedBy: "真帆",
  enteredBy: "真帆",
  approvedBy: null,
  keepers: ["友人"],
  viewers: [],
  count: 1,
  title: "夏の差し入れ",
  category: "お土産",
  note: "気軽にどうぞ",
  visibility: "open",
  visual: {
    hue: 38,
    saturation: 56,
    lightness: 54,
    kind: "filled",
    label: "夏",
  },
  emotionEcho: {
    recordedAt: "2026-07-05T00:18:00.000Z",
    date: "2026-07-05",
    time: "09:18",
    subject: "自分",
    issuerType: "self",
    count: 1,
    title: "よい余韻",
    category: "軽やか",
    note: "",
    visibility: "category",
    visual: {
      hue: 166,
      saturation: 42,
      lightness: 48,
      kind: "ring",
      label: "軽",
    },
  },
  lifecycleStatus: "active",
  createdAt: "2026-07-05T00:18:00.000Z",
  updatedAt: "2026-07-05T00:18:00.000Z",
  receiptCreatedAt: "2026-07-05T00:20:00.000Z",
};

const detailHtml = renderBallDialog(sampleBall, context);
assertIncludes(detailHtml, "app-modal-backdrop", "ball detail should use the shared fixed modal backdrop");
assertIncludes(detailHtml, "app-modal-scroll", "ball detail should expose one shared modal scroll region");
assertOrder(detailHtml, "surface-fixed-header", "surface-scroll-body", "ball detail header should remain outside its scroll owner");
assertOrder(detailHtml, "detail-screen-name", "detail-edit-top", "detail header should place its name before the edit action");
assertOrder(detailHtml, "detail-edit-top", "data-dialog-close", "detail header should place edit before close in visual and tab order");

assertIncludes(detailHtml, 'detail-card-label">玉を送る</span>', "detail card should use the explicit send-ball title");
assertIncludes(detailHtml, "お配り", "detail card should offer casual send");
assertIncludes(detailHtml, "お預け", "detail card should offer formal send");
assertIncludes(detailHtml, 'data-send-mode="casual"', "casual send button should expose send mode");
assertIncludes(detailHtml, 'data-send-mode="formal"', "formal send button should expose send mode");
assertIncludes(detailHtml, "ghost-action quiet-accent-action detail-card-action", "send buttons should share the quiet current-time palette");
const sendCardStart = detailHtml.indexOf("detail-receipt-card");
const sendCardEnd = detailHtml.indexOf("</article>", sendCardStart);
const sendCardHtml = detailHtml.slice(sendCardStart, sendCardEnd);
assertNotIncludes(sendCardHtml, "降臨GPS情報：", "send card should move GPS privacy status into the descent group");
assertIncludes(detailHtml, 'class="detail-descent-history" aria-label="降臨"', "detail should always render a descent group");
assertIncludes(detailHtml, "降臨GPS情報：", "descent group should use the explicit GPS privacy label");
assertIncludes(detailHtml, ">OFF</strong>", "GPS-off descent group should show its state as text");
assertNotIncludes(detailHtml, "handoff-privacy-switch", "send card should not resemble an editable switch");
assertNotIncludes(detailHtml, "handoff-privacy-input", "send card GPS state should not expose a form control");
assertIncludes(detailHtml, "⚙ 設定の「降臨」で変更", "descent group should point to its settings location");
assertIncludes(detailHtml, "降臨なし", "empty detail descent group should explain that it has no records");
assertNotIncludes(detailHtml, "降臨GPSを含めない", "send card should not resemble an unchecked error state");
assertNotIncludes(detailHtml, "準備済み", "detail send card should not show prepared status");
assertNotIncludes(detailHtml, "未準備", "detail send card should not show unprepared status");
assertNotIncludes(detailHtml, "data-receipt-status-ball-id", "detail send card should not expose receipt status marker");
assertNotIncludes(detailHtml, "receipt-thumb", "detail send card should not show receipt thumbnail");
assertIncludes(detailHtml, "detail-feeling-card", "detail should include full-width feeling card");
assertIncludes(detailHtml, "カテゴリ", "detail feeling card should label category");
assertIncludes(detailHtml, "余韻", "detail feeling card should label echo");
assertIncludes(detailHtml, "お土産", "detail feeling card should show category value");
assertIncludes(detailHtml, "軽やか", "detail feeling card should show echo value");
assertIncludes(detailHtml, "mini-ball detail-info-ball", "detail feeling card should show mini ball markers");
const feelingCardStart = detailHtml.indexOf('detail-feeling-card');
const feelingCardEnd = detailHtml.indexOf('</article>', feelingCardStart);
const feelingCardHtml = detailHtml.slice(feelingCardStart, feelingCardEnd);
assertNotIncludes(feelingCardHtml, "玉数", "detail feeling card should not show ball count as an info row");
assertNotIncludes(detailHtml, "detail-ball-count-under-icon", "single-ball detail should not show a count under the ball icon");
const multiBallDetailHtml = renderBallDialog({ ...sampleBall, count: 4 }, context);
assertIncludes(multiBallDetailHtml, "detail-ball-count-under-icon", "multi-ball detail should show a count under the ball icon");
assertIncludes(multiBallDetailHtml, "4玉", "multi-ball detail should show the count under the ball icon");

const descentDetailHtml = renderBallDialog({
  ...sampleBall,
  descents: [
    {
      id: "descent_1",
      sequence: 1,
      recordedAt: "2026-07-05T01:18:00.000Z",
      latitude: 35.681236,
      longitude: 139.767125,
      accuracyMeters: 12,
      badgeAwarded: true,
      memo: "駅前で降臨",
    },
  ],
  descentBadgeCount: 1,
  isKamiBall: false,
}, context);
assertIncludes(descentDetailHtml, 'class="descent-section-label">降臨</span>', "detail should show the descent group label");
assertIncludes(descentDetailHtml, "descent-section-label", "detail should style descent label separately");
assertNotIncludes(descentDetailHtml, "detail-descent-card", "detail should not render the redundant descent summary card");
assertNotIncludes(descentDetailHtml, "降臨 1回", "detail descent heading should not show descent count");
assertIncludes(descentDetailHtml, "No.1", "detail should show descent sequence as number label");
assertNotIncludes(descentDetailHtml, "第1回", "detail should not use the old descent sequence label");
assertIncludes(descentDetailHtml, "駅前で降臨", "detail should show descent memo");
assertIncludes(descentDetailHtml, "35.68124, 139.7671", "detail should show descent coordinates");
assertIncludes(descentDetailHtml, "Google Maps", "detail should link to Google Maps");
assertIncludes(descentDetailHtml, "https://www.google.com/maps/search/?api=1", "detail should generate a Google Maps URL");

const foldedDescentDetailHtml = renderBallDialog({
  ...sampleBall,
  descents: [
    {
      id: "descent_1",
      sequence: 1,
      recordedAt: "2026-07-05T01:18:00.000Z",
      badgeAwarded: true,
      memo: "地下でメモだけ",
    },
    {
      id: "descent_2",
      sequence: 2,
      recordedAt: "2026-07-05T02:18:00.000Z",
      latitude: 35.681236,
      longitude: 139.767125,
      accuracyMeters: 12,
      badgeAwarded: true,
      memo: "駅前で再降臨",
    },
  ],
  descentBadgeCount: 2,
  isKamiBall: false,
}, context);
assertNotIncludes(foldedDescentDetailHtml, "降臨 2回", "detail should not show total descent count in a summary card");
assertIncludes(foldedDescentDetailHtml, "✦2", "detail ball should show compact descent badge");
assertIncludes(foldedDescentDetailHtml, "No.2", "latest descent should use number label");
assertIncludes(foldedDescentDetailHtml, "ほかの降臨を見る（1回）", "multiple descents should fold older records");
assertIncludes(foldedDescentDetailHtml, "位置未取得", "GPS-less descent should render as missing location");
assertIncludes(foldedDescentDetailHtml, "駅前で再降臨", "latest descent should remain directly visible");

const casualPaper = renderReceiptPaper(sampleBall, { idPrefix: "test-casual", showUrl: true, sendMode: "casual" }, context);
assertIncludes(casualPaper, "Emoi Dama Cover Note", "casual paper should use the casual English heading");
assertIncludes(casualPaper, "お配り", "casual paper should use casual title");
assertIncludes(casualPaper, "<dt>発行者</dt>", "casual paper should show issuer");
assertIncludes(casualPaper, "真帆", "casual paper should include issuer value");
assertIncludes(casualPaper, "<dt>カテゴリ／余韻</dt>", "casual paper should show category and echo");
assertIncludes(casualPaper, "receipt-qr-code", "casual paper should render a QR block");
assertNotIncludes(casualPaper, "相手のスマホで読み取ると", "paper should omit the redundant QR explanation");
assertNotIncludes(casualPaper, "<dt>預け先</dt>", "casual paper should not show keeper target");
assertNotIncludes(casualPaper, "<dt>預かり者</dt>", "casual paper should not show keeper person");
assertNotIncludes(casualPaper, "<dt>メモ</dt>", "casual paper should not show memo");
assertNotIncludes(casualPaper, "玉ID", "casual paper should not show ball ID");

const formalPaper = renderReceiptPaper(sampleBall, { idPrefix: "test-formal", showUrl: true, sendMode: "formal" }, context);
assertIncludes(formalPaper, "お預け状", "formal self paper should remain an oazuke note");
assertIncludes(formalPaper, "<dt>発行者</dt>", "formal paper should still show eligible issuer");
assertIncludes(formalPaper, "<dt>メモ</dt>", "formal paper should keep visible memo when allowed");
assertNotIncludes(formalPaper, "<dt>タイトル</dt>", "formal paper should remove duplicate title row");
assertNotIncludes(formalPaper, "<dt>預け先</dt>", "formal paper should remove keeper target row");
assertNotIncludes(formalPaper, "<dt>預かり者</dt>", "formal paper should remove keeper person row");
assertIncludes(formalPaper, "降臨GPS なし", "paper should show GPS sharing state without coordinates");
assertOrder(formalPaper, "receipt-url", "receipt-hero", "paper should place QR before ball details");

const receiptDialog = renderReceiptDialog(sampleBall, context, "formal");
assertIncludes(receiptDialog, ">戻る</button>", "receipt should provide a concise back action");
assertNotIncludes(receiptDialog, "← 詳細へ戻る", "receipt should remove the old long back wording");
const receiptHeaderStart = receiptDialog.indexOf("receipt-surface-header");
const receiptHeaderEnd = receiptDialog.indexOf("</div>", receiptHeaderStart);
const receiptHeaderHtml = receiptDialog.slice(receiptHeaderStart, receiptHeaderEnd);
assertNotIncludes(receiptHeaderHtml, "お預け状", "receipt fixed header should not repeat the paper title");
assertNotIncludes(receiptHeaderHtml, "detail-screen-name", "receipt fixed header should not use the tall generic screen-name layout");
assertIncludes(receiptDialog, "QRを大きく", "receipt should expose enlarged QR as its main action");
assertIncludes(receiptDialog, "画像で送る", "receipt should expose image sharing");
assertIncludes(receiptDialog, "↓ 続く", "receipt should include a conditional scroll cue");
assertNotIncludes(receiptDialog, "画像保存", "receipt should not expose image download");
assertNotIncludes(receiptDialog, "URLコピー", "normal receipt should hide URL debug actions");
assertNotIncludes(receiptDialog, "LINE用URL", "normal receipt should hide LINE URL debug actions");

const debugContext = { ...context, handoffDebugEnabled: true, includeDescentGpsInHandoff: true };
const gpsOnDetailHtml = renderBallDialog(sampleBall, debugContext);
assertIncludes(gpsOnDetailHtml, "handoff-privacy-value is-on\">ON</strong>", "GPS-on send card should show a highlighted ON state");
const debugReceiptDialog = renderReceiptDialog(sampleBall, debugContext, "formal");
assertIncludes(debugReceiptDialog, "受け渡しデバッグ", "debug query state should expose collapsible URL tools");
assertIncludes(debugReceiptDialog, "URLコピー", "debug receipt should expose URL copy");
assertIncludes(debugReceiptDialog, "LINE用URL", "debug receipt should expose LINE URL copy");
assertIncludes(debugReceiptDialog, "降臨GPS あり", "GPS-on paper should show its sharing state");
const debugQrDialog = renderReceiptQrDialog(sampleBall, debugContext, "formal");
assertIncludes(debugQrDialog, "受け渡しデバッグ", "large QR should keep debug tools behind debug state");

const oversizedReceipt = renderReceiptDialog({ ...sampleBall, note: "private-location-note".repeat(5000) }, context, "formal");
assertIncludes(oversizedReceipt, "受け渡し用QRの生成異常", "oversized handoff should show a specific QR failure");
assertIncludes(oversizedReceipt, "エラー情報をコピー", "QR failure should offer diagnostic copying");
const qrFailureStart = oversizedReceipt.indexOf("data-qr-generation-error");
const qrFailureEnd = oversizedReceipt.indexOf("</div>", qrFailureStart);
const qrFailureHtml = oversizedReceipt.slice(qrFailureStart, qrFailureEnd);
assertNotIncludes(qrFailureHtml, "private-location-note", "QR diagnostic markup must not expose memo text");
assertNotIncludes(qrFailureHtml, "https://", "QR diagnostic markup must not expose the handoff URL");

const proxyPaper = renderReceiptPaper(
  { ...sampleBall, issuerType: "proxy", issuedBy: "祖母", enteredBy: "真帆", keepers: ["叔父"] },
  { idPrefix: "test-proxy", showUrl: true, sendMode: "formal" },
  context,
);
assertIncludes(proxyPaper, "預かり証", "formal proxy paper should remain a receipt");
assertNotIncludes(proxyPaper, "<dt>預かり者</dt>", "proxy receipt should not show keeper person row");

function assertIncludes(haystack: string, needle: string, message: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`${message}: missing ${needle}`);
  }
}

function assertNotIncludes(haystack: string, needle: string, message: string): void {
  if (haystack.includes(needle)) {
    throw new Error(`${message}: found ${needle}`);
  }
}

function assertOrder(haystack: string, first: string, second: string, message: string): void {
  if (haystack.indexOf(first) < 0 || haystack.indexOf(first) >= haystack.indexOf(second)) {
    throw new Error(message);
  }
}
