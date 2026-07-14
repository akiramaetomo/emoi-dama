import type { HappyBall } from "./models";
import {
  createBallPacket,
  createLinePacketImportUrl,
  createPacketImportUrl,
  parsePacketHash,
  parsePacketLocation,
  parsePacketQuery,
  reviewPacketImport,
} from "./packet.js";

const sampleBall: HappyBall = {
  id: "ball_20260626_self_ab12",
  date: "2026-06-26",
  time: "18:42",
  subject: "自分",
  issuerType: "self",
  issuedBy: "自分",
  enteredBy: "自分",
  approvedBy: null,
  keepers: ["自分"],
  viewers: [],
  count: 1,
  title: "夕方の空がよかった",
  category: "日常",
  note: "少し涼しかった",
  visibility: "category",
  visual: {
    hue: 214,
    saturation: 42,
    lightness: 54,
    kind: "filled",
    label: "夕方の空",
  },
  lifecycleStatus: "active",
  createdAt: "2026-06-26T10:00:00.000Z",
  updatedAt: "2026-06-26T10:00:00.000Z",
};

const importUrl = createPacketImportUrl(sampleBall, "https://example.test/happy-ball/?openExternalBrowser=1");
const parsed = parsePacketHash(new URL(importUrl).hash);
assertOk(parsed, "generated import URL should parse");
assertEqual(parsed.packet.items[0].title, sampleBall.title, "packet should preserve Japanese title text");
assertEqual(parsed.packet.items[0].time, sampleBall.time, "packet should preserve ball timestamp text");
assertEqual(parsed.packet.items[0].visual.label, "夕方の空", "packet should preserve Japanese visual label text");
assertEqual(parsed.packet.items[0].visual.kind, "filled", "packet should preserve visual kind");
assert(new URL(importUrl).hash.startsWith("#import="), "standard import URL should use a fragment payload");
assert(!new URL(importUrl).searchParams.has("openExternalBrowser"), "standard import URL should not keep LINE query parameters");
assert(!new URL(createPacketImportUrl(sampleBall, "https://example.test/happy-ball/?handoffDebug=1")).searchParams.has("handoffDebug"), "generated import URL should strip local handoff debug state");

const lineImportUrl = createLinePacketImportUrl(sampleBall, "https://example.test/happy-ball/?view=toy#import=old");
const lineUrl = new URL(lineImportUrl);
assertEqual(lineUrl.searchParams.get("openExternalBrowser"), "1", "LINE import URL should include external browser hint");
assert(lineUrl.searchParams.has("import"), "LINE import URL should include query import payload");
assertEqual(lineUrl.hash, "", "LINE import URL should avoid fragment payload");

const parsedLineQuery = parsePacketQuery(lineUrl.search);
assertOk(parsedLineQuery, "LINE query import URL should parse");
assertEqual(parsedLineQuery.packet.items[0].title, sampleBall.title, "query import should preserve Japanese title text");
assertEqual(parsedLineQuery.packet.sendMode, undefined, "default LINE import URL should not require a send mode field");

const casualImportUrl = createPacketImportUrl(sampleBall, "https://example.test/happy-ball/", { sendMode: "casual", includeDescentGps: false });
const parsedCasual = parsePacketHash(new URL(casualImportUrl).hash);
assertOk(parsedCasual, "casual import URL should parse");
assertEqual(parsedCasual.packet.sendMode, "casual", "casual import URL should preserve send mode");
assertEqual("activityLog" in parsedCasual.packet, false, "packet payloads should not include local activity logs");

const casualLineImportUrl = createLinePacketImportUrl(sampleBall, "https://example.test/happy-ball/", { sendMode: "casual", includeDescentGps: false });
const parsedCasualLine = parsePacketQuery(new URL(casualLineImportUrl).search);
assertOk(parsedCasualLine, "casual LINE query import URL should parse");
assertEqual(parsedCasualLine.packet.sendMode, "casual", "casual LINE URL should preserve send mode");

const issuerVisibilityPacket = createBallPacket({ ...sampleBall, visibility: "issuer" });
assertEqual(issuerVisibilityPacket.items[0].visibility, "issuer", "packet should preserve issuer-level visibility");

const descentPacket = createBallPacket({
  ...sampleBall,
  descents: [
    {
      id: "descent_1",
      sequence: 1,
      recordedAt: "2026-06-26T11:00:00.000Z",
      latitude: 35.681236,
      longitude: 139.767125,
      accuracyMeters: 12,
      badgeAwarded: true,
      memo: "駅前で降臨",
    },
  ],
  descentBadgeCount: 1,
  isKamiBall: false,
});
assertEqual(descentPacket.items[0].descents?.length, 1, "GPS-off packet should retain non-location descent history");
assertEqual(descentPacket.items[0].descents?.[0].memo, "駅前で降臨", "GPS-off packet should retain descent memo");
assertEqual(descentPacket.items[0].descents?.[0].latitude, undefined, "GPS-off packet should omit latitude");
assertEqual(descentPacket.items[0].descents?.[0].longitude, undefined, "GPS-off packet should omit longitude");
assertEqual(descentPacket.items[0].descents?.[0].accuracyMeters, undefined, "GPS-off packet should omit accuracy");
assertEqual(descentPacket.items[0].descentBadgeCount, 1, "packet may preserve non-location descent badge count");
assertEqual(descentPacket.items[0].isKamiBall, false, "packet may preserve non-location kami state");

