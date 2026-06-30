import { normalizeCategoryColorPresets, type CategoryColorPreset } from "./categories.js";
import type { HappyBall, HappyBallLedger, NameBookEntry } from "./models";
import { PACKET_TYPE, normalizePacketBall, reviewPacketImport } from "./packet.js";
import { looksLikeAppSettings, normalizeAppSettings, type AppSettings } from "./settings.js";
import { MAX_NAME_BOOK_ENTRIES } from "./storage.js";

export type ExportSection = "ledger" | "appSettings" | "categories";
export type JsonImportSection = ExportSection;

export interface JsonImportReview {
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

interface ExportPayloadSource {
  ledger: HappyBallLedger;
  appSettings: AppSettings;
  categories: CategoryColorPreset[];
}

const exportSectionSlugs: Record<ExportSection, string> = {
  ledger: "ledger",
  appSettings: "app-settings",
  categories: "categories",
};

export function isExportSection(value: string): value is ExportSection {
  return value === "ledger" || value === "appSettings" || value === "categories";
}

export function createExportPayload(
  sections: ExportSection[],
  source: ExportPayloadSource,
  exportedAt = new Date().toISOString(),
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    v: 1,
    type: "happy-ball-export",
    exportedAt,
    sections,
  };

  if (sections.includes("ledger")) {
    payload.ledger = source.ledger;
  }
  if (sections.includes("appSettings")) {
    payload.appSettings = source.appSettings;
  }
  if (sections.includes("categories")) {
    payload.categories = source.categories;
  }

  return payload;
}

export function createExportFileName(sections: ExportSection[], exportedAt = new Date().toISOString()): string {
  const selected = sections.map((section) => exportSectionSlugs[section]).join("-");
  const stamp = exportedAt
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "")
    .replace("T", "-");
  return `emoi-dama-export-${selected}-${stamp}.json`;
}

export function reviewJsonImport(
  value: unknown,
  fileName: string,
  existingLedger: HappyBallLedger,
): JsonImportReview {
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

  const ledgerReview = reviewLedgerImport(ledgerSource, existingLedger);
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

function reviewLedgerImport(value: unknown, existingLedger: HappyBallLedger): JsonImportReview["ledger"] | null {
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
  const ballReview = reviewPacketImport(packet, existingLedger.balls);
  return {
    ...ballReview,
    rejectedItemCount: value.balls.length - balls.length,
    nameBookToAdd: collectImportNameBookAdditions(value.ownerProfile, existingLedger.ownerProfile.nameBook),
  };
}

function collectImportNameBookAdditions(ownerProfile: unknown, existingNameBook: NameBookEntry[]): NameBookEntry[] {
  if (!isPlainObject(ownerProfile) || !Array.isArray(ownerProfile.nameBook)) {
    return [];
  }

  const existing = new Set(existingNameBook.map((entry) => entry.name));
  const additions: NameBookEntry[] = [];
  for (const item of ownerProfile.nameBook) {
    if (existingNameBook.length + additions.length >= MAX_NAME_BOOK_ENTRIES) {
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

function reviewCategoryImport(value: unknown): CategoryColorPreset[] | null {
  return Array.isArray(value) ? normalizeCategoryColorPresets(value) : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
