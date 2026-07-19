import { categoryColorPresets } from "./categories.js";
import type { HappyBall } from "./models";
import { DEFAULT_APP_SETTINGS } from "./settings.js";
import { renderLedgerList, renderToolsPanel, type ToolsPanelRenderContext } from "./settings-renderers.js";

const defaultRenderContext = {
  appSettings: DEFAULT_APP_SETTINGS,
  appVersion: "0.1.0",
  developmentToolsEnabled: true,
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
  physicsSettingsProfile: "normal",
} satisfies ToolsPanelRenderContext;
const html = renderToolsPanel(defaultRenderContext);

assert(html.includes("<h2>バックアップ・復元</h2>"), "backup/restore group title should be rendered");
assert(html.includes('id="setting-startup-screen"'), "startup screen setting should be rendered");
assert(html.includes('<option value="calendarMonth" selected>カレンダー</option>'), "calendar should be the default startup screen");
assert(html.includes("<h2>降臨</h2>"), "descent settings group should be rendered");
assert(html.includes('id="setting-descent-distance"'), "descent distance setting should be rendered");
assert(html.includes('value="500"'), "descent distance should default to 500m");
assert(html.includes('id="setting-handoff-descent-gps"'), "handoff GPS privacy setting should be rendered");
assert(!html.includes('id="setting-handoff-descent-gps" type="checkbox" checked'), "handoff GPS privacy setting should default to off");
assert(html.includes('id="setting-gravity-debug"'), "gravity debug setting should be rendered");
const productionHtml = renderToolsPanel({ ...defaultRenderContext, developmentToolsEnabled: false });
assert(!productionHtml.includes('id="setting-gravity-debug"'), "production settings should hide gravity diagnostics");
assert(html.includes('<h2>物理パラメータ</h2>'), "physics settings should have an independent top-level group");
assert(html.includes('<h2>サウンド</h2>'), "sound settings should have an independent top-level group");
assert(!html.includes("サウンド・ビジュアル"), "the former combined sound/visual group should be removed");
assert(html.includes('id="setting-damping" type="range" min="0" max="300" step="1" value="48"'), "damping should render as a logarithmic slider");
assert(html.includes('id="setting-gravity-strength" type="range" min="80" max="20000" step="20" value="4000"'), "gravity strength should render with the expanded range");
assert(html.includes('id="setting-density-ratio" type="range" min="-2" max="2" step="0.05" value="1"'), "density ratio should render on a logarithmic scale at ratio two");
assert(html.includes('id="setting-class-damping-ratio" type="range" min="-2" max="2" step="0.05" value="1"'), "classification damping should render on a logarithmic scale at ratio two");
assert(html.includes('id="setting-class-buoyancy" type="range" min="0" max="1" step="0.05" value="1"'), "classification buoyancy should expose the accepted zero-to-one tuning range");
assert(html.includes('id="setting-parent-diameter" type="range" min="40" max="160" step="4" value="112"'), "parent diameter should expose the approved range");
assert(html.includes('id="setting-parent-lifetime" type="range" min="1" max="30" step="1" value="3"'), "parent lifetime should expose the approved range");
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
assert(!html.includes("Pages参考"), "version details should not show a stale hard-coded Pages reference");

const tailoringClusterHtml = readSettingsCluster(html, "settings-cluster-tailoring");
const behaviorClusterHtml = readSettingsCluster(html, "settings-cluster-behavior");
const managementClusterHtml = readSettingsCluster(html, "settings-cluster-management");
assert(html.indexOf("settings-cluster-tailoring") < html.indexOf("settings-cluster-behavior"), "ball tailoring should precede ball behavior");
assert(html.indexOf("settings-cluster-behavior") < html.indexOf("settings-cluster-management"), "ball behavior should precede management");
assert(tailoringClusterHtml.includes(">玉の仕立て</p>"), "the first Settings cluster should be named ball tailoring");
assert(behaviorClusterHtml.includes(">玉のふるまい</p>"), "the second Settings cluster should be named ball behavior");
assert(managementClusterHtml.includes(">管理</p>"), "the final Settings cluster should be named management");
assertSettingsClusterMembership(tailoringClusterHtml, ["name-book-settings", "category-settings", "display-settings", "descent-settings"]);
assertSettingsClusterMembership(behaviorClusterHtml, ["physics-settings", "sound-settings"]);
assertSettingsClusterMembership(managementClusterHtml, ["backup-settings", "ball-management-panel", "activity-log-panel", "app-about-panel"]);

