import type { RecoverStaleRunsResponse } from './api'

export const isRefreshStatusActive = (status: string | null | undefined) =>
  status === 'queued' || status === 'running'

export const getRecoveryFeedbackMessage = (result: RecoverStaleRunsResponse) => {
  if (!result.ok) {
    return 'Recovery refusee par le serveur. Voir logs admin.'
  }

  const recoveredCount = result.recoveredCount
  const skippedCount = result.skippedCount
  const backgroundRecoveredCount = result.backgroundRecoveredCount ?? 0
  const manualRecoveredCount =
    result.manualRecoveredCount ?? Math.max(0, recoveredCount - backgroundRecoveredCount)
  const warning = result.warning ? ` ${result.warning}` : ''

  if (recoveredCount > 0 && skippedCount > 0) {
    return `Recovery partielle: ${recoveredCount} run(s) recupere(s), ${skippedCount} ignore(s).${warning}`
  }

  if (recoveredCount > 0) {
    return `Recovery reussie: ${recoveredCount} run(s) recupere(s) (${manualRecoveredCount} advisor, ${backgroundRecoveredCount} background).${warning}`
  }

  if (skippedCount > 0) {
    return `Recovery controlee: aucun run modifie, ${skippedCount} candidat(s) laisse(s) intact(s).${warning}`
  }

  return `Recovery terminee: aucun run stale a reprendre.${warning}`
}
