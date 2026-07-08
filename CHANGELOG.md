# Changelog

All notable user-visible changes and playable milestones for `えもい玉`
(former `しあわせ玉`) will be documented here.

This project follows a lightweight changelog discipline:

- record user-visible app changes
- record playable or inspectable milestones
- keep speculative ideas in specifications, not the changelog
- keep implementation state in `docs/project-status.md`

## Unreleased

## 0.4.0 - 2026-07-09

- Kept edit-flow `降臨` in the edit dialog after success, with clearer success
  feedback for GPS-backed and GPS-less descents.
- Added a local operation log for receive/send preparation, JSON operations,
  lifecycle changes, `お焚上`, and `降臨`/GPS actions, with settings visibility
  and optional JSON backup export.
- Added issuer and latest `お配り` / `お預け` send-mode hints to Ball List and
  saved-ball list rows.
- Applied a first Safari/iPhone stability pass for Play-surface ball labels so
  text stays on a fixed foreground layer while balls move.
- Added an in-menu `?` help surface for 操作ログ and expanded the Play ball-label
  switch with readable next-mode text on the ball icon plus a new `名前` label
  mode; the unmarked mode now uses a plain ball icon with no `無印` text, and
  the overlaid mode text is flatter with a larger `title` and no extra gray
  ring.

## 0.3.0 - 2026-07-08

- Clarified primary-screen controls: the three main surfaces now show screen
  names above the surface as `Emotion Play`, `Calendar`, and `Ball List`, while
  the bottom control buttons stay icon-only.
- Made per-ball counts easier to notice without turning them into form rows:
  multi-count balls now show `N玉` under the ball icon in `玉の中身`, saved-ball
  lists, and the one-day Ball List; single balls do not show a count badge.
- Moved Play period state and Calendar marker-mode state above the bottom
  controls, leaving the period and marker-mode buttons as icon-only actions.
- Tuned the icon-only controls: Calendar uses a shorter top bar, Play's period
  action uses clearer day/week/month symbols, and the three screen titles use
  a quieter, more formal title treatment.
- Enlarged the current-mode labels and the `玉の中身` multi-ball count, and
  adjusted mobile viewport handling so the edit screen is less likely to reveal
  a black page area above the soft keyboard.
- Kept Play and Calendar month selection in sync both ways: changing months in
  Calendar now updates the Play anchor month while preserving the day number
  when possible.
- Added a calendar month marker mode toggle. The new `メーター` mode groups
  each day's balls by saved ball record and shows up to three left-aligned
  rows, so multi-count balls can read like simple condition meters while the
  existing `通常` mini-ball spread remains available.
- Improved `降臨` location handling for underground or unstable GPS
  environments: the app no longer accepts long-lived cached coordinates as the
  current place, gathers fresh location candidates before saving a GPS-backed
  descent, and lets users keep a GPS-less provisional descent when the current
  position cannot be confirmed as far enough from the previous GPS descent.
- Made `Google Maps` descent links easier to notice and tap while keeping the
  button text unchanged.

## 0.2.1 - 2026-07-07

- Improved `降臨` handling when GPS is slow or unavailable: descent buttons now
  show a waiting state and prevent duplicate presses, GPS-less provisional
  descents can keep memo and star state, and GPS can later be acquired or
  deleted from the edit screen without losing the memo, sequence, or stars.
  Ball details and edit screens now show one descent directly and fold older
  entries, while Play/list/edit surfaces show clearer descent star indicators.
- Made `降臨` GPS acquisition more patient by trying cached, normal, and
  high-accuracy location reads before offering a GPS-less provisional descent,
  and by showing clearer permission/unavailable/timeout guidance when location
  still cannot be obtained.
- Polished descent display: Play-surface descent stars are smaller, translucent,
  and pushed farther toward the ball edge, while ball detail and edit descent
  sections now use a quieter `降臨情報` heading and `No.n` descent rows without
  the redundant count/star summary cards.
