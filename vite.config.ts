import { defineConfig } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const localHttpsPfxPath = resolve(".local-certs", "happy-ball-ipad-local.pfx");
const localHttpsPassphrase = process.env.HAPPY_BALL_HTTPS_PASSPHRASE ?? "happy-ball-local-dev";

export default defineConfig(({ mode }) => ({
  base: process.env.NODE_ENV === "production" ? "/emoi-dama/" : "/",
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
  },
  server: {
    https: mode === "local-https" ? readLocalHttpsConfig() : undefined,
  },
}));

function readLocalHttpsConfig(): { pfx: Buffer; passphrase: string } {
  if (!existsSync(localHttpsPfxPath)) {
    throw new Error(
      `Local HTTPS certificate not found: ${localHttpsPfxPath}. Run tools/create-ipad-local-cert.ps1 first.`,
    );
  }
  return {
    pfx: readFileSync(localHttpsPfxPath),
    passphrase: localHttpsPassphrase,
  };
}
