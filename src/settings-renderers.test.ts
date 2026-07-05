import { categoryColorPresets } from "./categories.js";
import type { HappyBall } from "./models";
import { DEFAULT_APP_SETTINGS } from "./settings.js";
import { renderLedgerList, renderToolsPanel } from "./settings-renderers.js";

const html = renderToolsPanel({
  appSettings: DEFAULT_APP_SETTINGS,
  appVersion: "0.1.0",
  categories: categoryColorPresets,
  openSettingsGroups: ["backup-settings"],
  nameBook: [],
  maxNameBookEntries: 10,
  defaultSampleName: "エモ次郎",
});

assert(html.includes("<h2>バックアップ・復元</h2>"), "backup/restore group title should be rendered");
assert(html.includes('id="setting-startup-screen"'), "startup screen setting should be rendered");
assert(html.includes('<option value="calendarMonth" selected>カレンダー</option>'), "calendar should be the default startup screen");
assert(html.includes("<h2>降臨</h2>"), "descent settings group should be rendered");
assert(html.includes('id="setting-descent-distance"'), "descent distance setting should be rendered");
assert(html.includes('value="500"'), "descent distance should default to 500m");
assert(html.includes('id="export-json"'), "backup export action should be rendered");
assert(html.includes('id="import-json"'), "backup import action should be rendered");
assert(!html.includes("summary-action"), "settings summaries should not contain action-button hooks");
assert(!html.includes("export-panel"), "backup/restore group should not keep the old export-panel-specific hook");

const exportPanelStart = html.indexOf('<details class="settings-group backup-settings"');
const exportPanelEnd = html.indexOf("</details>", exportPanelStart);
assert(exportPanelStart >= 0 && exportPanelEnd > exportPanelStart, "backup/restore group should be a details section");

const exportPanelHtml = html.slice(exportPanelStart, exportPanelEnd);
const summaryStart = exportPanelHtml.indexOf("<summary");
const summaryEnd = exportPanelHtml.indexOf("</summary>", summaryStart);
assert(summaryStart >= 0 && summaryEnd > summaryStart, "backup/restore group should have a summary");

const summaryHtml = exportPanelHtml.slice(summaryStart, summaryEnd);
assert(!summaryHtml.includes("<button"), "backup/restore summary should not contain buttons");
assert(exportPanelHtml.indexOf('class="settings-copy"') > summaryEnd, "backup/restore body should start with explanatory copy");
assert(exportPanelHtml.indexOf('class="export-options"') > summaryEnd, "backup/restore options should live in the opened panel body");
assert(exportPanelHtml.indexOf('id="export-json"') > exportPanelHtml.indexOf('class="export-options"'), "export button should follow the backup options");
assert(exportPanelHtml.indexOf('id="import-json"') > exportPanelHtml.indexOf('class="export-options"'), "import button should follow the backup options");

const sampleBall: HappyBall = {
  id: "ball_20260703_sample",
  date: "2026-07-03",
  subject: "エモ次郎",
  issuerType: "self",
  issuedBy: "エモ次郎",
  enteredBy: "エモ次郎",
  approvedBy: null,
  keepers: ["エモ次郎"],
  viewers: [],
  count: 1,
  title: "今日のえもい玉",
  category: "日常",
  note: "",
  visibility: "open",
  visual: {
    hue: 40,
    saturation: 50,
    lightness: 50,
    kind: "filled",
    label: "今日",
  },
  lifecycleStatus: "active",
  createdAt: "2026-07-03T10:00:00.000Z",
  updatedAt: "2026-07-03T10:00:00.000Z",
};

const ledgerListHtml = renderLedgerList([sampleBall], sampleBall.id, { dateFilter: "2026-07-03" });
assert(ledgerListHtml.includes("2026-07-03 の保存された玉"), "ledger list should show the selected calendar day scope");
assert(ledgerListHtml.includes("data-clear-ledger-list-date"), "ledger list should offer a way back to all saved balls");
assert(ledgerListHtml.includes('data-lifecycle-status="archived"'), "ledger list should render the archive/shimau action");
assert(ledgerListHtml.includes(">しまう</button>"), "active balls should show the shimau action");
assert(ledgerListHtml.includes('data-lifecycle-status="offered"'), "ledger list should render the kuyoh action");
assert(ledgerListHtml.includes('data-delete-ball-id="ball_20260703_sample"'), "ledger list should render the otakiage action");
assert(ledgerListHtml.includes('data-descend-ball-id="ball_20260703_sample"'), "ledger list should render the kourin action");

const archivedLedgerListHtml = renderLedgerList([{ ...sampleBall, lifecycleStatus: "archived" }], sampleBall.id, { dateFilter: null });
assert(archivedLedgerListHtml.includes('data-lifecycle-status="active"'), "archived balls should render the restore action");
assert(archivedLedgerListHtml.includes(">戻す</button>"), "archived balls should show the restore label");
assert(!archivedLedgerListHtml.includes(">しまう</button>"), "archived balls should not show the shimau label");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
