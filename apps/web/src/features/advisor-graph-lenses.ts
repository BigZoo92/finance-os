/**
 * Advisor Knowledge Graph 3D — curated lenses, guided tours and
 * quick-filter predicates.
 *
 * V2 replaces V1's plain "view modes" with curated lenses: each lens
 * carries a short eyebrow, an explainer, an accent color, the included
 * node kinds, the kinds it emphasizes, and an optional starter rule
 * that tells the page which node to focus when the lens is opened.
 *
 * Tours are tiny scripted entrypoints ("Pourquoi cette recommandation ?")
 * that activate a lens, optionally select a starter node, and surface
 * the right explainer copy. They never call the backend or the LLM.
 */
import type {
  AdvisorGraphNode,
  AdvisorGraphNodeKind,
  AdvisorGraph,
} from './advisor-graph-data'

// ─── lenses ───────────────────────────────────────────────────────────────

export type AdvisorGraphLensId =
  | 'atlas'
  | 'decision'
  | 'personal'
  | 'market'
  | 'risk'
  | 'knowledge'
  | 'sources'

export type AdvisorGraphLensTone = 'aurora' | 'brand' | 'positive' | 'warning' | 'violet' | 'plain'

export interface AdvisorGraphLens {
  id: AdvisorGraphLensId
  /** Short uppercase eyebrow shown above the title. */
  eyebrow: string
  /** Lens title in French. */
  label: string
  /** One-line tagline. */
  tagline: string
  /** Longer explainer rendered in the lens panel when active. */
  description: string
  /** Visual accent for chips and panels. */
  tone: AdvisorGraphLensTone
  /** Node kinds that should remain visible. */
  includedKinds: ReadonlyArray<AdvisorGraphNodeKind>
  /**
   * Node kinds visually emphasized inside the lens. Other included kinds
   * still render but are quieter. Used by the renderer to dim/strengthen.
   */
  emphasizedKinds: ReadonlyArray<AdvisorGraphNodeKind>
  /**
   * Picks a default focus node when the lens is opened (e.g. "highest
   * importance recommendation"). Returning null leaves selection alone.
   */
  pickStarter?: (graph: AdvisorGraph) => AdvisorGraphNode | null
}

const ALL_KINDS: ReadonlyArray<AdvisorGraphNodeKind> = [
  'personal_snapshot',
  'financial_account',
  'transaction_cluster',
  'asset',
  'investment',
  'goal',
  'recommendation',
  'assumption',
  'market_signal',
  'news_signal',
  'social_signal',
  'concept',
  'formula',
  'risk',
  'contradiction',
  'source',
  'unknown',
]

const pickHighestImportance = (
  graph: AdvisorGraph,
  predicate: (node: AdvisorGraphNode) => boolean
): AdvisorGraphNode | null => {
  let best: AdvisorGraphNode | null = null
  for (const node of graph.nodes) {
    if (!predicate(node)) continue
    if (!best || (node.importance ?? 0) > (best.importance ?? 0)) best = node
  }
  return best
}

