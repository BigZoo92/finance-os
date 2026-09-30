/**
 * AdvisorGraphDetailsPanel — V2 right-rail of the 3D memory graph.
 *
 * Renders the selected node or selected link with kind-specific layouts
 * and a tight set of quick actions: pin, isolate neighborhood, copy
 * label, ask Advisor about this. Empty state shows a discoverable
 * onboarding nudge.
 *
 * No data fetching here — the page owns all state and passes pre-computed
 * props (neighbors, path, pinned ids, etc.).
 */
import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Badge } from '@finance-os/ui/components'
import { ChartNetworkPixelIcon, ThumbtackPixelIcon } from '@finance-os/ui/icons/pixel'
import { Link } from '@tanstack/react-router'
import { Panel } from '@/components/surfaces/panel'
import {
  type AdvisorGraphLink,
  type AdvisorGraphNode,
  LINK_KIND_COLOR,
  LINK_KIND_LABEL,
  NODE_KIND_COLOR,
  NODE_KIND_LABEL,
} from '@/features/advisor-graph-data'
import { toAdvisorMemoryNodeViewModel } from '@/features/advisor-memory-view-model'

export interface AdvisorGraphNeighbor {
  link: AdvisorGraphLink
  other: AdvisorGraphNode
}

interface NodeDetailsProps {
  node: AdvisorGraphNode
  neighbors: ReadonlyArray<AdvisorGraphNeighbor>
  isPinned: boolean
  isIsolated: boolean
  pathPeerLabel: string | null
  onSelectNeighbor: (id: string) => void
  onTogglePin: (id: string) => void
  onIsolate: (id: string) => void
  onClearIsolation: () => void
  onCopyLabel: (label: string) => void
  onTracePath: (id: string) => void
}

interface LinkDetailsProps {
  link: AdvisorGraphLink
  source: AdvisorGraphNode | null
  target: AdvisorGraphNode | null
}

interface EmptyDetailsProps {
  hasGraph: boolean
}

// ─── styles ───────────────────────────────────────────────────────────────

// Kind swatch in the panel header; the color itself is graph data, not a token.
const kindSwatch = css({ display: 'inline-block', boxSize: '3', rounded: 'full' })

const notice = cva({
  base: { rounded: 'lg', borderWidth: '1px', bg: 'warning/10', px: '3', py: '2', color: 'warning' },
  variants: {
    kind: {
      example: { borderColor: 'warning/40', borderStyle: 'dashed', fontSize: '12px' },
      path: { borderColor: 'warning/30', fontSize: '11.5px' },
    },
  },
})

const kindNote = css({
  rounded: 'lg',
  bg: 'surface.1',
  px: '3',
  py: '2',
  fontSize: '11.5px',
  fontStyle: 'italic',
  lineHeight: 'relaxed',
  color: 'muted.foreground',
})

const neighborsSummary = css({
  cursor: 'pointer',
  px: '3',
  py: '2',
  fontSize: '11px',
  fontWeight: 'medium',
  color: 'muted.foreground',
  _hover: { color: 'foreground' },
})

const chatLink = css({ color: 'primary', _hover: { textDecorationLine: 'underline' } })

// Tailwind's `space-y-3` put the margin on every child but the last; the last
// child here is an inline-flex Badge, so the rule is kept verbatim.
const linkBody = css({
  fontSize: '12.5px',
  '& > :not(:last-child)': { marginBlockEnd: '3' },
})

const actionButton = cva({
  base: {
    minH: '11',
    rounded: 'lg',
    borderWidth: '1px',
    px: '2.5',
    py: '1.5',
    fontSize: '11px',
    fontWeight: 'medium',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    _disabled: { cursor: 'not-allowed', opacity: '0.4' },
  },
  variants: {
    active: {
      true: { borderColor: 'primary/40', bg: 'primary/12', color: 'primary' },
      false: {
        borderColor: 'border/60',
        bg: 'surface.1',
        color: 'muted.foreground',
        _hover: { bg: 'surface.2', color: 'foreground' },
      },
    },
  },
  defaultVariants: { active: false },
})

