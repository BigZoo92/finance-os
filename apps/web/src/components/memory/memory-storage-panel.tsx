import { Badge, Button } from '@finance-os/ui/components'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Panel } from '@/components/surfaces/panel'
import { StatusDot } from '@/components/surfaces/status-dot'
import type { AuthMode } from '@/features/auth-types'
import { describeMemoryReadiness, type MemoryReadinessState } from '@/features/memory-readiness'
import {
  ensureOpsKnowledgeStorage,
  opsKnowledgeEnrichmentStatusQueryOptions,
  opsKnowledgeQueryKeys,
} from '@/features/ops-knowledge-api'
import { toErrorMessage } from '@/lib/format'

const stateBadgeVariant = (state: MemoryReadinessState) => {
  switch (state) {
    case 'ready':
      return 'positive' as const
    case 'degraded':
      return 'destructive' as const
    case 'fallback':
    case 'empty':
      return 'warning' as const
    default:
      return 'secondary' as const
  }
}

const stateDotTone = (state: MemoryReadinessState) => {
  switch (state) {
    case 'ready':
      return 'ok' as const
    case 'degraded':
      return 'warn' as const
    default:
      return 'idle' as const
  }
}

/**
 * Admin-only memory storage readiness. Shows an honest state (ready / empty /
 * fallback / degraded / demo) with labeled Qdrant + Neo4j counts — never raw
 * JSON — and a non-destructive "ensure storage" action.
 */
export const MemoryStoragePanel = ({
  mode,
  isAdmin,
}: {
  mode: AuthMode | undefined
  isAdmin: boolean
}) => {
  const queryClient = useQueryClient()
  const statusQuery = useQuery(opsKnowledgeEnrichmentStatusQueryOptions({ mode }))
  const status = statusQuery.data
  const readiness = describeMemoryReadiness(status)
  const storage = status?.storage ?? null

  const ensureMutation = useMutation({
    mutationFn: ensureOpsKnowledgeStorage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: opsKnowledgeQueryKeys.enrichmentStatus() })
    },
  })

  return (
    <Panel
      title="État du stockage mémoire"
      description="Qdrant + Neo4j: prêt, vide, fallback ou dégradé. Mémoire dérivée, jamais une source de vérité d'exécution."
      tone="plain"
      icon={<StatusDot size={8} tone={stateDotTone(readiness.state)} />}
      actions={<Badge variant={stateBadgeVariant(readiness.state)}>{readiness.label}</Badge>}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{readiness.detail}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-surface-1 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Neo4j
              </span>
              <StatusDot size={6} tone={storage?.neo4jReachable ? 'ok' : 'idle'} />
            </div>
            <p className="mt-1 font-financial text-sm">
              {storage?.neo4jNodes ?? 0} nœuds · {storage?.neo4jRelationships ?? 0} relations
            </p>
            <p className="text-xs text-muted-foreground">
              {storage?.neo4jReachable ? (storage.neo4jDatabase ?? 'connecté') : 'non joignable'}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-surface-1 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Qdrant
              </span>
              <StatusDot size={6} tone={storage?.qdrantReachable ? 'ok' : 'idle'} />
            </div>
            <p className="mt-1 font-financial text-sm">{storage?.qdrantPoints ?? 0} points</p>
            <p className="text-xs text-muted-foreground">
              {storage?.qdrantCollectionExists
                ? (storage.qdrantCollection ?? 'collection prête')
                : 'collection absente'}
            </p>
          </div>
        </div>

        {storage?.emptyBecauseNoIngest ? (
          <p className="text-xs text-muted-foreground">
            Normal après déploiement: lancez un ingest/rebuild advisor pour peupler la mémoire.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!isAdmin || ensureMutation.isPending}
            onClick={() => ensureMutation.mutate()}
          >
            {ensureMutation.isPending ? 'Initialisation…' : 'Initialiser le stockage'}
          </Button>
          <span className="text-xs text-muted-foreground">
            Idempotent et non destructif: garantit la collection Qdrant et le schéma Neo4j.
          </span>
        </div>
        {!isAdmin ? (
          <p className="text-xs text-muted-foreground">
            Mode démo: consultation déterministe uniquement.
          </p>
        ) : null}
        {ensureMutation.error ? (
          <p className="text-xs text-negative">{toErrorMessage(ensureMutation.error)}</p>
        ) : null}
      </div>
    </Panel>
  )
}
