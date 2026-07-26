import { categoryColorPresets } from "./categories.js";
import type { HappyBallLedger } from "./models.js";
import { DEFAULT_APP_SETTINGS } from "./settings.js";
import {
  activateNextWorkspace,
  addWorkspace,
  getActiveWorkspace,
  getWorkspaceDisplayCode,
  loadOrCreateWorkspaceStore,
  saveWorkspaceStore,
  WORKSPACE_STORE_KEY,
  type HappyBallWorkspace,
} from "./workspace.js";

const values = new Map<string, string>();
let failWrites = false;
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrites) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      values.set(key, value);
    },
  },
  configurable: true,
});
Object.defineProperty(globalThis, "crypto", {
  value: {
    getRandomValues: (array: Uint8Array) => {
      array.fill(7);
      return array;
    },
  },
  configurable: true,
});

const ledger: HappyBallLedger = {
  v: 1,
  type: "happy-ball-ledger",
  ledgerId: "ledger_legacy_32bit",
  ownerProfile: { name: "自分", nameBook: [] },
  balls: [],
  createdAt: "2026-07-26T00:00:00.000Z",
  updatedAt: "2026-07-26T00:00:00.000Z",
};
const store = loadOrCreateWorkspaceStore({ ledger, categories: categoryColorPresets, appSettings: DEFAULT_APP_SETTINGS }, "2026-07-26T00:00:00.000Z");
assert(store.workspaces.length === 1, "legacy state should become one self workspace");
assert(store.workspaces[0].workspaceId === "workspace_07070707070707070707070707070707", "migration should create a 128-bit workspace ID");
assert(store.workspaces[0].ledger.ledgerId === "ledger_legacy_32bit", "migration should preserve the legacy ledger ID");
assert(values.has(WORKSPACE_STORE_KEY), "migration should save the workspace store");
const reloadedStore = loadOrCreateWorkspaceStore({ ledger, categories: categoryColorPresets, appSettings: DEFAULT_APP_SETTINGS }, "2026-07-27T00:00:00.000Z");
assert(reloadedStore.workspaces[0].workspaceId === store.workspaces[0].workspaceId, "reload should preserve the self workspace ID instead of regenerating it");

const received: HappyBallWorkspace = {
  ...store.workspaces[0],
  workspaceId: "workspace_abc11111111111111111111111111111",
  sourceWorkspaceId: "workspace_abc11111111111111111111111111111",
  role: "received",
  displayName: "父",
};
const secondReceived: HappyBallWorkspace = {
  ...received,
  workspaceId: "workspace_abc22222222222222222222222222222",
  sourceWorkspaceId: "workspace_abc22222222222222222222222222222",
  displayName: "母",
};
const withTwo = addWorkspace(store, received);
assert(withTwo !== null, "a received workspace should fit into an empty slot");
const withThree = addWorkspace(withTwo!, secondReceived);
assert(withThree !== null, "a second received workspace should fit");
assert(getWorkspaceDisplayCode(withThree!, received.workspaceId) === "ABC1", "colliding three-character codes should extend");
const cycled = activateNextWorkspace(withThree!);
assert(getActiveWorkspace(cycled).workspaceId === received.workspaceId, "workspace cycling should advance from self to the first received workspace");
saveWorkspaceStore(cycled);

const thirdReceived: HappyBallWorkspace = {
  ...received,
  workspaceId: "workspace_def33333333333333333333333333333",
  sourceWorkspaceId: "workspace_def33333333333333333333333333333",
  displayName: "祖母",
};
const fullStore = addWorkspace(withThree!, thirdReceived);
assert(fullStore?.workspaces.length === 4, "self plus three received workspaces should fill all four slots");
assert(addWorkspace(fullStore!, { ...thirdReceived, workspaceId: "workspace_overflow", sourceWorkspaceId: "workspace_overflow" }) === null, "a fifth workspace should be rejected");

const storedBeforeFailure = values.get(WORKSPACE_STORE_KEY);
failWrites = true;
let saveFailed = false;
try {
  saveWorkspaceStore(fullStore!);
} catch {
  saveFailed = true;
}
failWrites = false;
assert(saveFailed, "workspace save failures should remain observable to the transaction caller");
assert(values.get(WORKSPACE_STORE_KEY) === storedBeforeFailure, "a failed workspace save should preserve the previous serialized store");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
