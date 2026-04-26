import type { SignalItemRow } from '../repositories/dashboard-signal-items-repository'
import type { KnowledgeServiceClientConfig } from './knowledge-service-client'

interface GraphIngestResult {
  sentCount: number
  failedCount: number
  skippedCount: number
  sentIds: number[]
  failedIds: number[]
}

/**
 * Send top-scored signal items to the knowledge graph.
 * Fail-soft: graph failure does not propagate — returns degraded result.
 */
export const sendSignalsToKnowledgeGraph = async ({
  items,
  knowledgeServiceUrl,
  requestId,
}: {
  items: SignalItemRow[]
  knowledgeServiceUrl: string
  requestId: string
}): Promise<GraphIngestResult> => {
  if (items.length === 0) {
    return { sentCount: 0, failedCount: 0, skippedCount: 0, sentIds: [], failedIds: [] }
  }

  const payload = {
    mode: 'admin',
    source: 'finance-os-signals',
    items: items.map(item => ({
      id: String(item.id),
      text: item.title,
      author: item.author ?? 'unknown',
      authorHandle: item.author,
      provider: item.sourceProvider,
      sourceUrl: item.url,
      publishedAt: item.publishedAt,
      group: item.signalDomain === 'ai_tech' ? 'ai_tech' : 'finance',
      signalDomain: item.signalDomain,
      confidence: item.confidenceScore / 100,
      impact: item.impactScore / 100,
      severity: item.urgencyScore / 100,
      relevanceScore: item.relevanceScore / 100,
      requiresAttention: item.requiresAttention,
      attentionReason: item.attentionReason,
      tags: item.topics,
      relatedAssets: item.tickers,
      relatedSectors: item.sectors,
    })),
  }

  try {
    const response = await fetch(`${knowledgeServiceUrl}/knowledge/ingest/social`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return {
        sentCount: 0,
        failedCount: items.length,
        skippedCount: 0,
        sentIds: [],
        failedIds: items.map(i => i.id),
      }
    }

    return {
      sentCount: items.length,
      failedCount: 0,
      skippedCount: 0,
      sentIds: items.map(i => i.id),
      failedIds: [],
    }
  } catch {
    // Fail-soft: graph unavailable does not break ingestion
    return {
      sentCount: 0,
      failedCount: items.length,
      skippedCount: 0,
      sentIds: [],
      failedIds: items.map(i => i.id),
    }
  }
}