export const ADVISOR_GRAPH_LENSES: ReadonlyArray<AdvisorGraphLens> = [
  {
    id: 'atlas',
    eyebrow: '01 · vue d’ensemble',
    label: 'Atlas mémoire',
    tagline: 'Tout ce que l’Advisor a en tête.',
    description:
      'Vue panoramique. Toutes les couches coexistent — personnel, signaux, concepts, recommandations, sources. Idéal pour repérer un point d’entrée puis basculer sur une lentille plus spécifique.',
    tone: 'aurora',
    includedKinds: ALL_KINDS,
    emphasizedKinds: [
      'recommendation',
      'personal_snapshot',
      'risk',
      'concept',
    ],
  },
  {
    id: 'decision',
    eyebrow: '02 · raisonnement',
    label: 'Trace de décision',
    tagline: 'Pourquoi l’Advisor pense ce qu’il pense.',
    description:
      'Recommandations, hypothèses utilisées, evidence et risques associés. Sert à reconstituer le chemin entre une conclusion et ce qui la soutient ou la fragilise.',
    tone: 'brand',
    includedKinds: [
      'recommendation',
      'assumption',
      'risk',
      'contradiction',
      'concept',
      'formula',
      'source',
      'investment',
      'asset',
      'goal',
    ],
    emphasizedKinds: ['recommendation', 'assumption', 'risk', 'contradiction'],
    pickStarter: graph =>
      pickHighestImportance(graph, n => n.kind === 'recommendation' && !n.isExample),
  },
  {
    id: 'personal',
    eyebrow: '03 · toi',
    label: 'Noyau personnel',
    tagline: 'Ce que l’Advisor sait de toi, sans le bruit externe.',
    description:
      'Snapshot, comptes, objectifs, dépenses récurrentes, investissements, actifs. Aucun signal externe, aucune théorie. Pour vérifier la couverture de ta mémoire personnelle.',
    tone: 'positive',
    includedKinds: [
      'personal_snapshot',
      'financial_account',
      'transaction_cluster',
      'investment',
      'asset',
      'goal',
    ],
    emphasizedKinds: ['personal_snapshot', 'goal', 'investment'],
    pickStarter: graph =>
      pickHighestImportance(graph, n => n.kind === 'personal_snapshot' || n.isPersonal === true),
  },
  {
    id: 'market',
    eyebrow: '04 · contexte',
    label: 'Météo des marchés',
    tagline: 'Ce qui bouge dehors et qui te touche.',
    description:
      'Signaux de marché, actualités, signaux sociaux et leurs cibles (actifs / investissements). Permet de voir d’où vient une influence externe.',
    tone: 'violet',
    includedKinds: ['market_signal', 'news_signal', 'social_signal', 'asset', 'investment', 'source'],
    emphasizedKinds: ['market_signal', 'news_signal', 'social_signal'],
    pickStarter: graph =>
      pickHighestImportance(
        graph,
        n => n.kind === 'market_signal' || n.kind === 'news_signal'
      ),
  },
  {
    id: 'risk',
    eyebrow: '05 · fragilités',
    label: 'Risques & contradictions',
    tagline: 'Ce qui est fragile, stale ou faiblement étayé.',
    description:
      'Risques, contradictions, hypothèses datées et evidence faible. Un nœud ici ne signifie pas alarme — c’est l’endroit où challenger l’Advisor.',
    tone: 'warning',
    includedKinds: [
      'risk',
      'contradiction',
      'assumption',
      'recommendation',
      'investment',
      'asset',
    ],
    emphasizedKinds: ['risk', 'contradiction'],
    pickStarter: graph =>
      pickHighestImportance(graph, n => n.kind === 'risk' || n.kind === 'contradiction'),
  },
  {
    id: 'knowledge',
    eyebrow: '06 · théorie',
    label: 'Couche connaissance',
    tagline: 'Concepts financiers et formules mobilisés.',
    description:
      'Concepts, formules, hypothèses long terme. Utile pour comprendre la grammaire financière qu’utilise l’Advisor, indépendamment de tes données.',
    tone: 'violet',
    includedKinds: ['concept', 'formula', 'assumption', 'recommendation'],
    emphasizedKinds: ['concept', 'formula'],
    pickStarter: graph =>
      pickHighestImportance(graph, n => n.kind === 'concept'),
  },
  {
    id: 'sources',
    eyebrow: '07 · provenance',
    label: 'Sources & provenance',
    tagline: 'D’où vient chaque chose dans cette mémoire.',
    description:
      'Sources internes et externes, fraîcheur, couverture. Toute conclusion devrait pouvoir remonter à au moins une source identifiable.',
    tone: 'plain',
    includedKinds: ['source', 'concept', 'formula', 'recommendation'],
    emphasizedKinds: ['source'],
    pickStarter: graph =>
      pickHighestImportance(graph, n => n.kind === 'source'),
  },
]

export const ADVISOR_GRAPH_LENS_BY_ID: Record<AdvisorGraphLensId, AdvisorGraphLens> =
  ADVISOR_GRAPH_LENSES.reduce(
    (acc, lens) => {
      acc[lens.id] = lens
      return acc
    },
    {} as Record<AdvisorGraphLensId, AdvisorGraphLens>
  )

// ─── guided tours ─────────────────────────────────────────────────────────

export interface AdvisorGraphTour {
  id: string
  label: string
  hint: string
  lensId: AdvisorGraphLensId
  /** Picks the starter node to focus when the tour starts. */
  pickStarter: (graph: AdvisorGraph) => AdvisorGraphNode | null
  /** Short copy for the after-action explainer banner. */
  explainer: string
}

