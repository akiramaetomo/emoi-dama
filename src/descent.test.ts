import { appendDescentToBall, createGoogleMapsUrl, DESCENT_BADGE_MAX, distanceMeters } from "./descent.js";
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
