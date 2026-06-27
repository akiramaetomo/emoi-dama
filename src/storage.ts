import { getCategoryColorPreset } from "./categories";
import type { CategoryColorPreset } from "./categories";
import type { BallDraft, HappyBall, HappyBallEmotionSnapshot, HappyBallLedger, HappyBallVisual, NameBookEntry, NameRole } from "./models";

const STORAGE_KEY = "happyBall.ledger.v1";
const LEDGER_TYPE = "happy-ball-ledger";
export const DEFAULT_SAMPLE_NAME = "エモ次郎";
export const MAX_NAME_BOOK_ENTRIES = 10;

export function todayIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createDefaultDraft(subject = DEFAULT_SAMPLE_NAME): BallDraft {
  return {
    date: todayIsoDate(),
    subject,
    issuerType: "self",
    count: 1,
    title: "",
    category: "日常",
    note: "",
    visibility: "category",
  };
}

export function loadLedger(): HappyBallLedger {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return createEmptyLedger();
  }

  try {
    const parsed = JSON.parse(stored) as Partial<HappyBallLedger>;
    if (parsed.type !== LEDGER_TYPE || parsed.v !== 1 || !Array.isArray(parsed.balls)) {
      return createEmptyLedger();
    }

    let visualIndex = 0;
    const balls = parsed.balls.map((ball) => {
      const normalized = normalizeBall(ball, visualIndex);
      visualIndex += clampCount(Number(ball.count) || 1);
      return normalized;
    });
    const ownerProfile = normalizeOwnerProfile(parsed.ownerProfile);
    const ledger: HappyBallLedger = {
      v: 1,
      type: LEDGER_TYPE,
      ledgerId: parsed.ledgerId || createLedgerId(),
      ownerProfile,
      balls,
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
    if (parsed.balls.some((ball) => !hasValidVisual((ball as Partial<HappyBall>).visual))) {
      saveLedger(ledger);
    }
    return ledger;
  } catch {
    return createEmptyLedger();
  }
}

export function saveLedger(ledger: HappyBallLedger): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger, null, 2));
}

export function addBall(ledger: HappyBallLedger, draft: BallDraft): HappyBallLedger {
  const now = new Date().toISOString();
  const ball = createBall(draft, now, getPrimarySelfName(ledger));
  const next: HappyBallLedger = {
    ...ledger,
    balls: [ball, ...ledger.balls],
    updatedAt: now,
  };
  saveLedger(next);
  return next;
}

export function updateNameBook(ledger: HappyBallLedger, entries: NameBookEntry[]): HappyBallLedger {
  const now = new Date().toISOString();
  const nameBook = normalizeNameBook(entries, ledger.ownerProfile.name);
  const next: HappyBallLedger = {
    ...ledger,
    ownerProfile: {
      name: getPrimarySelfNameFromBook(nameBook),
      nameBook,
    },
    updatedAt: now,
  };
  saveLedger(next);
  return next;
}

export function getPrimarySelfName(ledger: HappyBallLedger): string {
  return getPrimarySelfNameFromBook(ledger.ownerProfile.nameBook);
}

export function updateBall(ledger: HappyBallLedger, id: string, draft: BallDraft): HappyBallLedger {
  const now = new Date().toISOString();
  let updated = false;
  const balls = ledger.balls.map((ball) => {
    if (ball.id !== id) {
      return ball;
    }
    updated = true;
    return updateExistingBall(ball, draft, now);
  });
  if (!updated) {
    return ledger;
  }
  const next: HappyBallLedger = {
    ...ledger,
    balls,
    updatedAt: now,
  };
  saveLedger(next);
  return next;
}

export function clearLedger(): HappyBallLedger {
  const next = createEmptyLedger();
  saveLedger(next);
  return next;
}

export function deleteBall(ledger: HappyBallLedger, id: string): HappyBallLedger {
  const now = new Date().toISOString();
  const next: HappyBallLedger = {
    ...ledger,
    balls: ledger.balls.filter((ball) => ball.id !== id),
    updatedAt: now,
  };
  saveLedger(next);
  return next;
}

export function markReceiptCreated(ledger: HappyBallLedger, id: string): HappyBallLedger {
  const target = ledger.balls.find((ball) => ball.id === id);
  if (!target || target.receiptCreatedAt) {
    return ledger;
  }

  const now = new Date().toISOString();
  const next: HappyBallLedger = {
    ...ledger,
    balls: ledger.balls.map((ball) => (
      ball.id === id
        ? { ...ball, receiptCreatedAt: now }
        : ball
    )),
    updatedAt: now,
  };
  saveLedger(next);
  return next;
}

