export type CategoryTone = "bright" | "dark" | "neutral";

export interface CategoryColorPreset {
  name: string;
  tone: CategoryTone;
  hue: number;
  saturation: number;
  lightness: number;
}

export const toneLabels: Record<CategoryTone, string> = {
  bright: "明るい系",
  dark: "ダーク系",
  neutral: "ニュートラル",
};

export const categoryColorPresets: CategoryColorPreset[] = [
  { name: "よろこび", tone: "bright", hue: 18, saturation: 64, lightness: 62 },
  { name: "ひらめき", tone: "bright", hue: 43, saturation: 68, lightness: 58 },
  { name: "やさしさ", tone: "bright", hue: 118, saturation: 40, lightness: 58 },
  { name: "安心", tone: "bright", hue: 176, saturation: 42, lightness: 58 },
  { name: "ときめき", tone: "bright", hue: 334, saturation: 54, lightness: 64 },
  { name: "祝福", tone: "bright", hue: 266, saturation: 48, lightness: 66 },
  { name: "しずけさ", tone: "dark", hue: 190, saturation: 36, lightness: 36 },
  { name: "余韻", tone: "dark", hue: 234, saturation: 32, lightness: 40 },
  { name: "祈り", tone: "dark", hue: 286, saturation: 30, lightness: 38 },
  { name: "覚悟", tone: "dark", hue: 350, saturation: 38, lightness: 37 },
  { name: "夜明け前", tone: "dark", hue: 216, saturation: 28, lightness: 34 },
  { name: "深呼吸", tone: "dark", hue: 148, saturation: 34, lightness: 36 },
  { name: "日常", tone: "neutral", hue: 92, saturation: 22, lightness: 54 },
  { name: "記録", tone: "neutral", hue: 38, saturation: 16, lightness: 58 },
  { name: "感謝", tone: "neutral", hue: 22, saturation: 30, lightness: 55 },
  { name: "家族", tone: "neutral", hue: 54, saturation: 18, lightness: 60 },
  { name: "仕事", tone: "neutral", hue: 204, saturation: 20, lightness: 52 },
  { name: "供養", tone: "neutral", hue: 278, saturation: 16, lightness: 52 },
];

const CATEGORY_SETTINGS_KEY = "happyBall.categories.v1";

export function loadCategoryColorPresets(): CategoryColorPreset[] {
  try {
    const stored = localStorage.getItem(CATEGORY_SETTINGS_KEY);
    return stored ? normalizeCategoryColorPresets(JSON.parse(stored)) : cloneDefaultCategoryColorPresets();
  } catch {
    return cloneDefaultCategoryColorPresets();
  }
}

export function saveCategoryColorPresets(presets: CategoryColorPreset[]): CategoryColorPreset[] {
  const normalized = normalizeCategoryColorPresets(presets);
  localStorage.setItem(CATEGORY_SETTINGS_KEY, JSON.stringify(normalized, null, 2));
  return normalized;
}

export function resetCategoryColorPresets(): CategoryColorPreset[] {
  const presets = cloneDefaultCategoryColorPresets();
  localStorage.removeItem(CATEGORY_SETTINGS_KEY);
  return presets;
}

export function findCategoryColorPreset(category: string): CategoryColorPreset | undefined {
  const normalized = category.trim();
  return loadCategoryColorPresets().find((preset) => preset.name === normalized);
}

export function getCategoryColorPreset(category: string): CategoryColorPreset {
  const presets = loadCategoryColorPresets();
  return findCategoryColorPreset(category) ?? presets.find((preset) => preset.name === "日常") ?? presets[0];
}

export function normalizeCategoryColorPresets(value: unknown): CategoryColorPreset[] {
  const source = Array.isArray(value) ? value : [];
  const used = new Set<string>();
  return categoryColorPresets.map((defaults, index) => {
    const item = source[index] as Partial<CategoryColorPreset> | undefined;
    const candidate = typeof item?.name === "string" && item.name.trim()
      ? item.name.trim().slice(0, 12)
      : defaults.name;
    const name = used.has(candidate) ? defaults.name : candidate;
    used.add(name);
    return { ...defaults, name };
  });
}

function cloneDefaultCategoryColorPresets(): CategoryColorPreset[] {
  return categoryColorPresets.map((preset) => ({ ...preset }));
}
