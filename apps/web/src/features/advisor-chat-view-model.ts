import type { DashboardAdvisorChatMessageResponse } from './dashboard-types'

const MAX_CITATION_LABEL_LENGTH = 180
const MAX_DETAIL_LENGTH = 220
const MAX_SIMULATION_LABEL_LENGTH = 120
const MAX_SIMULATION_VALUE_LENGTH = 160
const MAX_MESSAGE_CONTENT_LENGTH = 12_000

const TECHNICAL_METADATA_PATTERN =
  /\b(?:bm25|confidence(?:[\s_-]*(?:pct|percent|score))?|embedding(?:s)?|graphrag|model(?:[\s_-]*id)?|neo4j|provider|qdrant|request[\s_-]*id|retrieval|schema(?:[\s_-]*version)?|source[\s_-]*(?:id|type)|thread(?:[\s_-]*id)?|token(?:s)?)\b/i
const TECHNICAL_KEY_PATTERN = /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/i
const TECHNICAL_ID_PATTERN = /\b(?:node|recommendation|request|run|source|thread)[-_:][a-z0-9-]+\b/i
const OPAQUE_IDENTIFIER_PATTERN = /^(?=.{8,}$)(?=.*\d)[a-z0-9]+(?:[-_:][a-z0-9]+)+$/i
const RAW_RELIABILITY_PERCENT_PATTERN =
  /\b(?:confidence|confiance|fiabilit[ée])\b[^\n\d]{0,24}\d+(?:[.,]\d+)?\s*%/i

export const ADVISOR_CHAT_EMPTY_SUGGESTIONS = [
  'Où en est mon patrimoine ?',
  'Pourquoi mes dépenses ont-elles augmenté ?',
  'Comment mon portefeuille est-il réparti ?',
  'Quelle est ma capacité d’investissement ce mois-ci ?',
] as const

export type AdvisorChatAuthorViewModel =
  | Readonly<{ kind: 'user'; label: 'Vous' }>
  | Readonly<{ kind: 'finance-os'; label: 'Finance-OS' }>
  | Readonly<{ kind: 'notice'; label: 'Information' }>

export type AdvisorChatCitationViewModel = Readonly<{
  label: string
}>

export type AdvisorChatSimulationViewModel = Readonly<{
  label: string
  value: string
}>

export type AdvisorChatSimulationGroupViewModel = Readonly<{
  items: ReadonlyArray<AdvisorChatSimulationViewModel>
  state: 'estimated'
  stateLabel: 'Estimation'
  description: 'Résultats indicatifs fondés sur des hypothèses.'
  isHypothetical: true
  isAuthoritative: false
}>

export type AdvisorChatMessageDetailsViewModel = Readonly<{
  citations?: ReadonlyArray<AdvisorChatCitationViewModel>
  assumptions?: ReadonlyArray<string>
  caveats?: ReadonlyArray<string>
  simulations?: AdvisorChatSimulationGroupViewModel
}>

export type AdvisorChatMessageViewModel = Readonly<{
  author: AdvisorChatAuthorViewModel
  content: string
  details?: AdvisorChatMessageDetailsViewModel
}>

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim()

const normalizeVisiblePunctuation = (value: string) =>
  value
    .replace(/\s*[·—]\s*/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/,\s*$/, '')

const sanitizeMessageContent = (value: unknown) => {
  if (typeof value !== 'string') return ''
  const normalized = value.replace(/\r\n/g, '\n').trim()
  if (!normalized || normalized.length > MAX_MESSAGE_CONTENT_LENGTH) return ''

  const safeLines = normalized
    .split('\n')
    .filter(line => !containsTechnicalMetadata(normalizeWhitespace(line)))
    .map(normalizeVisiblePunctuation)
  const safe = safeLines.join('\n').trim()

  return safe || 'Cette réponse contient des détails techniques indisponibles dans le chat.'
}

