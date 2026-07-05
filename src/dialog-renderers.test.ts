import type { HappyBall } from "./models";
import {
  renderBallDialog,
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
assertIncludes(detailHtml, "送る", "detail card should be titled send");
assertIncludes(detailHtml, "お配り", "detail card should offer casual send");
assertIncludes(detailHtml, "お預け", "detail card should offer formal send");
assertIncludes(detailHtml, 'data-send-mode="casual"', "casual send button should expose send mode");
assertIncludes(detailHtml, 'data-send-mode="formal"', "formal send button should expose send mode");
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
assertIncludes(descentDetailHtml, "降臨情報", "detail should show descent history");
assertIncludes(descentDetailHtml, "第1回", "detail should show descent sequence");
assertIncludes(descentDetailHtml, "駅前で降臨", "detail should show descent memo");
assertIncludes(descentDetailHtml, "35.68124, 139.7671", "detail should show descent coordinates");
assertIncludes(descentDetailHtml, "Google Maps", "detail should link to Google Maps");
assertIncludes(descentDetailHtml, "https://www.google.com/maps/search/?api=1", "detail should generate a Google Maps URL");

const casualPaper = renderReceiptPaper(sampleBall, { idPrefix: "test-casual", showUrl: true, sendMode: "casual" }, context);
assertIncludes(casualPaper, "Emoi Dama Cover Note", "casual paper should use the casual English heading");
assertIncludes(casualPaper, "お配り", "casual paper should use casual title");
assertIncludes(casualPaper, "<dt>発行者</dt>", "casual paper should show issuer");
assertIncludes(casualPaper, "真帆", "casual paper should include issuer value");
assertIncludes(casualPaper, "<dt>カテゴリ／余韻</dt>", "casual paper should show category and echo");
assertIncludes(casualPaper, "receipt-qr-code", "casual paper should render a QR block");
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
