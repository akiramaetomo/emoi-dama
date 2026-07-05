import { categoryColorPresets } from "./categories.js";
import { renderBallEditDialog, renderCreateForm } from "./form-renderers.js";
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
assert(createHtml.includes("<span>玉数</span>"), "create form should keep ball count label");
assert(!createHtml.includes("球数"), "create form should not rename ball count to sphere count");
assert(createHtml.includes("<span>だれの玉</span>"), "create form should label whose ball selector without question mark");
assert(!createHtml.includes("<span>だれの玉？</span>"), "create form should not show the old question-mark label");
assert(createHtml.includes("<span>自由入力</span>"), "create form should label the free name input");
assert(createHtml.includes("<span>作り方</span>"), "create form should label issue mode");
assert(createHtml.includes("<span>タイトル</span>"), "create form should label title");
assert(createHtml.includes("<span>見せる範囲</span>"), "create form should label visibility");
assert(createHtml.includes('class="timestamp-field create-timestamp-field create-inline-field"'), "create form should render compact horizontal timestamp controls");
assert(createHtml.includes('name="timeEnabled" checked'), "create form should enable timestamp recording when draft has time");
assert(createHtml.includes('name="time" type="time" value="09:35"'), "create form should render a visible time input value");
assert(createHtml.includes("<span>時刻記録</span>"), "create form should label the timestamp row as timestamp recording");
assert(createHtml.includes('type="button" data-current-time-button>現在時刻</button>'), "create form should render a current-time button");
assert(!createHtml.includes("<span>時刻</span>"), "create form should not show a standalone time label");
assert(createHtml.includes('<input type="checkbox" name="timeEnabled" checked />\n        </label>'), "create form should not show a standalone timestamp checkbox label");
assert(!createHtml.includes("<span>時刻を記録</span>"), "create form should not use the long timestamp checkbox label");
assert(!createHtml.includes("登録名選択または自由に入力"), "create form should remove the old free-input hint");
assert(createHtml.indexOf('class="name-preset-select"') < createHtml.indexOf('name="subject"'), "create form should place name preset before free input");
assert(createHtml.indexOf("<span>時刻記録</span>") < createHtml.indexOf('name="timeEnabled"'), "create form should place timestamp controls to the right of the timestamp label");
assert(createHtml.indexOf('name="timeEnabled"') < createHtml.indexOf("data-current-time-button"), "create form should place current-time button after the timestamp checkbox");
assert(createHtml.indexOf("data-current-time-button") < createHtml.indexOf('name="time"'), "create form should place the time input after the current-time button");
assert(createHtml.indexOf("<span>だれの玉</span>") < createHtml.indexOf('class="name-preset-select"'), "create form should place name preset to the right of the name label");
assert(createHtml.indexOf("<span>自由入力</span>") < createHtml.indexOf('name="subject"'), "create form should place subject input to the right of the free input label");
assert(createHtml.indexOf("<span>見せる範囲</span>") < createHtml.indexOf('class="create-title-divider"'), "create form should place divider after visibility");
assert(createHtml.indexOf('class="create-title-divider"') < createHtml.indexOf("<span>タイトル</span>"), "create form should place title after divider");

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
assert(editHtml.includes('class="ball-dialog-backdrop ball-edit-dialog-backdrop"'), "edit form should render a dedicated edit backdrop class");
assert(editHtml.includes('class="ball-dialog ball-edit-dialog"'), "edit form should render a dedicated edit dialog class");
assert(editHtml.includes("<span>日時</span>"), "edit form should label date as datetime");
assert(editHtml.includes("<span>時刻記録</span>"), "edit form should label the timestamp row as timestamp recording");
assert(editHtml.includes("<span>玉数</span>"), "edit form should keep ball count label");
assert(editHtml.includes("<span>だれの玉</span>"), "edit form should label whose ball selector without question mark");
assert(editHtml.includes("<span>自由入力</span>"), "edit form should label the free name input");
assert(editHtml.includes("<span>作り方</span>"), "edit form should label issue mode");
assert(editHtml.includes("<span>見せる範囲</span>"), "edit form should label visibility");
assert(editHtml.includes("<span>タイトル</span>"), "edit form should label title");
assert(!editHtml.includes("<span>日付</span>"), "edit form should not use the old date label");
assert(!editHtml.includes("<span>だれの玉？</span>"), "edit form should not show the old question-mark label");
assert(editHtml.includes('class="timestamp-field edit-timestamp-field edit-inline-field timestamp-field-wide"'), "edit form should render timestamp as a compact horizontal editable row");
assert(editHtml.includes('name="timeEnabled" checked'), "edit form should enable timestamp recording when ball has time");
assert(editHtml.includes('name="time" type="time" value="21:08"'), "edit form should expose the existing time for editing");
assert(editHtml.includes('type="button" data-current-time-button>現在時刻</button>'), "edit form should render a current-time button");
assert(!editHtml.includes("<span>時刻</span>"), "edit form should not show a standalone time label");
assert(editHtml.includes('<input type="checkbox" name="timeEnabled" checked />\n        </label>'), "edit form should not show a standalone timestamp checkbox label");
assert(editHtml.indexOf("<span>時刻記録</span>") < editHtml.indexOf('name="timeEnabled"'), "edit form should place timestamp controls to the right of the timestamp label");
assert(editHtml.indexOf('name="timeEnabled"') < editHtml.indexOf("data-current-time-button"), "edit form should place current-time button after the timestamp checkbox");
assert(editHtml.indexOf("data-current-time-button") < editHtml.indexOf('name="time"'), "edit form should place the time input after the current-time button");
assert(editHtml.indexOf("<span>だれの玉</span>") < editHtml.indexOf('class="name-preset-select"'), "edit form should place name preset to the right of the name label");
assert(editHtml.indexOf("<span>自由入力</span>") < editHtml.indexOf('name="subject"'), "edit form should place subject input to the right of the free input label");
assert(editHtml.indexOf("<span>見せる範囲</span>") < editHtml.indexOf('class="edit-title-divider"'), "edit form should place divider after visibility");
assert(editHtml.indexOf('class="edit-title-divider"') < editHtml.indexOf("<span>タイトル</span>"), "edit form should place title after divider");

const noTimeEditHtml = renderBallEditDialog({ ...sampleBall, time: undefined }, context);
assert(noTimeEditHtml.includes('name="time" type="time" value="" disabled'), "edit form should still show a disabled time input when ball has no time");
assert(!noTimeEditHtml.includes('name="timeEnabled" checked'), "edit form should leave timestamp recording off when ball has no time");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
