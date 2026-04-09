import type { NewsAffectedEntity, NormalizedNewsSignalDraft } from './news-types'

export interface NewsDuplicateCandidate {
  id: number
  canonicalUrlFingerprint: string | null
  normalizedTitle: string | null
  sourceDomain: string | null
  eventType: string
  publishedAt: Date
  affectedEntities: NewsAffectedEntity[]
  eventClusterId: string
}

export interface NewsDuplicateMatch {
  articleId: number
  evidence: {
    score: number
    reasons: string[]
  }
}

const tokenizeTitle = (value: string | null | undefined) => {
  if (!value) {
    return new Set<string>()
  }

  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map(token => token.trim())
      .filter(token => token.length >= 3)
  )
}

const jaccardSimilarity = (left: Set<string>, right: Set<string>) => {
  if (left.size === 0 || right.size === 0) {
    return 0
  }

  let overlap = 0
  for (const token of left) {
    if (right.has(token)) {
      overlap += 1
    }
  }

  const unionSize = left.size + right.size - overlap
  return unionSize > 0 ? overlap / unionSize : 0
}

const sharedEntityNames = (left: NewsAffectedEntity[], right: NewsAffectedEntity[]) => {
  const leftSet = new Set(left.map(entity => entity.name.toLowerCase()))
  return right.filter(entity => leftSet.has(entity.name.toLowerCase())).map(entity => entity.name)
}

export const resolveNewsDuplicate = ({
  signal,
  candidates,
}: {
  signal: NormalizedNewsSignalDraft
  candidates: NewsDuplicateCandidate[]
}): NewsDuplicateMatch | null => {
  const signalTokens = tokenizeTitle(signal.normalizedTitle)
  const bestMatch = candidates
    .map(candidate => {
      const reasons: string[] = []
      let score = 0

      if (
        signal.canonicalUrlFingerprint &&
        candidate.canonicalUrlFingerprint &&
        signal.canonicalUrlFingerprint === candidate.canonicalUrlFingerprint
      ) {
        score += 100
        reasons.push('canonical-url-match')
      }

      if (candidate.normalizedTitle && candidate.normalizedTitle === signal.normalizedTitle) {
        score += 62
        reasons.push('normalized-title-match')
      }

      const similarity = jaccardSimilarity(signalTokens, tokenizeTitle(candidate.normalizedTitle))
      if (similarity >= 0.82) {
        score += 40
        reasons.push('title-similarity-high')
      } else if (similarity >= 0.65) {
        score += 24
        reasons.push('title-similarity-medium')
      }

      if (candidate.eventType === signal.eventType) {
        score += 16
        reasons.push('event-type-match')
      }

      if (candidate.sourceDomain && candidate.sourceDomain === signal.sourceDomain) {
        score += 10
        reasons.push('source-domain-match')
      }

      const hoursDistance = Math.abs(signal.publishedAt.getTime() - candidate.publishedAt.getTime()) / 3_600_000
      if (hoursDistance <= 3) {
        score += 18
        reasons.push('published-window-tight')
      } else if (hoursDistance <= 24) {
        score += 8
        reasons.push('published-window-near')
      }

      const sharedEntities = sharedEntityNames(signal.affectedEntities, candidate.affectedEntities)
      if (sharedEntities.length > 0) {
        score += Math.min(20, sharedEntities.length * 8)
        reasons.push(`shared-entities:${sharedEntities.slice(0, 3).join(',')}`)
      }

      return {
        candidate,
        score,
        reasons,
      }
    })
    .sort((left, right) => right.score - left.score)[0]

  if (!bestMatch || bestMatch.score < 60) {
    return null
  }

  return {
    articleId: bestMatch.candidate.id,
    evidence: {
      score: bestMatch.score,
      reasons: bestMatch.reasons,
    },
  }
}
