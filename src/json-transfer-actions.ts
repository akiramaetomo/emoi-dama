import type { CategoryColorPreset } from "./categories";
import {
  createExportFileName,
  createExportPayload,
  isExportSection,
  reviewJsonImport,
  type ExportSection,
  type JsonImportReview,
} from "./json-transfer";
import type { HappyBallLedger } from "./models";
import type { AppSettings } from "./settings";
import { importNewBalls, updateNameBook } from "./storage";

export interface JsonExportSource {
  ledger: HappyBallLedger;
  appSettings: AppSettings;
  categories: CategoryColorPreset[];
}

export interface JsonImportApplySource {
  ledger: HappyBallLedger;
  selectedBallId: string | null;
}

export interface JsonImportApplyResult {
  ledger: HappyBallLedger;
  selectedBallId: string | null;
  appSettings?: AppSettings;
  categories?: CategoryColorPreset[];
}

export function exportSelectedJson(source: JsonExportSource): boolean {
  const sections = readSelectedJsonSections("export-section");

  if (sections.length === 0) {
    alert("書き出す内容を選んでください。");
    return false;
  }

  const payload = createExportPayload(sections, source);
  downloadJsonFile(payload, createExportFileName(sections));
  return true;
}

export async function reviewJsonImportFile(input: HTMLInputElement, ledger: HappyBallLedger): Promise<JsonImportReview | null> {
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return null;
  }

  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    return reviewJsonImport(parsed, file.name, ledger);
  } catch {
    return {
      fileName: file.name,
      sections: [],
      error: "JSONファイルを読み込めませんでした。",
    };
  }
}

export function readSelectedJsonImportSections(): ExportSection[] {
  return readSelectedJsonSections("json-import-section");
}

export function applyJsonImportReview(
  review: JsonImportReview,
  selectedSections: ExportSection[],
  source: JsonImportApplySource,
): JsonImportApplyResult {
  let ledger = source.ledger;
  let selectedBallId = source.selectedBallId;
  const selected = new Set(selectedSections);
  const result: JsonImportApplyResult = {
    ledger,
    selectedBallId,
  };

  if (selected.has("ledger") && review.ledger) {
    ledger = importNewBalls(ledger, review.ledger.newItems);
    if (review.ledger.nameBookToAdd.length > 0) {
      ledger = updateNameBook(ledger, [...ledger.ownerProfile.nameBook, ...review.ledger.nameBookToAdd]);
    }
    selectedBallId = review.ledger.newItems[0]?.id ?? selectedBallId;
    result.ledger = ledger;
    result.selectedBallId = selectedBallId;
  }

  if (selected.has("appSettings") && review.appSettings) {
    result.appSettings = review.appSettings;
  }

  if (selected.has("categories") && review.categories) {
    result.categories = review.categories;
  }

  return result;
}

function readSelectedJsonSections(name: "export-section" | "json-import-section"): ExportSection[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>(`input[name='${name}']:checked`))
    .map((input) => input.value)
    .filter(isExportSection);
}

function downloadJsonFile(payload: unknown, fileName: string): void {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
