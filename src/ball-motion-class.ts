import type { HappyBall, HappyBallLedger, HappyBallVisual } from "./models.js";
import { resolveVisualMotionClass } from "./play-physics-classification.js";

export function withVisualMotionClass(visual: HappyBallVisual): HappyBallVisual {
  return { ...visual, motionClass: resolveVisualMotionClass(visual) };
}

export function withBallMotionClass(ball: HappyBall): HappyBall {
  return {
    ...ball,
    visual: withVisualMotionClass(ball.visual),
    ...(ball.emotionEcho
      ? {
          emotionEcho: {
            ...ball.emotionEcho,
            visual: withVisualMotionClass(ball.emotionEcho.visual),
          },
        }
      : {}),
  };
}

export function withLedgerMotionClasses(ledger: HappyBallLedger): HappyBallLedger {
  return { ...ledger, balls: ledger.balls.map(withBallMotionClass) };
}
