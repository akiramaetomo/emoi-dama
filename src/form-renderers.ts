import { toneLabels, type CategoryColorPreset, type CategoryTone } from "./categories.js";
import { createGoogleMapsUrl, hasDescentPosition } from "./descent.js";
import {
  normalizeBallTime,
  issuerLabels,
  visibilityLabels,
  type BallDraft,
  type HappyBall,
  type NameBookEntry,
  type NameRole,
} from "./models.js";

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
      <label class="create-inline-field">
        <span>日時</span>
        <input name="date" type="date" value="${escapeAttribute(draft.date)}" />
      </label>

      ${renderCreateTimeField(draft.time)}

      <label class="create-inline-field">
        <span>玉数</span>
        <input name="count" type="number" min="1" max="12" value="${draft.count}" />
      </label>

      <label class="create-inline-field">
        <span>だれの玉</span>
        ${renderNamePresetSelect(draft.subject, context)}
      </label>

      <label class="create-inline-field">
        <span>自由入力</span>
        <input name="subject" type="text" value="${escapeAttribute(draft.subject)}" />
      </label>

      <label class="create-inline-field">
        <span>作り方</span>
        <select name="issuerType">
          ${renderOptions(issuerLabels, draft.issuerType)}
        </select>
      </label>

      <label class="create-inline-field">
        <span>見せる範囲</span>
        <select name="visibility">
          ${renderOptions(visibilityLabels, draft.visibility)}
        </select>
      </label>

      <div class="create-title-divider" aria-hidden="true"></div>

      <label class="create-inline-field">
        <span>タイトル</span>
        <input name="title" type="text" maxlength="48" value="${escapeAttribute(draft.title)}" placeholder="小さなえもいゴト" />
      </label>

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
    <div class="ball-dialog-backdrop ball-edit-dialog-backdrop" data-dialog-backdrop>
      <section class="ball-dialog ball-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="ball-edit-title">
        <button class="dialog-close" type="button" data-dialog-close aria-label="閉じる">&times;</button>
        <div class="dialog-title-block">
          <div class="edit-dialog-title-row">
            <h2 id="ball-edit-title">玉を編集</h2>
          </div>
        </div>
        <form id="ball-edit-form" class="edit-form" data-editing-ball-id="${escapeAttribute(ball.id)}">
          <label class="edit-inline-field">
            <span>日時</span>
            <input name="date" type="date" value="${escapeAttribute(ball.date)}" />
          </label>

          ${renderTimeField(ball.time, "edit-timestamp-field edit-inline-field timestamp-field-wide")}

          <label class="edit-inline-field">
            <span>玉数</span>
            <input name="count" type="number" min="1" max="12" value="${ball.count}" />
          </label>

          <label class="edit-inline-field">
            <span>だれの玉</span>
            ${renderNamePresetSelect(ball.subject, context)}
          </label>

          <label class="edit-inline-field">
            <span>自由入力</span>
            <input name="subject" type="text" value="${escapeAttribute(ball.subject)}" />
          </label>

          <label class="edit-inline-field">
            <span>作り方</span>
            <select name="issuerType">
              ${renderOptions(issuerLabels, ball.issuerType)}
            </select>
          </label>

          <label class="edit-inline-field">
            <span>見せる範囲</span>
            <select name="visibility">
              ${renderOptions(visibilityLabels, ball.visibility)}
            </select>
          </label>

          <div class="edit-title-divider" aria-hidden="true"></div>

          <label class="edit-inline-field">
            <span>タイトル</span>
            <input name="title" type="text" maxlength="48" value="${escapeAttribute(ball.title)}" />
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

          ${renderEditableDescentHistory(ball)}

          <div class="edit-lifecycle-actions" aria-label="玉のしまい方">
            ${renderArchiveToggleButton(ball)}
            <button class="lifecycle-ball" type="button" data-lifecycle-ball-id="${escapeAttribute(ball.id)}" data-lifecycle-status="offered">供養</button>
            <button class="delete-ball" type="button" data-delete-ball-id="${escapeAttribute(ball.id)}">お焚上</button>
            <button class="descend-ball" type="button" data-descend-ball-id="${escapeAttribute(ball.id)}">降臨</button>
          </div>

          <div class="dialog-actions">
            <button class="primary-action" type="submit">保存</button>
            <button class="ghost-action" type="button" data-dialog-close>キャンセル</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderCreateTimeField(time: string | undefined): string {
  const normalizedTime = normalizeBallTime(time);
  const checked = normalizedTime ? " checked" : "";
  const disabled = normalizedTime ? "" : " disabled";

  return `
    <div class="timestamp-field create-timestamp-field create-inline-field">
      <span>時刻記録</span>
      <div class="timestamp-control">
        <label class="timestamp-toggle" aria-label="時刻を記録">
          <input type="checkbox" name="timeEnabled"${checked} />
        </label>
        <button class="timestamp-now-button" type="button" data-current-time-button>現在時刻</button>
        <input name="time" type="time" value="${escapeAttribute(normalizedTime ?? "")}"${disabled} />
      </div>
    </div>
  `;
}

