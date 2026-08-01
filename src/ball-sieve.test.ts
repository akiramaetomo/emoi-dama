import {
  applyBallSieve,
  BALL_SIEVE_PRESETS,
  matchesBallSieve,
  type BallSieveSpec,
} from "./ball-sieve.js";
import type { HappyBall } from "./models.js";

const baseBall: HappyBall = {
  id: "ball_sieve_active",
  date: "2026-07-31",
  subject: "エモ次郎",
  issuerType: "self",
  issuedBy: "エモ次郎",
  enteredBy: "エモ次郎",
  approvedBy: null,
  keepers: [],
  viewers: [],
  count: 1,
  title: "いつもの玉",
  category: "日常",
  note: "",
  visibility: "open",
  visual: { hue: 42, saturation: 62, lightness: 58, kind: "filled", label: "いつ" },
  lifecycleStatus: "active",
  createdAt: "2026-07-31T01:00:00.000Z",
  updatedAt: "2026-07-31T01:00:00.000Z",
};

const archivedBall = { ...baseBall, id: "ball_sieve_archived", lifecycleStatus: "archived" as const };
const offeredBall = { ...baseBall, id: "ball_sieve_offered", lifecycleStatus: "offered" as const };
const descentBall = {
  ...offeredBall,
  id: "ball_sieve_descent",
  descents: [{
    id: "descent_without_gps",
    sequence: 1,
    recordedAt: "2026-07-31T02:00:00.000Z",
    badgeAwarded: true,
    memo: "場所を残さない降臨",
  }],
  descentBadgeCount: 1,
};
const positionedDescentBall = {
  ...baseBall,
  id: "ball_sieve_descent_gps",
  descents: [{
    id: "descent_with_gps",
    sequence: 1,
    recordedAt: "2026-07-31T03:00:00.000Z",
    latitude: 35.6812,
    longitude: 139.7671,
    badgeAwarded: true,
    memo: "",
  }],
  descentBadgeCount: 1,
};
const source = [baseBall, archivedBall, offeredBall, descentBall, positionedDescentBall];

assertIds(applyBallSieve(source, "usual"), [baseBall.id, archivedBall.id, positionedDescentBall.id], "usual should include active and archived but exclude offered");
assertIds(applyBallSieve(source, "archived"), [archivedBall.id], "archived should include only archived balls");
assertIds(applyBallSieve(source, "offered"), [offeredBall.id, descentBall.id], "offered should include only offered balls");
assertIds(applyBallSieve(source, "descent"), [descentBall.id, positionedDescentBall.id], "descent should include GPS and GPS-less records across lifecycle states");

const futureCriteria: BallSieveSpec = {
  id: "usual",
  label: "future-composite",
  operator: "all",
  criteria: [
    { kind: "category", values: ["日常"] },
    { kind: "subject", values: ["エモ次郎"] },
  ],
};
assert(matchesBallSieve(baseBall, futureCriteria), "future category and subject criteria should use the same evaluator");

const before = JSON.stringify(source);
const filtered = applyBallSieve(source, BALL_SIEVE_PRESETS.offered);
assert(JSON.stringify(source) === before, "sieving must not mutate source balls");
assert(filtered !== source, "sieving should return a new array");

function assertIds(actual: HappyBall[], expected: string[], message: string): void {
  assert(actual.map((ball) => ball.id).join(",") === expected.join(","), message);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
