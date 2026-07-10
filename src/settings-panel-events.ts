import type { CategoryColorPreset } from "./categories";
import type { NameBookEntry } from "./models";
import { dampingSliderToValue } from "./motion-tuning";
import { readBackgroundTexture, readEchoStrength, readStartupScreen, type AppSettings } from "./settings";
import { formatSettingValue } from "./settings-renderers";

interface SettingsPanelEventHandlers {
  unlockAudio: () => void;
  toggleGravitySensor: () => void;
  updateAppSettings: (patch: Partial<AppSettings>) => void;
  saveCategories: (categories: CategoryColorPreset[]) => CategoryColorPreset[];
  resetCategories: () => void;
  saveNameBook: (entries: NameBookEntry[]) => NameBookEntry[];
  resetNameBook: () => void;
}

interface SettingsPanelEventContext {
  categories: CategoryColorPreset[];
  maxNameBookEntries: number;
  handlers: SettingsPanelEventHandlers;
  root?: ParentNode;
}

const numberSettings: { id: string; prop: keyof AppSettings; readValue?: (input: HTMLInputElement) => number }[] = [
  { id: "setting-wall", prop: "wallRestitution" },
  { id: "setting-contact", prop: "contactRestitution" },
  { id: "setting-damping", prop: "linearDamping", readValue: (input) => dampingSliderToValue(input.valueAsNumber) },
  { id: "setting-flick", prop: "flickPower" },
  { id: "setting-speed", prop: "maxSpeed" },
  { id: "setting-gravity-strength", prop: "gravityStrength" },
  { id: "setting-volume", prop: "masterVolume" },
  { id: "setting-pitch", prop: "frequencyHz" },
  { id: "setting-duration", prop: "durationMs" },
  { id: "setting-descent-distance", prop: "descentMinDistanceMeters" },
];

export function bindSettingsPanelEvents(context: SettingsPanelEventContext): void {
  const root = context.root ?? document;
  bindTuningEvents(root, context.handlers);
  bindCategorySettingsEvents(root, context.categories, context.handlers);
  bindNameBookSettingsEvents(root, context.maxNameBookEntries, context.handlers);
}

function bindTuningEvents(root: ParentNode, handlers: SettingsPanelEventHandlers): void {
  const sound = root.querySelector<HTMLInputElement>("#setting-sound");
  sound?.addEventListener("change", () => {
    handlers.unlockAudio();
    handlers.updateAppSettings({ soundEnabled: sound.checked });
  });

  const gravity = root.querySelector<HTMLInputElement>("#setting-gravity");
  gravity?.addEventListener("change", () => {
    handlers.toggleGravitySensor();
  });

  const gravityDebug = root.querySelector<HTMLInputElement>("#setting-gravity-debug");
  gravityDebug?.addEventListener("change", () => {
    handlers.updateAppSettings({ gravityDebugEnabled: gravityDebug.checked });
  });

  const memoField = root.querySelector<HTMLInputElement>("#setting-memo-field");
  memoField?.addEventListener("change", () => {
    handlers.updateAppSettings({ showMemoField: memoField.checked });
  });

  const echoStrength = root.querySelector<HTMLSelectElement>("#setting-echo-strength");
  echoStrength?.addEventListener("change", () => {
    handlers.updateAppSettings({ emotionEchoStrength: readEchoStrength(echoStrength.value) });
  });

  const backgroundTexture = root.querySelector<HTMLSelectElement>("#setting-background-texture");
  backgroundTexture?.addEventListener("change", () => {
    handlers.updateAppSettings({ backgroundTexture: readBackgroundTexture(backgroundTexture.value) });
  });

  const startupScreen = root.querySelector<HTMLSelectElement>("#setting-startup-screen");
  startupScreen?.addEventListener("change", () => {
    handlers.updateAppSettings({ startupScreen: readStartupScreen(startupScreen.value) });
  });

  for (const setting of numberSettings) {
    bindNumberSetting(root, setting.id, setting.prop, handlers, setting.readValue);
  }

}

function bindCategorySettingsEvents(
  root: ParentNode,
  categories: CategoryColorPreset[],
  handlers: SettingsPanelEventHandlers,
): void {
  let currentCategories = categories;
  let feedbackTimer: number | undefined;
  const form = root.querySelector<HTMLFormElement>("#category-settings-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    currentCategories = handlers.saveCategories(readCategorySettingsForm(form, currentCategories));
  });

  form?.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.name.startsWith("category-")) {
      return;
    }
    currentCategories = handlers.saveCategories(readCategorySettingsForm(form, currentCategories));
    feedbackTimer = showCategorySettingsFeedback(target, feedbackTimer);
  });

  root.querySelector("#reset-categories")?.addEventListener("click", () => {
    const ok = window.confirm("カテゴリ設定を初期状態に戻します。現在のカテゴリ名は失われます。実行しますか？");
    if (!ok) {
      return;
    }
    handlers.resetCategories();
  });
}

