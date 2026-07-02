import { isKnownVisibility, normalizeVisibilityValue } from "./models.js";
import type { HappyBall } from "./models";

export const PACKET_TYPE = "happy-ball-packet";

export interface HappyBallPacket {
  v: 1;
  type: typeof PACKET_TYPE;
  mode: "append";
  exportedAt: string;
  items: HappyBall[];
}

export interface PacketImportReview {
  newItems: HappyBall[];
  duplicates: HappyBall[];
  conflicts: HappyBall[];
}

export type UrlPacketSource = "ball" | "import";

export type UrlPacketParseResult =
  | {
      ok: true;
      source: UrlPacketSource;
      packet: HappyBallPacket;
      rejectedItemCount: number;
    }
  | {
      ok: false;
      source: UrlPacketSource;
      error: string;
    };

export function createBallPacket(ball: HappyBall, exportedAt = new Date().toISOString()): HappyBallPacket {
  return {
    v: 1,
    type: PACKET_TYPE,
    mode: "append",
    exportedAt,
    items: [ball],
  };
}

export function createPacketImportUrl(ball: HappyBall, baseHref: string): string {
  const url = new URL(baseHref);
  url.searchParams.delete("import");
  url.searchParams.delete("ball");
  url.searchParams.delete("openExternalBrowser");
  url.hash = `import=${encodePacket(createBallPacket(ball))}`;
  return url.toString();
}

export function createLinePacketImportUrl(ball: HappyBall, baseHref: string): string {
  const url = new URL(baseHref);
  url.hash = "";
  url.searchParams.delete("ball");
  url.searchParams.set("openExternalBrowser", "1");
  url.searchParams.set("import", encodePacket(createBallPacket(ball)));
  return url.toString();
}

export function encodePacket(packet: HappyBallPacket): string {
  return encodeBase64Url(JSON.stringify(packet));
}

export function parsePacketLocation(search: string, hash: string): UrlPacketParseResult | null {
  return parsePacketQuery(search) ?? parsePacketHash(hash);
}

export function parsePacketQuery(search: string): UrlPacketParseResult | null {
  const rawSearch = search.startsWith("?") ? search.slice(1) : search;
  return parsePacketParams(new URLSearchParams(rawSearch));
}

export function parsePacketHash(hash: string): UrlPacketParseResult | null {
  const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
  return parsePacketParams(new URLSearchParams(rawHash));
}

function parsePacketParams(params: URLSearchParams): UrlPacketParseResult | null {
  const importPayload = params.get("import");
  const ballPayload = params.get("ball");
  const source = importPayload ? "import" : ballPayload ? "ball" : null;
  const payload = importPayload ?? ballPayload;
  if (!source || !payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as unknown;
    const normalized = source === "ball"
      ? normalizeBallOrPacket(parsed)
      : normalizePacket(parsed);
    if (!normalized) {
      return { ok: false, source, error: "URLの玉データを確認できませんでした。" };
    }
    return { ok: true, source, packet: normalized.packet, rejectedItemCount: normalized.rejectedItemCount };
  } catch {
    return { ok: false, source, error: "URLの玉データを読み込めませんでした。" };
  }
}

export function reviewPacketImport(packet: HappyBallPacket, existingBalls: HappyBall[]): PacketImportReview {
  const existingById = new Map(existingBalls.map((ball) => [ball.id, ball]));
  const seenPacketIds = new Set<string>();
  const review: PacketImportReview = {
    newItems: [],
    duplicates: [],
    conflicts: [],
  };

  for (const item of packet.items) {
    if (seenPacketIds.has(item.id)) {
      review.duplicates.push(item);
      continue;
    }
    seenPacketIds.add(item.id);

    const existing = existingById.get(item.id);
    if (!existing) {
      review.newItems.push(item);
    } else if (stableStringify(toComparableBall(existing)) === stableStringify(toComparableBall(item))) {
      review.duplicates.push(item);
    } else {
      review.conflicts.push(item);
    }
  }

  return review;
}

function normalizeBallOrPacket(value: unknown): { packet: HappyBallPacket; rejectedItemCount: number } | null {
  const packet = normalizePacket(value);
  if (packet) {
    return packet;
  }

  const ball = normalizePacketBall(value);
  if (!ball) {
    return null;
  }

  return {
    packet: {
      v: 1,
      type: PACKET_TYPE,
      mode: "append",
      exportedAt: new Date().toISOString(),
      items: [ball],
    },
    rejectedItemCount: 0,
  };
}

function normalizePacket(value: unknown): { packet: HappyBallPacket; rejectedItemCount: number } | null {
  if (!isObject(value)) {
    return null;
  }

  if (value.v !== 1 || value.type !== PACKET_TYPE || value.mode !== "append" || !Array.isArray(value.items)) {
    return null;
  }

  const items = value.items.map(normalizePacketBall).filter((item): item is HappyBall => Boolean(item));
  if (items.length === 0) {
    return null;
  }

  return {
    packet: {
      v: 1,
      type: PACKET_TYPE,
      mode: "append",
      exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : new Date().toISOString(),
      items,
    },
    rejectedItemCount: value.items.length - items.length,
  };
}

