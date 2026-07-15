import { categoryColorPresets } from "./categories.js";
import { renderBallEditDialog, renderCreateForm, renderEditSaveModeConfirm } from "./form-renderers.js";
import type { BallDraft, HappyBall } from "./models.js";

const context = {
  categories: categoryColorPresets,
  nameBook: [
    {
      id: "person_emojirou",
      name: "エモ次郎",
      role: "self" as const,
    },
  ],
};

const draft: BallDraft = {
  date: "2026-07-05",
  time: "09:35",
  subject: "エモ次郎",
  issuerType: "self",
  count: 1,
  title: "朝のえもい玉",
  category: "日常",
  note: "",
  visibility: "open",
};

const createHtml = renderCreateForm(draft, context);
assert(createHtml.includes("<span>日時</span>"), "create form should label date as datetime");
assert(createHtml.includes('<span class="ball-count-field-label">玉数</span>'), "create form should keep ball count label");
assert(!createHtml.includes('type="number"'), "create form should not use a numeric text field for ball count");
assert(createHtml.includes("data-ball-count-control"), "create form should use the shared ball count control");
assert(createHtml.includes('type="range"'), "create form should expose a native ball count range");
assert(createHtml.includes('min="1"'), "create ball count range should start at one ball");
assert(createHtml.includes('max="10"'), "create ball count range should end at ten balls");
assert(createHtml.includes('name="count" type="hidden" value="1"'), "create form should submit the mapped count through a hidden field");
assert(createHtml.includes("data-ball-count-range"), "create form should identify the shared count range");
assert(createHtml.includes('data-ball-count-tick="1"'), "create form should render a one-ball tick");
assert(createHtml.includes('data-ball-count-tick="5"'), "create form should render the emphasized five-ball tick");
assert(createHtml.includes('data-ball-count-tick="10"'), "create form should render a ten-ball tick");
assert(!createHtml.includes('data-ball-count-tick="0"'), "create form should not render an invalid zero tick");
assert(countOccurrences(createHtml, "data-ball-count-tick=") === 10, "create form should render ten ticks across nine intervals");
assert(!createHtml.includes("球数"), "create form should not rename ball count to sphere count");
assert(createHtml.includes('<span class="subject-field-label">だれの玉</span>'), "create form should label the unified subject field without question mark");
assert(!createHtml.includes("<span>だれの玉？</span>"), "create form should not show the old question-mark label");
assert(!createHtml.includes("<span>自由入力</span>"), "create form should not render a separate free-input row");
assert(createHtml.includes('placeholder="名前を自由に入力"'), "create form should make free subject entry explicit");
assert(createHtml.includes("<span>作り方</span>"), "create form should label issue mode");
assert(createHtml.includes('<span class="authoring-inset-label">タイトル</span>'), "create form should label title");
assert(createHtml.includes("data-authoring-primary-fields"), "create form should group title and memo as primary authoring fields");
assert(createHtml.includes("data-ball-authoring-title-field"), "create form should expose the shared title field hook");
assert(createHtml.includes("data-ball-authoring-memo-field"), "create form should expose the shared memo field hook");
assert(createHtml.includes('<span class="authoring-inset-label">タイトル</span>'), "create form should retain a semantic inset title label");
assert(createHtml.includes('placeholder="タイトル"'), "create form should show the title name inside an empty input");
assert(createHtml.includes('placeholder="メモ"'), "create form should show the memo name inside an empty textarea");
assert(createHtml.includes("キーボードは入力欄以外タップで閉じられます"), "create form should explain the safe IME dismissal gesture");
assert(!createHtml.includes("小さなえもいゴト"), "create form should remove the old example title placeholder");
assert(createHtml.includes("<span>見せる範囲</span>"), "create form should label visibility");
assert(createHtml.includes("data-authoring-category-fold"), "create form should use the shared folded category control");
assert(createHtml.includes('class="timestamp-field create-timestamp-field create-inline-field"'), "create form should render compact horizontal timestamp controls");
assert(createHtml.includes('name="timeEnabled" checked'), "create form should enable timestamp recording when draft has time");
assert(createHtml.includes('name="time" type="time" value="09:35"'), "create form should render a visible time input value");
assert(createHtml.includes("<span>時刻記録</span>"), "create form should label the timestamp row as timestamp recording");
assert(createHtml.includes('type="button" data-current-time-button>現在時刻</button>'), "create form should render a current-time button");
assert(createHtml.includes("timestamp-now-button quiet-accent-action"), "create form should use the shared quiet accent on current time");
assert(!createHtml.includes("<span>時刻</span>"), "create form should not show a standalone time label");
assert(createHtml.includes('<input type="checkbox" name="timeEnabled" checked />\n        </label>'), "create form should not show a standalone timestamp checkbox label");
assert(!createHtml.includes("<span>時刻を記録</span>"), "create form should not use the long timestamp checkbox label");
assert(!createHtml.includes("登録名選択または自由に入力"), "create form should remove the old free-input hint");
assert(createHtml.indexOf('name="subject"') < createHtml.indexOf('class="name-preset-select"'), "create form should place free input before the registered-name selector");
assert(createHtml.indexOf("<span>時刻記録</span>") < createHtml.indexOf('name="timeEnabled"'), "create form should place timestamp controls to the right of the timestamp label");
assert(createHtml.indexOf('name="timeEnabled"') < createHtml.indexOf("data-current-time-button"), "create form should place current-time button after the timestamp checkbox");
assert(createHtml.indexOf("data-current-time-button") < createHtml.indexOf('name="time"'), "create form should place the time input after the current-time button");
assert(createHtml.indexOf('class="subject-field-label"') < createHtml.indexOf('name="subject"'), "create form should place subject controls after the unified label");
assertAuthoringOrder(createHtml, "create form");

