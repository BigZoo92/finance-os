import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const desktopRoot = new URL("..", import.meta.url).pathname;
const webPublicDir = join(desktopRoot, "../web/.output/public");
const tauriStaticDir = join(desktopRoot, "src-tauri/static");

execSync("pnpm -C ../.. web:build", { cwd: desktopRoot, stdio: "inherit" });

rmSync(tauriStaticDir, { recursive: true, force: true });
mkdirSync(tauriStaticDir, { recursive: true });
cpSync(webPublicDir, tauriStaticDir, { recursive: true });

const indexPath = join(tauriStaticDir, "index.html");
if (!existsSync(indexPath)) {
  const assetsDir = join(tauriStaticDir, "assets");
  const assetFiles = readdirSync(assetsDir);
  const mainScript = assetFiles.find((file) => /^main-.*\.js$/.test(file));
  const styleFile = assetFiles.find((file) => /^styles-.*\.css$/.test(file));

  if (!mainScript || !styleFile) {
    throw new Error(
      `desktop static shell could not locate built assets in ${assetsDir}; expected main-*.js and styles-*.css`,
    );
  }

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="./assets/${styleFile}" />
    <title>Finance-OS</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./assets/${mainScript}"></script>
  </body>
</html>
`;

  writeFileSync(indexPath, html, "utf8");
}
