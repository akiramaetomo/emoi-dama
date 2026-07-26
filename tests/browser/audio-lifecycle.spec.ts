import { expect, test, type Page } from "@playwright/test";

test("audio recovers after iPad-style wake without toggling its setting", async ({ page }) => {
  await installAudioProbe(page);
  await page.goto("/");
  await page.locator("[data-calendar-main]").click();

  await expect.poll(() => readAudioProbe(page)).toMatchObject({ contexts: 1, resumes: 1, state: "running" });

  await page.evaluate(() => {
    const probe = (window as typeof window & { __audioProbe: Omit<AudioProbe, "state"> }).__audioProbe;
    probe.current!.state = "suspended";
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => readAudioProbe(page)).toMatchObject({ resumes: 2, state: "running" });

  await page.evaluate(() => {
    const probe = (window as typeof window & { __audioProbe: Omit<AudioProbe, "state"> }).__audioProbe;
    probe.current!.state = "suspended";
    window.dispatchEvent(new PageTransitionEvent("pageshow"));
  });
  await expect.poll(() => readAudioProbe(page)).toMatchObject({ resumes: 3, state: "running" });

  await page.evaluate(() => {
    const probe = (window as typeof window & { __audioProbe: Omit<AudioProbe, "state"> }).__audioProbe;
    probe.current!.state = "interrupted";
    probe.rejectNextResume = true;
  });
  await page.locator("[data-cycle-ball-label-mode]").click();
  await expect.poll(() => readAudioProbe(page)).toMatchObject({ contexts: 2, closes: 1, state: "running" });

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
  });
  await expect.poll(() => readAudioProbe(page)).toMatchObject({ closes: 2, state: "closed" });

  await page.locator("[data-open-panel='calendar']").click();
  await expect.poll(() => readAudioProbe(page)).toMatchObject({ contexts: 3, state: "running" });
  await page.locator("[data-calendar-open-panel='settings']").click();
  await expect(page.locator("#setting-sound")).toBeChecked();
  await expect(page.locator(".runtime-fault-banner")).toHaveCount(0);
});

interface AudioProbe {
  closes: number;
  contexts: number;
  current: { state: string } | null;
  rejectNextResume: boolean;
  resumes: number;
  state: string | null;
  suspends: number;
}

async function installAudioProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe = {
      closes: 0,
      contexts: 0,
      current: null as { state: string } | null,
      rejectNextResume: false,
      resumes: 0,
      suspends: 0,
    };

    class FakeAudioContext {
      currentTime = 0;
      destination = {};
      state = "suspended";

      constructor() {
        probe.contexts += 1;
        probe.current = this;
      }

      async resume(): Promise<void> {
        probe.resumes += 1;
        if (probe.rejectNextResume) {
          probe.rejectNextResume = false;
          throw new Error("simulated iPad resume rejection");
        }
        this.state = "running";
      }

      async suspend(): Promise<void> {
        probe.suspends += 1;
        this.state = "suspended";
      }

      async close(): Promise<void> {
        probe.closes += 1;
        this.state = "closed";
      }

      createOscillator() {
        let ended: (() => void) | null = null;
        return {
          type: "sine",
          frequency: { setValueAtTime() {} },
          connect() {},
          disconnect() {},
          start() {},
          stop() { window.setTimeout(() => ended?.(), 0); },
          addEventListener(type: string, listener: () => void) {
            if (type === "ended") ended = listener;
          },
        };
      }

      createBiquadFilter() {
        return {
          type: "lowpass",
          frequency: { setValueAtTime() {} },
          Q: { setValueAtTime() {} },
          connect() {},
          disconnect() {},
        };
      }

      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
        };
      }
    }

    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    Object.defineProperty(window, "webkitAudioContext", { configurable: true, value: FakeAudioContext });
    Object.defineProperty(window, "__audioProbe", { configurable: true, value: probe });
  });
}

async function readAudioProbe(page: Page): Promise<AudioProbe> {
  return page.evaluate(() => {
    const probe = (window as typeof window & { __audioProbe: Omit<AudioProbe, "state"> }).__audioProbe;
    return {
      closes: probe.closes,
      contexts: probe.contexts,
      current: probe.current,
      rejectNextResume: probe.rejectNextResume,
      resumes: probe.resumes,
      state: probe.current?.state ?? null,
      suspends: probe.suspends,
    };
  });
}