const sampleBall: HappyBall = {
  id: "ball_20260705_sample",
  date: "2026-07-05",
  time: "21:08",
  subject: "エモ次郎",
  issuerType: "self",
  issuedBy: "エモ次郎",
  enteredBy: "エモ次郎",
  approvedBy: null,
  keepers: ["エモ次郎"],
  viewers: [],
  count: 1,
  title: "夜のえもい玉",
  category: "日常",
  note: "",
  visibility: "open",
  visual: {
    hue: 92,
    saturation: 22,
    lightness: 54,
    kind: "filled",
    label: "夜のえも",
  },
  lifecycleStatus: "active",
  createdAt: "2026-07-05T12:00:00.000Z",
  updatedAt: "2026-07-05T12:00:00.000Z",
};

const editHtml = renderBallEditDialog(sampleBall, context);
assert(editHtml.includes("ball-edit-dialog-backdrop"), "edit form should render a dedicated edit backdrop class");
assert(editHtml.includes("ball-edit-dialog surface-shell"), "edit form should render a fixed Surface Shell");
assert(editHtml.includes("app-modal-backdrop"), "edit form should use the shared fixed modal backdrop");
assert(editHtml.includes("app-modal-scroll"), "edit form should expose one shared modal scroll region");
assert(editHtml.indexOf("surface-fixed-header") < editHtml.indexOf("surface-scroll-body"), "edit header should remain outside its scroll owner");
assert(editHtml.includes("authoring-surface-backdrop"), "edit form should use the shared authoring backdrop contract");
assert(editHtml.includes("authoring-surface-header"), "edit form should use the shared authoring header contract");
assert(editHtml.indexOf('id="ball-edit-title"') < editHtml.indexOf("data-dialog-close"), "edit header should place its title before close in DOM and tab order");
assert(editHtml.includes('class="edit-header-actions"'), "edit header should group save and close on its right side");
assert(editHtml.includes('class="panel-header-action primary-action edit-header-save" type="submit" form="ball-edit-form">保存</button>'), "edit header should submit the edit form from its fixed save action");
assert(countOccurrences(editHtml, 'type="submit"') === 2, "edit form should keep both header and footer save actions");
assert(editHtml.includes("autocomplete=\"off\""), "edit memo form should suppress inappropriate autofill suggestions where supported");
assert(editHtml.includes("<span>日時</span>"), "edit form should label date as datetime");
assert(editHtml.includes("<span>時刻記録</span>"), "edit form should label the timestamp row as timestamp recording");
assert(editHtml.includes('<span class="ball-count-field-label">玉数</span>'), "edit form should keep ball count label");
assert(!editHtml.includes('type="number"'), "edit form should not use a numeric text field for ball count");
assert(editHtml.includes("data-ball-count-control"), "edit form should use the shared ball count control");
assert(editHtml.includes("data-authoring-category-fold"), "edit form should use the shared folded category control");
assert(editHtml.includes('<span class="subject-field-label">だれの玉</span>'), "edit form should label the unified subject field without question mark");
assert(!editHtml.includes("<span>自由入力</span>"), "edit form should not render a separate free-input row");
assert(editHtml.includes('placeholder="名前を自由に入力"'), "edit form should make free subject entry explicit");
assert(editHtml.includes("<span>作り方</span>"), "edit form should label issue mode");
assert(editHtml.includes("<span>見せる範囲</span>"), "edit form should label visibility");
assert(editHtml.includes('<span class="authoring-inset-label">タイトル</span>'), "edit form should label title");
assert(editHtml.includes("data-authoring-primary-fields"), "edit form should group title and memo as primary authoring fields");
assert(editHtml.includes('placeholder="タイトル"'), "edit form should use the shared inset title placeholder");
assert(editHtml.includes('placeholder="メモ"'), "edit form should use the shared inset memo placeholder");
assert(editHtml.includes("キーボードは入力欄以外タップで閉じられます"), "edit form should explain the shared safe IME dismissal gesture");
assert(editHtml.includes('data-authoring-echo-category'), "edit form should always identify the read-only echo category row");
assert(editHtml.includes('<strong>なし</strong>'), "edit form should explicitly show when no echo category exists");
assert(!editHtml.includes("<span>日付</span>"), "edit form should not use the old date label");
assert(!editHtml.includes("<span>だれの玉？</span>"), "edit form should not show the old question-mark label");
assert(editHtml.includes('class="timestamp-field edit-timestamp-field edit-inline-field timestamp-field-wide"'), "edit form should render timestamp as a compact horizontal editable row");
assert(editHtml.includes('name="timeEnabled" checked'), "edit form should enable timestamp recording when ball has time");
assert(editHtml.includes('name="time" type="time" value="21:08"'), "edit form should expose the existing time for editing");
assert(editHtml.includes('type="button" data-current-time-button>現在時刻</button>'), "edit form should render a current-time button");
assert(editHtml.includes("timestamp-now-button quiet-accent-action"), "edit form should use the shared quiet accent on current time");
assert(!editHtml.includes("<span>時刻</span>"), "edit form should not show a standalone time label");
assert(editHtml.includes('<input type="checkbox" name="timeEnabled" checked />\n        </label>'), "edit form should not show a standalone timestamp checkbox label");
assert(editHtml.indexOf("<span>時刻記録</span>") < editHtml.indexOf('name="timeEnabled"'), "edit form should place timestamp controls to the right of the timestamp label");
assert(editHtml.indexOf('name="timeEnabled"') < editHtml.indexOf("data-current-time-button"), "edit form should place current-time button after the timestamp checkbox");
assert(editHtml.indexOf("data-current-time-button") < editHtml.indexOf('name="time"'), "edit form should place the time input after the current-time button");
assert(editHtml.indexOf('class="subject-field-label"') < editHtml.indexOf('name="subject"'), "edit form should place subject controls after the unified label");
assert(editHtml.indexOf('name="subject"') < editHtml.indexOf('class="name-preset-select"'), "edit form should place free input before the registered-name selector");
assert(editHtml.indexOf('name="title"') < editHtml.indexOf('name="note"'), "edit form should place title before memo");
assert(editHtml.indexOf('name="note"') < editHtml.indexOf('data-authoring-category-fold'), "edit form should place memo before category");
assert(editHtml.indexOf('data-authoring-category-fold') < editHtml.indexOf('name="date"'), "edit form should place category before the datetime group");
assert(editHtml.indexOf('name="date"') < editHtml.indexOf('name="timeEnabled"'), "edit datetime group should place date before time controls");
assert(editHtml.indexOf('name="time"') < editHtml.indexOf("data-authoring-context-divider"), "edit form should place the quiet divider after datetime");
assert(editHtml.indexOf("data-authoring-context-divider") < editHtml.indexOf('name="subject"'), "edit form should place subject after the quiet divider");
assert(editHtml.indexOf('name="subject"') < editHtml.indexOf("data-ball-count-control"), "edit form should place ball count after subject");
assert(editHtml.indexOf("data-ball-count-control") < editHtml.indexOf('name="issuerType"'), "edit form should place issue mode after ball count");
assert(editHtml.indexOf('name="issuerType"') < editHtml.indexOf('name="visibility"'), "edit form should place visibility after issue mode");
assert(countOccurrences(editHtml, 'name="note"') === 1, "edit form should render exactly one memo textarea");
assert(editHtml.includes('rows="4" maxlength="180" placeholder="メモ" autocomplete="off"'), "edit form should preserve memo textarea behavior");
assertAuthoringOrder(editHtml, "edit form");
assert(editHtml.includes('class="edit-descent-history" aria-label="降臨"'), "edit form should always render the descent group");
assert(editHtml.includes('data-descend-ball-id="ball_20260705_sample">降臨</button>'), "empty edit descent group should expose its descent action as the group heading");
assert(editHtml.includes("降臨なし"), "empty edit descent group should explain that it has no records");
const lifecycleHtml = sliceBetween(editHtml, 'class="edit-lifecycle-actions"', "</div>");
assert(!lifecycleHtml.includes("data-descend-ball-id"), "edit lifecycle row should no longer contain the descent action");

