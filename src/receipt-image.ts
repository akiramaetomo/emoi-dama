import {
  canShowIssuer,
  canShowMemo,
  createVisibilitySafeSummaryLabel,
  getReceiptTitle,
} from "./dialog-renderers";
import { resolveBallDisplayVisual, type DisplayVisual } from "./ball-visual-display.js";
import type { CategoryColorPreset } from "./categories.js";
import { formatBallDateTime } from "./models.js";
import type { HappyBall, SendMode } from "./models";
import { createPacketImportUrl } from "./packet";
import { createQrCode, type QrCodeMatrix } from "./qr-code";

export interface ReceiptImageContext {
  currentUrl: string;
  showMemoField: boolean;
  includeDescentGpsInHandoff: boolean;
  categories: CategoryColorPreset[];
}

export function createReceiptImageFileName(ball: HappyBall, sendMode: SendMode = "formal"): string {
  const title = (ball.title || ball.category || "emoi-dama")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .slice(0, 32) || "emoi-dama";
  const modeLabel = sendMode === "casual" ? "okubari" : "oazuke";
  return `emoi-dama-${ball.date}-${modeLabel}-${title}.png`;
}

export async function createReceiptImageBlob(
  ball: HappyBall,
  receiptContext: ReceiptImageContext,
  sendMode: SendMode = "formal",
): Promise<Blob> {
  const width = 1080;
  const height = 1800;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable.");
  }

  drawReceiptImage(context, ball, receiptContext, width, height, sendMode);

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