export function importNewBalls(ledger: HappyBallLedger, ballsToImport: HappyBall[]): HappyBallLedger {
  const existingIds = new Set(ledger.balls.map((ball) => ball.id));
  const newBalls = ballsToImport.filter((ball) => !existingIds.has(ball.id));
  if (newBalls.length === 0) {
    return ledger;
  }

  const now = new Date().toISOString();
  const next: HappyBallLedger = {
    ...ledger,
    balls: [...newBalls, ...ledger.balls],
    updatedAt: now,
  };
  saveLedger(next);
  return next;
}

export function importNewAndReplaceBalls(
  ledger: HappyBallLedger,
  ballsToImport: HappyBall[],
  ballsToReplace: HappyBall[],
): HappyBallLedger {
  const existingIds = new Set(ledger.balls.map((ball) => ball.id));
  const replacementById = new Map(
    ballsToReplace
      .filter((ball) => existingIds.has(ball.id))
      .map((ball) => [ball.id, ball]),
  );
  const newBalls = ballsToImport.filter((ball) => !existingIds.has(ball.id));

  if (newBalls.length === 0 && replacementById.size === 0) {
    return ledger;
  }

  const now = new Date().toISOString();
  const next: HappyBallLedger = {
    ...ledger,
    balls: [
      ...newBalls,
      ...ledger.balls.map((ball) => replacementById.get(ball.id) ?? ball),
    ],
    updatedAt: now,
  };
  saveLedger(next);
  return next;
}

export function applyCategoryRenames(
  ledger: HappyBallLedger,
  renames: Array<{ from: string; to: string; preset: CategoryColorPreset }>,
): HappyBallLedger {
  if (renames.length === 0) {
    return ledger;
  }

  const now = new Date().toISOString();
  let changed = false;
  const balls = ledger.balls.map((ball) => {
    const rename = renames.find((item) => item.from === ball.category);
    if (!rename || rename.from === rename.to) {
      return ball;
    }

    changed = true;
    return {
      ...ball,
      category: rename.to,
      visual: {
        hue: rename.preset.hue,
        saturation: rename.preset.saturation,
        lightness: rename.preset.lightness,
        label: createVisualLabel(ball.title, rename.to),
      },
      updatedAt: now,
    };
  });

  if (!changed) {
    return ledger;
  }

  const next: HappyBallLedger = {
    ...ledger,
    balls,
    updatedAt: now,
  };
  saveLedger(next);
  return next;
}

export function serializeLedger(ledger: HappyBallLedger): string {
  return JSON.stringify(ledger, null, 2);
}

function createEmptyLedger(): HappyBallLedger {
  const now = new Date().toISOString();
  const nameBook = createDefaultNameBook(DEFAULT_SAMPLE_NAME);
  return {
    v: 1,
    type: LEDGER_TYPE,
    ledgerId: createLedgerId(),
    ownerProfile: {
      name: DEFAULT_SAMPLE_NAME,
      nameBook,
    },
    balls: [],
    createdAt: now,
    updatedAt: now,
  };
}

