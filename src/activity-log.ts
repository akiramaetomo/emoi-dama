import type { HappyBall, LifecycleStatus, SendMode } from "./models";

const ACTIVITY_LOG_STORAGE_KEY = "happyBall.activityLog.v1";
const ACTIVITY_LOG_TYPE = "happy-ball-activity-log";
export const ACTIVITY_LOG_MAX_ENTRIES = 200;

export type ActivityLogAction =
  | "send-url"
  | "send-line-url"
  | "send-qr"
  | "send-image-share"
  | "send-image-download"
  | "url-receive"
  | "url-replace-receive"
  | "json-export"
  | "json-import"
  | "delete-ball"
  | "lifecycle-change"
  | "descent-create"
  | "descent-gps-update"
  | "descent-gps-clear"
  | "clear-ball-data";

export type ActivityLogStatus = "success" | "failure";

export interface ActivityBallSnapshot {
  id: string;
  title: string;
  subject: string;
  issuedBy: string;
  category: string;
  date: string;
  lifecycleStatus: LifecycleStatus;
}

export interface ActivityLogEntry {
  id: string;
  recordedAt: string;
  action: ActivityLogAction;
  status: ActivityLogStatus;
  ballId?: string;
  title?: string;
  subject?: string;
  issuedBy?: string;
  sendMode?: SendMode;
  lifecycleStatus?: LifecycleStatus;
  previousLifecycleStatus?: LifecycleStatus;
  descentSequence?: number;
  message?: string;
  ballSnapshot?: ActivityBallSnapshot;
}

export interface ActivityLogPayload {
  v: 1;
  type: typeof ACTIVITY_LOG_TYPE;
  entries: ActivityLogEntry[];
}

export type ActivityLogInput = Omit<ActivityLogEntry, "id" | "recordedAt" | "status"> & {
  status?: ActivityLogStatus;
};

const sendActivityActions = new Set<ActivityLogAction>([
  "send-url",
  "send-line-url",
  "send-qr",
  "send-image-share",
  "send-image-download",
  "url-receive",
  "url-replace-receive",
]);

export function loadActivityLog(): ActivityLogEntry[] {
  const stored = localStorage.getItem(ACTIVITY_LOG_STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    return normalizeActivityLogPayload(JSON.parse(stored)).entries;
  } catch {
    return [];
  }
}

export function saveActivityLog(entries: ActivityLogEntry[]): ActivityLogEntry[] {
  const normalized = normalizeActivityEntries(entries);
  localStorage.setItem(ACTIVITY_LOG_STORAGE_KEY, JSON.stringify(createActivityLogPayload(normalized)));
  return normalized;
}

export function recordActivity(input: ActivityLogInput): ActivityLogEntry[] {
  return saveActivityLog(appendActivityLogEntry(loadActivityLog(), input));
}

export function appendActivityLogEntry(
  entries: ActivityLogEntry[],
  input: ActivityLogInput,
  recordedAt = new Date().toISOString(),
): ActivityLogEntry[] {
  const entry: ActivityLogEntry = {
    id: createActivityLogId(recordedAt, entries.length + 1),
    recordedAt,
    action: input.action,
    status: input.status ?? "success",
  };
  assignOptionalText(entry, "ballId", input.ballId);
  assignOptionalText(entry, "title", input.title);
  assignOptionalText(entry, "subject", input.subject);
  assignOptionalText(entry, "issuedBy", input.issuedBy);
  if (input.sendMode === "casual" || input.sendMode === "formal") {
    entry.sendMode = input.sendMode;
  }
  if (isLifecycleStatus(input.lifecycleStatus)) {
    entry.lifecycleStatus = input.lifecycleStatus;
  }
  if (isLifecycleStatus(input.previousLifecycleStatus)) {
    entry.previousLifecycleStatus = input.previousLifecycleStatus;
  }
  if (isPositiveInteger(input.descentSequence)) {
    entry.descentSequence = input.descentSequence;
  }
  assignOptionalText(entry, "message", input.message);
  if (input.ballSnapshot) {
    entry.ballSnapshot = normalizeBallSnapshot(input.ballSnapshot);
  }
  return normalizeActivityEntries([entry, ...entries]);
}

export function createActivityLogPayload(entries: ActivityLogEntry[]): ActivityLogPayload {
  return {
    v: 1,
    type: ACTIVITY_LOG_TYPE,
    entries: normalizeActivityEntries(entries),
  };
}

export function createBallActivitySnapshot(ball: HappyBall): ActivityBallSnapshot {
  return {
    id: ball.id,
    title: ball.title,
    subject: ball.subject,
    issuedBy: ball.issuedBy,
    category: ball.category,
    date: ball.date,
    lifecycleStatus: ball.lifecycleStatus,
  };
}

export function createBallActivityInput(
  ball: HappyBall,
  input: Omit<ActivityLogInput, "ballId" | "title" | "subject" | "issuedBy">,
): ActivityLogInput {
  return {
    ...input,
    ballId: ball.id,
    title: ball.title,
    subject: ball.subject,
    issuedBy: ball.issuedBy,
  };
}

