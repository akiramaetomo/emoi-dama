import type { WorkspaceImportSelection } from "./workspace-transfer";

export type WorkspaceShareActionMode = "share" | "download";

export interface WorkspaceUiActionHandlers {
  cycleWorkspace: () => void;
  exportWorkspaceSelection: (form: HTMLFormElement, mode: WorkspaceShareActionMode) => void | Promise<void>;
  syncWorkspaceShareFormState: (form: HTMLFormElement) => void;
  openJsonImportFile: (input: HTMLInputElement) => void;
  importJsonFile: (input: HTMLInputElement) => void | Promise<void>;
  dismissJsonImport: () => void;
  confirmJsonImport: () => void;
  changeWorkspaceDisplayName: (workspaceId: string, displayName: string) => string | undefined;
  deleteWorkspace: (workspaceId: string) => void;
  selectWorkspaceImportTarget: (workspaceId: string) => void;
  confirmWorkspaceImport: (selection: WorkspaceImportSelection) => void;
  confirmDeviceBackupImport: () => void;
  cancelWorkspaceImport: () => void;
  cancelDeviceBackupImport: () => void;
}

interface WorkspaceUiActionsContext {
  handlers: WorkspaceUiActionHandlers;
  root?: ParentNode;
}

export function bindWorkspaceUiActions(context: WorkspaceUiActionsContext): void {
  const root = context.root ?? document;
  const { handlers } = context;

  root.querySelectorAll<HTMLButtonElement>("[data-cycle-workspace]").forEach((button) => {
    button.addEventListener("click", handlers.cycleWorkspace);
  });

  bindWorkspaceShareForm(root, handlers);
  bindJsonImportFilePicker(root, handlers);
  bindJsonImportDialog(root, handlers);
  bindWorkspaceManagement(root, handlers);
  bindWorkspaceImportDialog(root, handlers);
}

export function createWorkspaceImportSelection(selectedValues: Iterable<string>): WorkspaceImportSelection {
  const selected = new Set(selectedValues);
  return {
    addNewBalls: selected.has("newBalls"),
    addNameBookEntries: selected.has("nameBook"),
    replaceCategories: selected.has("categories"),
    replaceAppSettings: selected.has("appSettings"),
    replaceConflicts: selected.has("conflicts"),
  };
}

function bindWorkspaceShareForm(root: ParentNode, handlers: WorkspaceUiActionHandlers): void {
  const form = root.querySelector<HTMLFormElement>("#workspace-share-form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const submitter = (event as SubmitEvent).submitter as HTMLElement | null;
    const mode = submitter?.dataset.workspaceShareMode === "download" ? "download" : "share";
    void handlers.exportWorkspaceSelection(form, mode);
  });
  form.querySelectorAll<HTMLInputElement>("input[type='date']").forEach((input) => {
    input.addEventListener("input", () => handlers.syncWorkspaceShareFormState(form));
    input.addEventListener("change", () => handlers.syncWorkspaceShareFormState(form));
  });
  handlers.syncWorkspaceShareFormState(form);
}

function bindJsonImportFilePicker(root: ParentNode, handlers: WorkspaceUiActionHandlers): void {
  const input = root.querySelector<HTMLInputElement>("#import-json-file");
  root.querySelector("#import-json")?.addEventListener("click", () => {
    if (input) {
      handlers.openJsonImportFile(input);
    }
  });
  input?.addEventListener("change", () => {
    void handlers.importJsonFile(input);
  });
}

function bindJsonImportDialog(root: ParentNode, handlers: WorkspaceUiActionHandlers): void {
  root.querySelector("#dismiss-json-import")?.addEventListener("click", handlers.dismissJsonImport);
  root.querySelector("#confirm-json-import")?.addEventListener("click", handlers.confirmJsonImport);
  root.querySelector("#confirm-device-backup-import")?.addEventListener("click", handlers.confirmDeviceBackupImport);
  root.querySelector<HTMLElement>("[data-cancel-device-backup-import]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      handlers.cancelDeviceBackupImport();
    }
  });
}

function bindWorkspaceManagement(root: ParentNode, handlers: WorkspaceUiActionHandlers): void {
  root.querySelectorAll<HTMLInputElement>("[data-workspace-display-name]").forEach((input) => {
    input.addEventListener("change", () => {
      const workspaceId = input.dataset.workspaceDisplayName;
      if (!workspaceId) {
        return;
      }
      const replacement = handlers.changeWorkspaceDisplayName(workspaceId, input.value);
      if (replacement !== undefined) {
        input.value = replacement;
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-delete-workspace-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const workspaceId = button.dataset.deleteWorkspaceId;
      if (workspaceId) {
        handlers.deleteWorkspace(workspaceId);
      }
    });
  });
}

function bindWorkspaceImportDialog(root: ParentNode, handlers: WorkspaceUiActionHandlers): void {
  root.querySelectorAll<HTMLInputElement>("input[name='workspace-import-target']").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        handlers.selectWorkspaceImportTarget(input.value);
      }
    });
  });

  root.querySelectorAll<HTMLInputElement>("input[name='workspace-import-option']").forEach((input) => {
    input.addEventListener("change", () => syncWorkspaceImportConfirmState(root));
  });

  root.querySelector("#confirm-workspace-import")?.addEventListener("click", () => {
    handlers.confirmWorkspaceImport(readWorkspaceImportSelection(root));
  });
  root.querySelector<HTMLElement>("[data-cancel-workspace-import]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      handlers.cancelWorkspaceImport();
    }
  });
}

function syncWorkspaceImportConfirmState(root: ParentNode): void {
  const confirmButton = root.querySelector<HTMLButtonElement>("#confirm-workspace-import");
  if (confirmButton) {
    confirmButton.disabled = root.querySelectorAll("input[name='workspace-import-option']:checked").length === 0;
  }
}

function readWorkspaceImportSelection(root: ParentNode): WorkspaceImportSelection {
  return createWorkspaceImportSelection(
    Array.from(root.querySelectorAll<HTMLInputElement>("input[name='workspace-import-option']:checked"))
      .map((input) => input.value),
  );
}
