import type { HappyBall, HappyBallDescentRecord } from "./models.js";

export const DESCENT_BADGE_MAX = 20;
export const DEFAULT_DESCENT_MIN_DISTANCE_METERS = 500;

export interface DescentPositionInput {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export type DescentApplyResult =
  | {
      ok: true;
      ball: HappyBall;
      record: HappyBallDescentRecord;
    }
  | {
      ok: false;
      reason: "too-close";
      distanceFromPreviousMeters: number;
      requiredDistanceMeters: number;
    };

export function appendDescentToBall(
  ball: HappyBall,
  position: DescentPositionInput,
  minDistanceMeters: number,
  memo = "",
  recordedAt = new Date().toISOString(),
): DescentApplyResult {
  const descents = normalizeDescentRecords(ball.descents);
  const previous = descents[descents.length - 1];
  const distanceFromPreviousMeters = previous
    ? distanceMeters(previous.latitude, previous.longitude, position.latitude, position.longitude)
    : undefined;
  const requiredDistanceMeters = normalizeDescentMinDistance(minDistanceMeters);

  if (distanceFromPreviousMeters !== undefined && distanceFromPreviousMeters < requiredDistanceMeters) {
    return {
      ok: false,
      reason: "too-close",
      distanceFromPreviousMeters,
      requiredDistanceMeters,
    };
  }

  const currentBadgeCount = normalizeDescentBadgeCount(ball.descentBadgeCount);
  const badgeAwarded = currentBadgeCount < DESCENT_BADGE_MAX;
  const nextBadgeCount = badgeAwarded ? Math.min(DESCENT_BADGE_MAX, currentBadgeCount + 1) : currentBadgeCount;
  const sequence = descents.length + 1;
  const record: HappyBallDescentRecord = {
    id: createDescentId(ball.id, sequence, recordedAt),
    sequence,
    recordedAt,
    latitude: clampLatitude(position.latitude),
    longitude: clampLongitude(position.longitude),
    accuracyMeters: normalizeOptionalPositiveNumber(position.accuracyMeters),
    distanceFromPreviousMeters: normalizeOptionalPositiveNumber(distanceFromPreviousMeters),
    badgeAwarded,
    memo: normalizeDescentMemo(memo),
  };

  return {
    ok: true,
    record,
    ball: {
      ...ball,
      descents: [...descents, record],
      descentBadgeCount: nextBadgeCount,
      isKamiBall: nextBadgeCount >= DESCENT_BADGE_MAX,
      updatedAt: recordedAt,
    },
  };
}

export function normalizeDescentRecords(value: unknown): HappyBallDescentRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const records: HappyBallDescentRecord[] = [];
  for (const item of value) {
    if (!isPlainObject(item)) {
      continue;
    }
    const latitude = readFiniteNumber(item.latitude);
    const longitude = readFiniteNumber(item.longitude);
    if (latitude === null || longitude === null) {
      continue;
    }
    const sequence = normalizeSequence(item.sequence, records.length + 1);
    const recordedAt = typeof item.recordedAt === "string" && item.recordedAt.trim()
      ? item.recordedAt.trim()
      : new Date().toISOString();
    records.push({
      id: typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : createDescentId("legacy", sequence, recordedAt),
      sequence,
      recordedAt,
      latitude: clampLatitude(latitude),
      longitude: clampLongitude(longitude),
      accuracyMeters: normalizeOptionalPositiveNumber(item.accuracyMeters),
      distanceFromPreviousMeters: normalizeOptionalPositiveNumber(item.distanceFromPreviousMeters),
      badgeAwarded: item.badgeAwarded !== false,
      memo: normalizeDescentMemo(item.memo),
    });
  }

  return records.map((record, index) => ({
    ...record,
    sequence: index + 1,
  }));
}

export function normalizeDescentBadgeCount(value: unknown): number {
  const count = readFiniteNumber(value);
  return count === null ? 0 : Math.max(0, Math.min(DESCENT_BADGE_MAX, Math.floor(count)));
}

export function normalizeDescentMinDistance(value: unknown): number {
  const distance = readFiniteNumber(value);
  if (distance === null) {
    return DEFAULT_DESCENT_MIN_DISTANCE_METERS;
  }
  return Math.max(10, Math.min(100_000, Math.round(distance)));
}

export function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const earthRadiusMeters = 6_371_000;
  const latA = toRadians(latitudeA);
  const latB = toRadians(latitudeB);
  const deltaLat = toRadians(latitudeB - latitudeA);
  const deltaLon = toRadians(longitudeB - longitudeA);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function createGoogleMapsUrl(record: Pick<HappyBallDescentRecord, "latitude" | "longitude">): string {
  const query = `${record.latitude},${record.longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function createDescentId(ballId: string, sequence: number, recordedAt: string): string {
  const safeTime = recordedAt.replace(/[^0-9A-Za-z]/g, "").slice(0, 18);
  return `${ballId}_descent_${String(sequence).padStart(2, "0")}_${safeTime}`;
}

function normalizeDescentMemo(value: unknown): string {
  return typeof value === "string" ? Array.from(value.trim()).slice(0, 80).join("") : "";
}

function normalizeSequence(value: unknown, fallback: number): number {
  const sequence = readFiniteNumber(value);
  return sequence === null ? fallback : Math.max(1, Math.floor(sequence));
}

function normalizeOptionalPositiveNumber(value: unknown): number | undefined {
  const number = readFiniteNumber(value);
  return number === null ? undefined : Math.max(0, number);
}

function clampLatitude(value: number): number {
  return Math.max(-90, Math.min(90, value));
}

function clampLongitude(value: number): number {
  return Math.max(-180, Math.min(180, value));
}

function toRadians(value: number): number {
  return value * Math.PI / 180;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