const containsTechnicalMetadata = (value: string) =>
  TECHNICAL_METADATA_PATTERN.test(value) ||
  TECHNICAL_KEY_PATTERN.test(value) ||
  TECHNICAL_ID_PATTERN.test(value) ||
  OPAQUE_IDENTIFIER_PATTERN.test(value) ||
  RAW_RELIABILITY_PERCENT_PATTERN.test(value)

const toDisplayText = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return null

  const normalized = normalizeWhitespace(value)
  if (!normalized || normalized.length > maxLength || containsTechnicalMetadata(normalized)) {
    return null
  }

  return normalizeVisiblePunctuation(normalized)
}

const toCitationLabel = (value: unknown) => {
  if (typeof value !== 'string') return null

  const normalized = normalizeWhitespace(value)
  const snapshotMatch = /^snapshot\s+(.+)$/i.exec(normalized)
  const humanLabel = snapshotMatch?.[1] ? `Données au ${snapshotMatch[1]}` : normalized

  return toDisplayText(humanLabel, MAX_CITATION_LABEL_LENGTH)
}

const uniqueByNormalizedText = <TValue extends { label: string }>(values: TValue[]) => {
  const seen = new Set<string>()

  return values.filter(value => {
    const key = value.label.toLocaleLowerCase('fr-FR')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const toCitations = (values: unknown) =>
  uniqueByNormalizedText(
    (Array.isArray(values) ? values : []).flatMap(value => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return []

      const label = toCitationLabel((value as Record<string, unknown>).label)
      return label ? [{ label }] : []
    })
  )

const toTextList = (values: unknown) => {
  const seen = new Set<string>()

  return (Array.isArray(values) ? values : []).flatMap(value => {
    const text = toDisplayText(value, MAX_DETAIL_LENGTH)
    if (!text) return []

    const key = text.toLocaleLowerCase('fr-FR')
    if (seen.has(key)) return []
    seen.add(key)
    return [text]
  })
}

const toSimulations = (values: unknown) =>
  uniqueByNormalizedText(
    (Array.isArray(values) ? values : []).flatMap(value => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return []

      const record = value as Record<string, unknown>
      const label = toDisplayText(record.label, MAX_SIMULATION_LABEL_LENGTH)
      const simulationValue = toDisplayText(record.value, MAX_SIMULATION_VALUE_LENGTH)

      return label && simulationValue ? [{ label, value: simulationValue }] : []
    })
  )

export const getAdvisorChatAuthor = (
  role: DashboardAdvisorChatMessageResponse['role']
): AdvisorChatAuthorViewModel => {
  if (role === 'user') return { kind: 'user', label: 'Vous' }
  if (role === 'assistant') return { kind: 'finance-os', label: 'Finance-OS' }
  return { kind: 'notice', label: 'Information' }
}

export const toAdvisorChatMessageViewModel = (
  message: DashboardAdvisorChatMessageResponse
): AdvisorChatMessageViewModel => {
  const citations = toCitations(message.citations)
  const assumptions = toTextList(message.assumptions)
  const caveats = toTextList(message.caveats)
  const simulations = toSimulations(message.simulations)

  const details: AdvisorChatMessageDetailsViewModel = {
    ...(citations.length > 0 ? { citations } : {}),
    ...(assumptions.length > 0 ? { assumptions } : {}),
    ...(caveats.length > 0 ? { caveats } : {}),
    ...(simulations.length > 0
      ? {
          simulations: {
            items: simulations,
            state: 'estimated',
            stateLabel: 'Estimation',
            description: 'Résultats indicatifs fondés sur des hypothèses.',
            isHypothetical: true,
            isAuthoritative: false,
          } as const,
        }
      : {}),
  }

  const hasDetails = Object.keys(details).length > 0

  return {
    author: getAdvisorChatAuthor(message.role),
    content: sanitizeMessageContent(message.content),
    ...(hasDetails ? { details } : {}),
  }
}
