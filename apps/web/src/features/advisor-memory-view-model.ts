import type {
  AdvisorGraphLink,
  AdvisorGraphNode,
  AdvisorGraphNodeKind,
  AdvisorGraphOrigin,
} from './advisor-graph-data'
import { NODE_KIND_LABEL } from './advisor-graph-data'

const SOURCE_LABELS: Readonly<Record<string, string>> = {
  'finance-engine': 'Finance-OS',
  'finance-os-curated-seed': 'Exemple Finance-OS',
  'macro-feed': 'Données de marché',
  ecb: 'Banque centrale européenne',
  advisor: 'Advisor',
}

const TECHNICAL_SOURCE_PATTERN =
  /(?:^|\b)(?:api|database|db|graph|internal|neo4j|provider|qdrant|request|schema|source[_:-]|token)(?:\b|[_:-])/i
const OPAQUE_SOURCE_PATTERN = /\b[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\b/i
const NAMESPACED_ID_PATTERN = /^[a-z][a-z0-9_-]*:[^\s]+$/i
const TECHNICAL_COPY_PATTERN =
  /(?:^|\b)(?:api|bundle|database|embedding|finance[- ]?engine|graph(?:rag)?|hit(?:s)?|internal|neo4j|provider|qdrant|request|retrieval|schema|seed|source[_:-]|token)(?:\b|[_:-])/i

const FALLBACK_NODE_LABEL: Readonly<Record<AdvisorGraphNodeKind, string>> = {
  personal_snapshot: 'Profil financier',
  financial_account: 'Compte financier',
  transaction_cluster: 'Dépenses regroupées',
  asset: 'Actif financier',
  investment: 'Investissement',
  goal: 'Objectif financier',
  recommendation: 'Recommandation',
  assumption: 'Hypothèse',
  market_signal: 'Signal de marché',
  news_signal: 'Actualité',
  social_signal: 'Tendance',
  concept: 'Concept financier',
  formula: 'Méthode de calcul',
  risk: 'Risque',
  contradiction: 'Point à vérifier',
  source: 'Source',
  unknown: 'Souvenir',
}

const normalizeMemoryPunctuation = (value: string) =>
  value
    .replace(/\s*[·—]\s*/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/,\s*$/, '')

const sanitizeMemoryText = (value: string | undefined): string | null => {
  if (!value) return null
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized || normalized.length > 500) return null
  if (NAMESPACED_ID_PATTERN.test(normalized) || OPAQUE_SOURCE_PATTERN.test(normalized)) return null
  if (TECHNICAL_COPY_PATTERN.test(normalized)) return null
  return normalizeMemoryPunctuation(normalized)
}

export const toHumanAdvisorMemoryNode = (node: AdvisorGraphNode): AdvisorGraphNode => {
  const summary = sanitizeMemoryText(node.summary)
  const source = toMemorySourceLabel(node.source)
  const label = sanitizeMemoryText(node.label)
  const safeLabel =
    label && label.toLocaleLowerCase('fr-FR') !== node.id.toLocaleLowerCase('fr-FR')
      ? label
      : FALLBACK_NODE_LABEL[node.kind]
  const { summary: _summary, source: _source, ...safeNode } = node
  return {
    ...safeNode,
    label: safeLabel,
    ...(summary ? { summary } : {}),
    ...(source ? { source } : {}),
  }
}

export const toHumanAdvisorMemoryLink = (link: AdvisorGraphLink): AdvisorGraphLink => {
  const label = sanitizeMemoryText(link.label)
  const summary = sanitizeMemoryText(link.summary)
  const { label: _label, summary: _summary, ...safeLink } = link
  return {
    ...safeLink,
    ...(label ? { label } : {}),
    ...(summary ? { summary } : {}),
  }
}

export const toMemorySourceLabel = (source: string | undefined): string | null => {
  if (!source) return null
  const normalized = source.replace(/\s+/g, ' ').trim()
  if (!normalized || normalized.length > 100) return null

  const known = SOURCE_LABELS[normalized.toLocaleLowerCase('fr-FR')]
  if (known) return known
  if (
    TECHNICAL_SOURCE_PATTERN.test(normalized) ||
    OPAQUE_SOURCE_PATTERN.test(normalized) ||
    /[_:]{1,}/.test(normalized)
  ) {
    return null
  }

  return normalizeMemoryPunctuation(normalized)
}

export const MEMORY_ORIGIN_COPY: Readonly<
  Record<AdvisorGraphOrigin, { label: string; description: string }>
> = {
  demo: {
    label: 'Démonstration',
    description: 'Souvenirs fictifs et déterministes.',
  },
  real: {
    label: 'Mémoire personnelle',
    description: 'Souvenirs dérivés des données Finance-OS disponibles.',
  },
  mixed: {
    label: 'Mémoire avec exemples',
    description: 'Les exemples restent signalés séparément.',
  },
  empty: {
    label: 'Mémoire vide',
    description: 'Aucun souvenir exploitable pour cette vue.',
  },
}

export const toAdvisorMemoryNodeViewModel = (node: AdvisorGraphNode) => ({
  label: node.label,
  typeLabel: NODE_KIND_LABEL[node.kind],
  summary: node.summary?.trim() || null,
  sourceLabel: toMemorySourceLabel(node.source),
  isExample: node.isExample === true,
})
