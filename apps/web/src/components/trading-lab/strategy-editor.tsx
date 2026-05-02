import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  archiveTradingLabStrategy,
  createTradingLabStrategy,
  type CreateStrategyRequest,
  type TradingLabStrategy,
} from '@/features/trading-lab-api'
import { Panel } from '@/components/surfaces/panel'

type Props = {
  strategies: TradingLabStrategy[]
  isAdmin: boolean
}

type Preset = {
  name: string
  slug: string
  description: string
  strategyType: 'benchmark' | 'experimental'
  tags: string[]
  parameters: Record<string, unknown>
  indicators: Array<{ name: string; params: Record<string, unknown> }>
  entryRules: Array<{ id: string; description: string; condition: string }>
  exitRules: Array<{ id: string; description: string; condition: string }>
  riskRules: Array<{ id: string; description: string; condition: string }>
  assumptions: string[]
  caveats: string[]
}

const PRESETS = {
  buy_and_hold: {
    name: 'Buy & Hold',
    slug: 'buy-and-hold',
    description: 'Benchmark long-only — achat à l\'ouverture, conservation jusqu\'à la fin.',
    strategyType: 'benchmark',
    tags: ['benchmark', 'long-only'],
    parameters: { strategy_type: 'buy_and_hold' },
    indicators: [],
    entryRules: [{ id: 'bh-entry', description: 'Achat au démarrage', condition: 'always' }],
    exitRules: [{ id: 'bh-exit', description: 'Détention jusqu\'à la fin', condition: 'never' }],
    riskRules: [],
    assumptions: ['Marché long-terme haussier'],
    caveats: ['Aucune gestion du drawdown', 'Exposition pleine et continue'],
  },
  ema_crossover: {
    name: 'EMA Crossover (10/20)',
    slug: 'ema-crossover-10-20',
    description: 'Signal long quand EMA10 > EMA20, sortie quand EMA10 < EMA20.',
    strategyType: 'experimental',
    tags: ['trend', 'ema', 'experimental'],
    parameters: { strategy_type: 'ema_crossover', fast_period: 10, slow_period: 20 },
    indicators: [
      { name: 'ema', params: { period: 10 } },
      { name: 'ema', params: { period: 20 } },
    ],
    entryRules: [{ id: 'ec-entry', description: 'EMA10 > EMA20', condition: 'ema_fast > ema_slow' }],
    exitRules: [{ id: 'ec-exit', description: 'EMA10 < EMA20', condition: 'ema_fast < ema_slow' }],
    riskRules: [],
    assumptions: ['Persistance des tendances', 'Liquidité suffisante'],
    caveats: ['Pas d\'edge prouvée', 'Whipsaws en marché latéral'],
  },
  rsi_mean_reversion: {
    name: 'RSI Mean Reversion',
    slug: 'rsi-mean-reversion-14',
    description: 'Long quand RSI < 30, exit quand RSI > 70.',
    strategyType: 'experimental',
    tags: ['mean-reversion', 'rsi', 'experimental'],
    parameters: {
      strategy_type: 'rsi_mean_reversion',
      rsi_period: 14,
      oversold: 30,
      overbought: 70,
    },
    indicators: [{ name: 'rsi', params: { period: 14 } }],
    entryRules: [
      { id: 'rsi-entry', description: 'RSI < 30 (survente)', condition: 'rsi < oversold' },
    ],
    exitRules: [
      { id: 'rsi-exit', description: 'RSI > 70 (surachat)', condition: 'rsi > overbought' },
    ],
    riskRules: [],
    assumptions: ['Le marché tend à revenir vers sa moyenne'],
    caveats: ['Risque de couteau qui tombe', 'Pas d\'edge prouvée'],
  },
  parabolic_sar_trend: {
    name: 'Parabolic SAR Trend',
    slug: 'parabolic-sar-trend',
    description: 'Long quand le prix > SAR.',
    strategyType: 'experimental',
    tags: ['trend', 'sar', 'experimental'],
    parameters: { strategy_type: 'parabolic_sar_trend', step: 0.02, max_step: 0.2 },
    indicators: [{ name: 'parabolic_sar', params: { step: 0.02, max_step: 0.2 } }],
    entryRules: [{ id: 'sar-entry', description: 'Prix > SAR', condition: 'close > sar' }],
    exitRules: [{ id: 'sar-exit', description: 'Prix < SAR', condition: 'close < sar' }],
    riskRules: [],
    assumptions: ['Tendance directionnelle claire'],
    caveats: ['Sensible aux retournements brutaux'],
  },
  orb_breakout: {
    name: 'ORB Breakout (5j)',
    slug: 'orb-breakout-5d',
    description: 'Cassure de range haut/bas sur 5 jours.',
    strategyType: 'experimental',
    tags: ['breakout', 'experimental'],
    parameters: { strategy_type: 'orb_breakout', lookback: 5 },
    indicators: [],
    entryRules: [
      { id: 'orb-entry', description: 'Cassure haute', condition: 'close > range_high' },
    ],
    exitRules: [
      { id: 'orb-exit', description: 'Cassure basse', condition: 'close < range_low' },
    ],
    riskRules: [],
    assumptions: ['Volatilité directionnelle après cassure'],
    caveats: ['Faux signaux fréquents en range'],
  },
} satisfies Record<string, Preset>

