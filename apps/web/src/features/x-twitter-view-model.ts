import type { XHealthResponse } from './x-twitter-api'

export type XBudgetTone = 'ok' | 'warn' | 'danger' | 'unknown'

export const resolveBudgetTone = (health: XHealthResponse | undefined): XBudgetTone => {
  if (!health || !health.ok) return 'unknown'
  switch (health.budgetStatus) {
    case 'healthy':
      return 'ok'
    case 'monthly_low':
      return 'warn'
    case 'daily_exhausted':
    case 'monthly_exhausted':
      return 'danger'
    default:
      return 'unknown'
  }
}

export const formatUsd = (value: number | null | undefined, fallback = '—') => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return `$${value.toFixed(2)}`
}

export const formatCount = (value: number | null | undefined, fallback = '—') => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return new Intl.NumberFormat('fr-FR').format(value)
}

export const verificationStatusLabel = (status: string | undefined): string => {
  switch (status) {
    case 'verified':
      return 'Vérifié'
    case 'unverified_payment_required':
      return 'Non vérifié — paiement requis (HTTP 402)'
    case 'unverified_forbidden':
      return 'Non vérifié — accès refusé (HTTP 403)'
    case 'unverified_rate_limited':
      return 'Non vérifié — quota atteint (HTTP 429)'
    case 'unverified_not_found':
      return 'Non trouvé sur X (HTTP 404)'
    case 'unverified_token_invalid':
      return 'Token X invalide ou manquant'
    case 'unverified_invalid_handle':
      return 'Handle invalide'
    case 'unverified_provider_error':
      return 'Erreur fournisseur X'
    default:
      return status ?? '—'
  }
}

export const capReasonLabel = (reason: string | undefined | null): string => {
  switch (reason) {
    case 'complete':
      return 'Complet'
    case 'capped_by_budget':
      return 'Budget atteint'
    case 'capped_by_author_limit':
      return 'Limite par auteur atteinte'
    case 'capped_by_global_limit':
      return 'Limite globale atteinte'
    case 'capped_by_page_limit':
      return 'Limite de pages atteinte'
    case 'capped_by_provider_error':
      return 'Erreur fournisseur'
    default:
      return reason ?? '—'
  }
}
