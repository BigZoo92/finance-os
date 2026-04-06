import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@finance-os/ui/components'
import { dashboardNewsQueryOptionsWithMode } from '@/features/dashboard-query-options'
import type { AuthMode } from '@/features/auth-types'
import { rankNewsByRelevance } from './relevance-scoring'

export function NewsFeed({ mode }: { mode: AuthMode }) {
  const [topic, setTopic] = useState('')
  const [source, setSource] = useState('')

  const queryParams = {
    mode,
    ...(topic.trim() ? { topic: topic.trim() } : {}),
    ...(source.trim() ? { source: source.trim() } : {}),
    limit: 20,
  } as const

  const newsQuery = useQuery(
    dashboardNewsQueryOptionsWithMode(queryParams)
  )

  const payload = newsQuery.data
  const rankedItems = payload
    ? rankNewsByRelevance(payload.items, {
        topicFilter: topic.trim(),
        sourceFilter: source.trim(),
      })
    : []

  const resilience = payload?.resilience
  const showPartialState = resilience?.status === 'degraded'
  const showUnavailableState = resilience?.status === 'unavailable'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relevant financial news</CardTitle>
        <CardDescription>
          Demo uses deterministic fixtures. Admin reads cached DB articles with live ingestion fallback.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input value={topic} placeholder="Filter by topic (ex: crypto)" onChange={e => setTopic(e.target.value)} />
          <Input value={source} placeholder="Filter by source" onChange={e => setSource(e.target.value)} />
          <Button type="button" variant="secondary" onClick={() => newsQuery.refetch()}>
            Refresh
          </Button>
        </div>

        {newsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading news…</p> : null}

        {showPartialState ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-900">
            Partial data mode active: showing resilient fallback data while live sources recover.
          </div>
        ) : null}

        {showUnavailableState ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            News is temporarily unavailable. Safe fallback mode is active.
          </div>
        ) : null}

        {payload?.providerError && !showUnavailableState ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            Provider fallback active: {payload.providerError.message}
          </div>
        ) : null}

        {payload?.staleCache && !showPartialState ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-900">
            Showing last successful sync. Live provider may be delayed.
          </div>
        ) : null}

        {payload?.lastUpdatedAt ? (
          <p className="text-xs text-muted-foreground">Last updated: {new Date(payload.lastUpdatedAt).toLocaleString()}</p>
        ) : null}
        {resilience ? (
          <p className="text-xs text-muted-foreground">
            Resilience status: {resilience.status} · source: {resilience.source} · request-id: {resilience.requestId}
          </p>
        ) : null}

        {payload && payload.items.length === 0 ? (
          topic || source ? (
            <p className="text-sm text-muted-foreground">No articles match your filters.</p>
          ) : (
            <p className="text-sm text-muted-foreground">No cached articles available yet.</p>
          )
        ) : null}

        {rankedItems.map(({ item, score, reasons }) => (
          <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block rounded-md border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug">{item.title}</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{item.topic}</Badge>
                <Badge variant="outline">Score {score}</Badge>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.sourceName}</p>
            <p className="mt-1 text-xs text-muted-foreground">Why relevant: {reasons.join(', ')}</p>
          </a>
        ))}
      </CardContent>
    </Card>
  )
}
