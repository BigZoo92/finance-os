import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = fileURLToPath(new URL('..', import.meta.url))
const webPublicDir = join(desktopRoot, '../web/.output/public')
const tauriStaticDir = join(desktopRoot, 'src-tauri/static')
const packageManagerExec = process.env.npm_execpath
  ? {
      command: process.execPath,
      args: [process.env.npm_execpath, '-C', '../..', 'web:build'],
    }
  : {
      command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      args: ['-C', '../..', 'web:build'],
    }

const webBuild = spawnSync(packageManagerExec.command, packageManagerExec.args, {
  cwd: desktopRoot,
  stdio: 'inherit',
})

if (webBuild.error) {
  throw webBuild.error
}

if (typeof webBuild.status === 'number' && webBuild.status !== 0) {
  process.exit(webBuild.status)
}

rmSync(tauriStaticDir, { recursive: true, force: true })
mkdirSync(tauriStaticDir, { recursive: true })
cpSync(webPublicDir, tauriStaticDir, { recursive: true })

const indexPath = join(tauriStaticDir, 'index.html')
if (!existsSync(indexPath)) {
  const assetsDir = join(tauriStaticDir, 'assets')
  const assetFiles = readdirSync(assetsDir)
  const mainScript = assetFiles.find(file => /^main-.*\.js$/.test(file))
  const styleFile = assetFiles.find(file => /^styles-.*\.css$/.test(file))

  if (!mainScript || !styleFile) {
    throw new Error(
      `desktop static shell could not locate built assets in ${assetsDir}; expected main-*.js and styles-*.css`
    )
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
`

  writeFileSync(indexPath, html, 'utf8')
}
