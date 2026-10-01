import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { reactCompilerOptions } from './react-compiler.config.ts'

export default defineConfig({
  // Same native React Compiler as the app build, so component tests run the
  // compiled output (the plugin applies it to client environments such as jsdom).
  plugins: [react({ compiler: reactCompilerOptions('build') })],
  // The `@/` alias comes from tsconfig.json `paths`, as in the app build.
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    // Isolation stays on: the suites mock modules per file (`vi.mock`), which a
    // shared module graph would leak across files (measured 3.5x faster without
    // isolation, but with mocks applied to the wrong modules).
    experimental: {
      // Static pre-parse applies `.only`, name filters and patterns across all
      // files before running them.
      preParse: true,
    },
  },
})
