import { bindBallCountSliderControls } from "./ball-count-slider.js";
import {
  createGoogleMapsUrl,
  normalizeDescentRecords,
  type DescentPositionInput,
} from "./descent.js";
import {
  formatDescentCoordinates,
  renderEditableDescentHistory,
} from "./form-renderers.js";
import {
  createBallDraftFromValues,
  createEditedDescentRecordFromValues,
  hasBallDraftChanged,
  haveDescentRecordsChanged,
  readPositiveInteger,
  resolveManualSubjectPreset,
  resolveNamePresetSelection,
  type AuthoringDraftDefaults,
  type EditedDescentFieldValues,
} from "./form-interactions.js";
import {
  type BallDraft,
  type HappyBall,
  type HappyBallDescentRecord,
  type IssuerType,
} from "./models.js";
import { blurActiveEditableWithin } from "./modal-interactions.js";

export type { AuthoringDraftDefaults } from "./form-interactions.js";

export interface AuthoringDescentActionHandlers {
  requestNewDescent: (form: HTMLFormElement, button: HTMLButtonElement) => void | Promise<void>;
  confirmDeleteDescent: (sequence: number) => boolean;
  requestDescentPosition: () => Promise<DescentPositionInput | null>;
}

export interface CreateAuthoringActionHandlers extends AuthoringDescentActionHandlers {
  getDraftDefaults: () => AuthoringDraftDefaults;
  getCurrentLocalTime: () => string;
  changeDraft: (draft: BallDraft) => void;
  submit: (form: HTMLFormElement, draft: BallDraft, descents: HappyBallDescentRecord[]) => void;
  cancel: (form: HTMLFormElement) => void;
}

export interface CreateDiscardConfirmActionHandlers {
  continueEditing: () => void;
  discardAndClose: () => void;
}

export interface EditAuthoringActionHandlers extends AuthoringDescentActionHandlers {
  getDraftDefaults: () => AuthoringDraftDefaults;
  getCurrentLocalTime: () => string;
  submit: (form: HTMLFormElement) => void;
  close: (form: HTMLFormElement) => void;
}

export interface EditSaveConfirmActionHandlers {
  saveWithEcho: () => void;
  saveCorrection: () => void;
  continueEditing: () => void;
  discardAndClose: () => void;
}

export function readAuthoringDraft(form: HTMLFormElement, defaults: AuthoringDraftDefaults): BallDraft {
  return createBallDraftFromValues(new FormData(form), defaults);
}

export function readEditedDescentRecords(
  form: HTMLFormElement,
  createRecordedAt: () => string = () => new Date().toISOString(),
): HappyBallDescentRecord[] {
  return Array.from(form.querySelectorAll<HTMLElement>("[data-descent-edit-item]")).map((item, index) => (
    createEditedDescentRecordFromValues(readEditedDescentFieldValues(item), index, createRecordedAt())
  ));
}

export function hasBallEditFormChanged(
  ball: HappyBall,
  form: HTMLFormElement,
  defaults: AuthoringDraftDefaults,
): boolean {
  return hasBallDraftChanged(ball, readAuthoringDraft(form, defaults))
    || haveDescentRecordsChanged(ball.descents ?? [], readEditedDescentRecords(form));
}

export function bindCreateAuthoringUiActions(root: ParentNode, handlers: CreateAuthoringActionHandlers): void {
  const form = root.querySelector<HTMLFormElement>("#ball-form");
  if (!form) {
    return;
  }

  bindAuthoringFormControls(form, handlers, () => handlers.changeDraft(readAuthoringDraft(form, handlers.getDraftDefaults())));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    handlers.submit(
      form,
      readAuthoringDraft(form, handlers.getDraftDefaults()),
      readEditedDescentRecords(form),
    );
  });
  form.addEventListener("input", () => {
    handlers.changeDraft(readAuthoringDraft(form, handlers.getDraftDefaults()));
  });

  root.querySelectorAll<HTMLElement>("[data-close-panel]").forEach((element) => {
    if (!element.closest(".panel-backdrop-create")) {
      return;
    }
    element.addEventListener("click", (event) => {
      if (element.classList.contains("panel-backdrop")) {
        if (event.target === element) {
          blurActiveEditableWithin(element);
        }
        return;
      }
      handlers.cancel(form);
    });
  });
}

