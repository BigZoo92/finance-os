import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import type { AdvisorGraphNode } from '@/features/advisor-graph-data'
import { NODE_KIND_LABEL } from '@/features/advisor-graph-data'
import { toMemoryFreshnessLabel, toMemoryReliabilityLabel } from './advisor-graph-details-panel'

const emptyState = css({
  display: 'grid',
  minH: '64',
  placeItems: 'center',
  px: '6',
  textAlign: 'center',
  textStyle: 'sm',
  color: 'muted.foreground',
})

const memoryList = css({
  '& > :not(:last-child)': { borderBottomWidth: '1px', borderColor: 'border/50' },
})

const memoryRow = cva({
  base: {
    display: 'flex',
    minH: '14',
    w: 'full',
    alignItems: 'flex-start',
    gap: '3',
    px: '3',
    py: '3',
    textAlign: 'left',
    outlineStyle: 'none',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    _focusVisible: {
      boxShadow: 'inset 0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)',
    },
  },
  variants: {
    selected: {
      true: { bg: 'primary/10' },
      false: { _hover: { bg: 'surface.1' } },
    },
  },
})

const memoryDot = cva({
  base: { mt: '1.5', boxSize: '2', flexShrink: '0', rounded: 'full' },
  variants: {
    selected: {
      true: { bg: 'primary' },
      false: { bg: 'muted.foreground/45' },
    },
  },
})

const kindLabel = css({
  fontFamily: 'mono',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'muted.foreground',
})

// `line-clamp-2` owns `display: -webkit-box`; Tailwind sorted it after `block`.
const memorySummary = css({
  mt: '1',
  lineClamp: '2',
  fontSize: 'xs',
  lineHeight: 'relaxed',
  color: 'muted.foreground',
})

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
    return <div className={emptyState}>{emptyMessage}</div>
  }

  return (
    <ul aria-label={label} className={memoryList}>
      {nodes.map(node => {
        const selected = node.id === selectedNodeId
        const reliability = toMemoryReliabilityLabel(node.confidence)

        return (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onSelectNode(node.id)}
              aria-pressed={selected}
              className={memoryRow({ selected })}
            >
              <span aria-hidden="true" className={memoryDot({ selected })} />
              <styled.span minW="0" flex="1">
                <styled.span
                  display="flex"
                  flexWrap="wrap"
                  alignItems="baseline"
                  justifyContent="space-between"
                  columnGap="3"
                  rowGap="1"
                >
                  <styled.span fontWeight="medium" color="foreground">
                    {node.label}
                  </styled.span>
                  <span className={kindLabel}>{NODE_KIND_LABEL[node.kind]}</span>
                </styled.span>
                {node.summary ? <span className={memorySummary}>{node.summary}</span> : null}
                <styled.span
                  mt="1.5"
                  display="flex"
                  flexWrap="wrap"
                  gap="3"
                  fontSize="11px"
                  color="muted.foreground"
                >
                  {node.freshness ? <span>{toMemoryFreshnessLabel(node.freshness)}</span> : null}
                  {reliability ? <span>{reliability}</span> : null}
                  {node.isExample ? <styled.span color="warning">Exemple</styled.span> : null}
                </styled.span>
              </styled.span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