const neighborGroup = cva({
  base: { rounded: 'lg', borderWidth: '1px', p: '3' },
  variants: {
    tone: {
      primary: { borderColor: 'primary/25', bg: 'primary/8', color: 'primary' },
      warning: { borderColor: 'warning/30', bg: 'warning/8', color: 'warning' },
      ai: { borderColor: 'ai/30', bg: 'ai/8', color: 'ai' },
      muted: { borderColor: 'border/40', bg: 'surface.1', color: 'muted.foreground' },
    },
  },
})

const neighborLink = css({
  minH: '11',
  textAlign: 'left',
  fontSize: '12px',
  color: 'foreground',
  _hover: { textDecorationLine: 'underline' },
})

// Bare `rounded` is Tailwind's inlined 0.25rem, not a radius token.
const exampleTag = cva({
  base: {
    rounded: '0.25rem',
    bg: 'warning/15',
    px: '1',
    py: '0.5',
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: 'wider',
    color: 'warning',
  },
  variants: {
    placement: {
      inline: { ml: '1.5' },
      row: { fontWeight: 'medium' },
    },
  },
})

const neighborRow = cva({
  base: {
    display: 'flex',
    minH: '11',
    w: 'full',
    alignItems: 'center',
    gap: '2',
    rounded: 'md',
    borderWidth: '1px',
    px: '2',
    py: '1.5',
    textAlign: 'left',
    fontSize: '11px',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
  },
  variants: {
    example: {
      true: {
        borderColor: 'warning/30',
        borderStyle: 'dashed',
        bg: 'warning/5',
        _hover: { bg: 'warning/10' },
      },
      false: { borderColor: 'border/40', bg: 'surface.1', _hover: { bg: 'surface.2' } },
    },
  },
})

const neighborDot = css({ boxSize: '2', flexShrink: '0', rounded: 'full' })

export const toMemoryFreshnessLabel = (freshness: 'fresh' | 'stale' | 'unknown'): string => {
  if (freshness === 'fresh') return 'Récente'
  if (freshness === 'stale') return 'À actualiser'
  return 'Date inconnue'
}

export const toMemoryReliabilityLabel = (value: number | undefined): string | null => {
  if (value === undefined) return null
  if (value >= 0.75) return 'Fiabilité élevée'
  if (value >= 0.55) return 'Fiabilité moyenne'
  return 'Fiabilité à confirmer'
}