const fiveBallEditHtml = renderBallEditDialog({ ...sampleBall, count: 5 }, context);
assert(fiveBallEditHtml.includes('value="5"\n              aria-label="玉数"'), "five balls should load at its native range detent");
assert(fiveBallEditHtml.includes('aria-valuetext="5玉"'), "five balls should expose the visible count to assistive technology");
assert(fiveBallEditHtml.includes('class="ball-count-tick is-emphasized" style="--ball-count-position: 44.444444%"'), "the five-ball tick should be emphasized at four of nine intervals");
assert(fiveBallEditHtml.indexOf("data-ball-count-output") < fiveBallEditHtml.indexOf("ball-count-range-stack"), "the live count should render to the left of the range stack");
assert(fiveBallEditHtml.includes("data-ball-count-track"), "the slider should render a pointer-inert visual track");
assert(fiveBallEditHtml.includes("data-ball-count-thumb data-horizontal-drag-control"), "the slider should expose a thumb-only horizontal drag target");

const echoEditHtml = renderBallEditDialog({
  ...sampleBall,
  emotionEcho: {
    recordedAt: "2026-07-05T11:00:00.000Z",
    date: "2026-07-04",
    time: "19:30",
    subject: "エモ次郎",
    issuerType: "self",
    count: 1,
    title: "前日の玉",
    category: "よろこび",
    note: "以前の気持ち",
    visibility: "open",
    visual: {
      hue: 42,
      saturation: 72,
      lightness: 60,
      kind: "filled",
      label: "よろこび",
    },
  },
}, context);
assert(echoEditHtml.includes('<span>余韻</span>'), "edit form should label the echo explicitly");
assert(!echoEditHtml.includes('<span>余韻カテゴリ</span>'), "edit form should remove the longer echo-category label");
assert(echoEditHtml.includes('<strong>よろこび</strong>'), "edit form should show the stored echo category read-only");

