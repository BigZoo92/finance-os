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

const freshnessLabel = (freshness: 'fresh' | 'stale' | 'unknown'): string => {
  if (freshness === 'fresh') return 'fraîche'
  if (freshness === 'stale') return 'stale'
  return 'inconnue'
}

const confidenceTone = (value: number): 'positive' | 'plain' | 'warning' => {
  if (value >= 0.75) return 'positive'
  if (value >= 0.55) return 'plain'
  return 'warning'
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

  const confidencePct = Math.round((node.confidence ?? 0) * 100)

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
            <p className="font-medium">Exemple, pas donnée réelle</p>
            <p className="mt-0.5 text-[11.5px] text-warning/85">
              Ajouté depuis le seed démo pour illustration. Aucune décision Advisor ne s’y appuie.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {node.isExample ? <Badge variant="destructive">exemple</Badge> : null}
          {node.confidence !== undefined ? (
            <Badge variant="outline">{confidencePct}% confiance</Badge>
          ) : null}
          {node.freshness ? <Badge variant="outline">{freshnessLabel(node.freshness)}</Badge> : null}
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

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Score label="Confiance" value={node.confidence ?? 0} tone={confidenceTone(node.confidence ?? 0)} />
          <Score label="Importance" value={node.importance ?? 0} tone="plain" />
        </div>

        {pathPeerLabel ? (
          <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[11.5px] text-amber-200">
            <p className="font-medium">Chemin actif</p>
            <p className="mt-0.5 text-amber-100/80">
              Trace en cours vers&nbsp;: {pathPeerLabel}
            </p>
          </div>
        ) : null}

        {/* Quick actions — terse, all functional. */}
        <div className="grid grid-cols-2 gap-1.5">
          <ActionButton onClick={() => onTogglePin(node.id)} active={isPinned}>
            {isPinned ? '◉ Désépingler' : '◯ Épingler'}
          </ActionButton>
          <ActionButton onClick={() => (isIsolated ? onClearIsolation() : onIsolate(node.id))} active={isIsolated}>
            {isIsolated ? 'Quitter l’isolation' : 'Isoler le voisinage'}
          </ActionButton>
          <ActionButton onClick={() => onTracePath(node.id)}>Tracer un chemin →</ActionButton>
          <ActionButton onClick={() => onCopyLabel(node.label)}>Copier le label</ActionButton>
        </div>

        {/* Kind-specific neighbor groupings, only shown when populated. */}
        <NeighborGroup
          title="Recommandations connectées"
          tone="primary"
          items={recommendations}
          onSelect={onSelectNeighbor}
        />
        <NeighborGroup
          title="Risques & contradictions"
          tone="warning"
          items={risks}
          onSelect={onSelectNeighbor}
        />
        <NeighborGroup
          title="Hypothèses utilisées"
          tone="violet"
          items={assumptions}
          onSelect={onSelectNeighbor}
        />
        <NeighborGroup
          title="Concepts liés"
          tone="violet"
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
            Demander à l’Advisor →
          </Link>
          <Link
            to="/ia/memoire"
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            Voir l’inspection texte
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
      tone="violet"
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
          <span className="text-foreground">{source?.label ?? link.source}</span>{' '}
          <span className="text-muted-foreground/60">→</span>{' '}
          <span className="text-foreground">{target?.label ?? link.target}</span>
        </p>
        {meaning ? (
          <p className="rounded-lg bg-surface-1 px-3 py-2 text-[11.5px] italic leading-relaxed text-muted-foreground">
            {meaning}
          </p>
        ) : null}
        {link.summary ? <p className="text-muted-foreground">{link.summary}</p> : null}
        <div className="flex flex-wrap gap-1.5">
          {link.confidence !== undefined ? (
            <Badge variant="outline">{Math.round(link.confidence * 100)}% confiance</Badge>
          ) : null}
          {link.strength !== undefined ? (
            <Badge variant="outline">{Math.round(link.strength * 100)}% force</Badge>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}

export function AdvisorGraphEmptyDetails({ hasGraph }: EmptyDetailsProps) {
  return (
    <Panel
      title="Sélectionne un nœud"
      tone="plain"
      icon={<span aria-hidden="true">◌</span>}
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        Clique sur un nœud pour voir son type, sa confiance, sa fraîcheur, ses voisins
        directs, les recommandations connectées et les sources de provenance.
        {hasGraph ? ' Clique sur un lien pour inspecter une relation.' : null}
      </p>
      <ul className="mt-3 space-y-1 text-[11.5px] leading-relaxed text-muted-foreground">
        <li>· <span className="text-foreground">survol</span> · met en relief un voisinage immédiat</li>
        <li>· <span className="text-foreground">clic</span> · ouvre la fiche détaillée</li>
        <li>· <span className="text-foreground">épingler</span> · garde un nœud en référence</li>
        <li>· <span className="text-foreground">isoler</span> · ne montre que le voisinage</li>
        <li>· <span className="text-foreground">tracer</span> · cherche un chemin entre deux nœuds</li>
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
      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-primary/40 bg-primary/12 text-primary'
          : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function Score({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'positive' | 'plain' | 'warning'
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)))
  const barClass =
    tone === 'positive'
      ? 'bg-positive'
      : tone === 'warning'
        ? 'bg-warning'
        : 'bg-primary'
  return (
    <div className="rounded-lg border border-border/40 bg-surface-1 p-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-financial text-sm text-foreground">{pct}%</p>
      <div className="mt-1 h-1 rounded-full bg-background">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function NeighborGroup({
  title,
  tone,
  items,
  onSelect,
}: {
  title: string
  tone: 'primary' | 'warning' | 'violet' | 'muted'
  items: ReadonlyArray<AdvisorGraphNeighbor>
  onSelect: (id: string) => void
}) {
  if (items.length === 0) return null
  const styles: Record<typeof tone, string> = {
    primary: 'border-primary/25 bg-primary/8 text-primary',
    warning: 'border-warning/30 bg-warning/8 text-warning',
    violet: 'border-accent-2/30 bg-accent-2/8 text-accent-2',
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
              className="text-left text-[12px] text-foreground hover:underline"
            >
              · {other.label}
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
      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
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
    'Une conclusion proposée par l’Advisor. Ses voisins immédiats sont ses hypothèses, ses sources et les risques qui la fragilisent.',
  risk: 'Une zone de fragilité — surveiller, ne pas alarmer. Sert à challenger les recommandations associées.',
  contradiction: 'Quelque chose dans la mémoire vient affaiblir une autre affirmation. Demande une lecture attentive.',
  source:
    'Une provenance — interne ou externe. Toute conclusion devrait pouvoir y remonter.',
  concept: 'Un concept financier mobilisé pour expliquer une décision. Indépendant de tes données.',
  formula: 'Une formule sous-jacente. Sert à dériver des concepts ou à comparer des mesures.',
  assumption:
    'Une hypothèse explicite. Sa fraîcheur et sa confiance déterminent à quel point elle peut être réutilisée.',
  personal_snapshot: 'Vue agrégée et anonymisée de ton patrimoine et de tes flux courants.',
  goal: 'Un objectif personnel utilisé comme cible par l’Advisor.',
  market_signal: 'Un signal externe agrégé. Affecte certains actifs / investissements.',
  news_signal: 'Un signal d’actualité agrégé. Sert à contextualiser l’instant.',
  social_signal: 'Un signal social agrégé. Imports manuels uniquement, jamais raw.',
  investment: 'Une position d’investissement, en agrégat — jamais en payload provider brut.',
  asset: 'Un actif détenu ou observé, agrégé.',
  financial_account: 'Un compte, en agrégat — soldes uniquement.',
  transaction_cluster: 'Un cluster de transactions, jamais une liste raw exposée.',
}

const LINK_KIND_MEANING: Record<AdvisorGraphLink['kind'], string> = {
  supports: 'Cette relation soutient l’affirmation cible. Plus la confiance est haute, plus elle compte.',
  explains: 'Le concept de gauche explique la conclusion de droite — pédagogie ou raisonnement.',
  contradicts: 'Une contradiction explicite. Ne supprime pas l’autre affirmation, mais la fragilise.',
  weakens:
    'Cette relation affaiblit la cible — sans la contredire frontalement, elle ajoute du doute.',
  derived_from: 'Provenance ou dérivation : la cible vient de la source.',
  related_to: 'Lien faible — utile à la navigation, pas une preuve.',
  affects: 'Impact d’un signal sur une cible : suivi à surveiller.',
  mentions: 'Mention sans engagement — utile pour la traçabilité.',
  uses_assumption: 'La cible repose sur une hypothèse explicite. À revisiter si l’hypothèse vieillit.',
  belongs_to: 'Appartenance structurelle (compte → snapshot, etc.).',
}