function readCategorySettingsForm(
  form: HTMLFormElement,
  categories: CategoryColorPreset[],
): CategoryColorPreset[] {
  const data = new FormData(form);
  return categories.map((preset, index) => ({
    ...preset,
    name: String(data.get(`category-${index}`) || preset.name).trim() || preset.name,
  }));
}

function showCategorySettingsFeedback(
  target: HTMLElement,
  feedbackTimer: number | undefined,
): number | undefined {
  if (feedbackTimer !== undefined) {
    window.clearTimeout(feedbackTimer);
  }
  const feedback = target
    .closest(".category-edit-tone")
    ?.querySelector<HTMLElement>("[data-category-settings-feedback]");
  if (!feedback) {
    return undefined;
  }
  feedback.textContent = "反映しました";
  feedback.dataset.visible = "true";
  return window.setTimeout(() => {
    clearSettingsFeedback(feedback);
  }, 1400);
}

function clearSettingsFeedback(feedback: HTMLElement): void {
  feedback.textContent = "";
  delete feedback.dataset.visible;
}

function bindNameBookSettingsEvents(
  root: ParentNode,
  maxNameBookEntries: number,
  handlers: SettingsPanelEventHandlers,
): void {
  let feedbackTimer: number | undefined;
  const form = root.querySelector<HTMLFormElement>("#name-book-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveNameBookForm(form, maxNameBookEntries, handlers);
    feedbackTimer = showNameBookSettingsFeedback(root, feedbackTimer);
  });

  form?.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.name.startsWith("name-book-name-")) {
      return;
    }
    saveNameBookForm(form, maxNameBookEntries, handlers);
    feedbackTimer = showNameBookSettingsFeedback(root, feedbackTimer);
  });

  form?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !target.name.startsWith("name-book-role-")) {
      return;
    }
    saveNameBookForm(form, maxNameBookEntries, handlers);
    feedbackTimer = showNameBookSettingsFeedback(root, feedbackTimer);
  });

  root.querySelector("#reset-name-book")?.addEventListener("click", () => {
    const ok = window.confirm("名前帳を初期状態に戻します。保存した名前は失われます。実行しますか？");
    if (!ok) {
      return;
    }
    handlers.resetNameBook();
  });
}

function saveNameBookForm(
  form: HTMLFormElement,
  maxNameBookEntries: number,
  handlers: SettingsPanelEventHandlers,
): void {
  const entries = readNameBookForm(form, maxNameBookEntries);
  const savedEntries = handlers.saveNameBook(entries);
  syncNameBookHiddenIds(form, savedEntries, maxNameBookEntries);
}

function readNameBookForm(form: HTMLFormElement, maxNameBookEntries: number): NameBookEntry[] {
  const data = new FormData(form);
  const entries: NameBookEntry[] = [];
  for (let index = 0; index < maxNameBookEntries; index += 1) {
    const name = String(data.get(`name-book-name-${index}`) || "").trim();
    if (!name) {
      continue;
    }
    entries.push({
      id: String(data.get(`name-book-id-${index}`) || "").trim(),
      name,
      role: readUnion(data.get(`name-book-role-${index}`), ["self", "proxy"], "self"),
    });
  }
  return entries;
}

function syncNameBookHiddenIds(
  form: HTMLFormElement,
  entries: NameBookEntry[],
  maxNameBookEntries: number,
): void {
  let savedIndex = 0;
  for (let index = 0; index < maxNameBookEntries; index += 1) {
    const nameInput = form.elements.namedItem(`name-book-name-${index}`);
    const idInput = form.elements.namedItem(`name-book-id-${index}`);
    if (!(nameInput instanceof HTMLInputElement) || !(idInput instanceof HTMLInputElement)) {
      continue;
    }
    if (!nameInput.value.trim()) {
      idInput.value = "";
      continue;
    }
    idInput.value = entries[savedIndex]?.id ?? "";
    savedIndex += 1;
  }
}

function showNameBookSettingsFeedback(
  root: ParentNode,
  feedbackTimer: number | undefined,
): number | undefined {
  if (feedbackTimer !== undefined) {
    window.clearTimeout(feedbackTimer);
  }
  const feedback = root.querySelector<HTMLElement>("[data-name-book-settings-feedback]");
  if (!feedback) {
    return undefined;
  }
  feedback.textContent = "変更しました";
  feedback.dataset.visible = "true";
  return window.setTimeout(() => {
    clearSettingsFeedback(feedback);
  }, 1400);
}

function bindNumberSetting(
  root: ParentNode,
  id: string,
  prop: keyof AppSettings,
  handlers: SettingsPanelEventHandlers,
  readValue?: (input: HTMLInputElement) => number,
): void {
  const input = root.querySelector<HTMLInputElement>(`#${id}`);
  input?.addEventListener("input", () => {
    const value = readValue ? readValue(input) : Number(input.value);
    handlers.unlockAudio();
    updateRangeValue(root, id, value);
    handlers.updateAppSettings({ [prop]: value });
  });
}

function updateRangeValue(root: ParentNode, id: string, value: number): void {
  const label = root.querySelector<HTMLElement>(`#${id}-value`);
  if (label) {
    label.textContent = formatSettingValue(value);
  }
}

function readUnion<const T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