const legacyCountEditHtml = renderBallEditDialog({ ...sampleBall, count: 12 }, context);
assert(legacyCountEditHtml.includes("既存値 12玉"), "legacy count should be shown without truncation");
assert(legacyCountEditHtml.includes('name="count" type="hidden" value="12"'), "legacy count should remain the submitted value");
assert(legacyCountEditHtml.includes("data-ball-count-slider hidden"), "legacy count should initially hide the normal slider");
assert(legacyCountEditHtml.includes("data-ball-count-convert>10玉以下へ変更"), "legacy count should require an explicit conversion action");

const noTimeEditHtml = renderBallEditDialog({ ...sampleBall, time: undefined }, context);
assert(noTimeEditHtml.includes('name="time" type="time" value="" disabled'), "edit form should still show a disabled time input when ball has no time");
assert(!noTimeEditHtml.includes('name="timeEnabled" checked'), "edit form should leave timestamp recording off when ball has no time");

const closeConfirmHtml = renderEditSaveModeConfirm("close");
assert(closeConfirmHtml.indexOf("訂正として保存") < closeConfirmHtml.indexOf("余韻として保存"), "edit confirmation should put correction save first");
assert(closeConfirmHtml.includes('class="primary-action" type="button" data-edit-save-correction'), "correction save should be the primary action");
assert(!closeConfirmHtml.includes("保存して閉じる"), "edit confirmation should use concise save labels");
assert(closeConfirmHtml.includes("保存せず閉じる"), "close confirmation should retain the discard action");