- Tuned final descent UI spacing by moving the detail-dialog descent star count
  to the ball's upper-left, matching `降臨情報` label styling with other detail
  labels, and tightening edit lifecycle action buttons for smartphone widths.

## 0.2.0 - 2026-07-07

- Changed the creation panel so opening `玉を置く` refreshes the draft timestamp
  to the current local time only when `時刻記録` is enabled. Opening `玉を編集`
  keeps the saved timestamp unchanged.
- Paused the Play surface's Rapier physics stage while calendar, creation,
  settings, list, or import overlays are in front, reducing background motion
  and preventing hidden collision sounds.
- Added the first real `降臨` model: successful descents save local GPS history
  with optional short notes, enforce a configurable re-descent distance, add
  star badges to Play balls, mark 20-star balls as `神玉`, and show numbered
  descent history with Google Maps links in ball details. Shared URL/LINE
  packets omit exact GPS coordinates.
- Changed startup to open the calendar month view by default, added a display
  setting for choosing the startup screen from the three primary screens, and
  grouped the bottom `ボール` / calendar / one-day list controls with calendar
  and ball-list icons. Desktop calendar cells now show up to 15 mini balls
  before numeric overflow, and one-day list rows always show the ball date even
  when no time is recorded.
- Added a `送る` card to the ball detail view with separate `お配り` and
  `お預け` actions. `お配り` generates a lighter `Emoi Dama Cover Note` paper,
  QR, image, and URL packet mode, while formal `お預け状` / `預かり証` papers now
  avoid duplicate title and keeper rows. The card omits ambiguous prepared
  status, and the ball detail category/echo card now uses the full width.
- Tightened the `玉を置く` and `玉を編集` forms for smartphone use by changing
  their key fields to compact `ラベル | 入力` rows: `日時`, `時刻`, `玉数`,
  `だれの玉`, `自由入力`, `作り方`, `タイトル`, and `見せる範囲`. The timestamp
  row now says `時刻記録`, includes a `現在時刻` fill button, and omits the old
  standalone `時刻` / `記録` labels. A divider before `タイトル` makes the title
  field easier to find. The create and edit form widths now match more closely,
  and the shared time input is wider on desktop and smartphone.
- Added optional per-ball time recording. `玉を置く` and `玉を編集` now include a
  `時刻記録` checkbox with a time input, saved timestamps can be changed or
  removed later, and recorded times appear in ball details, day lists, and
  receipt-style views.
- Fixed the timestamp controls so `記録` and the time input appear as a
  full-width row in both create and edit forms instead of being clipped in a
  narrow date row.
- Added lifecycle management actions to `玉を編集` and `保存された玉`: `しまう`
  keeps a smoky darker trace in the calendar and play surface, `供養` hides the
  ball from normal surfaces while keeping its data, `お焚上` deletes the ball
  from local data after confirmation, and `降臨` obtains location as a
  placeholder for future place-based behavior. For archived balls, the `しまう`
  action becomes `戻す` and restores the ball to normal display. Archived
  calendar/play rendering suppresses extra `余韻` glow so the smoky trace stays
  calm, and the `玉の中身` ball now uses the same thin archived color language
  as the main surface with a `しまい中` detail label.
- Tuned the mini balls attached to category and `余韻` values in `玉の中身` to
  match the category mini balls used in the edit screen.
- Changed the calendar so tapping a day opens that day's management list inside
  the calendar. The list is denser for daily review, showing compact ball
  visuals, category/echo-category metadata, memo excerpts, content/edit
  actions, lifecycle actions, and daily `供養済み` history while omitting
  URL/LINE/降臨 actions. Main, calendar, and the one-day list now share a bottom
  bar for create, main, Cal, selected-day list, period switching, and settings
  transitions. The one-day list title is just the date with previous/next day
  controls, labels active balls as `表示中`, and mutes `しまい中` rows with a
  gray-sepia treatment.
