import { renderPanelOverlay } from "./overlay-renderers.js";

const html = renderPanelOverlay("玉を置く", "<form></form>", "create");

assert(html.includes("app-modal-backdrop"), "create overlay should use the shared fixed modal backdrop");
assert(html.includes("app-modal-scroll"), "create overlay should expose one shared modal scroll region");
assert(html.indexOf("surface-fixed-header") < html.indexOf("surface-scroll-body"), "create header should remain outside its scroll owner");
assert(html.includes("authoring-surface-backdrop"), "create overlay should use the shared authoring backdrop contract");
assert(html.includes("authoring-surface-header"), "create overlay should use the shared authoring header contract");
assert(html.indexOf("<h2>") < html.indexOf('<button class="dialog-close"'), "create header should place its title before close in DOM and tab order");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
