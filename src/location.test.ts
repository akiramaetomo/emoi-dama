import {
  chooseBestFreshPosition,
  isFreshGeolocationPosition,
  readReliableCurrentPosition,
  StaleGeolocationPositionError,
} from "./location.js";

const now = Date.parse("2026-07-07T12:00:00.000Z");

const stalePosition = createPosition(35.0, 139.0, 12, now - 10 * 60 * 1000);
const freshRoughPosition = createPosition(35.001, 139.001, 120, now - 20_000);
const freshAccuratePosition = createPosition(35.002, 139.002, 15, now - 40_000);
const newestPosition = createPosition(35.003, 139.003, 15, now - 5_000);

assertEqual(isFreshGeolocationPosition(stalePosition, now), false, "old cached positions should be rejected");
assertEqual(isFreshGeolocationPosition(freshRoughPosition, now), true, "recent positions should be accepted");

const best = chooseBestFreshPosition([stalePosition, freshRoughPosition, freshAccuratePosition, newestPosition], now);
assertEqual(best, newestPosition, "best fresh position should prefer accuracy, then newer timestamps");

const staleOnly = chooseBestFreshPosition([stalePosition], now);
assertEqual(staleOnly, null, "stale-only candidate lists should not produce a position");

const staleGeolocation = createFakeGeolocation({
  currentPosition: stalePosition,
});
await assertRejects(
  () => readReliableCurrentPosition(staleGeolocation, {
    now: () => now,
    initialTimeoutMs: 1,
    watchDurationMs: 1,
  }),
  StaleGeolocationPositionError,
  "reliable position acquisition should reject stale cached positions",
);

const watchedGeolocation = createFakeGeolocation({
  currentPosition: stalePosition,
  watchedPositions: [freshRoughPosition, newestPosition],
});
const watchedPosition = await readReliableCurrentPosition(watchedGeolocation, {
  now: () => now,
  initialTimeoutMs: 1,
  watchDurationMs: 1,
});
assertEqual(watchedPosition, newestPosition, "watchPosition candidates should recover from stale one-shot positions");

function createPosition(latitude: number, longitude: number, accuracy: number, timestamp: number): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp,
    toJSON: () => ({}),
  };
}

function createFakeGeolocation(options: {
  currentPosition?: GeolocationPosition;
  currentError?: GeolocationPositionError;
  watchedPositions?: GeolocationPosition[];
  watchedError?: GeolocationPositionError;
}): Geolocation {
  return {
    getCurrentPosition: (success, error) => {
      if (options.currentPosition) {
        success(options.currentPosition);
        return;
      }
      error?.(options.currentError ?? createPositionError(2));
    },
    watchPosition: (success, error) => {
      for (const position of options.watchedPositions ?? []) {
        success(position);
      }
      if (options.watchedError) {
        error?.(options.watchedError);
      }
      return 1;
    },
    clearWatch: () => undefined,
  };
}

function createPositionError(code: number): GeolocationPositionError {
  return {
    code,
    message: "test geolocation error",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
}

async function assertRejects<T extends Error>(
  action: () => Promise<unknown>,
  expectedError: new (...args: never[]) => T,
  message: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (error instanceof expectedError) {
      return;
    }
    throw new Error(`${message}: expected ${expectedError.name}, got ${String(error)}`);
  }
  throw new Error(`${message}: expected rejection`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
