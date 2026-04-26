import type { NormalizedNewsSignalDraft } from './news-types'
import type { SignalSourceGroup } from '../repositories/dashboard-signal-sources-repository'

/**
 * Signal domain grouping for the Donnees & signaux system.
 *
 * This differs from the granular news taxonomy domains — it's a higher-level
 * classification for routing signals to the right consumer:
 * - finance → AI Advisor, Knowledge Graph, future Trading Lab
 * - ai_tech → Agentic/product context, model routing, only Finance-OS-relevant items
 */
export type SignalDomain =
  | 'finance'
  | 'macro'
  | 'market'
  | 'ai_tech'
  | 'cybersecurity'
  | 'regulatory'
  | 'provider_health'
  | 'unknown'

export interface SignalClassification {
  signalDomain: SignalDomain
  requiresAttention: boolean
  attentionReason: string | null
  impactScore: number
  urgencyScore: number
}

// ---------------------------------------------------------------------------
// AI/Tech attention rules — only flag when relevant to Finance-OS operations
// ---------------------------------------------------------------------------

const AI_TECH_ATTENTION_PATTERNS = [
  { pattern: /\b(claude|anthropic)\b/i, reason: 'Changement Anthropic/Claude' },
  { pattern: /\b(codex|openai|gpt-?[0-9]|o[0-9])\b/i, reason: 'Changement OpenAI' },
  { pattern: /\b(gemma|gemini|google ai)\b/i, reason: 'Changement Google AI' },
  { pattern: /\b(qwen|deepseek|mistral|llama)\b/i, reason: 'Changement modele open-source' },
  { pattern: /\b(kimi|hermes)\b/i, reason: 'Changement Kimi/Hermes' },
  { pattern: /\bpric(e|ing)\b.*\b(api|model|token|credit)/i, reason: 'Changement pricing provider IA' },
  { pattern: /\b(context window|context length|1[0-9]{6}\s*token)/i, reason: 'Changement contexte/capacite modele' },
  { pattern: /\b(prompt caching|batch api|discount)\b/i, reason: 'Changement caching/batch IA' },
  { pattern: /\b(agent|agentic|tool.?use|mcp)\b.*\b(framework|sdk|release|launch)/i, reason: 'Nouveau framework/outil agentic' },
  { pattern: /\b(security|vuln|exploit|jailbreak)\b.*\b(ai|llm|model|agent)/i, reason: 'Securite IA' },
  { pattern: /\b(ai|artificial intelligence)\b.*\b(market|stock|etf|fund|invest)/i, reason: 'IA et marches financiers' },
]

const FINANCE_ATTENTION_KEYWORDS = [
  { pattern: /\bfed(eral reserve)?\b.*\b(rate|decision|hike|cut|pause)/i, reason: 'Decision Fed' },
  { pattern: /\becb\b.*\b(rate|decision|inflation)/i, reason: 'Decision ECB' },
  { pattern: /\bearnings?\b.*\b(beat|miss|surprise|guidance)/i, reason: 'Resultat earnings' },
  { pattern: /\b(crash|correction|rally|circuit.?breaker)/i, reason: 'Mouvement marche extreme' },
  { pattern: /\b(sanctions?|tariff|trade war)\b/i, reason: 'Risque geopolitique/sanctions' },
  { pattern: /\b(default|bankruptcy|insolvency)\b/i, reason: 'Risque credit' },
]

// ---------------------------------------------------------------------------
// Domain inference
// ---------------------------------------------------------------------------

const FINANCE_DOMAINS = new Set([
  'finance', 'markets', 'macroeconomy', 'central_banks', 'monetary_policy',
  'earnings', 'guidance', 'filings', 'mna', 'capital_markets', 'credit',
  'real_estate', 'commodities', 'energy',
])

const AI_TECH_DOMAINS = new Set([
  'ai', 'technology', 'model_releases', 'product_launches', 'cybersecurity',
  'cyber_incidents',
])

const REGULATORY_DOMAINS = new Set([
  'regulation', 'legislation', 'public_policy',
])

/**
 * Classify a normalized signal draft into the broader signal domain
 * and determine whether it requires the user's attention.
 */
export const classifySignal = (
  signal: NormalizedNewsSignalDraft,
  sourceGroup?: SignalSourceGroup
): SignalClassification => {
  const text = `${signal.title} ${signal.summary ?? ''} ${signal.contentSnippet ?? ''}`.toLowerCase()
  const domains = new Set(signal.domains)

  // Determine signal domain
  let signalDomain: SignalDomain = 'unknown'

  const firstDomain = [...domains][0] as string | undefined
  if (sourceGroup === 'ai_tech' || (firstDomain && AI_TECH_DOMAINS.has(firstDomain))) {
    const hasFinanceOverlap = [...domains].some(d => FINANCE_DOMAINS.has(d))
    signalDomain = hasFinanceOverlap ? 'finance' : 'ai_tech'
  } else if (sourceGroup === 'finance' || [...domains].some(d => FINANCE_DOMAINS.has(d))) {
    signalDomain = 'finance'
  } else if ([...domains].some(d => REGULATORY_DOMAINS.has(d))) {
    signalDomain = 'regulatory'
  } else if (domains.has('cybersecurity') || domains.has('cyber_incidents')) {
    signalDomain = 'cybersecurity'
  } else if (domains.has('macroeconomy') || domains.has('central_banks')) {
    signalDomain = 'macro'
  } else if (domains.has('markets') || domains.has('commodities')) {
    signalDomain = 'market'
  }

  // Compute attention
  let requiresAttention = false
  let attentionReason: string | null = null

  if (signalDomain === 'ai_tech') {
    for (const rule of AI_TECH_ATTENTION_PATTERNS) {
      if (rule.pattern.test(text)) {
        requiresAttention = true
        attentionReason = rule.reason
        break
      }
    }
  } else {
    // Finance and others: check for high-impact patterns
    for (const rule of FINANCE_ATTENTION_KEYWORDS) {
      if (rule.pattern.test(text)) {
        requiresAttention = true
        attentionReason = rule.reason
        break
      }
    }
    // Also flag high severity/impact
    if (!requiresAttention && signal.severity >= 7) {
      requiresAttention = true
      attentionReason = `Severite elevee (${signal.severity})`
    }
  }

  // Scores
  const impactScore = Math.min(100, signal.marketImpactScore + (requiresAttention ? 20 : 0))
  const urgencyScore = Math.min(100,
    signal.severity * 5 +
    (requiresAttention ? 30 : 0) +
    (signal.confidence >= 7 ? 10 : 0) +
    (signal.novelty >= 7 ? 10 : 0)
  )

  return {
    signalDomain,
    requiresAttention,
    attentionReason,
    impactScore,
    urgencyScore,
  }
}

/**
 * Check whether an AI/Tech signal is relevant enough to require user attention
 * for Finance-OS product operations.
 */
export const isAiTechSignalRelevantForFinanceOs = (text: string): boolean => {
  return AI_TECH_ATTENTION_PATTERNS.some(rule => rule.pattern.test(text))
}
