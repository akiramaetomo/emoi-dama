import {
  BALL_LABEL_MAX_GRAPHEMES_PER_LINE,
  createBalancedBallLabelLayout,
  isSingleGrapheme,
  splitGraphemes,
} from "./ball-label-layout.js";

assertLines("", []);
assertLines("1234567", ["1234567"]);
assertLines("小さなえもいゴト", ["小さなえ", "もいゴト"]);
assertLines("123456789", ["12345", "6789"]);
assertLines("12345678901234", ["1234567", "8901234"]);
assertLines("123456789012345", ["12345", "67890", "12345"]);
assertLines("123456789012345678901", ["1234567", "8901234", "5678901"]);

const truncated = createBalancedBallLabelLayout("1234567890123456789012");
assert(truncated.truncated, "labels above 21 graphemes should report truncation");
assert(truncated.lines.join("") === "12345678901234567890…", "long labels should keep 20 graphemes and an ellipsis");
assert(truncated.lines.every((line) => splitGraphemes(line).length <= BALL_LABEL_MAX_GRAPHEMES_PER_LINE), "every line should stay within seven graphemes");

const familyEmoji = "👨🏻‍👩🏽‍👧🏿‍👦🏻";
assert(splitGraphemes(familyEmoji).length === 1, "a joined emoji sequence should remain one grapheme");
assert(isSingleGrapheme(familyEmoji), "a joined emoji sequence should qualify for the large item label");
assert(isSingleGrapheme("🎂"), "one pictographic emoji should qualify for the large item label");
assert(isSingleGrapheme("宝"), "one kanji should qualify for the large item label");
assert(isSingleGrapheme("あ"), "one kana should qualify for the large item label");
assert(isSingleGrapheme("A"), "one Latin character should qualify for the large item label");
assert(isSingleGrapheme("  石  "), "surrounding whitespace should not prevent a one-grapheme label from qualifying");
assert(!isSingleGrapheme("🎂🎂"), "two emoji should keep the normal label layout");
assert(!isSingleGrapheme("宝石"), "two text graphemes should keep the normal label layout");
assert(!isSingleGrapheme(""), "an empty label should not qualify for the large item label");
assert(!isSingleGrapheme("   "), "a whitespace-only label should not qualify for the large item label");
assertLines(`${familyEmoji}1234567`, [`${familyEmoji}123`, "4567"]);

function assertLines(input: string, expected: string[]): void {
  const actual = createBalancedBallLabelLayout(input).lines;
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${input} should balance as ${expected.join(" / ")}, got ${actual.join(" / ")}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