export function bindCreateDiscardConfirmActions(
  root: ParentNode,
  handlers: CreateDiscardConfirmActionHandlers,
): void {
  root.querySelector<HTMLButtonElement>("[data-create-continue]")?.addEventListener("click", handlers.continueEditing);
  root.querySelector<HTMLButtonElement>("[data-create-discard-close]")?.addEventListener("click", handlers.discardAndClose);
}

export function bindEditAuthoringUiActions(root: ParentNode, handlers: EditAuthoringActionHandlers): void {
  const form = root.querySelector<HTMLFormElement>("#ball-edit-form");
  if (!form) {
    return;
  }

  bindAuthoringFormControls(form, handlers);
  const backdrop = root.querySelector<HTMLElement>("[data-dialog-backdrop]");
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      blurActiveEditableWithin(backdrop);
    }
  });
  root.querySelectorAll<HTMLButtonElement>("[data-dialog-close]").forEach((button) => {
    button.addEventListener("click", () => handlers.close(form));
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    handlers.submit(form);
  });
}

export function bindEditSaveConfirmActions(root: ParentNode, handlers: EditSaveConfirmActionHandlers): void {
  root.querySelector<HTMLButtonElement>("[data-edit-save-echo]")?.addEventListener("click", handlers.saveWithEcho);
  root.querySelector<HTMLButtonElement>("[data-edit-save-correction]")?.addEventListener("click", handlers.saveCorrection);
  root.querySelector<HTMLButtonElement>("[data-edit-continue]")?.addEventListener("click", handlers.continueEditing);
  root.querySelector<HTMLButtonElement>("[data-edit-discard-close]")?.addEventListener("click", handlers.discardAndClose);
}

export function replaceAuthoringDescentHistory(
  form: HTMLFormElement,
  records: HappyBallDescentRecord[],
  message: string,
  handlers: AuthoringDescentActionHandlers,
): void {
  const normalizedRecords = normalizeDescentRecords(records);
  const template = document.createElement("template");
  template.innerHTML = renderEditableDescentHistory({
    id: form.dataset.authoringBallId || "pending-ball",
    descents: normalizedRecords,
  }).trim();
  const nextHistory = template.content.firstElementChild as HTMLElement | null;
  if (!nextHistory) {
    return;
  }

  const currentHistory = form.querySelector<HTMLElement>(".edit-descent-history");
  if (currentHistory) {
    currentHistory.replaceWith(nextHistory);
  } else {
    form.querySelector(".authoring-bottom-actions")?.insertAdjacentElement("beforebegin", nextHistory);
  }
  bindAuthoringDescentEvents(nextHistory, handlers);
  const feedback = nextHistory.querySelector<HTMLElement>("[data-edit-descent-feedback]");
  if (feedback) {
    feedback.textContent = message;
  }
}

export function updateAuthoringDescentButtonsBusy(
  root: ParentNode,
  ballId: string,
  busy: boolean,
  sourceButton?: HTMLButtonElement,
): void {
  root.querySelectorAll<HTMLButtonElement>("[data-descend-ball-id]").forEach((button) => {
    if (button.dataset.descendBallId !== ballId) {
      return;
    }
    if (busy) {
      button.dataset.idleText = button.textContent ?? "";
      button.textContent = button === sourceButton ? "位置確認中..." : "降臨中...";
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      return;
    }
    button.textContent = button.dataset.idleText || "降臨";
    button.disabled = false;
    button.removeAttribute("aria-busy");
    delete button.dataset.idleText;
  });
}

function bindAuthoringFormControls(
  form: HTMLFormElement,
  handlers: AuthoringDescentActionHandlers & { getCurrentLocalTime: () => string },
  changeDraft?: () => void,
): void {
  bindBallCountSliderControls(form);
  bindNamePresetEvents(form, changeDraft);
  bindTimeControlEvents(form, handlers.getCurrentLocalTime, changeDraft);
  bindAuthoringDescentEvents(form, handlers);
}