function renderTimeField(time: string | undefined, className = ""): string {
  const normalizedTime = normalizeBallTime(time);
  const checked = normalizedTime ? " checked" : "";
  const disabled = normalizedTime ? "" : " disabled";
  const fieldClass = className ? ` timestamp-field ${className}` : " timestamp-field";

  return `
    <div class="${fieldClass.trim()}">
      <span>時刻記録</span>
      <div class="timestamp-control">
        <label class="timestamp-toggle" aria-label="時刻を記録">
          <input type="checkbox" name="timeEnabled"${checked} />
        </label>
        <button class="timestamp-now-button" type="button" data-current-time-button>現在時刻</button>
        <input name="time" type="time" value="${escapeAttribute(normalizedTime ?? "")}"${disabled} />
      </div>
    </div>
  `;
}

function renderArchiveToggleButton(ball: HappyBall): string {
  if (ball.lifecycleStatus === "archived") {
    return `<button class="lifecycle-ball" type="button" data-lifecycle-ball-id="${escapeAttribute(ball.id)}" data-lifecycle-status="active" aria-label="通常表示に戻す">戻す</button>`;
  }
  return `<button class="lifecycle-ball" type="button" data-lifecycle-ball-id="${escapeAttribute(ball.id)}" data-lifecycle-status="archived" aria-label="玉をしまう">しまう</button>`;
}

function renderEditableDescentHistory(ball: HappyBall): string {
  const descents = ball.descents ?? [];
  const badgeCount = ball.descentBadgeCount ?? 0;
  if (descents.length === 0 && badgeCount === 0 && !ball.isKamiBall) {
    return "";
  }
  const primary = descents[descents.length - 1];
  const folded = descents.slice(0, -1).reverse();
  return `
    <section class="edit-descent-history" aria-label="降臨情報">
      <div class="edit-descent-head">
        <span class="descent-section-label">降臨情報</span>
      </div>
      ${primary ? renderEditableDescentItem(primary) : ""}
      ${folded.length > 0 ? `
        <details class="edit-descent-more">
          <summary>ほかの降臨を見る（${folded.length}回）</summary>
          ${folded.map(renderEditableDescentItem).join("")}
        </details>
      ` : ""}
    </section>
  `;
}

function renderEditableDescentItem(record: NonNullable<HappyBall["descents"]>[number]): string {
  const hasPosition = hasDescentPosition(record);
  const latitude = hasPosition ? String(record.latitude) : "";
  const longitude = hasPosition ? String(record.longitude) : "";
  const accuracy = typeof record.accuracyMeters === "number" ? String(record.accuracyMeters) : "";
  const distance = typeof record.distanceFromPreviousMeters === "number" ? String(record.distanceFromPreviousMeters) : "";
  return `
    <article class="edit-descent-item" data-descent-edit-item data-descent-id="${escapeAttribute(record.id)}">
      <input type="hidden" data-descent-field="id" value="${escapeAttribute(record.id)}" />
      <input type="hidden" data-descent-field="sequence" value="${record.sequence}" />
      <input type="hidden" data-descent-field="recordedAt" value="${escapeAttribute(record.recordedAt)}" />
      <input type="hidden" data-descent-field="badgeAwarded" value="${record.badgeAwarded ? "true" : "false"}" />
      <input type="hidden" data-descent-field="latitude" value="${escapeAttribute(latitude)}" />
      <input type="hidden" data-descent-field="longitude" value="${escapeAttribute(longitude)}" />
      <input type="hidden" data-descent-field="accuracyMeters" value="${escapeAttribute(accuracy)}" />
      <input type="hidden" data-descent-field="distanceFromPreviousMeters" value="${escapeAttribute(distance)}" />
      <div class="edit-descent-item-head">
        <strong>No.${record.sequence}</strong>
        <span>${escapeHtml(formatDescentDateTime(record.recordedAt))}</span>
      </div>
      <label class="inline-field textarea-field edit-descent-memo">
        <span>降臨メモ</span>
        <textarea data-descent-field="memo" rows="2" maxlength="80">${escapeHtml(record.memo)}</textarea>
      </label>
      <div class="edit-descent-gps-row">
        <span data-descent-gps-status>${hasPosition ? escapeHtml(formatCoordinates(record.latitude, record.longitude)) : "位置未取得"}</span>
        ${hasPosition ? `<a class="ghost-action detail-map-link" data-descent-map-link href="${escapeAttribute(createGoogleMapsUrl(record))}" target="_blank" rel="noopener noreferrer">Google Maps</a>` : `<span data-descent-map-link></span>`}
      </div>
      <div class="edit-descent-actions">
        <button class="ghost-action" type="button" data-descent-gps-record-id="${escapeAttribute(record.id)}">${hasPosition ? "GPS再取得" : "GPS取得"}</button>
        <button class="ghost-action" type="button" data-descent-clear-gps-record-id="${escapeAttribute(record.id)}"${hasPosition ? "" : " disabled"}>GPS削除</button>
      </div>
    </article>
  `;
}

function formatDescentDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
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
