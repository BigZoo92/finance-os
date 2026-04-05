import type { DiagnosticProvider } from '../domain/diagnostics'

export const createMockDiagnosticProvider = (): DiagnosticProvider => {
  return {
    run: async () => ({
      provider: 'mock',
      outcome: 'ok',
      guidance: 'Demo diagnostics are deterministic and fully local.',
      retryable: true,
    }),
  }
}