- Kept the calendar day-list scroll position stable after pressing `しまう`,
  `戻す`, or `お焚上`, so managing lower items no longer jumps back to the top.
- Compactly fit the shared bottom bar on phone widths by replacing the
  separate `日` / `週` / `月` controls with one cycling period button. The main
  ball icon now cycles ball labels `なし` -> `日付` -> `題`, while calendar and
  one-day list ball icons still return to the main surface. Creating a ball
  from the calendar month view or one-day list now returns to that same surface
  after saving.
- Defined the main surface, calendar month, and one-day ball list as equal
  primary screens. Closing or canceling create/settings-style sub-features now
  returns to the primary screen that opened them, instead of always falling back
  to the main surface.
- Startup now anchors the main surface and calendar month to today's local date.
  Calendar month cells show up to 10 mini balls on wider screens and up to 6 on
  phone widths before switching to numeric overflow.
- Removed the calendar month view's top-right close button so primary screen
  navigation stays concentrated in the shared bottom bar, and centered the
  month navigation header after that removal.
- Tuned the one-day list's row ball visual so each listed ball is easier to
  recognize without turning the list into a tall card layout, with wider and
  more transparent echo blur on echoed row balls.
- Changed selected rows in the one-day list and selected days in the calendar
  to use border emphasis instead of a yellow filled background.
- Darkened archived / `しまい中` rows in the one-day list so archiving reads as
  muted gray instead of a selected yellow fill.
- Fixed an Edge-visible settings layout regression where the
  `バックアップ・復元` group could appear displaced horizontally by removing
  action buttons from the `<summary>` row and keeping backup actions inside the
  opened panel body. The group no longer uses the old `export-panel`-specific
  hook or dedicated layout rule; it now follows the normal settings-group
  structure with copy, options, then actions.

## 0.1.0 - 2026-07-03

- Changed the empty main-screen title from `最初の玉を置く` to
  `今日のえもい玉は？`.
- Added a quiet lower-control hint, `＋で玉を置きましょう`, so creation guidance
  stays close to the `＋` button.
- Made the lower-control creation hint disappear after the `＋` creation button
  is pressed once in the current app session.
- Removed the decorative empty-state ball from the main Toy surface and reused
  the orange/green ball treatment as a non-interactive brand mark at the top of
  the settings panel.
- Tuned the settings-panel brand mark so the `えもい玉` label sits on the ball
  and the vertical spacing is tighter.
- Added a restrained `本日` marker to the calendar by highlighting today's date
  with a blue-green frame and small label that stay distinguishable from the
  selected-day styling.
- Made the background `emoi dama` wordmark larger and clearer, made the default
  grid texture slightly more visible, and added a `背景質感` selector with
  `ほの格子`, `ざら紙`, `粒の余韻`, `霞`, and `ランダム粒` choices. The wordmark
  strength was then tuned back toward the earlier subtler look while keeping
  the larger size.
- Added the `先々` category family with six ring + transparent/glassy presets:
  `先々・期待`, `先々・楽しみ`, `先々・重要`, `先々・不安`, `先々・仕事`, and
  `先々・予定`. These balls keep a thick color-identifiable rim, preserve their
  visual kind in saved data, and still participate in the normal `余韻` rule.
- Tuned the `先々` ring balls by slimming the rim, removing the inner small
  circle, and moving the rotation cue onto the rim highlight itself.
- Retuned the `先々` rim to an intermediate thickness, increased fill
  transparency, and strengthened the rim-based rotation cue.
- Raised the `先々` rim opacity and brightness so ring colors do not sink into
  the dark background.
- Improved the smartphone category settings layout so longer `先々・...` labels
  remain visible while editing.
- Fixed the detail dialog's `余韻` value so longer `先々・...` labels wrap
  instead of being clipped.
- Changed the detail dialog metadata layout so issuer, category, and echo read
  as separate rows, with mini ball icons shown for both category and echo.
- Returned category and echo to a shared detail card while keeping them as
  readable rows, and thickened detail-card borders to match the settings panel.
