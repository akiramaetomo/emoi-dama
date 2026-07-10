import { createDebugLogFileName, DebugLogBuffer } from "./debug-log.js";

const buffer = new DebugLogBuffer(3);
buffer.append("first", { value: 1 }, Date.parse("2026-07-11T00:00:00.000Z"));
buffer.append("second", { value: 2 }, Date.parse("2026-07-11T00:00:01.000Z"));
buffer.append("third", { value: 3 }, Date.parse("2026-07-11T00:00:02.000Z"));
buffer.append("fourth", { value: 4 }, Date.parse("2026-07-11T00:00:03.000Z"));

const snapshot = buffer.snapshot();
assertEqual(snapshot.length, 3, "debug log buffer should keep the configured limit");
assertEqual(snapshot[0].type, "second", "debug log buffer should drop the oldest entries first");
assertEqual(snapshot[2].type, "fourth", "debug log buffer should retain the newest entry");

const payload = buffer.toPayload({ url: "https://example.test/" }, new Date("2026-07-11T01:02:03.000Z"));
assertEqual(payload.version, 1, "debug log payload should expose version 1");
assertEqual(payload.createdAt, "2026-07-11T01:02:03.000Z", "debug log payload should use the supplied timestamp");
assertEqual(payload.entries.length, 3, "debug log payload should include buffered entries");

const fileName = createDebugLogFileName(new Date(2026, 6, 11, 1, 2, 3));
assertEqual(fileName, "happy-ball-debug-20260711-010203.json", "debug log file name should use a stable timestamp");

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