export const ADVISOR_GRAPH_TOURS: ReadonlyArray<AdvisorGraphTour> = [
  {
    id: 'why-this-reco',
    label: 'Pourquoi cette recommandation ?',
    hint: 'Suit une recommandation jusqu’à ses hypothèses, evidence et risques.',
    lensId: 'decision',
    pickStarter: graph =>
      pickHighestImportance(graph, n => n.kind === 'recommendation' && !n.isExample),
    explainer:
      'Trace de décision activée. La recommandation la plus saillante est sélectionnée — ses voisins immédiats sont ses hypothèses, ses sources et les risques qui la fragilisent.',
  },
  {
    id: 'whats-uncertain',
    label: 'Qu’est-ce qui est incertain ?',
    hint: 'Met en avant contradictions, evidence faible et hypothèses stale.',
    lensId: 'risk',
    pickStarter: graph =>
      pickHighestImportance(graph, n => n.kind === 'contradiction' || n.kind === 'risk'),
    explainer:
      'Lentille fragilités. Les nœuds gardés sont les zones où l’Advisor doit être challengé : contradictions, hypothèses datées, evidence faible.',
  },
  {
    id: 'from-me',
    label: 'Qu’est-ce qui vient de mes données ?',
    hint: 'Isole le noyau personnel — comptes, objectifs, dépenses, investissements.',
    lensId: 'personal',
    pickStarter: graph =>
      pickHighestImportance(graph, n => n.kind === 'personal_snapshot' || n.isPersonal === true),
    explainer:
      'Noyau personnel isolé. Aucun signal externe, aucune théorie. Si une zone manque ici, la mémoire personnelle a un trou à combler.',
  },
  {
    id: 'from-outside',
    label: 'Qu’est-ce qui vient des signaux externes ?',
    hint: 'Met en avant marchés, actualités et leur influence sur tes actifs.',
    lensId: 'market',
    pickStarter: graph =>
      pickHighestImportance(graph, n => n.kind === 'market_signal' || n.kind === 'news_signal'),
    explainer:
      'Météo des marchés. Les signaux externes les plus importants et leurs cibles. Les liens « affecte » montrent où ils touchent ta mémoire.',
  },
  {
    id: 'unknowns',
    label: 'Qu’est-ce que l’Advisor ne sait pas encore ?',
    hint: 'Met en avant hypothèses stale et nœuds peu étayés.',
    lensId: 'risk',
    pickStarter: graph =>
      pickHighestImportance(
        graph,
        n =>
          n.freshness === 'stale' ||
          n.freshness === 'unknown' ||
          (typeof n.confidence === 'number' && n.confidence < 0.6)
      ),
    explainer:
      'Le pli stale / faible confiance. Ces nœuds sont des candidats à enrichir : hypothèses datées, données peu fraîches, points peu étayés.',
  },
]

// ─── quick filters ────────────────────────────────────────────────────────

export type AdvisorGraphQuickFilterId =
  | 'stale_only'
  | 'contradictions_only'
  | 'high_confidence_only'
  | 'personal_only'

export interface AdvisorGraphQuickFilter {
  id: AdvisorGraphQuickFilterId
  label: string
  shortLabel: string
  predicate: (node: AdvisorGraphNode) => boolean
}

export const ADVISOR_GRAPH_QUICK_FILTERS: ReadonlyArray<AdvisorGraphQuickFilter> = [
  {
    id: 'stale_only',
    label: 'Stale uniquement',
    shortLabel: 'stale',
    predicate: n => n.freshness === 'stale' || n.freshness === 'unknown',
  },
  {
    id: 'contradictions_only',
    label: 'Contradictions / risques',
    shortLabel: 'fragile',
    predicate: n =>
      n.kind === 'contradiction' || n.kind === 'risk' || n.isContradicted === true,
  },
  {
    id: 'high_confidence_only',
    label: 'Confiance haute',
    shortLabel: '≥ 80%',
    predicate: n => typeof n.confidence === 'number' && n.confidence >= 0.8,
  },
  {
    id: 'personal_only',
    label: 'Personnel uniquement',
    shortLabel: 'perso',
    predicate: n =>
      n.isPersonal === true ||
      n.kind === 'personal_snapshot' ||
      n.kind === 'financial_account' ||
      n.kind === 'transaction_cluster' ||
      n.kind === 'goal' ||
      n.kind === 'investment' ||
      n.kind === 'asset',
  },
]

// ─── density preset (mobile / perf mode hooks) ────────────────────────────

export interface AdvisorGraphRenderPreset {
  particles: boolean
  labels: 'selected' | 'all'
  cooldownTicks: number
  warmupTicks: number
  nodeResolution: number
  autoOrbit: boolean
}

export const RENDER_PRESETS: Record<'cinematic' | 'standard' | 'performance', AdvisorGraphRenderPreset> = {
  cinematic: {
    particles: true,
    labels: 'selected',
    cooldownTicks: 180,
    warmupTicks: 30,
    nodeResolution: 18,
    autoOrbit: true,
  },
  standard: {
    particles: true,
    labels: 'selected',
    cooldownTicks: 140,
    warmupTicks: 20,
    nodeResolution: 14,
    autoOrbit: false,
  },
  performance: {
    particles: false,
    labels: 'selected',
    cooldownTicks: 90,
    warmupTicks: 10,
    nodeResolution: 8,
    autoOrbit: false,
  },
}
