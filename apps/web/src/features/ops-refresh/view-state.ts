import type { RecoverStaleRunsResponse } from './api'

export const isRefreshStatusActive = (status: string | null | undefined) =>
  status === 'queued' || status === 'running'

export const getRecoveryFeedbackMessage = (result: RecoverStaleRunsResponse) => {
  if (!result.ok) {
    return 'La récupération n’a pas abouti. Réessayez dans quelques instants.'
  }

  const recoveredCount = result.recoveredCount
  const skippedCount = result.skippedCount
  if (recoveredCount > 0 && skippedCount > 0) {
    return `${recoveredCount} exécution${recoveredCount > 1 ? 's' : ''} récupérée${recoveredCount > 1 ? 's' : ''}. ${skippedCount} autre${skippedCount > 1 ? 's' : ''} est restée inchangée.`
  }

  if (recoveredCount > 0) {
    return `${recoveredCount} exécution${recoveredCount > 1 ? 's ont' : ' a'} été récupérée${recoveredCount > 1 ? 's' : ''}.`
  }

  if (skippedCount > 0) {
    return `Aucune exécution n’a été modifiée. ${skippedCount} est restée active.`
  }

  return 'Aucune exécution bloquée à récupérer.'
}