export function AdvisorGraphNodeDetails(props: NodeDetailsProps) {
  const {
    node,
    neighbors,
    isPinned,
    isIsolated,
    pathPeerLabel,
    onSelectNeighbor,
    onTogglePin,
    onIsolate,
    onClearIsolation,
    onCopyLabel,
    onTracePath,
  } = props

  const reliabilityLabel = toMemoryReliabilityLabel(node.confidence)
  const nodeViewModel = toAdvisorMemoryNodeViewModel(node)

  const recommendations = neighbors.filter(n => n.other.kind === 'recommendation')
  const sources = neighbors.filter(n => n.other.kind === 'source')
  const risks = neighbors.filter(n => n.other.kind === 'risk' || n.other.kind === 'contradiction')
  const concepts = neighbors.filter(n => n.other.kind === 'concept' || n.other.kind === 'formula')
  const assumptions = neighbors.filter(n => n.other.kind === 'assumption')

  const kindCopy = KIND_COPY[node.kind]

  return (
    <Panel
      title={node.label}
      description={NODE_KIND_LABEL[node.kind]}
      tone={node.isExample ? 'warning' : node.isContradicted ? 'warning' : 'brand'}
      icon={
        <span
          aria-hidden="true"
          className={kindSwatch}
          style={{ backgroundColor: NODE_KIND_COLOR[node.kind] }}
        />
      }
    >
      <styled.div spaceY="4">
        {/* Provenance / origin row — most important trust signal first. */}
        {node.isExample ? (
          <div className={notice({ kind: 'example' })}>
            <styled.p fontWeight="medium">Exemple, pas une donnée réelle</styled.p>
            <styled.p mt="0.5" fontSize="11.5px" color="warning/85">
              Ajouté uniquement pour illustrer la carte. Aucune décision ne s’y appuie.
            </styled.p>
          </div>
        ) : null}

        <styled.div display="flex" flexWrap="wrap" gap="1.5">
          {node.isExample ? <Badge variant="destructive">exemple</Badge> : null}
          {reliabilityLabel ? <Badge variant="outline">{reliabilityLabel}</Badge> : null}
          {node.freshness ? (
            <Badge variant="outline">{toMemoryFreshnessLabel(node.freshness)}</Badge>
          ) : null}
          {node.isPersonal ? <Badge variant="secondary">personnel</Badge> : null}
          {node.isContradicted ? <Badge variant="destructive">contradiction</Badge> : null}
          {isPinned ? <Badge variant="secondary">épinglé</Badge> : null}
          {isIsolated ? <Badge variant="secondary">isolé</Badge> : null}
        </styled.div>

        {kindCopy ? <p className={kindNote}>{kindCopy}</p> : null}

        {node.summary ? (
          <styled.p fontSize="12.5px" lineHeight="relaxed" color="muted.foreground">
            {node.summary}
          </styled.p>
        ) : null}

        {nodeViewModel.sourceLabel ? (
          <styled.dl
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap="4"
            borderTopWidth="1px"
            borderColor="border/45"
            pt="3"
            textStyle="xs"
          >
            <styled.dt color="muted.foreground">Source</styled.dt>
            <styled.dd textAlign="right" color="foreground">
              {nodeViewModel.sourceLabel}
            </styled.dd>
          </styled.dl>
        ) : null}

        {pathPeerLabel ? (
          <div className={notice({ kind: 'path' })}>
            <styled.p fontWeight="medium">Chemin actif</styled.p>
            <styled.p mt="0.5" color="warning/80">
              Trace en cours vers {pathPeerLabel}
            </styled.p>
          </div>
        ) : null}

        {/* Quick actions — terse, all functional. */}
        <styled.div display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="1.5">
          <ActionButton onClick={() => onTogglePin(node.id)} active={isPinned}>
            <styled.span display="inline-flex" alignItems="center" gap="1.5">
              <ThumbtackPixelIcon size={12} />
              {isPinned ? 'Désépingler' : 'Épingler'}
            </styled.span>
          </ActionButton>
          <ActionButton
            onClick={() => (isIsolated ? onClearIsolation() : onIsolate(node.id))}
            active={isIsolated}
          >
            {isIsolated ? 'Quitter l’isolation' : 'Isoler le voisinage'}
          </ActionButton>
          <ActionButton onClick={() => onTracePath(node.id)}>Tracer un chemin</ActionButton>
          <ActionButton onClick={() => onCopyLabel(node.label)}>Copier le nom</ActionButton>
        </styled.div>

        {/* Kind-specific neighbor groupings, only shown when populated. */}
        <NeighborGroup
          title="Recommandations connectées"
          tone="primary"
          items={recommendations}
          onSelect={onSelectNeighbor}
        />
        <NeighborGroup
          title="Risques et contradictions"
          tone="warning"
          items={risks}
          onSelect={onSelectNeighbor}
        />
        <NeighborGroup
          title="Hypothèses utilisées"
          tone="ai"
          items={assumptions}
          onSelect={onSelectNeighbor}
        />
        <NeighborGroup
          title="Concepts liés"
          tone="ai"
          items={concepts}
          onSelect={onSelectNeighbor}
        />
        <NeighborGroup
          title="Sources de provenance"
          tone="muted"
          items={sources}
          onSelect={onSelectNeighbor}
        />

        {neighbors.length > 0 ? (
          <styled.details rounded="lg" borderWidth="1px" borderColor="border/40" bg="surface.1/60">
            <summary className={neighborsSummary}>Tous les voisins ({neighbors.length})</summary>
            <styled.div maxH="64" spaceY="1" overflowY="auto" px="3" pb="3" pt="1">
              {neighbors.map(({ link, other }) => (
                <NeighborRow
                  key={`${link.source}::${link.kind}::${link.target}`}
                  neighbor={{ link, other }}
                  onSelect={onSelectNeighbor}
                />
              ))}
            </styled.div>
          </styled.details>
        ) : null}

        <styled.div
          display="flex"
          flexWrap="wrap"
          alignItems="center"
          gap="3"
          pt="1"
          fontSize="11px"
        >
          <Link to="/ia/chat" className={chatLink}>
            Poser une question dans Chat
          </Link>
        </styled.div>
      </styled.div>
    </Panel>
  )
}

