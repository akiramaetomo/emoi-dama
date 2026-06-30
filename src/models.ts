export type IssuerType = "self" | "assisted" | "proxy";
export type Visibility = "category" | "issuer" | "title" | "open";
export type LegacyVisibility = Visibility | "hidden";
export type LifecycleStatus = "active" | "archived" | "memorial" | "offered";
export type NameRole = "self" | "proxy";

export interface HappyBallVisual {
  hue: number;
  saturation: number;
  lightness: number;
  label: string;
}

export interface HappyBallEmotionSnapshot {
  recordedAt: string;
  date: string;
  subject: string;
  issuerType: IssuerType;
  count: number;
  title: string;
  category: string;
  note: string;
  visibility: Visibility;
  visual: HappyBallVisual;
}

export interface HappyBall {
  id: string;
  date: string;
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