function createBall(draft: BallDraft, now: string, localSelfName: string): HappyBall {
  const subject = draft.subject.trim() || localSelfName || DEFAULT_SAMPLE_NAME;
  const title = draft.title.trim() || "小さなえもいゴト";
  const category = draft.category.trim() || "日常";
  const note = draft.note.trim();
  const enteredBy = localSelfName || subject || DEFAULT_SAMPLE_NAME;
  const issuedBy = subject;
  const approvedBy = draft.issuerType === "self" ? null : subject;
  const id = createBallId(draft.date, subject);

  return {
    id,
    date: draft.date,
    subject,
    issuerType: draft.issuerType,
    issuedBy,
    enteredBy,
    approvedBy,
    keepers: [enteredBy],
    viewers: [],
    count: clampCount(draft.count),
    title,
    category,
    note,
    visibility: draft.visibility,
    visual: createBallVisual(id, title, category),
    lifecycleStatus: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function updateExistingBall(ball: HappyBall, draft: BallDraft, now: string): HappyBall {
  const subject = draft.subject.trim() || ball.subject || DEFAULT_SAMPLE_NAME;
  const title = draft.title.trim() || "小さなえもいゴト";
  const category = draft.category.trim() || "日常";
  const note = draft.note.trim();
  const issuedBy = subject;
  const approvedBy = draft.issuerType === "self" ? null : subject;

  return {
    ...ball,
    date: draft.date,
    subject,
    issuerType: draft.issuerType,
    issuedBy,
    approvedBy,
    count: clampCount(draft.count),
    title,
    category,
    note,
    visibility: draft.visibility,
    visual: updateVisualForDraft(ball, title, category),
    emotionEcho: createEmotionSnapshot(ball, now),
    updatedAt: now,
  };
}

function normalizeBall(ball: HappyBall, visualIndex = 0): HappyBall {
  return {
    ...ball,
    keepers: Array.isArray(ball.keepers) ? ball.keepers : [],
    viewers: Array.isArray(ball.viewers) ? ball.viewers : [],
    count: clampCount(Number(ball.count) || 1),
    visibility: ball.visibility || "category",
    visual: normalizeVisual(ball, visualIndex),
    emotionEcho: normalizeEmotionEcho(ball.emotionEcho),
    receiptCreatedAt: normalizeOptionalIsoText(ball.receiptCreatedAt),
    lifecycleStatus: ball.lifecycleStatus || "active",
  };
}

function createEmotionSnapshot(ball: HappyBall, recordedAt: string): HappyBallEmotionSnapshot {
  return {
    recordedAt,
    date: ball.date,
    subject: ball.subject,
    issuerType: ball.issuerType,
    count: ball.count,
    title: ball.title,
    category: ball.category,
    note: ball.note,
    visibility: ball.visibility,
    visual: { ...ball.visual },
  };
}

function normalizeEmotionEcho(value: unknown): HappyBallEmotionSnapshot | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const snapshot = value as Partial<HappyBallEmotionSnapshot>;
  const category = typeof snapshot.category === "string" && snapshot.category.trim() ? snapshot.category.trim() : "";
  const title = typeof snapshot.title === "string" && snapshot.title.trim() ? snapshot.title.trim() : "前の感じ";
  const visual = normalizeSnapshotVisual(snapshot.visual, title, category);
  if (!category || !visual) {
    return undefined;
  }

  return {
    recordedAt: typeof snapshot.recordedAt === "string" && snapshot.recordedAt ? snapshot.recordedAt : new Date().toISOString(),
    date: typeof snapshot.date === "string" && snapshot.date ? snapshot.date : todayIsoDate(),
    subject: typeof snapshot.subject === "string" && snapshot.subject ? snapshot.subject : DEFAULT_SAMPLE_NAME,
    issuerType: normalizeIssuerType(snapshot.issuerType),
    count: clampCount(Number(snapshot.count) || 1),
    title,
    category,
    note: typeof snapshot.note === "string" ? snapshot.note : "",
    visibility: normalizeVisibility(snapshot.visibility),
    visual,
  };
}

function normalizeOptionalIsoText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeOwnerProfile(ownerProfile: Partial<HappyBallLedger["ownerProfile"]> | undefined): HappyBallLedger["ownerProfile"] {
  const rawLegacyName = typeof ownerProfile?.name === "string" ? ownerProfile.name.trim() : "";
  const legacyName = rawLegacyName && !isLegacySelfPlaceholder(rawLegacyName)
    ? rawLegacyName
    : DEFAULT_SAMPLE_NAME;
  const nameBook = normalizeNameBook(ownerProfile?.nameBook, legacyName);
  return {
    name: getPrimarySelfNameFromBook(nameBook),
    nameBook,
  };
}

function normalizeNameBook(entries: unknown, legacyName = DEFAULT_SAMPLE_NAME): NameBookEntry[] {
  const source = Array.isArray(entries) ? entries : createDefaultNameBook(legacyName);
  const normalized: NameBookEntry[] = [];
  const seen = new Set<string>();

  for (const entry of source) {
    if (normalized.length >= MAX_NAME_BOOK_ENTRIES || typeof entry !== "object" || entry === null) {
      continue;
    }
    const candidate = entry as Partial<NameBookEntry>;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    if (!name || seen.has(name)) {
      continue;
    }
    const role = normalizeNameRole(candidate.role);
    normalized.push({
      id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : createPersonId(name),
      name,
      role,
    });
    seen.add(name);
  }

  if (normalized.length === 0) {
    return createDefaultNameBook(legacyName);
  }

  return normalized;
}

function createDefaultNameBook(name: string): NameBookEntry[] {
  const normalizedName = name.trim() || DEFAULT_SAMPLE_NAME;
  return [
    {
      id: createPersonId(normalizedName),
      name: normalizedName,
      role: "self",
    },
  ];
}

function getPrimarySelfNameFromBook(nameBook: NameBookEntry[]): string {
  return nameBook.find((entry) => entry.role === "self")?.name ?? nameBook[0]?.name ?? DEFAULT_SAMPLE_NAME;
}

function normalizeNameRole(role: unknown): NameRole {
  return role === "proxy" ? "proxy" : "self";
}

function normalizeIssuerType(value: unknown): HappyBall["issuerType"] {
  return value === "assisted" || value === "proxy" || value === "self" ? value : "self";
}

function normalizeVisibility(value: unknown): HappyBall["visibility"] {
  return value === "hidden" || value === "open" || value === "category" ? value : "category";
}

function isLegacySelfPlaceholder(name: string): boolean {
  return name === "自分" || name === "本人";
}

function normalizeVisual(ball: HappyBall, visualIndex: number): HappyBallVisual {
  const visual = ball.visual as Partial<HappyBallVisual> | undefined;
  const hue = typeof visual?.hue === "number" && Number.isFinite(visual.hue)
    ? clampHue(visual.hue)
    : legacyDisplayHue(visualIndex, ball.id);
  const saturation = typeof visual?.saturation === "number" && Number.isFinite(visual.saturation)
    ? clampPercent(visual.saturation, 8, 76)
    : 68;
  const lightness = typeof visual?.lightness === "number" && Number.isFinite(visual.lightness)
    ? clampPercent(visual.lightness, 26, 72)
    : 58;
  const existingLabel = typeof visual?.label === "string" ? visual.label.trim() : "";
  const label = existingLabel && Array.from(existingLabel).length >= 4
    ? Array.from(existingLabel).slice(0, 4).join("")
    : createVisualLabel(ball.title, ball.category);
  return { hue, saturation, lightness, label };
}

function normalizeSnapshotVisual(visual: Partial<HappyBallVisual> | undefined, title: string, category: string): HappyBallVisual | null {
  if (!visual) {
    return null;
  }
  const hue = typeof visual.hue === "number" && Number.isFinite(visual.hue)
    ? clampHue(visual.hue)
    : null;
  const saturation = typeof visual.saturation === "number" && Number.isFinite(visual.saturation)
    ? clampPercent(visual.saturation, 8, 76)
    : null;
  const lightness = typeof visual.lightness === "number" && Number.isFinite(visual.lightness)
    ? clampPercent(visual.lightness, 26, 72)
    : null;
  if (hue === null || saturation === null || lightness === null) {
    return null;
  }
  const existingLabel = typeof visual.label === "string" ? visual.label.trim() : "";
  const label = existingLabel
    ? Array.from(existingLabel).slice(0, 4).join("")
    : createVisualLabel(title, category);
  return { hue, saturation, lightness, label };
}

function hasValidVisual(visual: Partial<HappyBallVisual> | undefined): boolean {
  return (
    typeof visual?.hue === "number" &&
    Number.isFinite(visual.hue) &&
    typeof visual.saturation === "number" &&
    Number.isFinite(visual.saturation) &&
    typeof visual.lightness === "number" &&
    Number.isFinite(visual.lightness) &&
    typeof visual.label === "string" &&
    visual.label.trim().length > 0
  );
}

function createBallVisual(_id: string, title: string, category: string): HappyBallVisual {
  const preset = getCategoryColorPreset(category);
  return {
    hue: preset.hue,
    saturation: preset.saturation,
    lightness: preset.lightness,
    label: createVisualLabel(title, category),
  };
}

function updateVisualForDraft(ball: HappyBall, title: string, category: string): HappyBallVisual {
  const label = createVisualLabel(title, category);
  if (category === ball.category) {
    return { ...ball.visual, label };
  }

  const preset = getCategoryColorPreset(category);
  return {
    hue: preset.hue,
    saturation: preset.saturation,
    lightness: preset.lightness,
    label,
  };
}

function createVisualLabel(title: string, category: string): string {
  const source = (title.trim() || category.trim() || "玉").replace(/\s+/g, "");
  return Array.from(source).slice(0, 4).join("") || "玉";
}

function legacyDisplayHue(index: number, seed: string): number {
  let hash = index * 37;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return clampHue(hash + 32);
}

function clampHue(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360;
}

function clampPercent(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampCount(count: number): number {
  return Math.max(1, Math.min(99, Math.round(count)));
}

function createLedgerId(): string {
  return `ledger_${randomToken()}`;
}

function createBallId(date: string, subject: string): string {
  const safeSubject = subject
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]/gu, "")
    .slice(0, 18);
  const compactDate = date.replace(/-/g, "");
  const subjectPart = safeSubject || "ball";
  return `ball_${compactDate}_${subjectPart}_${randomToken()}`;
}

function createPersonId(name: string): string {
  const safeName = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]/gu, "")
    .slice(0, 18);
  return `person_${safeName || "name"}_${randomToken()}`;
}

function randomToken(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
