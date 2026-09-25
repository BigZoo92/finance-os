import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

// `/api/*` is served by the runtime proxy in src/routes/api/$.ts (API_INTERNAL_URL is
// read per request), so neither a dev-server proxy nor a build-time Nitro route
// rule is configured here: one code path serves dev, preview, and production.
const config = defineConfig({
  envDir: '../../',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Rolldown resolves the `node` import condition of tslib to an ESM wrapper over
      // its `__esModule`-flagged CommonJS build and then reads `.default` (undefined),
      // which crashes the SSR bundle at boot (`react-remove-scroll-bar` via Radix).
      // Pointing every consumer at the pure ESM build removes the interop entirely.
      tslib: 'tslib/tslib.es6.mjs',
    },
  },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      // Bundle tslib (pure ESM via the alias above) instead of tracing it: Nitro
      // otherwise re-emits a bare `tslib` import that Node resolves to the
      // untraced `modules/index.js` wrapper at boot.
      noExternals: ['tslib'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
  ],
})

export default config