function drawReceiptImage(
  context: CanvasRenderingContext2D,
  ball: HappyBall,
  receiptContext: ReceiptImageContext,
  width: number,
  height: number,
  sendMode: SendMode,
): void {
  const receiptTitle = getReceiptTitle(ball, sendMode);
  const stamp = sendMode === "casual" ? "配" : ball.issuerType === "proxy" ? "預" : "託";
  const eyebrow = sendMode === "casual" ? "Emoi Dama Cover Note" : "emoi dama app";
  const packetUrl = createPacketImportUrl(ball, receiptContext.currentUrl, {
    sendMode,
    includeDescentGps: receiptContext.includeDescentGpsInHandoff,
  });
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
  context.fillText(eyebrow, margin, y);
  y += 76;

  context.fillStyle = "#2c2418";
  context.font = "900 62px 'Yu Mincho', 'Hiragino Mincho ProN', serif";
  context.fillText("えもい玉", margin, y);
  y += 72;
  context.fillText(receiptTitle, margin, y);

  drawReceiptStamp(context, width - margin - 92, 86, 92, stamp);

  y += 62;
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
  context.fillText(`降臨GPS ${receiptContext.includeDescentGpsInHandoff ? "あり" : "なし"}`, width / 2, y);
  context.textAlign = "left";
  y += 52;

  drawReceiptHero(context, ball, receiptContext, margin, y, contentWidth, sendMode);
  y += 174;

  const rows = createReceiptImageRows(ball, receiptContext.showMemoField, sendMode);
  drawReceiptRows(context, rows, margin, y, contentWidth);
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

function drawReceiptHero(
  context: CanvasRenderingContext2D,
  ball: HappyBall,
  receiptContext: ReceiptImageContext,
  x: number,
  y: number,
  width: number,
  sendMode: SendMode,
): void {
  context.fillStyle = "rgba(255, 250, 237, 0.68)";
  context.strokeStyle = "rgba(96, 63, 23, 0.18)";
  context.lineWidth = 2;
  drawRoundedRect(context, x, y, width, 132, 16);
  context.fill();
  context.stroke();

  drawReceiptBall(context, resolveBallDisplayVisual(ball, receiptContext.categories), x + 76, y + 66, 84);
  context.fillStyle = "#6b5638";
  context.font = "900 28px sans-serif";
  context.fillText(formatBallDateTime(ball.date, ball.time), x + 154, y + 48);
  context.fillStyle = "#2c2418";
  context.font = "900 40px sans-serif";
  drawWrappedText(context, createReceiptHeroLabel(ball, sendMode), x + 154, y + 92, width - 190, 45, 2);
}

function drawReceiptBall(context: CanvasRenderingContext2D, visual: DisplayVisual, cx: number, cy: number, size: number): void {
  const radius = size / 2;
  if (visual.kind === "ring") {
    drawReceiptRingBall(context, visual, cx, cy, radius, size);
    return;
  }

  context.save();
  context.shadowColor = "rgba(28, 38, 34, 0.24)";
  context.shadowBlur = size * 0.15;
  context.shadowOffsetX = size * 0.055;
  context.shadowOffsetY = size * 0.09;
  const gradient = context.createRadialGradient(cx - radius * 0.34, cy - radius * 0.38, 6, cx, cy, radius);
  gradient.addColorStop(0, "rgba(255, 252, 232, 0.96)");
  gradient.addColorStop(0.18, `hsl(${visual.hue} ${Math.min(visual.saturation + 8, 100)}% ${Math.min(visual.lightness + 16, 94)}%)`);
  gradient.addColorStop(0.58, `hsl(${visual.hue} ${visual.saturation}% ${visual.lightness}%)`);
  gradient.addColorStop(1, `hsl(${visual.hue} ${Math.max(visual.saturation - 8, 0)}% ${Math.max(visual.lightness - 18, 12)}%)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();

  const highlight = context.createRadialGradient(cx - radius * 0.36, cy - radius * 0.42, 0, cx - radius * 0.28, cy - radius * 0.34, radius * 0.48);
  highlight.addColorStop(0, "rgba(255, 255, 255, 0.78)");
  highlight.addColorStop(0.42, "rgba(255, 255, 255, 0.22)");
  highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = highlight;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();
}

function drawReceiptRingBall(
  context: CanvasRenderingContext2D,
  visual: DisplayVisual,
  cx: number,
  cy: number,
  radius: number,
  size: number,
): void {
  const lineWidth = Math.max(7, size * 0.105);
  const ringRadius = radius - lineWidth / 2;
  context.save();
  context.shadowColor = "rgba(28, 38, 34, 0.2)";
  context.shadowBlur = size * 0.13;
  context.shadowOffsetX = size * 0.045;
  context.shadowOffsetY = size * 0.075;
  context.strokeStyle = `hsl(${visual.hue} ${visual.saturation}% ${visual.lightness}%)`;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.arc(cx, cy, ringRadius, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  context.save();
  context.lineCap = "round";
  context.lineWidth = lineWidth * 0.32;
  context.strokeStyle = `hsl(${visual.hue} ${Math.min(visual.saturation + 8, 100)}% ${Math.min(visual.lightness + 25, 97)}% / 0.88)`;
  context.beginPath();
  context.arc(cx, cy, ringRadius, Math.PI * 1.05, Math.PI * 1.72);
  context.stroke();
  context.strokeStyle = `hsl(${visual.hue} ${Math.max(visual.saturation - 6, 0)}% ${Math.max(visual.lightness - 20, 10)}% / 0.5)`;
  context.beginPath();
  context.arc(cx, cy, ringRadius, Math.PI * 0.04, Math.PI * 0.72);
  context.stroke();
  context.restore();
}

function createReceiptImageRows(
  ball: HappyBall,
  showMemoField: boolean,
  sendMode: SendMode,
): Array<{ label: string; value: string; wide?: boolean }> {
  const rows: Array<{ label: string; value: string; wide?: boolean }> = [];
  if (sendMode === "casual" || canShowIssuer(ball)) {
    rows.push({ label: "発行者", value: ball.issuedBy });
  }
  rows.push({ label: "カテゴリ／余韻", value: `${ball.category}／${ball.emotionEcho?.category ?? "ー"}`, wide: true });
  if (sendMode === "formal" && canShowMemo(ball) && (ball.note.trim() || showMemoField)) {
    rows.push({ label: "メモ", value: ball.note.trim(), wide: true });
  }
  return rows;
}

function createReceiptHeroLabel(ball: HappyBall, sendMode: SendMode): string {
  if (sendMode === "casual") {
    return ball.title || ball.visual.label || ball.category || "玉";
  }
  return createVisibilitySafeSummaryLabel(ball);
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
