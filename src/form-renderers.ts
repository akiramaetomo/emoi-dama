import { toneLabels, type CategoryColorPreset, type CategoryTone } from "./categories";
import {
  issuerLabels,
  visibilityLabels,
  type BallDraft,
  type HappyBall,
  type NameBookEntry,
  type NameRole,
} from "./models";

export interface FormRenderContext {
  categories: CategoryColorPreset[];
  nameBook: NameBookEntry[];
}

const nameRoleLabels: Record<NameRole, string> = {
  self: "自分",
  proxy: "代理",
};

export function renderCreateForm(draft: BallDraft, context: FormRenderContext): string {
  return `
    <form id="ball-form" class="create-form">
      <div class="form-row two">
        <label>
          <span>日付</span>
          <input name="date" type="date" value="${escapeAttribute(draft.date)}" />
        </label>
        <label>
          <span>玉数</span>
          <input name="count" type="number" min="1" max="12" value="${draft.count}" />
        </label>
      </div>

      <label>
        <span>だれの玉？</span>
        ${renderNamePresetSelect(draft.subject, context)}
        <input name="subject" type="text" value="${escapeAttribute(draft.subject)}" />
        <small class="form-hint">登録名選択または自由に入力</small>
      </label>

      <label>
        <span>作り方</span>
        <select name="issuerType">
          ${renderOptions(issuerLabels, draft.issuerType)}
        </select>
      </label>

      <label>
        <span>タイトル</span>
        <input name="title" type="text" maxlength="48" value="${escapeAttribute(draft.title)}" placeholder="小さなえもいゴト" />
      </label>

      <div class="form-row two">
        <label>
          <span>見せる範囲</span>
          <select name="visibility">
            ${renderOptions(visibilityLabels, draft.visibility)}
          </select>
        </label>
      </div>

      ${renderCategoryPalette(draft.category, context)}

      <label>
        <span>メモ</span>
        <textarea name="note" rows="3" maxlength="180">${escapeHtml(draft.note)}</textarea>
      </label>

      <div class="button-row">
        <button class="primary-action" type="submit">玉を置く</button>
      </div>
    </form>
  `;
}

export function renderBallEditDialog(ball: HappyBall, context: FormRenderContext): string {
  return `
    <div class="ball-dialog-backdrop" data-dialog-backdrop>
      <section class="ball-dialog" role="dialog" aria-modal="true" aria-labelledby="ball-edit-title">
        <button class="dialog-close" type="button" data-dialog-close aria-label="閉じる">&times;</button>
        <div class="dialog-title-block">
          <div class="edit-dialog-title-row">
            <h2 id="ball-edit-title">玉を編集</h2>
          </div>
        </div>
        <form id="ball-edit-form" class="edit-form" data-editing-ball-id="${escapeAttribute(ball.id)}">
          <div class="edit-inline-grid two">
            <label class="inline-field">
              <span>日付</span>
              <input name="date" type="date" value="${escapeAttribute(ball.date)}" />
            </label>
            <label class="inline-field">
              <span>玉数</span>
              <input name="count" type="number" min="1" max="12" value="${ball.count}" />
            </label>
          </div>

          <label class="inline-field">
            <span>だれの玉？</span>
            <div class="inline-field-stack">
              ${renderNamePresetSelect(ball.subject, context)}
              <input name="subject" type="text" value="${escapeAttribute(ball.subject)}" placeholder="自由に入力" />
            </div>
          </label>

          <label class="inline-field">
            <span>作り方</span>
            <select name="issuerType">
              ${renderOptions(issuerLabels, ball.issuerType)}
            </select>
          </label>

          <label class="inline-field">
            <span>タイトル</span>
            <input name="title" type="text" maxlength="48" value="${escapeAttribute(ball.title)}" />
          </label>

          <label class="inline-field">
            <span>見せる範囲</span>
            <select name="visibility">
              ${renderOptions(visibilityLabels, ball.visibility)}
            </select>
          </label>

          <details class="edit-category-fold">
            <summary>
              <span>カテゴリ</span>
              ${renderCurrentCategoryBadge(ball.category, context)}
            </summary>
            ${renderCategoryPalette(ball.category, context)}
          </details>

          <label class="inline-field textarea-field">
            <span>メモ</span>
            <textarea name="note" rows="4" maxlength="180">${escapeHtml(ball.note)}</textarea>
          </label>

          <div class="dialog-actions">
            <button class="primary-action" type="submit">保存</button>
            <button class="ghost-action" type="button" data-dialog-close>キャンセル</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

export function renderOptions<T extends string>(labels: Record<T, string>, selected: T): string {
  return Object.entries(labels)
    .map(([value, label]) => {
      const isSelected = value === selected ? " selected" : "";
      return `<option value="${escapeAttribute(value)}"${isSelected}>${escapeHtml(String(label))}</option>`;
    })
    .join("");
}

function renderNamePresetSelect(selectedName: string, context: FormRenderContext): string {
  if (context.nameBook.length === 0) {
    return "";
  }

  const options = context.nameBook.map((entry) => {
    const selected = entry.name === selectedName ? " selected" : "";
    return `
      <option value="${escapeAttribute(entry.name)}" data-name-role="${entry.role}"${selected}>
        ${escapeHtml(entry.name)}（${escapeHtml(nameRoleLabels[entry.role])}）
      </option>
    `;
  }).join("");

  return `
    <select class="name-preset-select" data-name-preset aria-label="登録名から選ぶ">
      <option value="">登録名から選ぶ</option>
      ${options}
    </select>
  `;
}

function renderCurrentCategoryBadge(category: string, context: FormRenderContext): string {
  const preset = context.categories.find((item) => item.name === category) ?? context.categories[0];
  const visualStyle = preset ? renderVisualStyle(preset) : "";

  return `
    <span class="edit-category-current">
      <span class="category-swatch ${preset ? renderVisualKindClass(preset) : ""}" style="${visualStyle}" aria-hidden="true"></span>
      <strong>${escapeHtml(category || preset?.name || "日常")}</strong>
    </span>
  `;
}

function renderCategoryPalette(selectedCategory: string, context: FormRenderContext): string {
  const tones: CategoryTone[] = ["bright", "dark", "neutral", "future"];
  const selected = context.categories.some((preset) => preset.name === selectedCategory)
    ? selectedCategory
    : context.categories[0]?.name ?? "日常";

  return `
    <fieldset class="category-palette">
      <legend>カテゴリ</legend>
      ${tones.map((tone) => `
        <div class="category-tone">
          <span>${escapeHtml(toneLabels[tone])}</span>
          <div class="category-options">
            ${context.categories
              .filter((preset) => preset.tone === tone)
              .map((preset) => {
                const checked = preset.name === selected ? " checked" : "";
                return `
                  <label class="category-option">
                    <input type="radio" name="category" value="${escapeAttribute(preset.name)}"${checked} />
                    <span class="category-swatch ${renderVisualKindClass(preset)}" style="${renderVisualStyle(preset)}" aria-hidden="true"></span>
                    <span>${escapeHtml(preset.name)}</span>
                  </label>
                `;
              }).join("")}
          </div>
        </div>
      `).join("")}
    </fieldset>
  `;
}

function renderVisualKindClass(visual: { visualKind?: string; kind?: string }): string {
  return visual.visualKind === "ring" || visual.kind === "ring" ? "is-ring-ball" : "is-filled-ball";
}

function renderVisualStyle(visual: { hue: number; saturation: number; lightness: number }): string {
  return `--ball-hue: ${visual.hue}; --ball-saturation: ${visual.saturation}%; --ball-lightness: ${visual.lightness}%;`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
