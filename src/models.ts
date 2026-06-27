export type IssuerType = "self" | "assisted" | "proxy";
export type Visibility = "hidden" | "category" | "open";
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
  self: "本人から",
  assisted: "いっしょに作成",
  proxy: "会話から代理作成",
};

export const visibilityLabels: Record<Visibility, string> = {
  hidden: "存在だけ",
  category: "カテゴリまで",
  open: "メモも表示",
};
