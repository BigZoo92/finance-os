export type HighValueSignalItem = {
  id: string
  kind: 'alert' | 'insight'
  title: string
}

export type HighValueSignalDigest = {
  fingerprint: string
  alertCount: number
  insightCount: number
  topTitles: string[]
}

const DIGEST_MAX_TITLES = 3

export const buildHighValueSignalDigest = (
  items: HighValueSignalItem[]
): HighValueSignalDigest | null => {
  if (items.length === 0) {
    return null
  }

  const alertCount = items.filter(item => item.kind === 'alert').length
  const insightCount = items.length - alertCount
  const topTitles = items.slice(0, DIGEST_MAX_TITLES).map(item => item.title)
  const fingerprint = items
    .slice(0, DIGEST_MAX_TITLES)
    .map(item => `${item.kind}:${item.id}`)
    .join('|')

  return {
    fingerprint,
    alertCount,
    insightCount,
    topTitles,
  }
}
