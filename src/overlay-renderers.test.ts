import { renderPanelOverlay } from "./overlay-renderers.js";

const html = renderPanelOverlay("玉を置く", '<form id="ball-form"></form>', "create", {
  label: "玉を置く",
  formId: "ball-form",
});

assert(html.includes("app-modal-backdrop"), "create overlay should use the shared fixed modal backdrop");
assert(html.includes("app-modal-scroll"), "create overlay should expose one shared modal scroll region");
assert(html.indexOf("surface-fixed-header") < html.indexOf("surface-scroll-body"), "create header should remain outside its scroll owner");
assert(html.includes("authoring-surface-backdrop"), "create overlay should use the shared authoring backdrop contract");
assert(html.includes("authoring-surface-header"), "create overlay should use the shared authoring header contract");
assert(html.includes('class="primary-action panel-header-action"'), "create header should render a primary action instead of a text title");
assert(html.includes('type="submit" form="ball-form">玉を置く</button>'), "create header action should submit the create form");
assert(!html.includes("<h2>玉を置く</h2>"), "create header should replace its text title with the action");
assert(html.indexOf("panel-header-action") < html.indexOf('class="dialog-close"'), "create header should place its action before close in DOM and tab order");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
