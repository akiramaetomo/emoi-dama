import type { ImpactEvent } from "./rapier-stage.js";
import type { AppSettings } from "./settings.js";

const MAX_AUDIO_VOICES = 8;
const MAX_AUDIO_TRIGGERS_PER_FRAME = 3;
const MIN_AUDIO_TRIGGER_INTERVAL_MS = 28;
const AUDIO_TRIGGER_SPACING_SECONDS = 0.018;
const AUDIO_FAILURE_REPORT_INTERVAL_MS = 2500;
const IMPACT_ENERGY_REFERENCE = 70;
const MAX_ENERGY_GAIN_REFERENCE = 3000;
const MIN_GAIN_VALUE = 0.001;
const BASE_IMPACT_GAIN_RATIO = 0.16;
const IMPACT_GAIN_RANGE_RATIO = 0.84;
const FILTER_FREQUENCY_HZ = 7400;
const FILTER_Q = 0.4;
const GAIN_FLOOR = 0.0001;
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
    if (nowMs - this.lastPlayedAt < MIN_AUDIO_TRIGGER_INTERVAL_MS) {
      return;
    }

    const selected = impacts
      .filter((impact) => impact.energy >= settings.soundThreshold)
      .sort((a, b) => b.energy - a.energy)
      .slice(0, MAX_AUDIO_TRIGGERS_PER_FRAME);

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
    if (this.voices >= MAX_AUDIO_VOICES) {
      return;
    }

    const now = context.currentTime;
    const start = now + offset;
    const duration = settings.durationMs / 1000;
    const energyGain = Math.min(
      1,
      Math.log1p(impact.energy / IMPACT_ENERGY_REFERENCE)
        / Math.log1p(MAX_ENERGY_GAIN_REFERENCE / IMPACT_ENERGY_REFERENCE),
    );
    const gainValue = Math.max(
      MIN_GAIN_VALUE,
      settings.masterVolume * (BASE_IMPACT_GAIN_RATIO + energyGain * IMPACT_GAIN_RANGE_RATIO),
    );
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

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