- Removed the name-book settings save button. Name and role edits now apply
  immediately and show a short `変更しました` response.
- Removed the category settings save button. Category label edits now apply
  immediately and show a short `反映しました` response.
- Stopped normal category preset edits and resets from renaming, recoloring, or
  relabeling saved balls.
- Clarified that category presets are input aids and must not retroactively
  rename or recolor saved balls.
- Changed destructive cleanup so `玉データ管理` clears saved balls only, while
  name-book reset is a separate confirmed action inside `名前帳`.
- Merged saved-ball management and full ball-data clearing into one
  `玉データ管理` settings section.
- Renamed the JSON export section to `バックアップ・復元` and removed separate
  raw `台帳JSON` and `設定JSON` surfaces from the normal settings UI.
- Clarified that selected backup sections are written into one backup file.
- Moved the `重力センサー` toggle to the bottom of the movement settings group.
- Kept opened settings groups expanded after settings changes such as toggling
  the gravity sensor.
- Made the gear/settings menu behave as a single-open accordion so opening one
  settings group closes the previously open group.
- Renamed `質感設定` to `サウンド・ビジュアル` and separated movement controls
  from sound controls inside the settings menu.
- Removed extra explanatory copy from the `余韻光芒` display setting.
- Grouped the `メモ欄表示` explanation closer to its checkbox in display
  settings.
- Simplified the display settings explanation for `メモ欄表示`.
- Removed extra explanatory copy from the name-book settings section.
- Moved the category reset action away from the category save button and added
  a confirmation prompt before category initialization.
- Added an `アプリバージョン` section to the gear/settings panel showing the official
  app version baseline, public app-version state, and latest retrospective
  Pages reference label.
- Centered the gear/settings panel on wider screens while keeping the narrow
  mobile settings panel full-width.
- Published the latest receipt QR/image handoff prototype to the public
  `emoi-dama` GitHub Pages repository and attached the root `LICENSE.md`
  rights notice.
- Added public license/rights notice templates stating that the prototype is
  source-available for viewing/evaluation only, not MIT/open source.
- Added a PoC `QR表示` flow for `お預け状` / `預かり証`, letting a second phone
  scan the receipt packet URL and open the received paper screen from a
  reachable Pages/LAN URL.
- Replaced the long raw URL text on the `お預け状` / `預かり証` paper with a QR
  display, while keeping explicit URL copy actions available.
- Added `画像で送る` and `画像保存` actions for `お預け状` / `預かり証`, generating
  a PNG receipt image with the QR embedded for LINE or manual saving.
- Changed `見せる範囲` into the four-step ladder `カテゴリまで` /
  `発行者まで` / `タイトルまで` / `メモも表示`, and aligned ball detail,
  receipt paper, selected-ball title, and the `題` label display with that
  ladder while treating old `存在だけ` data as `カテゴリまで`.
- Renamed the `見せる範囲` issuer-level label from `作成者まで` to
  `発行者まで` for terminology consistency.
- Restored the `メモ欄表示` detail behavior so balls that do not expose memo
  text still show a blank or dummy/obfuscated memo field when the setting is on.
- Centered the `玉を置く` creation panel so it no longer appears as a
  right-aligned management panel.
- Unified the upper screen labels for `玉を置く`, `玉の中身`, and `玉を編集`
  as larger, calmer yellow-toned labels, and removed the redundant top date
  from the edit dialog while keeping the editable calendar field.
- Simplified the `玉の中身` issuer card for normal self-created balls while
  keeping short `いっしょに作成` / `AAAさんが代理作成` helper lines for
  non-self creation.
- Simplified the `玉を編集` owner-name input hint and surfaced the current
  category name/color in the collapsed category section.
- Centered the main ball-world date/title display at the top of the screen.
- Improved mobile dialog ergonomics by stacking the `玉の中身` edit button
  below the close button and stopping the edit dialog from auto-focusing the
  title input.