type PresetKey = keyof typeof PRESETS

const DEFAULT_PRESET_KEY = 'ema_crossover' satisfies PresetKey
const DEFAULT_PRESET = PRESETS[DEFAULT_PRESET_KEY]

export function StrategyEditor({ strategies, isAdmin }: Props) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [presetKey, setPresetKey] = useState<PresetKey>(DEFAULT_PRESET_KEY)
  const [name, setName] = useState(DEFAULT_PRESET.name)
  const [slug, setSlug] = useState(DEFAULT_PRESET.slug)
  const [description, setDescription] = useState(DEFAULT_PRESET.description)
  const [feedback, setFeedback] = useState<string | null>(null)

  const applyPreset = (key: PresetKey) => {
    const preset = PRESETS[key]
    if (!preset) return
    setPresetKey(key)
    setName(preset.name)
    setSlug(preset.slug)
    setDescription(preset.description)
  }

  const createMutation = useMutation({
    mutationFn: (body: CreateStrategyRequest) => createTradingLabStrategy(body),
    onSuccess: result => {
      setFeedback(`Stratégie #${result.strategy.id} créée.`)
      void queryClient.invalidateQueries({ queryKey: ['tradingLab', 'strategies'] })
    },
    onError: error => {
      setFeedback(`Erreur : ${(error as Error).message}`)
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: number) => archiveTradingLabStrategy(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tradingLab', 'strategies'] })
    },
  })

  const handleCreate = () => {
    setFeedback(null)
    const trimmedName = name.trim()
    const trimmedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    if (!trimmedName || !trimmedSlug) {
      setFeedback('Nom et slug requis.')
      return
    }
    const preset = PRESETS[presetKey]
    if (!preset) {
      setFeedback('Preset invalide.')
      return
    }
    const trimmedDescription = description.trim()
    const body: CreateStrategyRequest = {
      name: trimmedName,
      slug: trimmedSlug,
      strategyType: preset.strategyType,
      status: 'draft',
      tags: preset.tags,
      parameters: preset.parameters,
      indicators: preset.indicators,
      entryRules: preset.entryRules,
      exitRules: preset.exitRules,
      riskRules: preset.riskRules,
      assumptions: preset.assumptions,
      caveats: preset.caveats,
    }
    if (trimmedDescription) body.description = trimmedDescription
    createMutation.mutate(body)
  }

  return (
    <Panel
      title="Builder de stratégie"
      description={
        isAdmin
          ? 'Crée des stratégies papier depuis des presets. Les règles, indicateurs et caveats sont préremplis.'
          : 'Lecture seule en démo.'
      }
      tone="brand"
      actions={
        <button
          type="button"
          className="rounded-md border border-border bg-surface-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(state => !state)}
        >
          {open ? 'Masquer' : 'Afficher'}
        </button>
      }
    >
      {!open ? (
        <div className="text-xs text-muted-foreground">
          {strategies.length} stratégie{strategies.length > 1 ? 's' : ''} active{strategies.length > 1 ? 's' : ''}.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Preset</span>
              <select
                className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
                value={presetKey}
                disabled={!isAdmin}
                onChange={event => applyPreset(event.target.value as PresetKey)}
              >
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.name} · {preset.strategyType}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Nom</span>
              <input
                type="text"
                value={name}
                onChange={event => setName(event.target.value)}
                disabled={!isAdmin}
                className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Slug</span>
              <input
                type="text"
                value={slug}
                onChange={event => setSlug(event.target.value)}
                disabled={!isAdmin}
                className="rounded-md border border-border bg-surface-1 px-2 py-1.5 font-mono text-xs text-foreground disabled:opacity-50"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Description</span>
            <textarea
              rows={2}
              value={description}
              onChange={event => setDescription(event.target.value)}
              disabled={!isAdmin}
              className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
            />
          </label>

          <div className="rounded-md border border-border/60 bg-surface-1 p-2 text-[11px]">
            <div className="mb-1 text-muted-foreground">Règles & caveats du preset</div>
            <PresetSummary preset={PRESETS[presetKey] ?? DEFAULT_PRESET} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!isAdmin || createMutation.isPending}
              onClick={handleCreate}
              className="rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Création…' : 'Créer la stratégie'}
            </button>
            {feedback ? <span className="text-xs text-muted-foreground">{feedback}</span> : null}
            <span className="ml-auto text-[10px] text-amber-400/70">
              Aucune exécution réelle, aucun broker, aucune levier.
            </span>
          </div>

          <div className="rounded-md border border-border bg-surface-0 p-2">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Stratégies existantes
            </div>
            <ul className="space-y-1">
              {strategies.length === 0 ? (
                <li className="text-xs text-muted-foreground">Aucune stratégie pour le moment.</li>
              ) : null}
              {strategies.map(strategy => (
                <li
                  key={strategy.id}
                  className="flex items-center gap-2 rounded border border-border/60 bg-surface-1 px-2 py-1 text-xs"
                >
                  <span className="font-medium text-foreground">{strategy.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {strategy.slug}
                  </span>
                  <span className="rounded-full border border-border/60 px-1.5 text-[10px] text-muted-foreground">
                    {strategy.strategyType}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{strategy.status}</span>
                  {isAdmin && strategy.status !== 'archived' ? (
                    <button
                      type="button"
                      onClick={() => archiveMutation.mutate(strategy.id)}
                      className="text-[10px] text-muted-foreground hover:text-red-400"
                    >
                      archiver
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Panel>
  )
}

function PresetSummary({ preset }: { preset: Preset }) {
  return (
    <div className="space-y-1 text-muted-foreground">
      <div>
        <span className="text-foreground/80">Indicateurs : </span>
        {preset.indicators.length === 0
          ? 'aucun'
          : preset.indicators
              .map(ind => `${ind.name}(${Object.values(ind.params).join(',')})`)
              .join(', ')}
      </div>
      <div>
        <span className="text-foreground/80">Entrée : </span>
        {preset.entryRules.map(rule => rule.description).join(' · ')}
      </div>
      <div>
        <span className="text-foreground/80">Sortie : </span>
        {preset.exitRules.map(rule => rule.description).join(' · ')}
      </div>
      <div>
        <span className="text-foreground/80">Caveats : </span>
        {preset.caveats.join(' · ')}
      </div>
    </div>
  )
}
