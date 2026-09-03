import type { AdvisorGraphNode } from '@/features/advisor-graph-data'
import { NODE_KIND_LABEL } from '@/features/advisor-graph-data'
import { toMemoryFreshnessLabel, toMemoryReliabilityLabel } from './advisor-graph-details-panel'

export function AdvisorMemoryList({
  nodes,
  selectedNodeId,
  onSelectNode,
  label = 'Souvenirs visibles',
  emptyMessage = 'Aucun souvenir ne correspond aux filtres actuels.',
}: {
  nodes: ReadonlyArray<AdvisorGraphNode>
  selectedNodeId: string | null
  onSelectNode: (id: string) => void
  label?: string
  emptyMessage?: string
}) {
  if (nodes.length === 0) {
    return (
      <div className="grid min-h-64 place-items-center px-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <ul aria-label={label} className="divide-y divide-border/50">
      {nodes.map(node => {
        const selected = node.id === selectedNodeId
        const reliability = toMemoryReliabilityLabel(node.confidence)

        return (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onSelectNode(node.id)}
              aria-pressed={selected}
              className={`flex min-h-14 w-full items-start gap-3 px-3 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70 ${
                selected ? 'bg-primary/10' : 'hover:bg-surface-1'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 size-2 shrink-0 rounded-full ${
                  selected ? 'bg-primary' : 'bg-muted-foreground/45'
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-medium text-foreground">{node.label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {NODE_KIND_LABEL[node.kind]}
                  </span>
                </span>
                {node.summary ? (
                  <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                    {node.summary}
                  </span>
                ) : null}
                <span className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  {node.freshness ? <span>{toMemoryFreshnessLabel(node.freshness)}</span> : null}
                  {reliability ? <span>{reliability}</span> : null}
                  {node.isExample ? <span className="text-warning">Exemple</span> : null}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
