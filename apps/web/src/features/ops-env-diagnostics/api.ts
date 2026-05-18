import { apiFetch } from '@/lib/api'
import type { EnvDiagnosticsResponse } from './types'

export const fetchEnvDiagnostics = () =>
  apiFetch<EnvDiagnosticsResponse>('/ops/env/diagnostics')
