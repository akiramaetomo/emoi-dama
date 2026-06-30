import type { Visibility } from "./models";

export type MemoSurfaceMode = "none" | "visible" | "visible-empty" | "private-obscured" | "private-empty";

export function canShowMemoText(visibility: Visibility): boolean {
  return visibility === "open";
}

export function getMemoSurfaceMode(
  visibility: Visibility,
  note: string,
  showMemoField: boolean,
): MemoSurfaceMode {
  const hasMemo = note.trim().length > 0;

  if (canShowMemoText(visibility)) {
    if (hasMemo) {
      return "visible";
    }
    return showMemoField ? "visible-empty" : "none";
  }

  if (!showMemoField) {
    return "none";
  }

  return hasMemo ? "private-obscured" : "private-empty";
}