- Added an unsaved-change confirmation to the `玉を編集` dialog and removed its
  redundant top save button.
- Added edit save modes so changed balls can be saved either as a new `余韻`
  layer or as a correction that keeps any existing echo without creating a new
  one.
- Replaced the main `玉` management button with `日` / `週` / `月` display
  modes, moved saved-ball management into the gear menu, removed the calendar
  bottom `全ての玉` action, and added horizontal swipe plus desktop left/right
  key navigation for stepping the visible period.
- Changed the lower `字` control into a three-state ball-label switch for no
  label, date label, and title label, with longer title labels shrinking and
  wrapping inside the ball.
- Fixed title labels from the `字` control so they do not reveal content beyond
  each ball's `見せる範囲`.
- Changed new ball drafts so `見せる範囲` defaults to `メモも表示`; existing saved
  balls keep their current visibility values.
- Fixed period swipe navigation so it continues working after moving to a day,
  week, or month with no visible balls.
- Hardened impact audio on iPad/Safari-class browsers so audio unlock and
  playback failures degrade to silence instead of a fatal app state, ball
  gestures can unlock audio directly, and the app suspends/closes Web Audio
  resources when the page is hidden or left.
- Stabilized the mobile/tablet viewport height used by the main ball world by
  syncing a CSS `--app-viewport-height` value from `visualViewport` /
  `innerHeight`, then using it for the app shell, ball-world shell, stage, and
  full-height overlays.
- Enlarged shared overlay close controls from the small dark circle toward a
  warmer yellow circular button with a dark `×`, including related spacing for
  calendar, panels, detail dialogs, receipt dialogs, and manual-copy dialogs.
- Lightened the settings menu section frames and backgrounds slightly, with
  opened sections receiving a softer brighter surface so the gear menu is
  easier to scan without losing the subdued app mood.
- Renamed the ball creation/editing copy from `できかた` to `作り方`,
  `本人から` to `本人が作成`, and `見せ方` / `見せかた` to `見せる範囲`.
- Fixed calendar layout at tablet and narrow/landscape sizes so day numbers
  stay close to mini balls, mini balls can spread horizontally on wider
  calendar cells while narrow portrait phones keep a compact 2-by-3 group, and
  the full-screen calendar can scroll when phone landscape height is too short.
  The calendar month navigation buttons are also easier to see and tap.
- Hardened local ledger loading so a partly corrupted saved ledger can keep
  recoverable balls instead of falling back to an empty ledger, and older balls
  without visual snapshots regain stable ball visuals.
- Hardened app settings normalization so imported or hand-edited JSON accepts
  only real booleans for toggle settings, while numeric tuning values are
  clamped to safe ranges.
- Moved JSON export/import review into a tested module and fixed normalized
  imported balls so absent optional fields do not create false same-ID
  conflicts.
- Established the initial project documentation and integrated specification
  baseline.
- Added separate English and Japanese philosophy-first README files for both
  the development repository and the public `emoi-dama` GitHub Pages
  repository.
- Refined the tapped-ball detail dialog toward a lighter `玉の中身` surface:
  primary information is shown as compact cards, secondary ledger fields are
  folded away, the top-right edit action is easier to reach, and `お預け状` /
  `預かり証` now tracks first URL-copy creation intent. The folded metadata now
  keeps label/value rows compact while allowing full ball ID expansion when
  needed.
- Added the first Web app scaffold and local prototype slice: create one
  `しあわせ玉`, save it to localStorage, display it as balls, and inspect/copy
  the ledger JSON.
- Reworked the first prototype surface to use Rapier 2D so saved balls can be
  grabbed, flicked, rolled, bounced against walls, and collided with each
  other. The saved-ball list now supports individual deletion.
- Added containment, impact sound, tuning sliders, and editable settings JSON
  for the first Rapier prototype surface.
- Fixed a startup failure caused by loading saved tuning settings before the
  default settings constant was initialized.
