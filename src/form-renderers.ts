import { toneLabels, type CategoryColorPreset, type CategoryTone } from "./categories.js";
import { createGoogleMapsUrl, hasDescentPosition } from "./descent.js";
import {
  BALL_COUNT_SLIDER_MAX,
  BALL_COUNT_SLIDER_MIN,
  BALL_COUNT_SLIDER_EMPHASIS,
  ballCountToSliderPosition,
  ballCountToTrackPercent,
  formatBallCount,
  isLegacyBallCount,
  sliderPositionToBallCount,
} from "./ball-count-slider.js";
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

export type EditSaveConfirmReason = "save" | "close";

const nameRoleLabels: Record<NameRole, string> = {
  self: "自分",
  proxy: "代理",
};

export function renderCreateForm(draft: BallDraft, context: FormRenderContext): string {
  return `
    <form id="ball-form" class="create-form" autocomplete="off">
      ${renderBallAuthoringFields(draft, context, "create")}

      <div class="button-row">
        <button class="primary-action" type="submit">玉を置く</button>
      </div>
    </form>
  `;
}

export function renderBallEditDialog(ball: HappyBall, context: FormRenderContext): string {
  return `
    <div class="ball-dialog-backdrop ball-edit-dialog-backdrop app-modal-backdrop authoring-surface-backdrop" data-dialog-backdrop>
      <section class="ball-dialog ball-edit-dialog surface-shell authoring-surface" role="dialog" aria-modal="true" aria-labelledby="ball-edit-title">
        <div class="surface-fixed-header edit-surface-header authoring-surface-header">
          <h2 id="ball-edit-title">玉を編集</h2>
          <div class="edit-header-actions">
            <button class="panel-header-action primary-action edit-header-save" type="submit" form="ball-edit-form">保存</button>
            <button class="dialog-close" type="button" data-dialog-close aria-label="閉じる">&times;</button>
          </div>
        </div>
        <div class="surface-scroll-body app-modal-scroll" data-scroll-owner>
          <form id="ball-edit-form" class="edit-form" autocomplete="off" data-editing-ball-id="${escapeAttribute(ball.id)}">
          ${renderBallAuthoringFields(ball, context, "edit")}

          ${renderEditableDescentHistory(ball)}

          <div class="edit-lifecycle-actions" aria-label="玉のしまい方">
            ${renderArchiveToggleButton(ball)}
            <button class="lifecycle-ball" type="button" data-lifecycle-ball-id="${escapeAttribute(ball.id)}" data-lifecycle-status="offered">供養</button>
            <button class="delete-ball" type="button" data-delete-ball-id="${escapeAttribute(ball.id)}">お焚上</button>
          </div>

          <div class="dialog-actions">
            <button class="primary-action" type="submit">保存</button>
            <button class="ghost-action" type="button" data-dialog-close>キャンセル</button>
          </div>
          </form>
        </div>
      </section>
    </div>
  `;
}

function renderBallAuthoringFields(
  value: BallDraft | HappyBall,
  context: FormRenderContext,
  mode: "create" | "edit",
): string {
  const inlineClass = `${mode}-inline-field`;
  const timeField = mode === "create"
    ? renderCreateTimeField(value.time)
    : renderTimeField(value.time, "edit-timestamp-field edit-inline-field timestamp-field-wide");
  return `
      <div class="authoring-primary-fields" data-authoring-primary-fields>
        <label class="authoring-inset-field authoring-title-field ${mode}-inset-field" data-ball-authoring-title-field>
          <span class="authoring-inset-label">タイトル</span>
          <input name="title" type="text" maxlength="48" value="${escapeAttribute(value.title)}" placeholder="タイトル" />
        </label>

        <label class="authoring-inset-field authoring-memo-field ${mode}-inset-field" data-ball-authoring-memo-field>
          <span class="authoring-inset-label">メモ</span>
          <textarea name="note" rows="4" maxlength="180" placeholder="メモ" autocomplete="off">${escapeHtml(value.note)}</textarea>
        </label>
      </div>
      <p class="authoring-ime-hint">キーボードは入力欄以外タップで閉じられます</p>

      <details class="authoring-category-fold ${mode}-category-fold" data-authoring-category-fold>
        <summary>
          <span>カテゴリ</span>
          ${renderCurrentCategoryBadge(value.category, context)}
        </summary>
        ${renderCategoryPalette(value.category, context)}
      </details>
      ${mode === "edit" ? renderEchoCategory((value as HappyBall).emotionEcho) : ""}

      <div class="authoring-datetime-group ${mode}-datetime-group" data-authoring-datetime-group>
        <label class="${inlineClass}">
          <span>日時</span>
          <input name="date" type="date" value="${escapeAttribute(value.date)}" />
        </label>

        ${timeField}
      </div>

      <div class="authoring-context-divider ${mode}-context-divider" data-authoring-context-divider aria-hidden="true"></div>

      ${renderSubjectField(value.subject, context, mode)}

      ${renderBallCountControl(value.count, mode)}

      <label class="${inlineClass}">
        <span>作り方</span>
        <select name="issuerType">
          ${renderOptions(issuerLabels, value.issuerType)}
        </select>
      </label>

      <label class="${inlineClass}">
        <span>見せる範囲</span>
        <select name="visibility">
          ${renderOptions(visibilityLabels, value.visibility)}
        </select>
      </label>
  `;
}