export function normalizePacketBall(value: unknown): HappyBall | null {
  if (!isObject(value) || !isObject(value.visual)) {
    return null;
  }

  const issuerType = readUnion(value.issuerType, ["self", "assisted", "proxy"]);
  const visibility = isKnownVisibility(value.visibility) ? normalizeVisibilityValue(value.visibility) : null;
  const lifecycleStatus = readUnion(value.lifecycleStatus, ["active", "archived", "memorial", "offered"]);
  const visual = value.visual;
  const hue = readFiniteNumber(visual.hue);
  const saturation = readFiniteNumber(visual.saturation);
  const lightness = readFiniteNumber(visual.lightness);
  const label = readRequiredString(visual.label);

  if (!issuerType || !visibility || !lifecycleStatus || hue === null || saturation === null || lightness === null || !label) {
    return null;
  }

  const id = readRequiredString(value.id);
  const date = readRequiredString(value.date);
  const subject = readRequiredString(value.subject);
  const title = readRequiredString(value.title);
  const category = readRequiredString(value.category);
  const createdAt = readRequiredString(value.createdAt);
  const updatedAt = readRequiredString(value.updatedAt);
  if (!id || !date || !subject || !title || !category || !createdAt || !updatedAt) {
    return null;
  }

  const normalizedBall: HappyBall = {
    id,
    date,
    subject,
    issuerType,
    issuedBy: readString(value.issuedBy) || subject,
    enteredBy: readString(value.enteredBy) || "自分",
    approvedBy: readString(value.approvedBy) || null,
    keepers: readStringArray(value.keepers),
    viewers: readStringArray(value.viewers),
    count: clampCount(readFiniteNumber(value.count) ?? 1),
    title,
    category,
    note: readString(value.note),
    visibility,
    visual: {
      hue: clampHue(hue),
      saturation: clampPercent(saturation, 8, 76),
      lightness: clampPercent(lightness, 26, 72),
      kind: value.visual.kind === "ring" ? "ring" : "filled",
      label: Array.from(label).slice(0, 4).join(""),
    },
    lifecycleStatus,
    createdAt,
    updatedAt,
  };

  const emotionEcho = normalizePacketEmotionEcho(value.emotionEcho);
  if (emotionEcho) {
    normalizedBall.emotionEcho = emotionEcho;
  }

  const receiptCreatedAt = readOptionalString(value.receiptCreatedAt);
  if (receiptCreatedAt) {
    normalizedBall.receiptCreatedAt = receiptCreatedAt;
  }

  return normalizedBall;
}

function toComparableBall(ball: HappyBall): Omit<HappyBall, "receiptCreatedAt"> {
  const comparable: HappyBall = { ...ball };
  delete comparable.receiptCreatedAt;
  return comparable;
}

function normalizePacketEmotionEcho(value: unknown): HappyBall["emotionEcho"] | undefined {
  if (!isObject(value) || !isObject(value.visual)) {
    return undefined;
  }

  const category = readRequiredString(value.category);
  const title = readRequiredString(value.title) ?? "前の感じ";
  const visual = value.visual;
  const hue = readFiniteNumber(visual.hue);
  const saturation = readFiniteNumber(visual.saturation);
  const lightness = readFiniteNumber(visual.lightness);
  const label = readString(visual.label).trim() || title;
  if (!category || hue === null || saturation === null || lightness === null) {
    return undefined;
  }

  return {
    recordedAt: readString(value.recordedAt) || new Date().toISOString(),
    date: readString(value.date) || new Date().toISOString().slice(0, 10),
    subject: readString(value.subject) || "自分",
    issuerType: readUnion(value.issuerType, ["self", "assisted", "proxy"]) ?? "self",
    count: clampCount(readFiniteNumber(value.count) ?? 1),
    title,
    category,
    note: readString(value.note),
    visibility: isKnownVisibility(value.visibility) ? normalizeVisibilityValue(value.visibility) : "category",
    visual: {
      hue: clampHue(hue),
      saturation: clampPercent(saturation, 8, 76),
      lightness: clampPercent(lightness, 26, 72),
      kind: visual.kind === "ring" ? "ring" : "filled",
      label: Array.from(label).slice(0, 4).join(""),
    },
  };
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRequiredString(value: unknown): string | null {
  const text = readString(value).trim();
  return text || null;
}

function readOptionalString(value: unknown): string | undefined {
  const text = readString(value).trim();
  return text || undefined;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readUnion<const T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

function clampCount(count: number): number {
  return Math.max(1, Math.min(99, Math.round(count)));
}

function clampHue(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360;
}

function clampPercent(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