export function AdvisorGraphLinkDetails({ link, source, target }: LinkDetailsProps) {
  const meaning = LINK_KIND_MEANING[link.kind]
  return (
    <Panel
      title={LINK_KIND_LABEL[link.kind]}
      tone="ai"
      icon={
        <span
          aria-hidden="true"
          className={kindSwatch}
          style={{ backgroundColor: LINK_KIND_COLOR[link.kind] }}
        />
      }
    >
      <div className={linkBody}>
        <styled.p color="muted.foreground">
          <styled.span color="foreground">{source?.label ?? 'Souvenir indisponible'}</styled.span>{' '}
          <styled.span color="muted.foreground/60">→</styled.span>{' '}
          <styled.span color="foreground">{target?.label ?? 'Souvenir indisponible'}</styled.span>
        </styled.p>
        {meaning ? <p className={kindNote}>{meaning}</p> : null}
        {link.summary ? <styled.p color="muted.foreground">{link.summary}</styled.p> : null}
        {toMemoryReliabilityLabel(link.confidence) ? (
          <Badge variant="outline">{toMemoryReliabilityLabel(link.confidence)}</Badge>
        ) : null}
      </div>
    </Panel>
  )
}

export function AdvisorGraphEmptyDetails({ hasGraph }: EmptyDetailsProps) {
  return (
    <Panel title="Sélectionne un nœud" tone="plain" icon={<ChartNetworkPixelIcon size={16} />}>
      <styled.p fontSize="sm" lineHeight="relaxed" color="muted.foreground">
        Sélectionne un souvenir pour afficher son résumé, sa fraîcheur et ses liens directs.
        {hasGraph ? ' Sélectionne une relation pour comprendre son rôle.' : null}
      </styled.p>
      <styled.ul mt="3" spaceY="1" fontSize="11.5px" lineHeight="relaxed" color="muted.foreground">
        <li>Le survol met en relief le voisinage immédiat.</li>
        <li>Le clic ouvre la fiche détaillée.</li>
        <li>Une épingle garde un souvenir en référence.</li>
        <li>L’isolation réduit la carte au voisinage utile.</li>
        <li>Le tracé cherche un chemin entre deux souvenirs.</li>
      </styled.ul>
    </Panel>
  )
}

// ─── pieces ───────────────────────────────────────────────────────────────

function ActionButton({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={actionButton({ active: Boolean(active) })}
    >
      {children}
    </button>
  )
}

