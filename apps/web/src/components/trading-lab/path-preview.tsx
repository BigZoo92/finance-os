/**
 * Knowledge graph path preview for Trading Lab.
 *
 * Renders the chain Signal → Scenario → Strategy → Backtest → Caveats as a
 * compact, accessible card flow. Does NOT query Neo4j directly — it just
 * walks data the API already exposes (scenarios + backtests + caveats).
 */
import type {
  AttentionItem,
  TradingLabBacktestRun,
  TradingLabScenario,
  TradingLabStrategy,
} from '@/features/trading-lab-api'
import { Panel } from '@/components/surfaces/panel'

type Props = {
  scenarios: TradingLabScenario[]
  strategies: TradingLabStrategy[]
  backtests: TradingLabBacktestRun[]
  attentionItems: AttentionItem[]
}

type PathStep = {
  id: string
  kind: 'signal' | 'scenario' | 'strategy' | 'backtest' | 'caveat'
  title: string
  subtitle?: string | undefined
  href?: string | undefined
}

const HUMAN_LABELS: Record<string, string> = {
  active: 'Active',
  archived: 'Archivée',
  benchmark: 'Référence',
  completed: 'Terminé',
  draft: 'Brouillon',
  experimental: 'Expérimentale',
  failed: 'Échec',
  flagged: 'Repéré',
  pending: 'En attente',
  running: 'En cours',
}

const toHumanLabel = (value: string) =>
  HUMAN_LABELS[value] ?? value.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase())

const KIND_TINT: Record<PathStep['kind'], string> = {
  signal: 'border-teal/40 bg-teal/10 text-teal',
  scenario: 'border-ai/40 bg-ai/10 text-ai',
  strategy: 'border-positive/40 bg-positive/10 text-positive',
  backtest: 'border-teal/40 bg-teal/10 text-teal',
  caveat: 'border-warning/40 bg-warning/10 text-warning',
}

const KIND_LABEL: Record<PathStep['kind'], string> = {
  signal: 'Signal',
  scenario: 'Scénario',
  strategy: 'Stratégie',
  backtest: 'Backtest',
  caveat: 'Caveat',
}

const buildPaths = ({
  scenarios,
  strategies,
  backtests,
  attentionItems,
}: Props): Array<{ key: string; title: string; steps: PathStep[] }> => {
  const out: Array<{ key: string; title: string; steps: PathStep[] }> = []
  const stratById = new Map<number, TradingLabStrategy>()
  for (const strategy of strategies) {
    stratById.set(strategy.id, strategy)
  }
  const recentBacktests = backtests.slice(0, 4)

  for (const scenario of scenarios.slice(0, 4)) {
    const strategy = scenario.linkedStrategyId
      ? stratById.get(scenario.linkedStrategyId)
      : undefined
    const linkedBacktest = strategy
      ? recentBacktests.find(b => b.strategyId === strategy.id)
      : undefined
    const steps: PathStep[] = []
    if (scenario.linkedSignalItemId) {
      steps.push({
        id: `signal:${scenario.linkedSignalItemId}`,
        kind: 'signal',
        title: `Signal #${scenario.linkedSignalItemId}`,
        subtitle: 'Repéré',
        href: '/radar',
      })
    }
    steps.push({
      id: `scenario:${scenario.id}`,
      kind: 'scenario',
      title: scenario.name,
      subtitle: scenario.thesis ? scenario.thesis.slice(0, 90) : toHumanLabel(scenario.status),
    })
    if (strategy) {
      steps.push({
        id: `strategy:${strategy.id}`,
        kind: 'strategy',
        title: strategy.name,
        subtitle: toHumanLabel(strategy.strategyType),
      })
    }
    if (linkedBacktest) {
      const m = (linkedBacktest.metrics ?? {}) as Record<string, unknown>
      const cagr = Number(m.cagr)
      steps.push({
        id: `backtest:${linkedBacktest.id}`,
        kind: 'backtest',
        title: `Backtest #${linkedBacktest.id}`,
        subtitle: Number.isFinite(cagr)
          ? `CAGR ${(cagr * 100).toFixed(1)}%, ${toHumanLabel(linkedBacktest.runStatus)}`
          : toHumanLabel(linkedBacktest.runStatus),
      })
    }
    steps.push({
      id: `caveat:${scenario.id}`,
      kind: 'caveat',
      title: 'Limites',
      subtitle: scenario.invalidationCriteria
        ? scenario.invalidationCriteria.slice(0, 80)
        : 'Backtest ≠ prédiction',
    })
    out.push({ key: `scenario:${scenario.id}`, title: scenario.name, steps })
  }

  // If no scenarios but we have attention items, show a "signal → caveat" path
  if (out.length === 0 && attentionItems.length > 0) {
    for (const item of attentionItems.slice(0, 2)) {
      out.push({
        key: `attention:${item.id}`,
        title: item.title,
        steps: [
          {
            id: `attention:${item.id}`,
            kind: 'signal',
            title: item.title,
            subtitle: item.summary ?? undefined,
            href: item.actionHref ?? undefined,
          },
          {
            id: `caveat:${item.id}`,
            kind: 'caveat',
            title: 'Aucun scénario lié',
            subtitle: 'Crée un scénario simulé pour structurer la thèse.',
          },
        ],
      })
    }
  }

  return out
}

export function GraphPathPreview(props: Props) {
  const paths = buildPaths(props)

  return (
    <Panel
      title="Parcours"
      description="Du signal aux limites de la simulation."
      tone="ai"
    >
      {paths.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          Aucun parcours enregistré. Crée un scénario depuis Radar.
        </div>
      ) : (
        <ul className="space-y-3">
          {paths.map(path => (
            <li key={path.key}>
              <div className="mb-1 text-xs text-muted-foreground">{path.title}</div>
              <ol className="flex flex-wrap items-stretch gap-1.5">
                {path.steps.map((step, index) => (
                  <li key={step.id} className="flex items-stretch">
                    {step.href ? (
                      <a
                        href={step.href}
                        className={`flex flex-col rounded border px-2 py-1 text-[11px] ${KIND_TINT[step.kind]} hover:opacity-90`}
                      >
                        <StepHeader step={step} />
                      </a>
                    ) : (
                      <div
                        className={`flex flex-col rounded border px-2 py-1 text-[11px] ${KIND_TINT[step.kind]}`}
                      >
                        <StepHeader step={step} />
                      </div>
                    )}
                    {index < path.steps.length - 1 ? (
                      <span
                        aria-hidden
                        className="self-center px-1 text-muted-foreground/60"
                      >
                        →
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function StepHeader({ step }: { step: PathStep }) {
  return (
    <>
      <span className="text-[9px] uppercase tracking-wide opacity-70">{KIND_LABEL[step.kind]}</span>
      <span className="line-clamp-1 font-medium">{step.title}</span>
      {step.subtitle ? (
        <span className="line-clamp-1 text-[10px] opacity-75">{step.subtitle}</span>
      ) : null}
    </>
  )
}
