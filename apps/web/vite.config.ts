import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

// `/api/*` is served by the runtime proxy in src/routes/api/$.ts (API_INTERNAL_URL is
// read per request), so neither a dev-server proxy nor a build-time Nitro route
// rule is configured here: one code path serves dev, preview, and production.
export default defineConfig(({ command }) => ({
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
    // The devtools bundler plugin is a dev-server concern only; production builds
    // never carry it (the in-app panels are already gated on import.meta.env.PROD).
    ...(command === 'serve' ? [devtools()] : []),
    nitro({
      rolldownConfig: {
        external: [/^@sentry\//],
        output: {
          codeSplitting: {
            // Nitro groups server chunks per npm package. Rolldown captures a
            // group's dependencies recursively by default, which pulled the
            // `d3-array` helpers shared with the radar route into the client-only
            // `3d-force-graph` chunk and evaluated `window.THREE` during SSR.
            includeDependenciesRecursively: false,
          },
        },
      },
      // Bundle tslib (pure ESM via the alias above) instead of tracing it: Nitro
      // otherwise re-emitted a bare `tslib` import that Node resolved to an
      // untraced file at boot.
      noExternals: ['tslib'],
    }),
    tailwindcss(),
    tanstackStart(),
    // Vite 8 handles JSX and Fast Refresh in Oxc; the React Compiler still runs
    // through Babel (`babel-plugin-react-compiler` behind `@rolldown/plugin-babel`)
    // so its output is identical to the Vite 7 line. Revisit the native
    // `viteReact({ compiler })` path once it leaves experimental status.
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
}))