function bindNamePresetEvents(root: ParentNode, changeDraft?: () => void): void {
  root.querySelectorAll<HTMLSelectElement>("[data-name-preset]").forEach((select) => {
    const form = select.closest("form");
    const subjectInput = form?.querySelector<HTMLInputElement>("input[name='subject']");
    const issuerSelect = form?.querySelector<HTMLSelectElement>("select[name='issuerType']");

    select.addEventListener("change", () => {
      const selected = select.selectedOptions[0];
      const resolution = resolveNamePresetSelection({
        name: select.value,
        role: selected?.dataset.nameRole === "proxy" ? "proxy" : "self",
        issuerType: (issuerSelect?.value ?? "self") as IssuerType,
      });
      if (!subjectInput || !resolution) {
        return;
      }
      subjectInput.value = resolution.subject;
      if (issuerSelect) {
        issuerSelect.value = resolution.issuerType;
      }
      changeDraft?.();
    });

    subjectInput?.addEventListener("input", () => {
      select.value = resolveManualSubjectPreset(subjectInput.value, select.value);
    });
  });
}

function bindTimeControlEvents(
  root: ParentNode,
  getCurrentLocalTime: () => string,
  changeDraft?: () => void,
): void {
  root.querySelectorAll<HTMLInputElement>("input[name='timeEnabled']").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const form = checkbox.closest("form");
      const timeInput = form?.querySelector<HTMLInputElement>("input[name='time']");
      if (!timeInput) {
        return;
      }
      timeInput.disabled = !checkbox.checked;
      if (checkbox.checked && !timeInput.value) {
        timeInput.value = getCurrentLocalTime();
      }
      changeDraft?.();
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-current-time-button]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.closest("form");
      const checkbox = form?.querySelector<HTMLInputElement>("input[name='timeEnabled']");
      const timeInput = form?.querySelector<HTMLInputElement>("input[name='time']");
      if (!checkbox || !timeInput) {
        return;
      }
      checkbox.checked = true;
      timeInput.disabled = false;
      timeInput.value = getCurrentLocalTime();
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      timeInput.dispatchEvent(new Event("input", { bubbles: true }));
      timeInput.dispatchEvent(new Event("change", { bubbles: true }));
      changeDraft?.();
    });
  });
}

function bindAuthoringDescentEvents(root: ParentNode, handlers: AuthoringDescentActionHandlers): void {
  root.querySelectorAll<HTMLButtonElement>("[data-descend-ball-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.closest<HTMLFormElement>("[data-ball-authoring-form]");
      if (form) {
        void handlers.requestNewDescent(form, button);
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-descent-delete-record-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest<HTMLElement>("[data-descent-edit-item]");
      const form = item?.closest<HTMLFormElement>("[data-ball-authoring-form]");
      if (!item || !form) {
        return;
      }
      const id = readDescentField(item, "id");
      const sequence = readPositiveInteger(readDescentField(item, "sequence"), 1);
      if (!handlers.confirmDeleteDescent(sequence)) {
        return;
      }
      const marker = document.createElement("input");
      marker.type = "hidden";
      marker.dataset.deletedDescentId = id;
      marker.dataset.deletedDescentSequence = String(sequence);
      form.append(marker);
      item.remove();
      replaceAuthoringDescentHistory(
        form,
        readEditedDescentRecords(form),
        `No.${sequence}を消去予定です。保存で確定します`,
        handlers,
      );
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-descent-gps-record-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest<HTMLElement>("[data-descent-edit-item]");
      if (item) {
        void updateEditDescentGps(item, button, handlers.requestDescentPosition);
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-descent-clear-gps-record-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest<HTMLElement>("[data-descent-edit-item]");
      if (!item) {
        return;
      }
      writeDescentField(item, "latitude", "");
      writeDescentField(item, "longitude", "");
      writeDescentField(item, "accuracyMeters", "");
      writeDescentField(item, "distanceFromPreviousMeters", "");
      updateEditDescentGpsUi(item, null);
      updateDescentActionFeedback(item, "GPSを削除しました");
    });
  });
}

