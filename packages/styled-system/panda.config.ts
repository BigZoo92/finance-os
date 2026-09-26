import { resolve } from 'node:path'
import { defineConfig } from '@pandacss/dev'
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
 * Coexistence policy (until the Tailwind exit): Tailwind owns the preflight
 * and the `base` layer; Panda's layers are namespaced so the two cascades never
 * merge, and Panda's utilities are declared last so they win over Tailwind
 * utilities on the same element.
 */
export default defineConfig({
  preflight: false,
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda', financeOsPreset],
  include: [source('../ui/src/**/*.{ts,tsx}'), source('../../apps/web/src/**/*.{ts,tsx}')],
  exclude: ['**/*.test.{ts,tsx}'],
  outdir: source('generated'),
  importMap: '@finance-os/styled-system',
  jsxFramework: 'react',
  jsxStyleProps: 'all',
  layers: {
    reset: 'panda_reset',
    base: 'panda_base',
    tokens: 'panda_tokens',
    recipes: 'panda_recipes',
    utilities: 'panda_utilities',
  },
  strictTokens: false,
  hash: false,
  minify: false,
  validation: 'error',
})
