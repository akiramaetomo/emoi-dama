import { createDurableId, type CryptoRandomSource } from "./durable-id.js";

let requestedLength = 0;
const source: CryptoRandomSource = {
  getRandomValues<T extends ArrayBufferView>(array: T): T {
    requestedLength = array.byteLength;
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    bytes.forEach((_, index) => { bytes[index] = index; });
    return array;
  },
};

const id = createDurableId("ball", source);
assert(requestedLength === 16, "durable IDs should request sixteen random bytes");
assert(id === "ball_000102030405060708090a0b0c0d0e0f", "durable IDs should keep their prefix and all 128 random bits");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
