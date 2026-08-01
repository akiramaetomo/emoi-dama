import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entrypointPath = resolve(appRoot, "src/style.css");
const expectedImports = [
  "./styles/foundation.css",
  "./styles/shared-primitives.css",
  "./styles/play.css",
  "./styles/surface-primitives.css",
  "./styles/calendar.css",
  "./styles/dialogs-receipt.css",
  "./styles/authoring.css",
  "./styles/settings-ledger.css",
  "./styles/motion.css",
  "./styles/responsive.css",
  "./styles/surface-shell-contract.css",
];
const expectedEntrypoint = `${expectedImports
  .map((importPath) => `@import "${importPath}";`)
  .join("\n")}\n`;

const normalizeLf = (value) => value.replace(/\r\n?/g, "\n");
const stripComments = (value) => value.replace(/\/\*[\s\S]*?\*\//g, "");
const countMatches = (value, pattern) => [...value.matchAll(pattern)].length;
const failures = [];

const entrypoint = normalizeLf(readFileSync(entrypointPath, "utf8"));
if (entrypoint !== expectedEntrypoint) {
  failures.push(
    "src/style.css must contain only the exact ordered eleven-import manifest",
  );
}

if (expectedImports.at(-1) !== "./styles/surface-shell-contract.css") {
  failures.push("surface-shell-contract.css must be the final import");
}

const stylesheets = new Map([["src/style.css", entrypoint]]);
for (const importPath of expectedImports) {
  const absolutePath = resolve(appRoot, "src", importPath);
  if (!existsSync(absolutePath)) {
    failures.push(`missing imported stylesheet: ${importPath}`);
    continue;
  }
  stylesheets.set(importPath, normalizeLf(readFileSync(absolutePath, "utf8")));
}

for (const [stylesheetPath, stylesheet] of stylesheets) {
  const uncommented = stripComments(stylesheet);
  if (/@layer\b/.test(uncommented)) {
    failures.push(`@layer is prohibited: ${stylesheetPath}`);
  }
}

const keyframeCounts = new Map();
for (const [stylesheetPath, stylesheet] of stylesheets) {
  const uncommented = stripComments(stylesheet);
  keyframeCounts.set(stylesheetPath, {
    settle: countMatches(uncommented, /@keyframes\s+settle\b/g),
    ballSieveSettle: countMatches(
      uncommented,
      /@keyframes\s+ball-sieve-settle\b/g,
    ),
  });
}

const totalKeyframes = (name) =>
  [...keyframeCounts.values()].reduce((total, counts) => total + counts[name], 0);

if (
  totalKeyframes("settle") !== 1 ||
  keyframeCounts.get("./styles/motion.css")?.settle !== 1
) {
  failures.push("@keyframes settle must be defined once, in motion.css");
}

if (
  totalKeyframes("ballSieveSettle") !== 1 ||
  keyframeCounts.get("./styles/play.css")?.ballSieveSettle !== 1
) {
  failures.push(
    "@keyframes ball-sieve-settle must be defined once, in play.css",
  );
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`CSS manifest check failed: ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("CSS split manifest check passed (11 ordered imports).");
}
