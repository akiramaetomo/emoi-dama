import type { IssuerType, NameRole } from "./models.js";

export function resolveNamePresetSelection(input: {
  name: string;
  role?: NameRole;
  issuerType: IssuerType;
}): { subject: string; issuerType: IssuerType } | null {
  const subject = input.name.trim();
  if (!subject) {
    return null;
  }

  if (input.role === "proxy") {
    return { subject, issuerType: "proxy" };
  }

  return {
    subject,
    issuerType: input.issuerType === "proxy" ? "self" : input.issuerType,
  };
}

export function resolveManualSubjectPreset(subject: string, selectedPreset: string): string {
  return subject.trim() === selectedPreset.trim() ? selectedPreset : "";
}
