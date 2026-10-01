import type { ReactCompilerOptions } from '@vitejs/plugin-react'

/**
 * Native React Compiler options (experimental, `oxc-transform-react`), shared by
 * the app build and the Vitest config so tests exercise the compiled output.
 *
 * Defaults mirror the Babel v1 preset the app was validated with: infer which
 * functions to compile, skip (never fail) on a recoverable bail-out, React 19
 * runtime. `REACT_COMPILER_DIAGNOSTICS=1` logs those bail-outs; oxlint's React
 * Compiler rules report the same findings at lint time.
 */
export const reactCompilerOptions = (command: 'build' | 'serve'): ReactCompilerOptions => ({
  target: '19',
  compilationMode: 'infer',
  panicThreshold: 'none',
  logDiagnostics: process.env.REACT_COMPILER_DIAGNOSTICS === '1',
  environment: {
    // Named memoized callbacks in React DevTools; development output only.
    enableNameAnonymousFunctions: command === 'serve',
  },
})
