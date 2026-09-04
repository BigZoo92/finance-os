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
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: NODE_KIND_COLOR[node.kind] }}
        />
      }
    >
      <div className="space-y-4">
        {/* Provenance / origin row — most important trust signal first. */}
        {node.isExample ? (
          <div className="rounded-lg border border-warning/40 border-dashed bg-warning/10 px-3 py-2 text-[12px] text-warning">
            <p className="font-medium">Exemple, pas une donnée réelle</p>
            <p className="mt-0.5 text-[11.5px] text-warning/85">
              Ajouté uniquement pour illustrer la carte. Aucune décision ne s’y appuie.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {node.isExample ? <Badge variant="destructive">exemple</Badge> : null}
          {reliabilityLabel ? <Badge variant="outline">{reliabilityLabel}</Badge> : null}
          {node.freshness ? (
            <Badge variant="outline">{toMemoryFreshnessLabel(node.freshness)}</Badge>
          ) : null}
          {node.isPersonal ? <Badge variant="secondary">personnel</Badge> : null}
          {node.isContradicted ? <Badge variant="destructive">contradiction</Badge> : null}
          {isPinned ? <Badge variant="secondary">épinglé</Badge> : null}
          {isIsolated ? <Badge variant="secondary">isolé</Badge> : null}
        </div>

        {kindCopy ? (
          <p className="rounded-lg bg-surface-1 px-3 py-2 text-[11.5px] italic leading-relaxed text-muted-foreground">
            {kindCopy}
          </p>
        ) : null}

        {node.summary ? (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{node.summary}</p>
        ) : null}

        {nodeViewModel.sourceLabel ? (
          <dl className="flex items-center justify-between gap-4 border-t border-border/45 pt-3 text-xs">
            <dt className="text-muted-foreground">Source</dt>
            <dd className="text-right text-foreground">{nodeViewModel.sourceLabel}</dd>
          </dl>
        ) : null}

        {pathPeerLabel ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11.5px] text-warning">
            <p className="font-medium">Chemin actif</p>
            <p className="mt-0.5 text-warning/80">Trace en cours vers {pathPeerLabel}</p>
          </div>
        ) : null}

        {/* Quick actions — terse, all functional. */}
        <div className="grid grid-cols-2 gap-1.5">
          <ActionButton onClick={() => onTogglePin(node.id)} active={isPinned}>
            <span className="inline-flex items-center gap-1.5">
              <ThumbtackPixelIcon size={12} />
              {isPinned ? 'Désépingler' : 'Épingler'}
            </span>
          </ActionButton>
          <ActionButton
            onClick={() => (isIsolated ? onClearIsolation() : onIsolate(node.id))}
            active={isIsolated}
          >
            {isIsolated ? 'Quitter l’isolation' : 'Isoler le voisinage'}
          </ActionButton>
          <ActionButton onClick={() => onTracePath(node.id)}>Tracer un chemin</ActionButton>
          <ActionButton onClick={() => onCopyLabel(node.label)}>Copier le nom</ActionButton>
        </div>

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
          <details className="rounded-lg border border-border/40 bg-surface-1/60">
            <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground">
              Tous les voisins ({neighbors.length})
            </summary>
            <div className="max-h-64 space-y-1 overflow-y-auto px-3 pb-3 pt-1">
              {neighbors.map(({ link, other }) => (
                <NeighborRow
                  key={`${link.source}::${link.kind}::${link.target}`}
                  neighbor={{ link, other }}
                  onSelect={onSelectNeighbor}
                />
              ))}
            </div>
          </details>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
          <Link to="/ia/chat" className="text-primary hover:underline">
            Poser une question dans Chat
          </Link>
        </div>
      </div>
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
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: LINK_KIND_COLOR[link.kind] }}
        />
      }
    >
      <div className="space-y-3 text-[12.5px]">
        <p className="text-muted-foreground">
          <span className="text-foreground">{source?.label ?? 'Souvenir indisponible'}</span>{' '}
          <span className="text-muted-foreground/60">→</span>{' '}
          <span className="text-foreground">{target?.label ?? 'Souvenir indisponible'}</span>
        </p>
        {meaning ? (
          <p className="rounded-lg bg-surface-1 px-3 py-2 text-[11.5px] italic leading-relaxed text-muted-foreground">
            {meaning}
          </p>
        ) : null}
        {link.summary ? <p className="text-muted-foreground">{link.summary}</p> : null}
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
      <p className="text-sm leading-relaxed text-muted-foreground">
        Sélectionne un souvenir pour afficher son résumé, sa fraîcheur et ses liens directs.
        {hasGraph ? ' Sélectionne une relation pour comprendre son rôle.' : null}
      </p>
      <ul className="mt-3 space-y-1 text-[11.5px] leading-relaxed text-muted-foreground">
        <li>Le survol met en relief le voisinage immédiat.</li>
        <li>Le clic ouvre la fiche détaillée.</li>
        <li>Une épingle garde un souvenir en référence.</li>
        <li>L’isolation réduit la carte au voisinage utile.</li>
        <li>Le tracé cherche un chemin entre deux souvenirs.</li>
      </ul>
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
      className={`min-h-11 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-primary/40 bg-primary/12 text-primary'
          : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground'
      }`}
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
  const styles: Record<typeof tone, string> = {
    primary: 'border-primary/25 bg-primary/8 text-primary',
    warning: 'border-warning/30 bg-warning/8 text-warning',
    ai: 'border-ai/30 bg-ai/8 text-ai',
    muted: 'border-border/40 bg-surface-1 text-muted-foreground',
  }
  return (
    <div className={`rounded-lg border p-3 ${styles[tone]}`}>
      <p className="text-[11px] font-medium">{title}</p>
      <ul className="mt-1.5 space-y-1">
        {items.slice(0, 6).map(({ other }) => (
          <li key={other.id}>
            <button
              type="button"
              onClick={() => onSelect(other.id)}
              className="min-h-11 text-left text-[12px] text-foreground hover:underline"
            >
              {other.label}
              {other.isExample ? (
                <span className="ml-1.5 rounded bg-warning/15 px-1 py-0.5 text-[9px] uppercase tracking-wider text-warning">
                  ex
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
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
      className={`flex min-h-11 w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
        other.isExample
          ? 'border-warning/30 border-dashed bg-warning/5 hover:bg-warning/10'
          : 'border-border/40 bg-surface-1 hover:bg-surface-2'
      }`}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 flex-shrink-0 rounded-full"
        style={{
          backgroundColor: NODE_KIND_COLOR[other.kind],
          opacity: other.isExample ? 0.5 : 1,
        }}
      />
      <span className="truncate text-foreground">{other.label}</span>
      {other.isExample ? (
        <span className="rounded bg-warning/15 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-warning">
          ex
        </span>
      ) : null}
      <span className="ml-auto whitespace-nowrap text-[10px] text-muted-foreground">
        {LINK_KIND_LABEL[link.kind]}
      </span>
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