const physicsPanelHtml = readDetailsGroup(html, "physics-settings");
const soundPanelHtml = readDetailsGroup(html, "sound-settings");
assert(html.indexOf('class="settings-group physics-settings"') < html.indexOf('class="settings-group sound-settings"'), "physics settings should precede sound settings");
assert(physicsPanelHtml.indexOf('id="setting-gravity"') < physicsPanelHtml.indexOf("<h3>世界の物理</h3>"), "gravity sensor controls should appear before the named physics sections");
assert(physicsPanelHtml.indexOf("<h3>世界の物理</h3>") < physicsPanelHtml.indexOf('id="setting-wall"'), "world physics should contain the base movement settings");
assert(physicsPanelHtml.indexOf('id="setting-gravity-strength"') < physicsPanelHtml.indexOf("<h3>玉・親玉の性質</h3>"), "ball properties should follow every world physics setting");
assert(physicsPanelHtml.indexOf("<h3>玉・親玉の性質</h3>") < physicsPanelHtml.indexOf('id="setting-density-ratio"'), "ball properties should contain classification settings");
assert(physicsPanelHtml.includes('id="setting-parent-lifetime"'), "ball properties should include Parent settings");
assert(!physicsPanelHtml.includes('id="setting-sound"'), "physics settings should not contain sound controls");
assert(soundPanelHtml.includes('id="setting-sound"'), "sound settings should contain the sound toggle");
assert(soundPanelHtml.includes('id="setting-volume"'), "sound settings should contain volume");
assert(soundPanelHtml.includes('id="setting-pitch"'), "sound settings should contain pitch");
assert(soundPanelHtml.includes('id="setting-duration"'), "sound settings should contain sound length");
assert(!soundPanelHtml.includes("<h3>サウンド</h3>"), "the independent sound group should not repeat its title");

const jutsuPhysicsHtml = renderToolsPanel({ ...defaultRenderContext, physicsSettingsProfile: "jutsu" });
assert(jutsuPhysicsHtml.includes('data-physics-settings-profile="jutsu" aria-pressed="true"'), "jutsu profile should identify the selected tuning target");
assert(jutsuPhysicsHtml.includes('id="setting-wall" type="range" min="0" max="1" step="0.01" value="0.85"'), "jutsu profile should render the approved wall bounce");
assert(jutsuPhysicsHtml.includes('id="setting-contact" type="range" min="0" max="1" step="0.01" value="0.6"'), "jutsu profile should render the approved contact bounce");
assert(jutsuPhysicsHtml.includes('id="setting-gravity-strength" type="range" min="80" max="20000" step="20" value="1000"'), "jutsu profile should render the approved gravity");
assert(jutsuPhysicsHtml.includes('id="setting-parent-diameter" type="range" min="40" max="160" step="4" value="100"'), "jutsu profile should render the approved parent diameter");
assert(jutsuPhysicsHtml.includes('id="setting-parent-lifetime" type="range" min="1" max="30" step="1" value="2"'), "jutsu profile should render the approved parent lifetime");
assert(jutsuPhysicsHtml.includes('id="reset-jutsu-physics"'), "jutsu profile should expose its default reset action");
assert(!html.includes('id="reset-jutsu-physics"'), "normal profile should not expose the jutsu reset action");

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
  developmentToolsEnabled: false,
  categories: categoryColorPresets,
  activityLog: [],
  openSettingsGroups: ["activity-log-panel"],
  activityLogHelpOpen: false,
  nameBook: [],
  maxNameBookEntries: 10,
  defaultSampleName: "エモ次郎",
  physicsSettingsProfile: "normal",
});
assert(emptyActivityLogPanelHtml.includes("まだ操作ログはありません。"), "empty activity log panel should still show empty state");
assert(emptyActivityLogPanelHtml.includes("操作ログの簡易仕様を見る"), "empty activity log panel should still expose help");

const openActivityLogHelpHtml = renderToolsPanel({
  appSettings: DEFAULT_APP_SETTINGS,
  appVersion: "0.1.0",
  developmentToolsEnabled: false,
  categories: categoryColorPresets,
  activityLog: [],
  openSettingsGroups: ["activity-log-panel"],
  activityLogHelpOpen: true,
  nameBook: [],
  maxNameBookEntries: 10,
  defaultSampleName: "エモ次郎",
  physicsSettingsProfile: "normal",
});
assert(openActivityLogHelpHtml.includes('aria-expanded="true"'), "open activity log help should announce expanded state");
assert(openActivityLogHelpHtml.includes("玉を置くだけの通常作成は、現在は操作ログに記録しません。"), "open activity log help should explain non-logged creation");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function readDetailsGroup(source: string, className: string): string {
  const start = source.indexOf(`<details class="settings-group ${className}"`);
  const end = source.indexOf("</details>", start);
  if (start < 0 || end < 0) {
    throw new Error(`missing details group ${className}`);
  }
  return source.slice(start, end);
}

function readSettingsCluster(source: string, className: string): string {
  const start = source.indexOf(`<section class="settings-cluster ${className}"`);
  const end = source.indexOf("</section>", start);
  if (start < 0 || end < 0) {
    throw new Error(`missing Settings cluster ${className}`);
  }
  return source.slice(start, end);
}

function assertSettingsClusterMembership(source: string, expectedClasses: string[]): void {
  const actualClasses = Array.from(source.matchAll(/<details class="settings-group ([^"]+)"/g), (match) => match[1]);
  assert(
    JSON.stringify(actualClasses) === JSON.stringify(expectedClasses),
    `unexpected Settings cluster membership: expected ${expectedClasses.join(", ")}, got ${actualClasses.join(", ")}`,
  );
}