function renderEchoCategory(emotionEcho: HappyBall["emotionEcho"]): string {
  const visual = emotionEcho?.visual;
  return `
    <div class="authoring-echo-category" data-authoring-echo-category>
      <span>余韻</span>
      <span class="authoring-echo-category-value">
        ${visual ? `<span class="category-swatch ${renderVisualKindClass(visual)}" style="${renderVisualStyle(visual)}" aria-hidden="true"></span>` : ""}
        <strong>${escapeHtml(emotionEcho?.category ?? "なし")}</strong>
      </span>
    </div>
  `;
}

export function renderBallCountControl(count: number, mode: "create" | "edit"): string {
  const preserveLegacy = mode === "edit" && isLegacyBallCount(count);
  const initialCount = preserveLegacy
    ? Math.round(count)
    : sliderPositionToBallCount(ballCountToSliderPosition(count));
  const position = preserveLegacy ? BALL_COUNT_SLIDER_MAX : ballCountToSliderPosition(initialCount);
  const positionPercent = ballCountToTrackPercent(sliderPositionToBallCount(position));
  const inputId = `${mode}-ball-count-range`;
  return `
    <div class="ball-count-field ${mode}-ball-count-field" data-ball-count-control>
      <span class="ball-count-field-label">玉数</span>
      <div class="ball-count-control-body">
        <input name="count" type="hidden" value="${initialCount}" />
        ${preserveLegacy ? `
          <div class="ball-count-legacy" data-ball-count-legacy>
            <strong>既存値 ${formatBallCount(initialCount)}</strong>
            <button class="ghost-action" type="button" data-ball-count-convert>最寄りの公開目盛へ変更</button>
          </div>
        ` : ""}
        <div class="ball-count-slider" data-ball-count-slider${preserveLegacy ? " hidden" : ""}>
          <output id="${inputId}-output" for="${inputId}" data-ball-count-output aria-live="polite">${formatBallCount(sliderPositionToBallCount(position))}</output>
          <div class="ball-count-range-stack">
            <input
              id="${inputId}"
              type="range"
              min="${BALL_COUNT_SLIDER_MIN}"
              max="${BALL_COUNT_SLIDER_MAX}"
              step="1"
              value="${position}"
              aria-label="玉数"
              aria-valuetext="${formatBallCount(sliderPositionToBallCount(position))}"
              data-ball-count-range
            />
            <div class="ball-count-visual-control" data-ball-count-track style="--ball-count-position: ${positionPercent}%" aria-hidden="true">
              <span class="ball-count-rail"></span>
              <span class="ball-count-thumb-hit" data-ball-count-thumb data-horizontal-drag-control>
                <span class="ball-count-thumb-core"></span>
              </span>
            </div>
            <div class="ball-count-ticks" aria-hidden="true">
              ${renderBallCountTicks()}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderBallCountTicks(): string {
  const length = BALL_COUNT_SLIDER_MAX - BALL_COUNT_SLIDER_MIN + 1;
  return Array.from({ length }, (_, index) => {
    const position = BALL_COUNT_SLIDER_MIN + index;
    const count = sliderPositionToBallCount(position);
    const percent = `${ballCountToTrackPercent(count).toFixed(6).replace(/\.?0+$/, "")}%`;
    const classes = position === BALL_COUNT_SLIDER_EMPHASIS ? "ball-count-tick is-emphasized" : "ball-count-tick";
    return `<span class="${classes}" style="--ball-count-position: ${percent}" data-ball-count-tick="${count}"><i></i><b>${count}</b></span>`;
  }).join("");
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
        <button class="timestamp-now-button quiet-accent-action" type="button" data-current-time-button>現在時刻</button>
        <input name="time" type="time" value="${escapeAttribute(normalizedTime ?? "")}"${disabled} />
      </div>
    </div>
  `;
}

