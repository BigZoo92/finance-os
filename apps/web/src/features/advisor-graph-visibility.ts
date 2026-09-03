import {
  type AdvisorGraph,
  type AdvisorGraphLinkKind,
  type AdvisorGraphNode,
  type AdvisorGraphNodeKind,
  NODE_KIND_LABEL,
} from './advisor-graph-data'

export const deriveVisibleAdvisorGraph = ({
  graph,
  visibleNodeKinds,
  visibleLinkKinds,
}: {
  graph: AdvisorGraph
  visibleNodeKinds: ReadonlySet<AdvisorGraphNodeKind>
  visibleLinkKinds: ReadonlySet<AdvisorGraphLinkKind>
}): AdvisorGraph => {
  const nodes = graph.nodes.filter(node => visibleNodeKinds.has(node.kind))
  const nodeIds = new Set(nodes.map(node => node.id))
  const links = graph.links.filter(
    link => visibleLinkKinds.has(link.kind) && nodeIds.has(link.source) && nodeIds.has(link.target)
  )

  return {
    nodes,
    links,
    meta: {
      ...graph.meta,
      nodeCount: nodes.length,
      linkCount: links.length,
    },
  }
}

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR')

export const searchVisibleAdvisorGraph = (
  graph: AdvisorGraph,
  searchTerm: string,
  limit = 30
): AdvisorGraphNode[] => {
  const term = normalizeSearchText(searchTerm.trim())
  if (!term || limit <= 0) return []

  return graph.nodes
    .filter(node => {
      const humanText = [node.label, node.summary, NODE_KIND_LABEL[node.kind]]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
      return normalizeSearchText(humanText).includes(term)
    })
    .sort((left, right) => (right.importance ?? 0) - (left.importance ?? 0))
    .slice(0, limit)
}
