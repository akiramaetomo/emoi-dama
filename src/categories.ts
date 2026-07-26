export type CategoryTone = "bright" | "dark" | "neutral" | "future";
export type CategoryVisualKind = "filled" | "ring";

export interface CategoryColorPreset {
  name: string;
  tone: CategoryTone;
  hue: number;
  saturation: number;
  lightness: number;
  visualKind: CategoryVisualKind;
}

export const toneLabels: Record<CategoryTone, string> = {
  bright: "明るい系",
  dark: "ダーク系",
  neutral: "ニュートラル",
  future: "先々",
};

export const categoryColorPresets: CategoryColorPreset[] = [
  { name: "よろこび", tone: "bright", hue: 0, saturation: 70, lightness: 57, visualKind: "filled" },
  { name: "ひらめき", tone: "bright", hue: 43, saturation: 73, lightness: 58, visualKind: "filled" },
  { name: "やさしさ", tone: "bright", hue: 139, saturation: 62, lightness: 43, visualKind: "filled" },
  { name: "安心", tone: "bright", hue: 210, saturation: 67, lightness: 49, visualKind: "filled" },
  { name: "ときめき", tone: "bright", hue: 334, saturation: 64, lightness: 64, visualKind: "filled" },
  { name: "祝福", tone: "bright", hue: 261, saturation: 71, lightness: 57, visualKind: "filled" },
  { name: "しずけさ", tone: "dark", hue: 227, saturation: 0, lightness: 24, visualKind: "filled" },
  { name: "余韻", tone: "dark", hue: 14, saturation: 42, lightness: 27, visualKind: "filled" },
  { name: "祈り", tone: "dark", hue: 230, saturation: 50, lightness: 24, visualKind: "filled" },
  { name: "覚悟", tone: "dark", hue: 350, saturation: 44, lightness: 24, visualKind: "filled" },
  { name: "夜明け前", tone: "dark", hue: 46, saturation: 41, lightness: 18, visualKind: "filled" },
  { name: "深呼吸", tone: "dark", hue: 148, saturation: 44, lightness: 16, visualKind: "filled" },
  { name: "日常", tone: "neutral", hue: 92, saturation: 22, lightness: 54, visualKind: "filled" },
  { name: "記録", tone: "neutral", hue: 288, saturation: 16, lightness: 55, visualKind: "filled" },
  { name: "感謝", tone: "neutral", hue: 0, saturation: 21, lightness: 51, visualKind: "filled" },
  { name: "家族", tone: "neutral", hue: 38, saturation: 16, lightness: 50, visualKind: "filled" },
  { name: "仕事", tone: "neutral", hue: 206, saturation: 35, lightness: 48, visualKind: "filled" },
  { name: "供養", tone: "neutral", hue: 278, saturation: 0, lightness: 65, visualKind: "filled" },
  { name: "先々・期待", tone: "future", hue: 41, saturation: 87, lightness: 58, visualKind: "ring" },
  { name: "先々・楽しみ", tone: "future", hue: 327, saturation: 77, lightness: 66, visualKind: "ring" },
  { name: "先々・重要", tone: "future", hue: 114, saturation: 75, lightness: 50, visualKind: "ring" },
  { name: "先々・不安", tone: "future", hue: 0, saturation: 76, lightness: 55, visualKind: "ring" },
  { name: "先々・仕事", tone: "future", hue: 191, saturation: 76, lightness: 36, visualKind: "ring" },
  { name: "先々・予定", tone: "future", hue: 47, saturation: 15, lightness: 86, visualKind: "ring" },
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