export function findLatestBallSendMode(entries: ActivityLogEntry[], ballId: string): SendMode | null {
  for (const entry of normalizeActivityEntries(entries)) {
    if (entry.ballId === ballId && entry.status === "success" && entry.sendMode && sendActivityActions.has(entry.action)) {
      return entry.sendMode;
    }
  }
  return null;
}

export function formatSendModeLabel(sendMode: SendMode): string {
  return sendMode === "casual" ? "お配り" : "お預け";
}

export function formatActivityActionLabel(action: ActivityLogAction): string {
  switch (action) {
    case "send-url":
      return "URLコピー";
    case "send-line-url":
      return "LINE用URL";
    case "send-qr":
      return "QR表示";
    case "send-image-share":
      return "画像で送る";
    case "send-image-download":
      return "画像保存";
    case "url-receive":
      return "受領";
    case "url-replace-receive":
      return "上書き受領";
    case "json-export":
      return "JSON書き出し";
    case "json-import":
      return "JSON読み込み";
    case "delete-ball":
      return "お焚上";
    case "lifecycle-change":
      return "状態変更";
    case "descent-create":
      return "降臨";
    case "descent-gps-update":
      return "降臨GPS取得";
    case "descent-gps-clear":
      return "降臨GPS削除";
    case "clear-ball-data":
      return "玉データ全消去";
  }
}

function normalizeActivityLogPayload(value: unknown): ActivityLogPayload {
  if (!isPlainObject(value) || value.v !== 1 || value.type !== ACTIVITY_LOG_TYPE || !Array.isArray(value.entries)) {
    return createActivityLogPayload([]);
  }
  return createActivityLogPayload(value.entries.map(normalizeActivityEntry).filter((entry): entry is ActivityLogEntry => Boolean(entry)));
}

function normalizeActivityEntries(entries: unknown): ActivityLogEntry[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map(normalizeActivityEntry)
    .filter((entry): entry is ActivityLogEntry => Boolean(entry))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, ACTIVITY_LOG_MAX_ENTRIES);
}

function normalizeActivityEntry(value: unknown): ActivityLogEntry | null {
  if (!isPlainObject(value) || !isActivityLogAction(value.action)) {
    return null;
  }
  const recordedAt = readText(value.recordedAt) || new Date().toISOString();
  const entry: ActivityLogEntry = {
    id: readText(value.id) || createActivityLogId(recordedAt, 0),
    recordedAt,
    action: value.action,
    status: value.status === "failure" ? "failure" : "success",
  };
  assignOptionalText(entry, "ballId", value.ballId);
  assignOptionalText(entry, "title", value.title);
  assignOptionalText(entry, "subject", value.subject);
  assignOptionalText(entry, "issuedBy", value.issuedBy);
  if (value.sendMode === "casual" || value.sendMode === "formal") {
    entry.sendMode = value.sendMode;
  }
  if (isLifecycleStatus(value.lifecycleStatus)) {
    entry.lifecycleStatus = value.lifecycleStatus;
  }
  if (isLifecycleStatus(value.previousLifecycleStatus)) {
    entry.previousLifecycleStatus = value.previousLifecycleStatus;
  }
  if (isPositiveInteger(value.descentSequence)) {
    entry.descentSequence = Math.floor(value.descentSequence);
  }
  assignOptionalText(entry, "message", value.message);
  if (isPlainObject(value.ballSnapshot)) {
    entry.ballSnapshot = normalizeBallSnapshot(value.ballSnapshot);
  }
  return entry;
}

function normalizeBallSnapshot(value: ActivityBallSnapshot | Record<string, unknown>): ActivityBallSnapshot {
  return {
    id: readText(value.id) || "",
    title: readText(value.title) || "",
    subject: readText(value.subject) || "",
    issuedBy: readText(value.issuedBy) || "",
    category: readText(value.category) || "",
    date: readText(value.date) || "",
    lifecycleStatus: isLifecycleStatus(value.lifecycleStatus) ? value.lifecycleStatus : "active",
  };
}

function isActivityLogAction(value: unknown): value is ActivityLogAction {
  return typeof value === "string" && [
    "send-url",
    "send-line-url",
    "send-qr",
    "send-image-share",
    "send-image-download",
    "url-receive",
    "url-replace-receive",
    "json-export",
    "json-import",
    "delete-ball",
    "lifecycle-change",
    "descent-create",
    "descent-gps-update",
    "descent-gps-clear",
    "clear-ball-data",
  ].includes(value);
}

function isLifecycleStatus(value: unknown): value is LifecycleStatus {
  return value === "active" || value === "archived" || value === "memorial" || value === "offered";
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1;
}

function assignOptionalText<T extends ActivityLogEntry>(entry: T, key: keyof T, value: unknown): void {
  const text = readText(value);
  if (text) {
    entry[key] = text as T[keyof T];
  }
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function createActivityLogId(recordedAt: string, index: number): string {
  const safeTime = recordedAt.replace(/[^0-9A-Za-z]/g, "").slice(0, 18);
  return `activity_${safeTime}_${String(index).padStart(3, "0")}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
