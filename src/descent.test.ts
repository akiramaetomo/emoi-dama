import {
  appendDescentToBall,
  createGoogleMapsUrl,
  DESCENT_BADGE_MAX,
  distanceMeters,
  hasDescentPosition,
  updateDescentRecordPosition,
} from "./descent.js";
import type { HappyBall } from "./models.js";

const sampleBall: HappyBall = {
  id: "ball_20260706_descent",
  date: "2026-07-06",
  subject: "エモ次郎",
  issuerType: "self",
  issuedBy: "エモ次郎",
  enteredBy: "エモ次郎",
  approvedBy: null,
  keepers: ["エモ次郎"],
  viewers: [],
  count: 1,
  title: "旅の玉",
  category: "日常",
  note: "",
  visibility: "open",
  visual: {
    hue: 40,
    saturation: 50,
    lightness: 50,
    kind: "filled",
    label: "旅",
  },
  lifecycleStatus: "active",
  createdAt: "2026-07-06T10:00:00.000Z",
  updatedAt: "2026-07-06T10:00:00.000Z",
};

const first = appendDescentToBall(
  sampleBall,
  { latitude: 35.681236, longitude: 139.767125, accuracyMeters: 12 },
  500,
  "東京駅から",
  "2026-07-06T10:00:00.000Z",
);
assert(first.ok, "first descent should succeed");
if (first.ok) {
  assertEqual(first.ball.descents?.length, 1, "first descent should add a record");
  assertEqual(first.record.sequence, 1, "first descent should be sequence one");
  assertEqual(first.record.memo, "東京駅から", "descent memo should be preserved");
  assertEqual(first.ball.descentBadgeCount, 1, "first descent should add one badge");
  assertEqual(first.ball.isKamiBall, false, "one badge should not make a kami ball");

  const tooClose = appendDescentToBall(
    first.ball,
    { latitude: 35.6815, longitude: 139.7673, accuracyMeters: 10 },
    500,
    "",
    "2026-07-06T10:05:00.000Z",
  );
  assert(!tooClose.ok, "nearby second descent should be blocked");
  if (!tooClose.ok) {
    assert(tooClose.distanceFromPreviousMeters < 500, "blocked descent should report nearby distance");
  }

  const gpslessAfterTooClose = appendDescentToBall(
    first.ball,
    null,
    500,
    "移動確認できないので仮降臨",
    "2026-07-06T10:06:00.000Z",
  );
  assert(gpslessAfterTooClose.ok, "GPS-less descent should still be available after a too-close GPS attempt");
  if (gpslessAfterTooClose.ok) {
    assertEqual(gpslessAfterTooClose.record.sequence, 2, "GPS-less fallback should become the next descent");
    assertEqual(hasDescentPosition(gpslessAfterTooClose.record), false, "GPS-less fallback should not store the too-close coordinate");
  }

  const far = appendDescentToBall(
    first.ball,
    { latitude: 35.710063, longitude: 139.8107, accuracyMeters: 18 },
    500,
    "スカイツリーの近く",
    "2026-07-06T11:00:00.000Z",
  );
  assert(far.ok, "far second descent should succeed");
  if (far.ok) {
    assertEqual(far.record.sequence, 2, "far descent should be sequence two");
    assert((far.record.distanceFromPreviousMeters ?? 0) >= 500, "far descent should store distance from previous");
    assertEqual(far.ball.descentBadgeCount, 2, "far descent should add another badge");
  }
}

const gpsless = appendDescentToBall(
  sampleBall,
  null,
  500,
  "地下鉄でメモだけ残す",
  "2026-07-06T13:00:00.000Z",
);
assert(gpsless.ok, "GPS-less provisional descent should succeed");
if (gpsless.ok) {
  assertEqual(gpsless.record.memo, "地下鉄でメモだけ残す", "GPS-less descent should preserve memo");
  assertEqual(hasDescentPosition(gpsless.record), false, "GPS-less descent should not have coordinates");
  assertEqual(gpsless.ball.descentBadgeCount, 1, "GPS-less descent should still add one badge");

  const backfilled = updateDescentRecordPosition(
    gpsless.ball,
    gpsless.record.id,
    { latitude: 35.681236, longitude: 139.767125, accuracyMeters: 24 },
    "2026-07-06T13:05:00.000Z",
  );
  assert(backfilled.ok, "GPS-less descent should accept a later GPS backfill");
  if (backfilled.ok) {
    assertEqual(backfilled.record.sequence, 1, "GPS backfill should keep the same sequence");
    assertEqual(backfilled.ball.descents?.length, 1, "GPS backfill should not add another descent record");
    assertEqual(backfilled.ball.descentBadgeCount, 1, "GPS backfill should not add another badge");
    assertEqual(hasDescentPosition(backfilled.record), true, "GPS backfill should add coordinates");
  }
}

let maxBall: HappyBall = { ...sampleBall, descentBadgeCount: DESCENT_BADGE_MAX - 1 };
for (let index = 0; index < 3; index += 1) {
  const result = appendDescentToBall(
    maxBall,
    { latitude: 35 + index, longitude: 139 + index },
    500,
    "",
    `2026-07-06T12:0${index}:00.000Z`,
  );
  assert(result.ok, "descent should keep succeeding after kami threshold");
  if (result.ok) {
    maxBall = result.ball;
  }
}

assertEqual(maxBall.descentBadgeCount, DESCENT_BADGE_MAX, "badge count should stop at the maximum");
assertEqual(maxBall.isKamiBall, true, "twenty badges should make a kami ball");
assertEqual(maxBall.descents?.length, 3, "history should keep growing after badge max");

assert(distanceMeters(35.681236, 139.767125, 35.710063, 139.8107) > 500, "distance helper should return meter distances");
assert(
  createGoogleMapsUrl({ latitude: 35.681236, longitude: 139.767125 }).includes("query=35.681236%2C139.767125"),
  "Google Maps URL should include the coordinate query",
);

let gpslessBetweenPositioned = first.ok ? first.ball : sampleBall;
const provisionalBetween = appendDescentToBall(
  gpslessBetweenPositioned,
  null,
  500,
  "位置なしの途中回",
  "2026-07-06T10:30:00.000Z",
);
assert(provisionalBetween.ok, "GPS-less descent between positioned descents should succeed");
if (provisionalBetween.ok) {
  gpslessBetweenPositioned = provisionalBetween.ball;
  const nearbyAfterGpsless = appendDescentToBall(
    gpslessBetweenPositioned,
    { latitude: 35.6815, longitude: 139.7673, accuracyMeters: 10 },
    500,
    "",
    "2026-07-06T10:35:00.000Z",
  );
  assert(!nearbyAfterGpsless.ok, "distance check should still use latest positioned descent after GPS-less records");
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
