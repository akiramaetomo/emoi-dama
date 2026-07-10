const DEFAULT_DEBUG_LOG_LIMIT = 400;

export interface DebugLogEntry {
  t: number;
  type: string;
  data: Record<string, unknown>;
}

export interface DebugLogPayload {
  version: 1;
  createdAt: string;
  context: Record<string, unknown>;
  entries: DebugLogEntry[];
}

export class DebugLogBuffer {
  private entries: DebugLogEntry[] = [];

  constructor(private readonly limit = DEFAULT_DEBUG_LOG_LIMIT) {}

  append(type: string, data: Record<string, unknown>, now = Date.now()): void {
    this.entries.push({ t: now, type, data });
    if (this.entries.length > this.limit) {
      this.entries.splice(0, this.entries.length - this.limit);
    }
  }

  clear(): void {
    this.entries = [];
  }

  snapshot(): DebugLogEntry[] {
    return this.entries.map((entry) => ({
      t: entry.t,
      type: entry.type,
      data: { ...entry.data },
    }));
  }

  toPayload(context: Record<string, unknown>, now = new Date()): DebugLogPayload {
    return {
      version: 1,
      createdAt: now.toISOString(),
      context,
      entries: this.snapshot(),
    };
  }
}

export function createDebugLogFileName(now = new Date()): string {
  const stamp = [
    String(now.getFullYear()).padStart(4, "0"),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `happy-ball-debug-${stamp}.json`;
}
