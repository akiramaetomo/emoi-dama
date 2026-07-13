import { categoryColorPresets } from "./categories.js";
import type { HappyBall } from "./models";
import { DEFAULT_APP_SETTINGS } from "./settings.js";
import { renderLedgerList, renderToolsPanel } from "./settings-renderers.js";

const html = renderToolsPanel({
  appSettings: DEFAULT_APP_SETTINGS,
  appVersion: "0.1.0",
  categories: categoryColorPresets,
  activityLog: [
    {
      id: "activity_1",
      recordedAt: "2026-07-03T11:00:00.000Z",
      action: "send-line-url",
      status: "success",
      ballId: "ball_20260703_sample",
      title: "今日のえもい玉",
      issuedBy: "エモ次郎",
      sendMode: "formal",
    },
  ],
  openSettingsGroups: ["backup-settings"],
  activityLogHelpOpen: false,
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
assert(html.includes('id="setting-gravity-debug"'), "gravity debug setting should be rendered");
assert(html.includes('id="setting-damping" type="range" min="0" max="300" step="1" value="48"'), "damping should render as a logarithmic slider");
assert(html.includes('id="setting-gravity-strength" type="range" min="80" max="20000" step="20" value="4000"'), "gravity strength should render with the expanded range");
assert(html.includes('Damping <strong id="setting-damping-value">0.30</strong>'), "damping should display the real physics value");
assert(html.includes('id="export-json"'), "backup export action should be rendered");
assert(html.includes('id="import-json"'), "backup import action should be rendered");
assert(html.includes('value="activityLog"'), "backup export options should include activity logs");
assert(html.includes("<h2>操作ログ</h2>"), "activity log group should be rendered");
assert(html.includes("操作ログの簡易仕様を見る"), "activity log group should render a help trigger");
assert(html.includes('data-toggle-activity-log-help'), "activity log help should render as a normal button");
assert(html.includes('aria-expanded="false"'), "activity log help should start closed");
assert(!html.includes("玉を置くだけの通常作成は、現在は操作ログに記録しません。"), "closed activity log help should hide help text");
assert(html.includes("LINE用URL"), "activity log should render recent action labels");
assert(!html.includes("summary-action"), "settings summaries should not contain action-button hooks");
assert(!html.includes("export-panel"), "backup/restore group should not keep the old export-panel-specific hook");
assert(/<dt>公開版<\/dt>\s*<dd>0\.1\.0<\/dd>/.test(html), "a formal app version should also identify the official publication");

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

const descendedSampleBall: HappyBall = {
  ...sampleBall,
  count: 3,
  descents: [
    {
      id: "descent_1",
      sequence: 1,
      recordedAt: "2026-07-03T10:30:00.000Z",
      badgeAwarded: true,
      memo: "駅前で降臨",
    },
  ],
  descentBadgeCount: 1,
};

const ledgerListHtml = renderLedgerList([descendedSampleBall], sampleBall.id, {
  dateFilter: "2026-07-03",
  activityLog: [
    {
      id: "activity_1",
      recordedAt: "2026-07-03T11:00:00.000Z",
      action: "send-line-url",
      status: "success",
      ballId: sampleBall.id,
      title: sampleBall.title,
      issuedBy: sampleBall.issuedBy,
      sendMode: "formal",
    },
  ],
});
assert(ledgerListHtml.includes("2026-07-03 の保存された玉"), "ledger list should show the selected calendar day scope");
assert(ledgerListHtml.includes("ledger-descent-badge"), "ledger list should show a descent star badge");
assert(ledgerListHtml.includes("✦1"), "ledger list should show descent star count");
assert(ledgerListHtml.includes("ledger-ball-visual"), "ledger list should show a ball icon beside each row");
assert(ledgerListHtml.includes("ledger-count-under-icon"), "ledger list should show multi-ball counts below the ball icon");
assert(ledgerListHtml.includes("3玉"), "ledger list should show multi-ball counts only when needed");
assert(!ledgerListHtml.includes("ledger-count-badge"), "ledger list should not show the old title-row count badge");
assert(ledgerListHtml.includes("降臨1回"), "ledger list should show descent count in metadata");
assert(ledgerListHtml.includes("発行者: エモ次郎"), "ledger list should show issuer metadata");
assert(ledgerListHtml.includes("送り手段: お預け"), "ledger list should show latest send method metadata");
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

const emptyActivityLogPanelHtml = renderToolsPanel({
  appSettings: DEFAULT_APP_SETTINGS,
  appVersion: "0.1.0",
  categories: categoryColorPresets,
  activityLog: [],
  openSettingsGroups: ["activity-log-panel"],
  activityLogHelpOpen: false,
  nameBook: [],
  maxNameBookEntries: 10,
  defaultSampleName: "エモ次郎",
});
assert(emptyActivityLogPanelHtml.includes("まだ操作ログはありません。"), "empty activity log panel should still show empty state");
assert(emptyActivityLogPanelHtml.includes("操作ログの簡易仕様を見る"), "empty activity log panel should still expose help");

const openActivityLogHelpHtml = renderToolsPanel({
  appSettings: DEFAULT_APP_SETTINGS,
  appVersion: "0.1.0",
  categories: categoryColorPresets,
  activityLog: [],
  openSettingsGroups: ["activity-log-panel"],
  activityLogHelpOpen: true,
  nameBook: [],
  maxNameBookEntries: 10,
  defaultSampleName: "エモ次郎",
});
assert(openActivityLogHelpHtml.includes('aria-expanded="true"'), "open activity log help should announce expanded state");
assert(openActivityLogHelpHtml.includes("玉を置くだけの通常作成は、現在は操作ログに記録しません。"), "open activity log help should explain non-logged creation");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
