import type { ImpactEvent } from "./rapier-stage.js";
import type { AppSettings } from "./settings.js";

export const IMPACT_AUDIO_LIMITS = Object.freeze({
  maxVoices: 8,
  maxTriggersPerBatch: 3,
  minTriggerIntervalMs: 28,
});
const AUDIO_TRIGGER_SPACING_SECONDS = 0.018;
const AUDIO_FAILURE_REPORT_INTERVAL_MS = 2500;
const MAX_ENERGY_GAIN_REFERENCE = 3000;
const MIN_GAIN_VALUE = 0.00003;
const MIN_DYNAMIC_GAIN_RATIO = 0.0032;
const IMPACT_GAIN_LOG_CURVE = 18;
const FILTER_FREQUENCY_HZ = 7400;
const FILTER_Q = 0.4;
const GAIN_FLOOR = 0.00001;
const ATTACK_SECONDS = 0.008;

export class TinyImpactAudio {
  private context: AudioContext | null = null;
  private voices = 0;
  private lastPlayedAt = 0;
  private lastFailureReportedAt = 0;

  unlock(): void {
    void this.resumeFromGesture();
  }

  suspend(): void {
    const context = this.getOpenContext();
    if (!context || context.state !== "running") {
      return;
    }

    void context.suspend().catch((error: unknown) => {
      this.handleAudioFailure(error);
    });
  }

  close(): void {
    const context = this.getOpenContext();
    this.context = null;
    this.voices = 0;

    if (!context) {
      return;
    }

    void context.close().catch((error: unknown) => {
      this.handleAudioFailure(error);
    });
  }

  play(impacts: ImpactEvent[], settings: AppSettings): void {
    if (!settings.soundEnabled || impacts.length === 0) {
      return;
    }

    const context = this.getOpenContext();
    if (!context || context.state !== "running") {
      return;
    }

    const nowMs = performance.now();
    if (nowMs - this.lastPlayedAt < IMPACT_AUDIO_LIMITS.minTriggerIntervalMs) {
      return;
    }

    const selected = selectImpactEventsForAudio(impacts, settings.soundThreshold);

    try {
      selected.forEach((impact, index) => this.playPing(context, impact, settings, index * AUDIO_TRIGGER_SPACING_SECONDS));
    } catch (error) {
      this.handleAudioFailure(error);
      this.close();
      return;
    }

    if (selected.length > 0) {
      this.lastPlayedAt = nowMs;
    }
  }

  private async resumeFromGesture(): Promise<void> {
    const context = this.ensureContext();
    if (!context || context.state === "closed") {
      return;
    }

    if (context.state !== "running") {
      try {
        await context.resume();
      } catch (error) {
        this.handleAudioFailure(error);
        this.close();
      }
    }
  }

  private ensureContext(): AudioContext | null {
    const existingContext = this.getOpenContext();
    if (existingContext) {
      return existingContext;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    try {
      this.context = new AudioContextCtor();
    } catch (error) {
      this.handleAudioFailure(error);
      this.context = null;
    }

    return this.context;
  }

  private getOpenContext(): AudioContext | null {
    if (this.context?.state === "closed") {
      this.context = null;
      this.voices = 0;
    }

    return this.context;
  }

  private handleAudioFailure(error: unknown): void {
    const now = performance.now();
    if (now - this.lastFailureReportedAt < AUDIO_FAILURE_REPORT_INTERVAL_MS) {
      return;
    }

    this.lastFailureReportedAt = now;
    console.warn("Impact audio was disabled after a browser audio error.", error);
  }

  private playPing(context: AudioContext, impact: ImpactEvent, settings: AppSettings, offset: number): void {
    if (this.voices >= IMPACT_AUDIO_LIMITS.maxVoices) {
      return;
    }

    const now = context.currentTime;
    const start = now + offset;
    const duration = settings.durationMs / 1000;
    const gainValue = impactEnergyToGain(impact.energy, settings);
    if (gainValue <= 0) {
      return;
    }
    const spread = impact.kind === "wall" ? 1 : settings.frequencySpread;
    const pitchJitter = 1 + (Math.random() - 0.5) * (spread - 1);
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    this.voices += 1;
    oscillator.type = impact.kind === "wall" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(settings.frequencyHz * pitchJitter, start);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(FILTER_FREQUENCY_HZ, start);
    filter.Q.setValueAtTime(FILTER_Q, start);
    gain.gain.setValueAtTime(GAIN_FLOOR, now);
    gain.gain.setValueAtTime(GAIN_FLOOR, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + ATTACK_SECONDS);
    gain.gain.exponentialRampToValueAtTime(GAIN_FLOOR, start + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
    oscillator.addEventListener("ended", () => {
      this.voices = Math.max(0, this.voices - 1);
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
    });
  }
}

export function impactEnergyToGain(energy: number, settings: Pick<AppSettings, "masterVolume" | "soundThreshold">): number {
  if (!Number.isFinite(energy) || energy < settings.soundThreshold || settings.masterVolume <= 0) {
    return 0;
  }

  const normalizedEnergy = clamp(
    (energy - settings.soundThreshold) / Math.max(1, MAX_ENERGY_GAIN_REFERENCE - settings.soundThreshold),
    0,
    1,
  );
  const perceptualEnergy = Math.log1p(normalizedEnergy * IMPACT_GAIN_LOG_CURVE) / Math.log1p(IMPACT_GAIN_LOG_CURVE);
  const dynamicGainRatio = MIN_DYNAMIC_GAIN_RATIO * ((1 / MIN_DYNAMIC_GAIN_RATIO) ** perceptualEnergy);
  return Math.max(MIN_GAIN_VALUE, settings.masterVolume * dynamicGainRatio);
}

export function selectImpactEventsForAudio(impacts: readonly ImpactEvent[], soundThreshold: number): ImpactEvent[] {
  return impacts
    .filter((impact) => Number.isFinite(impact.energy) && impact.energy >= soundThreshold)
    .sort((a, b) => b.energy - a.energy)
    .slice(0, IMPACT_AUDIO_LIMITS.maxTriggersPerBatch);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
