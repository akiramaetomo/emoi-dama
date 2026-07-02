import { saveCategoryColorPresets } from "./categories.js";
import type { HappyBallLedger } from "./models";
import { loadLedger, saveLedger } from "./storage.js";

const stored = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
  value: {
    setItem(key: string, value: string): void {
      stored.set(key, value);
    },
    getItem(key: string): string | null {
      return stored.get(key) ?? null;
    },
    removeItem(key: string): void {
      stored.delete(key);
    },
  },
  configurable: true,
});

const ledger: HappyBallLedger = {
  v: 1,
  type: "happy-ball-ledger",
  ledgerId: "ledger_category_test",
  ownerProfile: {
    name: "エモ次郎",
    nameBook: [],
  },
  balls: [
    {
      id: "ball_20260702_abcd",
      date: "2026-07-02",
      subject: "エモ次郎",
      issuerType: "self",
      issuedBy: "エモ次郎",
      enteredBy: "エモ次郎",
      approvedBy: null,
      keepers: ["エモ次郎"],
      viewers: [],
      count: 1,
      title: "黄色い発見",
      category: "ひらめき",
      note: "",
      visibility: "category",
      visual: {
        hue: 43,
        saturation: 68,
        lightness: 58,
        kind: "filled",
        label: "黄色い発",
      },
      lifecycleStatus: "active",
      createdAt: "2026-07-02T10:00:00.000Z",
      updatedAt: "2026-07-02T10:00:00.000Z",
    },
  ],
  createdAt: "2026-07-02T10:00:00.000Z",
  updatedAt: "2026-07-02T10:00:00.000Z",
};

saveLedger(ledger);
saveCategoryColorPresets([
  { name: "よろこび", tone: "bright", hue: 18, saturation: 64, lightness: 62, visualKind: "filled" },
  { name: "ひらめき／かがやき／発見", tone: "bright", hue: 43, saturation: 68, lightness: 58, visualKind: "filled" },
]);

const loadedLedger = loadLedger();
const loadedBall = loadedLedger.balls[0];

assertEqual(loadedBall?.category, "ひらめき", "category preset edits should not rename saved balls");
assertEqual(loadedBall?.visual.hue, 43, "category preset edits should not recolor saved balls");
assertEqual(loadedBall?.visual.label, "黄色い発", "category preset edits should not relabel saved balls");

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
