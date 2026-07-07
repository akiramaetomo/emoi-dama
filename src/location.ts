export const DEFAULT_FRESH_POSITION_MAX_AGE_MS = 2 * 60 * 1000;
export const DEFAULT_INITIAL_POSITION_TIMEOUT_MS = 8 * 1000;
export const DEFAULT_POSITION_WATCH_DURATION_MS = 9 * 1000;

export interface ReliablePositionOptions {
  now?: () => number;
  freshPositionMaxAgeMs?: number;
  initialTimeoutMs?: number;
  watchDurationMs?: number;
}

export class StaleGeolocationPositionError extends Error {
  constructor() {
    super("The acquired geolocation position was too old.");
    this.name = "StaleGeolocationPositionError";
  }
}

export class GeolocationUnavailableError extends Error {
  constructor() {
    super("Geolocation is unavailable.");
    this.name = "GeolocationUnavailableError";
  }
}

interface WatchResult {
  positions: GeolocationPosition[];
  lastError: unknown;
}

export async function readReliableCurrentPosition(
  geolocation: Geolocation | null | undefined,
  options: ReliablePositionOptions = {},
): Promise<GeolocationPosition> {
  if (!geolocation) {
    throw new GeolocationUnavailableError();
  }

  const now = options.now ?? Date.now;
  const freshPositionMaxAgeMs = options.freshPositionMaxAgeMs ?? DEFAULT_FRESH_POSITION_MAX_AGE_MS;
  const initialTimeoutMs = options.initialTimeoutMs ?? DEFAULT_INITIAL_POSITION_TIMEOUT_MS;
  const watchDurationMs = options.watchDurationMs ?? DEFAULT_POSITION_WATCH_DURATION_MS;
  const candidates: GeolocationPosition[] = [];
  let lastError: unknown = null;

  try {
    const position = await readPositionOnce(geolocation, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: initialTimeoutMs,
    });
    if (isFreshGeolocationPosition(position, now(), freshPositionMaxAgeMs)) {
      candidates.push(position);
    } else {
      lastError = new StaleGeolocationPositionError();
    }
  } catch (error) {
    if (isGeolocationPermissionDenied(error)) {
      throw error;
    }
    lastError = error;
  }

  try {
    const watched = await collectWatchedPositions(geolocation, now, freshPositionMaxAgeMs, watchDurationMs);
    candidates.push(...watched.positions);
    if (watched.lastError) {
      lastError = watched.lastError;
    }
  } catch (error) {
    if (isGeolocationPermissionDenied(error)) {
      throw error;
    }
    lastError = error;
  }

  const best = chooseBestFreshPosition(candidates, now(), freshPositionMaxAgeMs);
  if (best) {
    return best;
  }

  throw lastError ?? new StaleGeolocationPositionError();
}

export function chooseBestFreshPosition(
  positions: GeolocationPosition[],
  nowMs: number,
  freshPositionMaxAgeMs = DEFAULT_FRESH_POSITION_MAX_AGE_MS,
): GeolocationPosition | null {
  const fresh = positions.filter((position) => isFreshGeolocationPosition(position, nowMs, freshPositionMaxAgeMs));
  if (fresh.length === 0) {
    return null;
  }

  return fresh.sort((a, b) => {
    const accuracyDiff = readAccuracyMeters(a) - readAccuracyMeters(b);
    if (accuracyDiff !== 0) {
      return accuracyDiff;
    }
    return b.timestamp - a.timestamp;
  })[0] ?? null;
}

export function isFreshGeolocationPosition(
  position: GeolocationPosition,
  nowMs: number,
  freshPositionMaxAgeMs = DEFAULT_FRESH_POSITION_MAX_AGE_MS,
): boolean {
  if (!Number.isFinite(position.timestamp)) {
    return false;
  }
  const ageMs = Math.max(0, nowMs - position.timestamp);
  return ageMs <= freshPositionMaxAgeMs;
}

export function isStaleGeolocationPositionError(error: unknown): error is StaleGeolocationPositionError {
  return error instanceof StaleGeolocationPositionError
    || (typeof error === "object" && error !== null && (error as { name?: unknown }).name === "StaleGeolocationPositionError");
}

export function isGeolocationUnavailableError(error: unknown): error is GeolocationUnavailableError {
  return error instanceof GeolocationUnavailableError
    || (typeof error === "object" && error !== null && (error as { name?: unknown }).name === "GeolocationUnavailableError");
}

function readPositionOnce(geolocation: Geolocation, options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function collectWatchedPositions(
  geolocation: Geolocation,
  now: () => number,
  freshPositionMaxAgeMs: number,
  watchDurationMs: number,
): Promise<WatchResult> {
  return new Promise((resolve, reject) => {
    const positions: GeolocationPosition[] = [];
    let lastError: unknown = null;
    let finished = false;
    let watchId: number | null = null;
    let timer: ReturnType<typeof globalThis.setTimeout>;

    const finish = (): void => {
      if (finished) {
        return;
      }
      finished = true;
      globalThis.clearTimeout(timer);
      if (watchId !== null) {
        geolocation.clearWatch(watchId);
      }
      resolve({ positions, lastError });
    };

    timer = globalThis.setTimeout(finish, Math.max(0, watchDurationMs));

    try {
      watchId = geolocation.watchPosition(
        (position) => {
          if (isFreshGeolocationPosition(position, now(), freshPositionMaxAgeMs)) {
            positions.push(position);
            return;
          }
          lastError = new StaleGeolocationPositionError();
        },
        (error) => {
          lastError = error;
          if (isGeolocationPermissionDenied(error)) {
            if (watchId !== null) {
              geolocation.clearWatch(watchId);
            }
            globalThis.clearTimeout(timer);
            reject(error);
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: Math.max(1, watchDurationMs),
        },
      );
    } catch (error) {
      globalThis.clearTimeout(timer);
      reject(error);
    }
  });
}

function readAccuracyMeters(position: GeolocationPosition): number {
  return Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : Number.MAX_SAFE_INTEGER;
}

function isGeolocationPermissionDenied(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  return (error as { code: unknown }).code === 1;
}
