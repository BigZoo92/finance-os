import { resolve } from 'node:path'
import { defineConfig } from '@pandacss/dev'
import { financeOsGlobalCss } from './src/global-css'
import { financeOsPreset } from './src/preset'

// Panda resolves `include` globs against the process cwd (apps/web under Vite,
// this package under the CLI), so the globs are anchored to this file instead.
// Panda bundles the config to CommonJS, hence `__dirname` rather than import.meta.
const source = (relativePath: string) => resolve(__dirname, relativePath).replace(/\\/g, '/')

/**
 * Single Panda configuration for the monorepo. Styles are extracted from the
 * UI package and the web app; the runtime is generated into ./generated and
 * consumed through the `@finance-os/styled-system/*` export map.
 *
 * `preflight` stays off: the element reset is the vendored Tailwind preflight
 * (`packages/ui/src/styles/preflight.css`, cascade layer `preflight`, declared
 * below every Panda layer in apps/web/src/styles.css), which the product was
 * designed on. Panda's own reset moves layouts (`body { height: 100% }`,
 * balanced headings). Global element styles live in `globalCss`.
 */
export default defineConfig({
  preflight: false,
  globalCss: financeOsGlobalCss,
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda', financeOsPreset],
  include: [source('../ui/src/**/*.{ts,tsx}'), source('../../apps/web/src/**/*.{ts,tsx}')],
  exclude: ['**/*.test.{ts,tsx}'],
  // Relative on purpose: the CLI joins its cwd and `outdir` (an absolute path
  // would be nested under this package). Codegen only runs from this package
  // (`prepare`, `pnpm panda:codegen`, the Moon `codegen` task); the PostCSS
  // plugin under apps/web never writes the runtime.
  outdir: 'generated',
  importMap: '@finance-os/styled-system',
  jsxFramework: 'react',
  jsxStyleProps: 'all',
  strictTokens: false,
  hash: false,
  minify: false,
  validation: 'error',
})
