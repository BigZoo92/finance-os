// Hypothesis-input execution-instruction detector.
//
// PR2 ships `detectExecutionDirective` / `findExecutionDirectives` which require BOTH an
// execution term AND a directive marker (lenient — educational text passes). For hypothesis
// payloads the prompt is stricter: reject any wording framed as an instruction to execute,
// including bare imperative phrases like "buy now", "sell now", "place order" that contain
// an implicit instruction without a separate directive marker.
//
// This module composes the PR2 helper with a small banlist of bare imperative phrases.
//
// Pure helper: no LLM, no provider, no graph, no DB.

import { findExecutionDirectives } from '@finance-os/ai'

// Bare imperative phrases that imply an execution instruction even without a separate marker.
// All are matched case-insensitively after diacritic stripping (handled by the regex builder).
const BARE_EXECUTION_PHRASES = [
  'buy now',
  'sell now',
  'achetez maintenant',
  'vendez maintenant',
  'place order',
  'place orders',
  'place an order',
  'passer un ordre',
  'passer ordre',
  'passez un ordre',
  'execute trade',
  'execute trades',
  'execute the trade',
  'execute the order',
  'executer la trade',
  'go long',
  'go short',
  'open the position',
  'close the position',
  "open the trade",
  'open a margin',
  'open margin',
  'enter the position',
  'fermez la position',
  'liquider la position',
  'liquidate the position',
  'place the buy',
  'place the sell',
] as const

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '')

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildPattern = (needle: string): RegExp =>
  new RegExp(
    `(?:^|[^\\w])${escapeRegex(stripDiacritics(needle).toLowerCase())}(?:[^\\w]|$)`,
    'i'
  )

export interface ExecutionInstructionMatch {
  reason: 'bare_imperative' | 'directive_with_term'
  excerpt: string
  detail: string
}

const truncate = (text: string, max = 160): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`

const detectBareImperatives = (texts: readonly string[]): ExecutionInstructionMatch[] => {
  const matches: ExecutionInstructionMatch[] = []
  for (const text of texts) {
    const haystack = stripDiacritics(text).toLowerCase()
    for (const needle of BARE_EXECUTION_PHRASES) {
      if (buildPattern(needle).test(haystack)) {
        matches.push({
          reason: 'bare_imperative',
          excerpt: truncate(text.trim()),
          detail: needle,
        })
        break
      }
    }
  }
  return matches
}

export interface ExecutionInstructionScanResult {
  rejected: boolean
  matches: ExecutionInstructionMatch[]
}

export const scanForExecutionInstruction = (
  texts: readonly string[]
): ExecutionInstructionScanResult => {
  const matches: ExecutionInstructionMatch[] = []

  // 1. Directive-marker + execution-term combinations (PR2 helper).
  const directives = findExecutionDirectives(texts.filter(t => typeof t === 'string'))
  for (const directive of directives) {
    matches.push({
      reason: 'directive_with_term',
      excerpt: directive.excerpt,
      detail: `${directive.directiveMarker}+${directive.executionTerm}`,
    })
  }

  // 2. Bare imperative phrases that imply execution.
  matches.push(...detectBareImperatives(texts))

  return {
    rejected: matches.length > 0,
    matches,
  }
}

export class HypothesisExecutionInstructionError extends Error {
  readonly code = 'HYPOTHESIS_EXECUTION_INSTRUCTION_FORBIDDEN' as const
  readonly matches: ExecutionInstructionMatch[]

  constructor(matches: ExecutionInstructionMatch[]) {
    super('Hypothesis payload contains execution-instruction wording.')
    this.name = 'HypothesisExecutionInstructionError'
    this.matches = matches
  }
}

export const isHypothesisExecutionInstructionError = (
  error: unknown
): error is HypothesisExecutionInstructionError =>
  error instanceof HypothesisExecutionInstructionError
