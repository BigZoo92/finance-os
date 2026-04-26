export interface KnowledgeContextProvenanceRef {
  source: string
  sourceType?: string
  sourceRef?: string | null
  sourceUrl?: string | null
  confidence: number
}

export interface KnowledgeContextEntity {
  id: string
  type: string
  title: string
  summary: string
  confidence: number
  recency: number
  provenanceRefs: string[]
  why: string[]
}

export interface KnowledgeContextRelation {
  id: string
  type: string
  fromId: string
  toId: string
  label?: string | null
  description?: string
  confidence: number
  weight?: number
}

export interface KnowledgeContextPath {
  pathId: string
  score: number
  explanation: string
  steps: Array<{
    entity: {
      id: string
      type: string
      label: string
      description?: string
      confidence: number
    }
    viaRelation?: KnowledgeContextRelation | null
  }>
}

export interface KnowledgeContextBundle {
  requestId: string
  mode: 'demo' | 'admin' | 'internal'
  generatedAt: string
  query: string
  maxTokens: number
  tokenEstimate: number
  summary: string
  entities: KnowledgeContextEntity[]
  relations: KnowledgeContextRelation[]
  graphPaths: KnowledgeContextPath[]
  evidence: KnowledgeContextEntity[]
  contradictoryEvidence: KnowledgeContextEntity[]
  assumptions: KnowledgeContextEntity[]
  unknowns: string[]
  retrievalExplanation: string[]
  confidence: number
  recency: number
  provenance: KnowledgeContextProvenanceRef[]
  degraded: boolean
  fallbackReason?: string | null
}

export const estimateKnowledgeContextTokens = (bundle: Pick<KnowledgeContextBundle, 'summary'>) =>
  Math.max(1, Math.ceil(bundle.summary.length / 4))

export const compactKnowledgeContextForPrompt = ({
  bundle,
  maxTokens = bundle.maxTokens,
}: {
  bundle: KnowledgeContextBundle
  maxTokens?: number
}) => {
  const sections = [
    `Knowledge graph context (${bundle.mode}, confidence ${bundle.confidence.toFixed(2)}):`,
    bundle.summary,
    bundle.unknowns.length > 0 ? `Unknowns: ${bundle.unknowns.join('; ')}` : '',
    bundle.contradictoryEvidence.length > 0
      ? `Contradictions: ${bundle.contradictoryEvidence.map(item => item.title).join(', ')}`
      : '',
  ].filter(Boolean)

  const text = sections.join('\n')
  return text.length > maxTokens * 4 ? text.slice(0, maxTokens * 4) : text
}
