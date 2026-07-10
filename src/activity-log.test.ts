import {
  ACTIVITY_LOG_MAX_ENTRIES,
  appendActivityLogEntry,
  createActivityLogPayload,
  createBallActivityInput,
  createBallActivitySnapshot,
  findLatestBallSendMode,
  loadActivityLog,
  recordActivity,
} from "./activity-log.js";
import type { HappyBall } from "./models.js";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
  },
  configurable: true,
});

const sampleBall: HappyBall = {
  id: "ball_activity_sample",
  date: "2026-07-09",
  subject: "エモ次郎",
  issuerType: "self",
  issuedBy: "エモ次郎",
  enteredBy: "エモ次郎",
  approvedBy: null,
  keepers: ["エモ次郎"],
  viewers: [],
  count: 1,
  title: "届いた玉",
  category: "日常",
  note: "",
  visibility: "open",
  visual: {
    hue: 40,
    saturation: 50,
    lightness: 50,
    kind: "filled",
    label: "届玉",
  },
  lifecycleStatus: "active",
  createdAt: "2026-07-09T10:00:00.000Z",
  updatedAt: "2026-07-09T10:00:00.000Z",
};

store.set("happyBall.activityLog.v1", "{broken");
assertEqual(loadActivityLog().length, 0, "broken stored activity log should recover as empty");

const firstEntries = recordActivity(createBallActivityInput(sampleBall, {
  action: "url-receive",
  sendMode: "casual",
}));
assertEqual(firstEntries.length, 1, "recordActivity should save one entry");
assertEqual(loadActivityLog()[0]?.sendMode, "casual", "stored receive activity should keep send mode");

const nextRecordedAt = new Date(Date.now() + 1000).toISOString();
const nextEntries = appendActivityLogEntry(firstEntries, createBallActivityInput(sampleBall, {
  action: "send-line-url",
  sendMode: "formal",
}), nextRecordedAt);
assertEqual(findLatestBallSendMode(nextEntries, sampleBall.id), "formal", "latest send mode should win");

const deletedRecordedAt = new Date(Date.now() + 2000).toISOString();
const deletedEntries = appendActivityLogEntry(nextEntries, createBallActivityInput(sampleBall, {
  action: "delete-ball",
  ballSnapshot: createBallActivitySnapshot(sampleBall),
}), deletedRecordedAt);
assertEqual(deletedEntries[0]?.ballSnapshot?.id, sampleBall.id, "delete log should keep a minimal ball snapshot");

let manyEntries = deletedEntries;
for (let index = 0; index < ACTIVITY_LOG_MAX_ENTRIES + 10; index += 1) {
  manyEntries = appendActivityLogEntry(manyEntries, {
    action: "json-export",
  }, `2026-07-09T13:${String(index % 60).padStart(2, "0")}:00.000Z`);
}
assertEqual(manyEntries.length, ACTIVITY_LOG_MAX_ENTRIES, "activity log should keep only the maximum recent entries");

const payload = createActivityLogPayload(deletedEntries);
assertEqual(payload.type, "happy-ball-activity-log", "activity payload should identify its own type");
assertEqual(payload.entries.length, deletedEntries.length, "activity payload should include normalized entries");

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
