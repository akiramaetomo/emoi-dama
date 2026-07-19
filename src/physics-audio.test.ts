import { IMPACT_AUDIO_LIMITS, impactEnergyToGain, selectImpactEventsForAudio } from "./impact-audio.js";
import {
  applyBallColliderSettings,
  findWallImpactCandidates,
  scheduleFixedPhysicsSteps,
} from "./rapier-stage.js";

const quietSettings = {
  masterVolume: 0.28,
  soundThreshold: 85,
};

const thresholdGain = impactEnergyToGain(85, quietSettings);
const strongGain = impactEnergyToGain(3000, quietSettings);

assert(thresholdGain > 0, "threshold impacts should remain barely audible");
assert(strongGain > thresholdGain * 250, "impact gain should preserve roughly 50dB of dynamic range");
assert(strongGain <= quietSettings.masterVolume, "impact gain should not exceed master volume");
assertEqual(impactEnergyToGain(84.9, quietSettings), 0, "sub-threshold impacts should stay silent");
assertEqual(impactEnergyToGain(3000, { ...quietSettings, masterVolume: 0 }), 0, "zero master volume should stay silent");

const selectedImpacts = selectImpactEventsForAudio([
  { kind: "contact", energy: 84 },
  { kind: "wall", energy: 900 },
  { kind: "contact", energy: 300 },
  { kind: "contact", energy: 1200 },
  { kind: "wall", energy: Number.NaN },
], quietSettings.soundThreshold);
assertEqual(selectedImpacts.map((impact) => impact.energy).join(","), "1200,900,300", "audio batches should keep the three strongest audible collision starts");
assertEqual(IMPACT_AUDIO_LIMITS.maxVoices, 8, "impact audio should retain the eight-voice polyphony limit");
assertEqual(IMPACT_AUDIO_LIMITS.maxTriggersPerBatch, 3, "impact audio should retain the three-trigger batch limit");
assertEqual(IMPACT_AUDIO_LIMITS.minTriggerIntervalMs, 28, "impact audio should retain the 28ms batch gate");

const slidingOnLeftWall = findWallImpactCandidates(
  { x: 41, y: 140 },
  { x: 0, y: 500 },
  42,
  320,
  480,
);
assertEqual(slidingOnLeftWall[0]?.energy, 0, "wall grazing should ignore tangent speed");

const hittingLeftWall = findWallImpactCandidates(
  { x: 41, y: 140 },
  { x: -160, y: 500 },
  42,
  320,
  480,
);
assertEqual(hittingLeftWall[0]?.side, "left", "left wall impact should be identified");
assertEqual(hittingLeftWall[0]?.energy, 160, "wall impact should use inward normal speed");

const leavingLeftWall = findWallImpactCandidates(
  { x: 41, y: 140 },
  { x: 160, y: 500 },
  42,
  320,
  480,
);
assertEqual(leavingLeftWall[0]?.energy, 0, "leaving a wall should not create impact energy");

assertEqual(countScheduledSteps(60, 1000 / 60), 60, "60Hz frames should run one physics second per real second");
assertEqual(countScheduledSteps(120, 1000 / 120), 60, "120Hz touch frames should not double physics time");

const longFrameSchedule = scheduleFixedPhysicsSteps(0, 1000);
assertEqual(longFrameSchedule.steps, 4, "long frames should cap catch-up physics steps");
assert(longFrameSchedule.accumulatorMs < 1000 / 60, "long frames should discard runaway accumulator time");

const colliderUpdates: string[] = [];
applyBallColliderSettings(
  {
    setRestitution: (value) => colliderUpdates.push(`restitution:${value}`),
    setFriction: (value) => colliderUpdates.push(`friction:${value}`),
  },
  { contactRestitution: 1, friction: 0.02 },
);
assertEqual(colliderUpdates.join(","), "restitution:1,friction:0.02", "existing ball colliders should receive updated contact settings");

function assert(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function countScheduledSteps(frameCount: number, elapsedMs: number): number {
  let accumulatorMs = 0;
  let steps = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const schedule = scheduleFixedPhysicsSteps(accumulatorMs, elapsedMs);
    accumulatorMs = schedule.accumulatorMs;
    steps += schedule.steps;
  }
  return steps;
}