function NeighborGroup({
  title,
  tone,
  items,
  onSelect,
}: {
  title: string
  tone: 'primary' | 'warning' | 'ai' | 'muted'
  items: ReadonlyArray<AdvisorGraphNeighbor>
  onSelect: (id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div className={neighborGroup({ tone })}>
      <styled.p fontSize="11px" fontWeight="medium">
        {title}
      </styled.p>
      <styled.ul mt="1.5" spaceY="1">
        {items.slice(0, 6).map(({ other }) => (
          <li key={other.id}>
            <button type="button" onClick={() => onSelect(other.id)} className={neighborLink}>
              {other.label}
              {other.isExample ? (
                <span className={exampleTag({ placement: 'inline' })}>ex</span>
              ) : null}
            </button>
          </li>
        ))}
      </styled.ul>
    </div>
  )
}

function NeighborRow({
  neighbor,
  onSelect,
}: {
  neighbor: AdvisorGraphNeighbor
  onSelect: (id: string) => void
}) {
  const { link, other } = neighbor
  return (
    <button
      type="button"
      onClick={() => onSelect(other.id)}
      className={neighborRow({ example: Boolean(other.isExample) })}
    >
      <span
        aria-hidden="true"
        className={neighborDot}
        style={{
          backgroundColor: NODE_KIND_COLOR[other.kind],
          opacity: other.isExample ? 0.5 : 1,
        }}
      />
      <styled.span truncate color="foreground">
        {other.label}
      </styled.span>
      {other.isExample ? <span className={exampleTag({ placement: 'row' })}>ex</span> : null}
      <styled.span ml="auto" whiteSpace="nowrap" fontSize="10px" color="muted.foreground">
        {LINK_KIND_LABEL[link.kind]}
      </styled.span>
    </button>
  )
}

// ─── per-kind copy ────────────────────────────────────────────────────────

const KIND_COPY: Partial<Record<AdvisorGraphNode['kind'], string>> = {
  recommendation:
    'Une conclusion proposée. Ses voisins montrent les hypothèses, sources et risques qui la soutiennent.',
  risk: 'Une zone de fragilité à examiner avec les recommandations associées.',
  contradiction:
    'Un souvenir vient affaiblir une autre affirmation et demande une lecture attentive.',
  source: 'Une origine interne ou externe utilisée pour retracer une information.',
  concept: 'Un concept financier mobilisé pour expliquer une décision. Indépendant de tes données.',
  formula: 'Une méthode de calcul utilisée pour comparer ou expliquer des mesures.',
  assumption:
    'Une hypothèse explicite. Sa fraîcheur et sa fiabilité déterminent si elle peut être réutilisée.',
  personal_snapshot: 'Vue agrégée de ton patrimoine et de tes flux courants.',
  goal: 'Un objectif personnel utilisé comme cible.',
  market_signal: 'Un signal externe agrégé qui peut affecter certains investissements.',
  news_signal: 'Un signal d’actualité agrégé. Sert à contextualiser l’instant.',
  social_signal: 'Une tendance sociale agrégée issue des informations disponibles.',
  investment: 'Une position d’investissement présentée sous forme agrégée.',
  asset: 'Un actif détenu ou observé, agrégé.',
  financial_account: 'Un compte présenté sous forme agrégée.',
  transaction_cluster: 'Un ensemble de dépenses regroupées par usage.',
}

const LINK_KIND_MEANING: Record<AdvisorGraphLink['kind'], string> = {
  supports: 'Cette relation soutient l’affirmation cible avec les informations disponibles.',
  explains: 'Le souvenir de gauche aide à expliquer la conclusion de droite.',
  contradicts: 'Une contradiction explicite fragilise l’autre affirmation sans l’annuler.',
  weakens: 'Cette relation ajoute du doute sans contredire directement la cible.',
  derived_from: 'La cible provient de la source indiquée.',
  related_to: 'Ce lien facilite la navigation mais ne constitue pas une preuve.',
  affects: 'Un signal peut avoir un effet sur cette cible.',
  mentions: 'Une mention utile pour retracer le contexte.',
  uses_assumption:
    'La cible repose sur une hypothèse explicite. À revisiter si l’hypothèse vieillit.',
  belongs_to: 'Ce souvenir appartient à un ensemble plus large.',
}
