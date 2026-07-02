import {
  canShowIssuer,
  canShowMemo,
  canShowTitle,
  createVisibilitySafeSummaryLabel,
  receiptTitleLabels,
} from "./dialog-renderers";
import type { HappyBall } from "./models";
import { createPacketImportUrl } from "./packet";
import { createQrCode, type QrCodeMatrix } from "./qr-code";

export interface ReceiptImageContext {
  currentUrl: string;
  showMemoField: boolean;
}

export function createReceiptImageFileName(ball: HappyBall): string {
  const title = (ball.title || ball.category || "emoi-dama")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .slice(0, 32) || "emoi-dama";
  return `emoi-dama-${ball.date}-${receiptTitleLabels[ball.issuerType]}-${title}.png`;
}

export async function createReceiptImageBlob(ball: HappyBall, receiptContext: ReceiptImageContext): Promise<Blob> {
  const width = 1080;
  const height = 1800;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable.");
  }

  drawReceiptImage(context, ball, receiptContext, width, height);

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
): void {
  const receiptTitle = receiptTitleLabels[ball.issuerType];
  const stamp = ball.issuerType === "proxy" ? "預" : "託";
  const packetUrl = createPacketImportUrl(ball, receiptContext.currentUrl);
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

  const rows = createReceiptImageRows(ball, receiptContext.showMemoField);
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
  if (ball.visual.kind === "ring") {
    const fill = context.createRadialGradient(cx - radius * 0.3, cy - radius * 0.34, 4, cx, cy, radius);
    fill.addColorStop(0, "rgba(255, 255, 255, 0.72)");
    fill.addColorStop(0.54, `hsl(${ball.visual.hue} ${Math.max(ball.visual.saturation - 16, 8)}% ${Math.min(ball.visual.lightness + 16, 94)}% / 0.12)`);
    fill.addColorStop(1, `hsl(${ball.visual.hue} ${ball.visual.saturation}% ${ball.visual.lightness}% / 0.04)`);
    context.fillStyle = fill;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = `hsl(${ball.visual.hue} ${Math.min(ball.visual.saturation + 6, 92)}% ${Math.min(ball.visual.lightness + 8, 88)}% / 0.96)`;
    context.lineWidth = Math.max(7, size * 0.11);
    context.beginPath();
    context.arc(cx, cy, radius - context.lineWidth / 2, 0, Math.PI * 2);
    context.stroke();
    return;
  }

  const gradient = context.createRadialGradient(cx - radius * 0.34, cy - radius * 0.38, 6, cx, cy, radius);
  gradient.addColorStop(0, "#fff8dd");
  gradient.addColorStop(0.28, `hsl(${ball.visual.hue} ${ball.visual.saturation}% ${Math.min(ball.visual.lightness + 12, 86)}%)`);
  gradient.addColorStop(1, `hsl(${ball.visual.hue} ${ball.visual.saturation}% ${Math.max(ball.visual.lightness - 14, 18)}%)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();
}

function createReceiptImageRows(ball: HappyBall, showMemoField: boolean): Array<{ label: string; value: string; wide?: boolean }> {
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
  if (canShowMemo(ball) && (ball.note.trim() || showMemoField)) {
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
