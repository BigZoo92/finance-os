import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import { reactCompilerOptions } from './react-compiler.config.ts'

// `/api/*` is served by the runtime proxy in src/routes/api/$.ts (API_INTERNAL_URL is
// read per request), so neither a dev-server proxy nor a build-time Nitro route
// rule is configured here: one code path serves dev, preview, and production.
export default defineConfig(({ command }) => ({
  envDir: '../../',
  build: {
    rolldownOptions: {
      // Experimental: skip compiling unused re-exports of side-effect-free barrels
      // (planned to become Rolldown's default). Measured: same bundle, same build
      // time here; nativeMagicString (no prod sourcemaps) and inlineConst "all"
      // (+0.8 kB raw) were measured and left at their defaults.
      experimental: { lazyBarrel: true },
    },
  },
  resolve: {
    // Native tsconfig `paths` resolution (Vite 8): the `@/` alias has one source,
    // tsconfig.json.
    tsconfigPaths: true,
    alias: {
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
        // Same lazy-barrel optimization for the server bundle.
        experimental: { lazyBarrel: true },
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
    // Styles are Panda CSS, extracted at build time by its PostCSS plugin
    // (postcss.config.cjs); there is no CSS framework plugin in the Vite graph.
    tanstackStart(),
    // Native React Compiler (experimental): `oxc-transform-react` runs the
    // compiler, TypeScript/JSX and Fast Refresh in one Rust pass, without Babel.
    // The plugin compiles the client environment only; SSR renders the same
    // markup. Options live in react-compiler.config.ts (shared with Vitest).
    viteReact({ compiler: reactCompilerOptions(command) }),
  ],
}))
