#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../../..')
const iconPath = path.join(repoRoot, 'apps/desktop/src-tauri/icons/icon.png')

const issues = []
const notes = []

function addIssue(title, details) {
  issues.push({ title, details })
}

function addNote(message) {
  notes.push(message)
}

function checkPngIcon() {
  const bytes = fs.readFileSync(iconPath)
  const signature = bytes.subarray(0, 8)
  const expectedSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

  if (!expectedSignature.every((value, index) => signature[index] === value)) {
    addIssue('`icon.png` is not a valid PNG file.', [`Path: ${iconPath}`])
    return
  }

  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  const bitDepth = bytes[24]
  const colorType = bytes[25]
  const colorTypes = {
    0: 'grayscale',
    2: 'rgb',
    3: 'indexed',
    4: 'grayscale+alpha',
    6: 'rgba',
  }

  if (width !== height) {
    addIssue('`icon.png` must be square for Tauri.', [`Detected: ${width}x${height}`])
  }

  if (bitDepth !== 8 || colorType !== 6) {
    addIssue('`icon.png` does not match Tauri PNG requirements.', [
      `Detected: ${width}x${height}, ${colorTypes[colorType] ?? `color-type-${colorType}`}, ${bitDepth}-bit`,
      'Expected: square PNG, RGBA, 32-bit (8-bit per channel).',
      'Reference: https://tauri.app/develop/icons/',
    ])
    return
  }

  addNote(`icon.png ok: ${width}x${height}, rgba, 32-bit.`)
}

function spawn(command, args) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  })
}

function getResultOutput(result) {
  return [result.stderr, result.stdout]
    .filter(value => typeof value === 'string' && value.trim().length > 0)
    .map(value => value.trim())[0]
}

function checkBun() {
  const bunVersion = spawn('bun', ['--version'])

  if (bunVersion.error?.code === 'ENOENT') {
    addNote('bun not found in PATH (optional for desktop shell, required for full `pnpm check:ci`).')
    return
  }

  if (bunVersion.error || bunVersion.status !== 0) {
    addNote('bun check failed; `pnpm check:ci` may fail until Bun is installed.')
    return
  }

  addNote(`bun detected: ${getResultOutput(bunVersion) ?? 'unknown version'}`)
}

function checkCargoAndTauriCli() {
  const cargoVersion = spawn('cargo', ['-V'])

  if (cargoVersion.error?.code === 'ENOENT') {
    addIssue('`cargo` is not available in PATH.', [
      'Install Rust via rustup, then restart the terminal.',
      'Windows also needs Microsoft C++ Build Tools and WebView2 for Tauri.',
      'Reference: https://v2.tauri.app/fr/start/prerequisites/',
    ])
    return
  }

  if (cargoVersion.error) {
    addIssue('`cargo -V` failed.', [cargoVersion.error.message])
    return
  }

  if (cargoVersion.status !== 0) {
    addIssue('`cargo -V` failed.', [getResultOutput(cargoVersion) ?? 'Unknown cargo error.'])
    return
  }

  addNote(getResultOutput(cargoVersion) ?? 'cargo detected')

  const tauriVersion = spawn('cargo', ['tauri', '-V'])
  if (tauriVersion.error) {
    addIssue('Tauri CLI is not available through `cargo tauri`.', [
      tauriVersion.error.message,
      'Install it with: cargo install tauri-cli --locked --version ^2',
    ])
    return
  }

  if (tauriVersion.status !== 0) {
    addIssue('Tauri CLI is not available through `cargo tauri`.', [
      getResultOutput(tauriVersion) ?? 'Unknown tauri-cli error.',
      'Install it with: cargo install tauri-cli --locked --version ^2',
    ])
    return
  }

  addNote(getResultOutput(tauriVersion) ?? 'tauri CLI detected')
}

function checkLinuxNativeDeps() {
  if (process.platform !== 'linux') {
    return
  }

  const pkgConfigVersion = spawn('pkg-config', ['--version'])
  if (pkgConfigVersion.error?.code === 'ENOENT') {
    addIssue('`pkg-config` is missing, so Linux Tauri dependencies cannot be verified.', [
      'On Ubuntu CI, install: libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf',
    ])
    return
  }

  const packages = [
    ['webkit2gtk-4.1', 'libwebkit2gtk-4.1-dev'],
    ['gtk+-3.0', 'libgtk-3-dev'],
    ['ayatana-appindicator3-0.1', 'libayatana-appindicator3-dev'],
    ['librsvg-2.0', 'librsvg2-dev'],
  ]

  const missingPackages = []
  for (const [pkgConfigName, aptPackageName] of packages) {
    const result = spawn('pkg-config', ['--exists', pkgConfigName])
    if (result.status !== 0) {
      missingPackages.push(`${pkgConfigName} (${aptPackageName})`)
    }
  }

  const patchelf = spawn('patchelf', ['--version'])
  if (patchelf.error?.code === 'ENOENT') {
    missingPackages.push('patchelf')
  }

  if (missingPackages.length > 0) {
    addIssue('Linux native dependencies for Tauri are incomplete.', [
      `Missing: ${missingPackages.join(', ')}`,
      'Ubuntu install command: sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf',
    ])
    return
  }

  addNote('Linux Tauri native dependencies detected.')
}

checkPngIcon()
checkBun()
checkCargoAndTauriCli()
checkLinuxNativeDeps()

console.log('Finance-OS desktop doctor')
console.log('')

for (const note of notes) {
  console.log(`OK: ${note}`)
}

if (issues.length === 0) {
  console.log('')
  console.log('Desktop doctor passed.')
  process.exit(0)
}

console.log('')
for (const [index, issue] of issues.entries()) {
  console.log(`${index + 1}. ${issue.title}`)
  for (const detail of issue.details) {
    console.log(`   - ${detail}`)
  }
  console.log('')
}

console.error('Desktop doctor failed.')
process.exit(1)