function renderSubjectField(subject: string, context: FormRenderContext, mode: "create" | "edit"): string {
  const fieldClass = mode === "create" ? "create-inline-field" : "edit-inline-field";
  const inputId = `${mode}-ball-subject`;
  return `
    <div class="${fieldClass} subject-field">
      <span class="subject-field-label">だれの玉</span>
      <div class="subject-controls">
        <input id="${inputId}" name="subject" type="text" value="${escapeAttribute(subject)}" placeholder="名前を自由に入力" aria-label="だれの玉を自由入力" />
        ${renderNamePresetSelect(subject, context)}
      </div>
    </div>
  `;
}

export function renderEditSaveModeConfirm(reason: EditSaveConfirmReason): string {
  const isClose = reason === "close";
  return `
    <section class="edit-unsaved-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-unsaved-title">
      <h3 id="edit-unsaved-title">${isClose ? "保存しますか？" : "保存方法を選んでください"}</h3>
      <p>${isClose ? "変更した内容があります。" : "前の状態を余韻に残すか、訂正として保存できます。"}</p>
      <div class="edit-unsaved-actions">
        <button class="primary-action" type="button" data-edit-save-correction>訂正として保存</button>
        <button class="ghost-action" type="button" data-edit-save-echo>余韻として保存</button>
        <button class="ghost-action" type="button" data-edit-continue>編集を続ける</button>
        ${isClose ? `<button class="ghost-action danger-action" type="button" data-edit-discard-close>保存せず閉じる</button>` : ""}
      </div>
    </section>
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
        <button class="timestamp-now-button quiet-accent-action" type="button" data-current-time-button>現在時刻</button>
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

export function renderEditableDescentHistory(ball: HappyBall): string {
  const descents = ball.descents ?? [];
  const primary = descents[descents.length - 1];
  const folded = descents.slice(0, -1).reverse();
  return `
    <section class="edit-descent-history" aria-label="降臨">
      <div class="edit-descent-head">
        <button class="descend-ball ghost-action quiet-accent-action" type="button" data-descend-ball-id="${escapeAttribute(ball.id)}">降臨</button>
        <span class="edit-descent-feedback" data-edit-descent-feedback role="status" aria-live="polite"></span>
      </div>
      ${primary ? renderEditableDescentItem(primary) : '<p class="edit-descent-empty">降臨なし</p>'}
      ${folded.length > 0 ? `
        <details class="edit-descent-more">
          <summary>ほかの降臨を見る（${folded.length}回）</summary>
          ${folded.map(renderEditableDescentItem).join("")}
        </details>
      ` : ""}
    </section>
  `;
}

export function renderEditableDescentItem(record: NonNullable<HappyBall["descents"]>[number]): string {
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
        <button class="ghost-action descent-record-delete" type="button" data-descent-delete-record-id="${escapeAttribute(record.id)}" aria-label="No.${record.sequence}の降臨dataを消去">消去</button>
      </div>
      <label class="authoring-inset-field edit-descent-memo">
        <span class="authoring-inset-label">降臨メモ</span>
        <textarea data-descent-field="memo" rows="1" maxlength="80" placeholder="降臨メモ" autocomplete="off">${escapeHtml(record.memo)}</textarea>
      </label>
      <div class="edit-descent-location-row${hasPosition ? " has-position" : " is-empty-position"}">
        <span data-descent-gps-status>${hasPosition ? escapeHtml(formatCoordinates(record.latitude, record.longitude)) : "位置未取得"}</span>
        ${hasPosition ? `<a class="ghost-action quiet-accent-action detail-map-link" data-descent-map-link href="${escapeAttribute(createGoogleMapsUrl(record))}" target="_blank" rel="noopener noreferrer">Google Maps</a>` : `<span data-descent-map-link></span>`}
        <button class="ghost-action quiet-accent-action" type="button" data-descent-gps-record-id="${escapeAttribute(record.id)}">${hasPosition ? "GPS再取得" : "GPS取得"}</button>
        <button class="ghost-action quiet-accent-action" type="button" data-descent-clear-gps-record-id="${escapeAttribute(record.id)}"${hasPosition ? "" : " disabled"}>GPS削除</button>
        <span class="edit-descent-action-feedback" data-descent-action-feedback role="status" aria-live="polite"></span>
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