- Stabilized the first Rapier surface: ball rendering now combines translation
  and rotation in one transform, dragging uses kinematic Rapier movement, stuck
  overlaps are separated, and the default bounce settings were reset toward a
  calmer tamaping-like feel.
- Improved the first ball-feel UI: the ball body now rotates separately from a
  fixed highlight layer, tapping a ball updates the attribute summary, tuning
  values update live, and tuning/data-destructive controls moved into a
  settings panel.
- Added persistent visual identity to ball records. Ball color and short label
  are now stored under each ball's data, and migrated from prior display color, so
  adding more balls no longer changes existing ball colors.
- Added a ball detail dialog. Short tapping/clicking a ball now opens its saved
  data while keeping the ledger list and selected-summary display.
- Added prototype editing for saved balls. Existing records can be edited from
  the ledger list or the ball detail dialog while preserving the ball ID and
  color.
- Expanded ball labels so the visible text can carry roughly four full-width
  Japanese characters.
- Enlarged ball labels and small UI text to better match elderly-readable
  sizing.
- Shifted the prototype toward `えもい玉`: the visible app copy now uses the new
  name, the home screen is ball-world-first, creation/list/settings open as
  overlays, a full-screen mini-ball calendar filters the Toy surface by day,
  and supported mobile browsers can opt into device-orientation gravity.
- Fixed ball creation from the overlay UI and simplified the settings overlay
  hierarchy so the gear button opens one settings/data surface instead of a
  nested gear menu.
- Fixed the calendar-selected creation date so a day chosen from the full-screen
  calendar becomes the next ball's default date, and hardened Rapier stage
  teardown to avoid stale physics ticks after view changes.
- Reduced mobile Rapier instability by avoiding physics stepping when there are
  no balls, avoiding world rebuilds on viewport resize, and stopping the local
  physics loop instead of crashing the whole app if Rapier throws.
- Simplified the ball-world chrome: removed the bottom selected-ball summary
  and visible ball counter, always shows the current display mode as `全ての玉`
  or a selected day, reduced mobile title size, expanded the saved-ball overlay
  height, and added DeviceMotion fallback for gravity input.
- Tightened the calendar and main controls: day cells now contain up to 6 mini
  balls in a 2x3 grid before numeric overflow, the main controls are larger and
  centered, and the top selected-ball title no longer clips Japanese glyphs.
- Changed the main ball world into a full-viewport surface with floating title
  and controls, removed the main-surface `全ての玉` clear button after calendar
  day selection, and replaced the white-ish field with a darker material-like
  stage.
- Fixed a desktop-only invisible lower-wall bounce after full-viewport layout
  changes and moved floating panels such as settings away from the white base.
- Darkened ball detail/edit dialogs, removed the visible main-surface `G`
  button in favor of the settings checkbox, and added an 18-color preset
  category palette that drives new and category-edited ball colors.
- Kept ball gradients closer to their category color, hid redundant ball-surface
  labels, and tightened pointer/touch dragging so the visible ball position and
  physics body stay aligned.
- Added a lower `字` control to toggle ball text labels, made category names
  editable and shared across all balls, and removed the redundant category-only
  sticky note from the ball detail dialog.
- Preserved ball position, velocity, and rotation across UI control/overlay
  re-renders so controls no longer snap the Toy surface back to its initial
  layout.
- Moved the app title out of the top-left overlay and into a centered, subtle
  `emoi dama` wordmark blended into the ball-field background.
- Added first URL packet exchange: a saved ball can copy an import URL, opening
  that URL shows an import confirmation, and only non-duplicate ball IDs are
  added to the local ledger.
- Added the first in-app paper preview. Ball details now expose `お預け状` for
  self/assisted balls and `預かり証` for proxy balls, with human-readable ball
  information and URL packet copy access.
- Improved the receipt preview controls so the close button and receipt actions
  stay reachable without scrolling to the bottom of the receipt.
