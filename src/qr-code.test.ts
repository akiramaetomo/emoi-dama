import { createQrCode, createQrSvg } from "./qr-code.js";

const shortQr = createQrCode("https://example.test/happy-ball/#import=test");
assert(shortQr.size >= 21, "short URL should produce a valid QR size");
assertEqual(shortQr.modules.length, shortQr.size, "QR matrix should be square");
assertEqual(shortQr.modules[0].length, shortQr.size, "QR matrix row should match size");
assert(shortQr.modules.some((row) => row.some(Boolean)), "QR matrix should contain dark modules");

const longUrl = `https://akiramaetomo.github.io/emoi-dama/#import=${"a".repeat(1200)}`;
const longQr = createQrCode(longUrl);
assert(longQr.size > shortQr.size, "longer URL should select a larger QR version");

const svg = createQrSvg(longUrl);
assert(svg.startsWith("<svg"), "QR SVG should start with an svg element");
assert(svg.includes("viewBox="), "QR SVG should include a viewBox");
assert(svg.includes("<path"), "QR SVG should render dark modules as a path");

assertThrows(() => createQrCode("x".repeat(4000)), "oversized QR payload should fail clearly");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertThrows(action: () => void, message: string): void {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(message);
}
