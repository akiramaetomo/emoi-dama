import { renderPanelOverlay } from "./overlay-renderers.js";

const html = renderPanelOverlay("玉を置く", '<form id="ball-form"></form>', "create", {
  label: "保存",
  formId: "ball-form",
});

assert(html.includes("app-modal-backdrop"), "create overlay should use the shared fixed modal backdrop");
assert(html.includes("app-modal-scroll"), "create overlay should expose one shared modal scroll region");
assert(html.indexOf("surface-fixed-header") < html.indexOf("surface-scroll-body"), "create header should remain outside its scroll owner");
assert(html.includes("authoring-surface-backdrop"), "create overlay should use the shared authoring backdrop contract");
assert(html.includes("authoring-surface-header"), "create overlay should use the shared authoring header contract");
assert(html.includes("<h2>玉を置く</h2>"), "create header should retain a non-interactive screen title");
assert(html.includes('class="primary-action panel-header-action"'), "create header should render a primary save action beside the title");
assert(html.includes('type="submit" form="ball-form">保存</button>'), "create header action should submit the create form with the shared save label");
assert(html.indexOf("panel-header-action") < html.indexOf('class="dialog-close"'), "create header should place its action before close in DOM and tab order");

const settingsHtml = renderPanelOverlay("設定とデータ", "<div>設定本文</div>", "settings", undefined, '<div data-test-upper-bar></div>');
assert(settingsHtml.includes("upper-control-surface"), "Settings should claim its own control surface when supplied");
assert(settingsHtml.indexOf("surface-scroll-body") < settingsHtml.indexOf("data-test-upper-bar"), "Settings controls should follow the internal scroll region");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
