import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@finance-os/ui/components'
import { dashboardNewsQueryOptionsWithMode } from '@/features/dashboard-query-options'
import type { AuthMode } from '@/features/auth-types'

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

        {payload?.staleCache ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-900">
            Showing last successful sync. Live provider may be delayed.
          </div>
        ) : null}

        {payload?.providerError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            Provider fallback active: {payload.providerError.message}
          </div>
        ) : null}

        {payload?.lastUpdatedAt ? (
          <p className="text-xs text-muted-foreground">Last updated: {new Date(payload.lastUpdatedAt).toLocaleString()}</p>
        ) : null}

        {payload && payload.items.length === 0 ? (
          topic || source ? (
            <p className="text-sm text-muted-foreground">No articles match your filters.</p>
          ) : (
            <p className="text-sm text-muted-foreground">No cached articles available yet.</p>
          )
        ) : null}

        {payload?.items.map(item => (
          <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block rounded-md border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug">{item.title}</p>
              <Badge variant="secondary">{item.topic}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.sourceName}</p>
          </a>
        ))}
      </CardContent>
    </Card>
  )
}
