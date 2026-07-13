import { resolveManualSubjectPreset, resolveNamePresetSelection } from "./form-interactions.js";

assertDeepEqual(
  resolveNamePresetSelection({ name: " エモ次郎 ", role: "self", issuerType: "proxy" }),
  { subject: "エモ次郎", issuerType: "self" },
  "selecting a self name should copy the name and leave proxy mode",
);

assertDeepEqual(
  resolveNamePresetSelection({ name: "代理さん", role: "proxy", issuerType: "self" }),
  { subject: "代理さん", issuerType: "proxy" },
  "selecting a proxy name should copy the name and select proxy mode",
);

assert(
  resolveManualSubjectPreset("自由な名前", "エモ次郎") === "",
  "manual input that differs from the selected name should clear the preset",
);

assert(
  resolveManualSubjectPreset("エモ次郎", "エモ次郎") === "エモ次郎",
  "unchanged manual input should keep the matching preset",
);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertDeepEqual<T>(actual: T, expected: T, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