- Adjusted paper preview wording so self/assisted papers show issuer-name-based
  text such as `XYZさん発行` instead of `本人発行` when viewed by another person.
- Added a local name book in settings. Up to 10 names can be registered as
  `自分` or `代理`, the creation/edit forms now say `だれの玉？`, and registered
  names can be selected while still allowing per-ball free text.
- Tightened the settings panel layout: the name book now uses compact
  horizontal rows, and settings groups can be collapsed from the gear panel.
- Made the gear panel start with all settings groups collapsed, ordered as
  name book, category, feel, ledger JSON, and data management.
- Moved important settings actions to the top of each opened group, including
  save buttons for the name book and category settings.
- Made save buttons more prominent in opened settings group headers while
  keeping them hidden when groups are collapsed.
- Unified the ledger JSON copy button with the prominent opened-group action
  style and added a fallback copy prompt when the Clipboard API is unavailable.
- Improved JSON copy fallback so the app first tries a legacy system copy path,
  and only then shows a multi-line manual copy dialog if automatic copy is not
  possible.
- Tightened the ball edit dialog with horizontal label/control rows, a folded
  category section, and save buttons at both the top and bottom.
- Refined the mobile ball edit dialog so the top save button stays compact
  beside the title and label/control rows remain visible on narrow screens.
- Widened the mobile settings panel to use the full screen, capped wider
  panels, moved the edit top save button to the right, and made the edit memo
  field use full width.
- Fixed the mobile CSS cascade so the full-width settings panel, right-aligned
  edit save button, and full-width edit memo field apply on narrow screens.
- Tightened the edit dialog's top save-button alignment and kept edit-form
  labels such as `だれの玉？` on one line on narrow screens.
- Aligned stacked edit-form labels with the first control row so `だれの玉？`
  sits beside the name selector instead of between the selector and helper text.
- Shortened the `だれの玉？` helper text to `登録名選択または自由に入力`.
- Made the tapped-ball detail dialog more transparent and changed its
  smartphone metadata rows to a compact label/value layout.
- Reduced the tapped-ball detail backdrop blur so the dialog blends more gently
  with the Toy surface.
- Renamed the `open` visibility label to `メモも表示` and added a settings
  toggle for showing blank or obfuscated memo fields when memo text is hidden.
- Added selectable JSON export for ledger data, app settings, and category
  settings, with filenames that include the selected export sections.
- Added JSON import with a confirmation step for ledger data, app settings, and
  category settings. Ledger import adds only new ball IDs and preserves existing
  local names/settings unless their section is selected.
- Added a LINE/message-app URL copy path for one-ball sharing. The app now
  accepts query import URLs such as `?openExternalBrowser=1&import=...` while
  keeping the normal fragment URL copy path available.
- Added a two-state feeling echo for ball re-evaluation. When a saved ball is
  edited, the current category becomes the filled ball color while the previous
  state remains as an outer `余韻` glow. Same-category saves intentionally create
  a same-color echo. The settings surface can now set that glow to off, weak,
  medium, or strong.
- Refined the URL receive screen so a received `お預け状` / `預かり証` appears as
  the same paper-like artifact as the sender preview, with receipt-oriented
  wording, a short top message, clearer close/remove-paper actions, and an
  explicit same-ID overwrite receive action for conflicting received balls.
  Choosing to view the paper later now leaves a compact text-plus-view reminder
  so the received paper can be reopened without reloading the page.
- Simplified the `お預け状` / `預かり証` paper content so the paper focuses on
  issuer, `預け先` / `預かり者`, tightly paired category and `余韻`, and `メモ`
  instead of showing ledger-like fields such as visibility, approval, count, or
  ball ID. The category and `余韻` value now appears as a simple inline pair
  instead of separate chip-like labels, and hidden memo text is no longer
  described in words on the paper.
- Clarified the URL receive conflict screen: when a received paper has the same
  ID as a different local ball, the supporting conflict list now shows the
  local ball that would be overwritten instead of repeating the received paper.
