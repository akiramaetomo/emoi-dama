export function renderManualCopyDialog(text: string): string {
  return `
    <div class="ball-dialog-backdrop" data-manual-copy-backdrop>
      <section class="ball-dialog manual-copy-dialog app-modal-scroll" data-scroll-owner role="dialog" aria-modal="true" aria-labelledby="manual-copy-title">
        <button class="dialog-close" type="button" data-manual-copy-close aria-label="閉じる">&times;</button>
        <div class="dialog-title-block">
          <span>コピー補助</span>
          <h2 id="manual-copy-title">自動コピーできませんでした</h2>
        </div>
        <p class="dialog-detail">下の欄は全選択されています。端末のコピー操作でコピーしてください。</p>
        <textarea class="manual-copy-text" data-text-selectable rows="10" readonly>${escapeHtml(text)}</textarea>
      </section>
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
