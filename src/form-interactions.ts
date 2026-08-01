import {
  visibilityValues,
  type BallDraft,
  type HappyBall,
  type HappyBallDescentRecord,
  type IssuerType,
  type NameRole,
} from "./models.js";

export interface AuthoringDraftDefaults {
  date: string;
  subject: string;
  currentTime: string;
}

export interface AuthoringFormValues {
  get(name: string): FormDataEntryValue | null;
}

export interface EditedDescentFieldValues {
  id?: string;
  sequence?: string;
  recordedAt?: string;
  badgeAwarded?: string;
  memo?: string;
  latitude?: string;
  longitude?: string;
  accuracyMeters?: string;
  distanceFromPreviousMeters?: string;
}

export function createBallDraftFromValues(values: AuthoringFormValues, defaults: AuthoringDraftDefaults): BallDraft {
  const timeEnabled = values.get("timeEnabled") === "on";
  return {
    date: String(values.get("date") || defaults.date),
    time: timeEnabled ? String(values.get("time") || defaults.currentTime) : undefined,
    subject: String(values.get("subject") || defaults.subject),
    issuerType: readUnion(values.get("issuerType"), ["self", "assisted", "proxy"], "self"),
    count: Number(values.get("count") || 1),
    title: String(values.get("title") || ""),
    category: String(values.get("category") || "日常"),
    note: String(values.get("note") || ""),
    visibility: readUnion(values.get("visibility"), visibilityValues, "open"),
  };
}

export function createEditedDescentRecordFromValues(
  fields: EditedDescentFieldValues,
  index: number,
  fallbackRecordedAt: string,
): HappyBallDescentRecord {
  const record: HappyBallDescentRecord = {
    id: fields.id || `edited_descent_${index + 1}`,
    sequence: readPositiveInteger(fields.sequence ?? "", index + 1),
    recordedAt: fields.recordedAt || fallbackRecordedAt,
    badgeAwarded: fields.badgeAwarded !== "false",
    memo: fields.memo ?? "",
  };
  const latitude = readOptionalNumber(fields.latitude ?? "");
  const longitude = readOptionalNumber(fields.longitude ?? "");
  if (latitude !== undefined && longitude !== undefined) {
    record.latitude = latitude;
    record.longitude = longitude;
    record.accuracyMeters = readOptionalNumber(fields.accuracyMeters ?? "");
    record.distanceFromPreviousMeters = readOptionalNumber(fields.distanceFromPreviousMeters ?? "");
  }
  return record;
}

export function hasBallDraftChanged(ball: HappyBall, next: BallDraft): boolean {
  return (
    next.date !== ball.date
    || next.time !== ball.time
    || next.subject.trim() !== ball.subject
    || next.issuerType !== ball.issuerType
    || Number(next.count) !== ball.count
    || next.title.trim() !== ball.title
    || next.category.trim() !== ball.category
    || next.note.trim() !== ball.note
    || next.visibility !== ball.visibility
  );
}

export function haveDescentRecordsChanged(
  previous: HappyBallDescentRecord[],
  next: HappyBallDescentRecord[],
): boolean {
  return JSON.stringify(previous) !== JSON.stringify(next);
}

export function resolveNamePresetSelection(input: {
  name: string;
  role?: NameRole;
  issuerType: IssuerType;
}): { subject: string; issuerType: IssuerType } | null {
  const subject = input.name.trim();
  if (!subject) {
    return null;
  }

  if (input.role === "proxy") {
    return { subject, issuerType: "proxy" };
  }

  return {
    subject,
    issuerType: input.issuerType === "proxy" ? "self" : input.issuerType,
  };
}

export function resolveManualSubjectPreset(subject: string, selectedPreset: string): string {
  return subject.trim() === selectedPreset.trim() ? selectedPreset : "";
}

export function readPositiveInteger(value: string, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.floor(number)) : fallback;
}

function readOptionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function readUnion<const T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
