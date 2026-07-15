export interface PanelHeaderAction {
  label: string;
  formId: string;
}

export function renderPanelOverlay(title: string, body: string, kind: string, headerAction?: PanelHeaderAction): string {
  const authoringSurfaceClass = kind === "create" ? " authoring-surface" : "";
  const authoringBackdropClass = kind === "create" ? " authoring-surface-backdrop" : "";
  const authoringHeaderClass = kind === "create" ? " authoring-surface-header" : "";
  return `
    <div class="panel-backdrop panel-backdrop-${kind} app-modal-backdrop${authoringBackdropClass}" data-close-panel>
      <aside class="floating-panel floating-panel-${kind} surface-shell${authoringSurfaceClass}" aria-label="${escapeAttribute(title)}">
        <div class="floating-panel-head surface-fixed-header${authoringHeaderClass}">
          ${headerAction
            ? `<button class="primary-action panel-header-action" type="submit" form="${escapeAttribute(headerAction.formId)}">${escapeHtml(headerAction.label)}</button>`
            : `<h2>${escapeHtml(title)}</h2>`}
          <button class="dialog-close" type="button" data-close-panel aria-label="閉じる">&times;</button>
        </div>
        <div class="surface-scroll-body app-modal-scroll" data-scroll-owner>
          ${body}
        </div>
      </aside>
    </div>
  `;
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
