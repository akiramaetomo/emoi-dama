export type DurableIdPrefix = "ball" | "ledger" | "person" | "workspace" | "bundle";

export interface CryptoRandomSource {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}

export function createDurableId(
  prefix: DurableIdPrefix,
  source: CryptoRandomSource = globalThis.crypto,
): string {
  const bytes = new Uint8Array(16);
  source.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${token}`;
}
