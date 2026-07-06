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
  position: DescentPositionInput | null,
  minDistanceMeters: number,
  memo = "",
  recordedAt = new Date().toISOString(),
): DescentApplyResult {
  const descents = normalizeDescentRecords(ball.descents);
  const previous = findLatestPositionedDescent(descents);
  const normalizedPosition = position ? normalizeDescentPosition(position) : null;
  const distanceFromPreviousMeters = previous && normalizedPosition
    ? distanceMeters(previous.latitude, previous.longitude, normalizedPosition.latitude, normalizedPosition.longitude)
    : undefined;
  const requiredDistanceMeters = normalizeDescentMinDistance(minDistanceMeters);

  if (normalizedPosition && distanceFromPreviousMeters !== undefined && distanceFromPreviousMeters < requiredDistanceMeters) {
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
    distanceFromPreviousMeters: normalizeOptionalPositiveNumber(distanceFromPreviousMeters),
    badgeAwarded,
    memo: normalizeDescentMemo(memo),
  };
  if (normalizedPosition) {
    record.latitude = normalizedPosition.latitude;
    record.longitude = normalizedPosition.longitude;
    record.accuracyMeters = normalizedPosition.accuracyMeters;
  }

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

export type DescentPositionUpdateResult =
  | {
      ok: true;
      ball: HappyBall;
      record: HappyBallDescentRecord;
    }
  | {
      ok: false;
      reason: "not-found";
    };

export function updateDescentRecordPosition(
  ball: HappyBall,
  descentId: string,
  position: DescentPositionInput | null,
  recordedAt = new Date().toISOString(),
): DescentPositionUpdateResult {
  const descents = normalizeDescentRecords(ball.descents);
  const targetIndex = descents.findIndex((record) => record.id === descentId);
  if (targetIndex < 0) {
    return { ok: false, reason: "not-found" };
  }

  const normalizedPosition = position ? normalizeDescentPosition(position) : null;
  const previous = findLatestPositionedDescent(descents.slice(0, targetIndex));
  const distanceFromPreviousMeters = previous && normalizedPosition
    ? distanceMeters(previous.latitude, previous.longitude, normalizedPosition.latitude, normalizedPosition.longitude)
    : undefined;
  const nextRecord: HappyBallDescentRecord = {
    ...descents[targetIndex],
    latitude: normalizedPosition?.latitude,
    longitude: normalizedPosition?.longitude,
    accuracyMeters: normalizedPosition?.accuracyMeters,
    distanceFromPreviousMeters: normalizeOptionalPositiveNumber(distanceFromPreviousMeters),
  };
  const nextDescents = descents.map((record, index) => index === targetIndex ? nextRecord : record);
  const nextBall = applyDescentRecordsToBall(ball, nextDescents, recordedAt);
  return {
    ok: true,
    ball: nextBall,
    record: nextDescents[targetIndex],
  };
}

export function applyDescentRecordsToBall(
  ball: HappyBall,
  records: unknown,
  recordedAt = new Date().toISOString(),
): HappyBall {
  const descents = recalculateDescentDistances(normalizeDescentRecords(records));
  const descentBadgeCount = normalizeDescentBadgeCount(descents.filter((record) => record.badgeAwarded).length);
  return {
    ...ball,
    descents,
    descentBadgeCount,
    isKamiBall: descentBadgeCount >= DESCENT_BADGE_MAX,
    updatedAt: recordedAt,
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
    const position = readDescentPosition(item);
    const sequence = normalizeSequence(item.sequence, records.length + 1);
    const recordedAt = typeof item.recordedAt === "string" && item.recordedAt.trim()
      ? item.recordedAt.trim()
      : new Date().toISOString();
    const record: HappyBallDescentRecord = {
      id: typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : createDescentId("legacy", sequence, recordedAt),
      sequence,
      recordedAt,
      distanceFromPreviousMeters: normalizeOptionalPositiveNumber(item.distanceFromPreviousMeters),
      badgeAwarded: item.badgeAwarded !== false,
      memo: normalizeDescentMemo(item.memo),
    };
    if (position) {
      record.latitude = position.latitude;
      record.longitude = position.longitude;
      record.accuracyMeters = position.accuracyMeters;
    }
    records.push(record);
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

export function hasDescentPosition(record: Pick<HappyBallDescentRecord, "latitude" | "longitude">): record is Pick<HappyBallDescentRecord, "latitude" | "longitude"> & { latitude: number; longitude: number } {
  return typeof record.latitude === "number"
    && Number.isFinite(record.latitude)
    && typeof record.longitude === "number"
    && Number.isFinite(record.longitude);
}

export function createGoogleMapsUrl(record: Pick<HappyBallDescentRecord, "latitude" | "longitude">): string {
  if (!hasDescentPosition(record)) {
    throw new Error("Cannot create a Google Maps URL without descent coordinates.");
  }
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

function findLatestPositionedDescent(records: HappyBallDescentRecord[]): (HappyBallDescentRecord & { latitude: number; longitude: number }) | null {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (hasDescentPosition(record)) {
      return record;
    }
  }
  return null;
}

function normalizeDescentPosition(position: DescentPositionInput): DescentPositionInput | null {
  const latitude = readFiniteNumber(position.latitude);
  const longitude = readFiniteNumber(position.longitude);
  if (latitude === null || longitude === null) {
    return null;
  }
  return {
    latitude: clampLatitude(latitude),
    longitude: clampLongitude(longitude),
    accuracyMeters: normalizeOptionalPositiveNumber(position.accuracyMeters),
  };
}

function readDescentPosition(value: Record<string, unknown>): DescentPositionInput | null {
  const latitude = readFiniteNumber(value.latitude);
  const longitude = readFiniteNumber(value.longitude);
  if (latitude === null || longitude === null) {
    return null;
  }
  return {
    latitude: clampLatitude(latitude),
    longitude: clampLongitude(longitude),
    accuracyMeters: normalizeOptionalPositiveNumber(value.accuracyMeters),
  };
}

function recalculateDescentDistances(records: HappyBallDescentRecord[]): HappyBallDescentRecord[] {
  let previousPositioned: (HappyBallDescentRecord & { latitude: number; longitude: number }) | null = null;
  return records.map((record) => {
    if (!hasDescentPosition(record)) {
      return {
        ...record,
        distanceFromPreviousMeters: undefined,
      };
    }
    const distanceFromPreviousMeters = previousPositioned
      ? distanceMeters(previousPositioned.latitude, previousPositioned.longitude, record.latitude, record.longitude)
      : undefined;
    const next = {
      ...record,
      distanceFromPreviousMeters: normalizeOptionalPositiveNumber(distanceFromPreviousMeters),
    };
    previousPositioned = next;
    return next;
  });
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
