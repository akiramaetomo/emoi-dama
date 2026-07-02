export function renderPanelOverlay(title: string, body: string, kind: string): string {
  return `
    <div class="panel-backdrop panel-backdrop-${kind}" data-close-panel>
      <aside class="floating-panel floating-panel-${kind}" aria-label="${escapeAttribute(title)}">
        <div class="floating-panel-head">
          <h2>${escapeHtml(title)}</h2>
          <button class="dialog-close" type="button" data-close-panel aria-label="閉じる">&times;</button>
        </div>
        ${body}
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
