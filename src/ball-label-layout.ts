export const BALL_LABEL_MAX_GRAPHEMES_PER_LINE = 7;
export const BALL_LABEL_MAX_LINES = 3;
export const BALL_LABEL_MAX_GRAPHEMES = BALL_LABEL_MAX_GRAPHEMES_PER_LINE * BALL_LABEL_MAX_LINES;

export interface BallLabelLayout {
  lines: string[];
  truncated: boolean;
}

export function createBalancedBallLabelLayout(label: string): BallLabelLayout {
  const graphemes = splitGraphemes(label);
  const truncated = graphemes.length > BALL_LABEL_MAX_GRAPHEMES;
  const visible = truncated
    ? [...graphemes.slice(0, BALL_LABEL_MAX_GRAPHEMES - 1), "…"]
    : graphemes;
  if (visible.length === 0) {
    return { lines: [], truncated };
  }

  const lineCount = Math.min(BALL_LABEL_MAX_LINES, Math.ceil(visible.length / BALL_LABEL_MAX_GRAPHEMES_PER_LINE));
  const baseLength = Math.floor(visible.length / lineCount);
  const longerLineCount = visible.length % lineCount;
  const lines: string[] = [];
  let offset = 0;
  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const lineLength = baseLength + (lineIndex < longerLineCount ? 1 : 0);
    lines.push(visible.slice(offset, offset + lineLength).join(""));
    offset += lineLength;
  }
  return { lines, truncated };
}

export function splitGraphemes(value: string): string[] {
  const Segmenter = typeof Intl !== "undefined"
    ? (Intl as typeof Intl & { Segmenter?: new (locale?: string, options?: { granularity: "grapheme" }) => {
        segment(input: string): Iterable<{ segment: string }>;
      } }).Segmenter
    : undefined;
  if (Segmenter) {
    return Array.from(new Segmenter("ja", { granularity: "grapheme" }).segment(value), (part) => part.segment);
  }
  return Array.from(value);
}
