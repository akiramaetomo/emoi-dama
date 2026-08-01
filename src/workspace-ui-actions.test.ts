import { createWorkspaceImportSelection } from "./workspace-ui-actions.js";

const defaults = createWorkspaceImportSelection([]);
assertEqual(defaults, {
  addNewBalls: false,
  addNameBookEntries: false,
  replaceCategories: false,
  replaceAppSettings: false,
  replaceConflicts: false,
}, "an empty option list should keep every workspace import section disabled");

const selected = createWorkspaceImportSelection(["newBalls", "nameBook", "categories", "appSettings", "conflicts", "unknown"]);
assertEqual(selected, {
  addNewBalls: true,
  addNameBookEntries: true,
  replaceCategories: true,
  replaceAppSettings: true,
  replaceConflicts: true,
}, "known workspace import options should map to the application callback contract");

console.log("workspace UI action tests passed");

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