const descentGpsPacket = createBallPacket(descentPacket.items[0], new Date().toISOString(), {
  sendMode: "formal",
  includeDescentGps: true,
});
const originalGpsPacket = createBallPacket({
  ...sampleBall,
  descents: [{
    id: "descent_gps",
    sequence: 1,
    recordedAt: "2026-06-26T11:00:00.000Z",
    latitude: 35.681236,
    longitude: 139.767125,
    accuracyMeters: 12,
    distanceFromPreviousMeters: 640,
    badgeAwarded: true,
    memo: "駅前で降臨",
  }],
}, new Date().toISOString(), { sendMode: "formal", includeDescentGps: true });
assertEqual(descentGpsPacket.items[0].descents?.[0].latitude, undefined, "GPS data omitted from an earlier packet must not be inferred");
assertEqual(originalGpsPacket.items[0].descents?.[0].latitude, 35.681236, "GPS-on packet should preserve latitude");
assertEqual(originalGpsPacket.items[0].descents?.[0].distanceFromPreviousMeters, 640, "GPS-on packet should preserve distance");
const originalGpsUrl = createPacketImportUrl({ ...sampleBall, descents: originalGpsPacket.items[0].descents }, "https://example.test/happy-ball/", { sendMode: "formal", includeDescentGps: true });
const parsedOriginalGps = parsePacketHash(new URL(originalGpsUrl).hash);
assertOk(parsedOriginalGps, "GPS-on packet URL should parse");
assertEqual(parsedOriginalGps.packet.items[0].descents?.[0].latitude, 35.681236, "receiver should restore only transmitted latitude");

const legacyHiddenPacket = createBallPacket({ ...sampleBall, visibility: "hidden" as unknown as HappyBall["visibility"] });
const legacyHiddenUrl = createPacketImportUrl(legacyHiddenPacket.items[0], "https://example.test/happy-ball/");
const parsedLegacyHidden = parsePacketHash(new URL(legacyHiddenUrl).hash);
assertOk(parsedLegacyHidden, "legacy hidden import URL should parse");
assertEqual(parsedLegacyHidden.packet.items[0].visibility, "category", "legacy hidden packet visibility should normalize to category");

const parsedLocation = parsePacketLocation(lineUrl.search, "");
assertOk(parsedLocation, "location parser should accept query import URL");

const reviewWithNoExisting = reviewPacketImport(createBallPacket(sampleBall), []);
assertEqual(reviewWithNoExisting.newItems.length, 1, "new packet item should be importable");
assertEqual(reviewWithNoExisting.duplicates.length, 0, "new packet item should not be duplicate");

const reviewWithSameExisting = reviewPacketImport(createBallPacket(sampleBall), [sampleBall]);
assertEqual(reviewWithSameExisting.newItems.length, 0, "existing packet item should not be importable");
assertEqual(reviewWithSameExisting.duplicates.length, 1, "same ID and content should be duplicate");

const receiptMarkedBall = { ...sampleBall, receiptCreatedAt: "2026-06-26T11:00:00.000Z" };
const reviewWithReceiptOnlyDifference = reviewPacketImport(createBallPacket(sampleBall), [receiptMarkedBall]);
assertEqual(reviewWithReceiptOnlyDifference.conflicts.length, 0, "receipt creation trace alone should not create an import conflict");
assertEqual(reviewWithReceiptOnlyDifference.duplicates.length, 1, "receipt creation trace alone should still be treated as duplicate");

const changedBall = { ...sampleBall, title: "内容が違う同じID" };
const reviewWithConflict = reviewPacketImport(createBallPacket(changedBall), [sampleBall]);
assertEqual(reviewWithConflict.conflicts.length, 1, "same ID with different content should be conflict");

const changedTimeBall = { ...sampleBall, time: "19:03" };
const reviewWithTimeConflict = reviewPacketImport(createBallPacket(changedTimeBall), [sampleBall]);
assertEqual(reviewWithTimeConflict.conflicts.length, 1, "same ID with different timestamp should be conflict");

const noTimePacket = createBallPacket({ ...sampleBall, time: undefined });
const noTimeUrl = createPacketImportUrl(noTimePacket.items[0], "https://example.test/happy-ball/");
const parsedNoTime = parsePacketHash(new URL(noTimeUrl).hash);
assertOk(parsedNoTime, "packet without timestamp should parse");
assertEqual(parsedNoTime.packet.items[0].time, undefined, "packet without timestamp should remain timestamp-free");

const parsedBad = parsePacketHash("#import=not_base64url");
assert(parsedBad?.ok === false, "invalid payload should return a parse error");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertOk<T extends { ok: boolean }>(value: T | null, message: string): asserts value is T & { ok: true } {
  if (!value || !value.ok) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