async function updateEditDescentGps(
  item: HTMLElement,
  button: HTMLButtonElement,
  requestDescentPosition: () => Promise<DescentPositionInput | null>,
): Promise<void> {
  setButtonBusy(button, true, "位置確認中...");
  try {
    const position = await requestDescentPosition();
    if (!position) {
      return;
    }
    writeDescentField(item, "latitude", String(position.latitude));
    writeDescentField(item, "longitude", String(position.longitude));
    writeDescentField(item, "accuracyMeters", position.accuracyMeters === undefined ? "" : String(position.accuracyMeters));
    writeDescentField(item, "distanceFromPreviousMeters", "");
    updateEditDescentGpsUi(item, position);
    updateDescentActionFeedback(item, "GPS取得できました");
  } finally {
    setButtonBusy(button, false);
  }
}

function updateEditDescentGpsUi(item: HTMLElement, position: DescentPositionInput | null): void {
  const status = item.querySelector<HTMLElement>("[data-descent-gps-status]");
  const mapSlot = item.querySelector<HTMLElement>("[data-descent-map-link]");
  const locationRow = item.querySelector<HTMLElement>(".edit-descent-location-row");
  const clearButton = item.querySelector<HTMLButtonElement>("[data-descent-clear-gps-record-id]");
  const gpsButton = item.querySelector<HTMLButtonElement>("[data-descent-gps-record-id]");
  if (position) {
    locationRow?.classList.add("has-position");
    locationRow?.classList.remove("is-empty-position");
    if (status) {
      status.textContent = formatDescentCoordinates(position.latitude, position.longitude);
    }
    if (mapSlot) {
      const link = document.createElement("a");
      link.className = "ghost-action quiet-accent-action detail-map-link";
      link.dataset.descentMapLink = "";
      link.href = createGoogleMapsUrl(position);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Google Maps";
      mapSlot.replaceWith(link);
    }
    if (clearButton) {
      clearButton.disabled = false;
    }
    if (gpsButton) {
      gpsButton.textContent = "GPS再取得";
    }
    return;
  }

  locationRow?.classList.add("is-empty-position");
  locationRow?.classList.remove("has-position");
  if (status) {
    status.textContent = "位置未取得";
  }
  if (mapSlot) {
    const placeholder = document.createElement("span");
    placeholder.dataset.descentMapLink = "";
    mapSlot.replaceWith(placeholder);
  }
  if (clearButton) {
    clearButton.disabled = true;
  }
  if (gpsButton) {
    gpsButton.textContent = "GPS取得";
  }
}

function readEditedDescentFieldValues(item: HTMLElement): EditedDescentFieldValues {
  return {
    id: readDescentField(item, "id"),
    sequence: readDescentField(item, "sequence"),
    recordedAt: readDescentField(item, "recordedAt"),
    badgeAwarded: readDescentField(item, "badgeAwarded"),
    memo: readDescentField(item, "memo"),
    latitude: readDescentField(item, "latitude"),
    longitude: readDescentField(item, "longitude"),
    accuracyMeters: readDescentField(item, "accuracyMeters"),
    distanceFromPreviousMeters: readDescentField(item, "distanceFromPreviousMeters"),
  };
}

function readDescentField(root: HTMLElement, field: string): string {
  const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-descent-field="${field}"]`);
  return input?.value ?? "";
}

function writeDescentField(root: HTMLElement, field: string, value: string): void {
  const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-descent-field="${field}"]`);
  if (input) {
    input.value = value;
  }
}

function updateDescentActionFeedback(item: HTMLElement, message: string): void {
  const feedback = item.querySelector<HTMLElement>("[data-descent-action-feedback]");
  if (feedback) {
    feedback.textContent = message;
  }
}

function setButtonBusy(button: HTMLButtonElement, busy: boolean, busyText = "処理中..."): void {
  if (busy) {
    button.dataset.idleText = button.textContent ?? "";
    button.textContent = busyText;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    return;
  }
  button.textContent = button.dataset.idleText || button.textContent || "";
  button.disabled = false;
  button.removeAttribute("aria-busy");
  delete button.dataset.idleText;
}
