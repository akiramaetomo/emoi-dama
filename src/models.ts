export type IssuerType = "self" | "assisted" | "proxy";
export type Visibility = "category" | "issuer" | "title" | "open";
export type LegacyVisibility = Visibility | "hidden";
export type LifecycleStatus = "active" | "archived" | "memorial" | "offered";
export type NameRole = "self" | "proxy";
export type BallVisualKind = "filled" | "ring";
export type SendMode = "formal" | "casual";

export interface HappyBallVisual {
  hue: number;
  saturation: number;
  lightness: number;
  kind: BallVisualKind;
  label: string;
}

export interface HappyBallEmotionSnapshot {
  recordedAt: string;
  date: string;
  time?: string;
  subject: string;
  issuerType: IssuerType;
  count: number;
  title: string;
  category: string;
  note: string;
  visibility: Visibility;
  visual: HappyBallVisual;
}

export interface HappyBallDescentRecord {
  id: string;
  sequence: number;
  recordedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  distanceFromPreviousMeters?: number;
  badgeAwarded: boolean;
  memo: string;
}

export interface HappyBall {
  id: string;
  date: string;
  time?: string;
  subject: string;
  issuerType: IssuerType;
  issuedBy: string;
  enteredBy: string;
  approvedBy: string | null;
  keepers: string[];
  viewers: string[];
  count: number;
  title: string;
  category: string;
  note: string;
  visibility: Visibility;
  visual: HappyBallVisual;
  emotionEcho?: HappyBallEmotionSnapshot;
  descents?: HappyBallDescentRecord[];
  descentBadgeCount?: number;
  isKamiBall?: boolean;
  receiptCreatedAt?: string;
  lifecycleStatus: LifecycleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HappyBallLedger {
  v: 1;
  type: "happy-ball-ledger";
  ledgerId: string;
  ownerProfile: {
    name: string;
    nameBook: NameBookEntry[];
  };
  balls: HappyBall[];
  createdAt: string;
  updatedAt: string;
}

export interface NameBookEntry {
  id: string;
  name: string;
  role: NameRole;
}

export interface BallDraft {
  date: string;
  time?: string;
  subject: string;
  issuerType: IssuerType;
  count: number;
  title: string;
  category: string;
  note: string;
  visibility: Visibility;
}

export const issuerLabels: Record<IssuerType, string> = {
  self: "本人が作成",
  assisted: "いっしょに作成",
  proxy: "会話から代理作成",
};

export const visibilityValues = ["category", "issuer", "title", "open"] as const satisfies readonly Visibility[];

export const visibilityLabels: Record<Visibility, string> = {
  category: "カテゴリまで",
  issuer: "発行者まで",
  title: "タイトルまで",
  open: "メモも表示",
};

export function isKnownVisibility(value: unknown): value is LegacyVisibility {
  return value === "hidden" || visibilityValues.includes(value as Visibility);
}

export function normalizeVisibilityValue(value: unknown, fallback: Visibility = "category"): Visibility {
  if (value === "hidden") {
    return "category";
  }
  return visibilityValues.includes(value as Visibility) ? (value as Visibility) : fallback;
}

export function normalizeBallTime(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed) ? trimmed : undefined;
}

export function formatBallDateTime(date: string, time?: string): string {
  const normalizedTime = normalizeBallTime(time);
  return normalizedTime ? `${date} ${normalizedTime}` : date;
}