const descentEditHtml = renderBallEditDialog({
  ...sampleBall,
  descents: [
    {
      id: "descent_1",
      sequence: 1,
      recordedAt: "2026-07-05T10:00:00.000Z",
      badgeAwarded: true,
      memo: "地下でメモだけ",
    },
    {
      id: "descent_2",
      sequence: 2,
      recordedAt: "2026-07-05T11:00:00.000Z",
      latitude: 35.681236,
      longitude: 139.767125,
      accuracyMeters: 12,
      badgeAwarded: true,
      memo: "駅前で再降臨",
    },
  ],
  descentBadgeCount: 2,
  isKamiBall: false,
}, context);
assert(!descentEditHtml.includes("降臨 2回"), "edit form should not show descent count in the heading");
const editDescentHeadHtml = sliceBetween(descentEditHtml, 'class="edit-descent-head"', "</div>");
assert(editDescentHeadHtml.includes('data-descend-ball-id="ball_20260705_sample">降臨</button>'), "edit form heading should use the descent action as its group label");
assert(!editDescentHeadHtml.includes("2星"), "edit form heading should not show star count");
assert(!editDescentHeadHtml.includes("✦2"), "edit form heading should not show compact star badge");
assert(descentEditHtml.includes("No.2"), "edit form should show descent sequence as number label");
assert(!descentEditHtml.includes("第2回"), "edit form should not use the old descent sequence label");
assert(descentEditHtml.includes("ほかの降臨を見る（1回）"), "edit form should fold older descents after the direct latest item");
assert(descentEditHtml.includes("降臨メモ"), "edit form should expose descent memo fields");
assert(descentEditHtml.includes("authoring-inset-field edit-descent-memo"), "edit form should expose a compact inset descent memo field");
assert(descentEditHtml.includes('rows="1" maxlength="80" placeholder="降臨メモ"'), "edit form should start descent memo at one title-height row");
assert(descentEditHtml.includes("edit-descent-location-row"), "edit form should group descent location status and actions on one row");
assert(!descentEditHtml.includes("edit-descent-gps-row"), "edit form should remove the old separate GPS status row");
assert(!descentEditHtml.includes("edit-descent-actions"), "edit form should remove the old separate GPS action row");
assert(descentEditHtml.includes("地下でメモだけ"), "edit form should preserve GPS-less descent memo");
assert(descentEditHtml.includes("位置未取得"), "edit form should show missing GPS state");
assert(descentEditHtml.includes('data-descent-gps-record-id="descent_1"'), "edit form should render GPS acquisition controls");
assert(descentEditHtml.includes('data-descent-clear-gps-record-id="descent_2"'), "edit form should render GPS deletion controls for positioned records");
assert(descentEditHtml.includes('data-descent-delete-record-id="descent_1"'), "edit form should allow a GPS-less descent record to be removed");
assert(descentEditHtml.includes('data-descent-delete-record-id="descent_2"'), "edit form should allow a GPS-backed descent record to be removed");
assert(countOccurrences(descentEditHtml, ">消去</button>") === 2, "edit form should render one whole-record removal action per descent");
assert(descentEditHtml.includes("Google Maps"), "edit form should show map links for positioned records");
assert(descentEditHtml.includes("ghost-action quiet-accent-action detail-map-link"), "edit form should use the quiet accent on map links");
assert(descentEditHtml.includes("ghost-action quiet-accent-action\" type=\"button\" data-descent-gps-record-id"), "edit form should use the quiet accent on descent GPS actions");

function assertAuthoringOrder(html: string, label: string): void {
  const markers = [
    'name="title"',
    'name="note"',
    "data-authoring-category-fold",
    "data-authoring-datetime-group",
    "data-authoring-context-divider",
    'name="subject"',
    "data-ball-count-control",
    'name="issuerType"',
    'name="visibility"',
  ];
  markers.forEach((marker, index) => {
    assert(html.includes(marker), `${label} should include ${marker}`);
    if (index > 0) {
      assert(html.indexOf(markers[index - 1]) < html.indexOf(marker), `${label} should keep the shared authoring order at ${marker}`);
    }
  });
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function sliceBetween(value: string, startNeedle: string, endNeedle: string): string {
  const start = value.indexOf(startNeedle);
  if (start < 0) {
    return "";
  }
  const end = value.indexOf(endNeedle, start);
  return end < 0 ? value.slice(start) : value.slice(start, end);
}

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}
