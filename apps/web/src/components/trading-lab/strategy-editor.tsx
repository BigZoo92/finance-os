import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Panel } from '@/components/surfaces/panel'
import {
  archiveTradingLabStrategy,
  type CreateStrategyRequest,
  createTradingLabStrategy,
  type TradingLabStrategy,
} from '@/features/trading-lab-api'

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
    description: "Benchmark long-only. Achat à l'ouverture et conservation jusqu'à la fin.",
    strategyType: 'benchmark',
    tags: ['benchmark', 'long-only'],
    parameters: { strategy_type: 'buy_and_hold' },
    indicators: [],
    entryRules: [{ id: 'bh-entry', description: 'Achat au démarrage', condition: 'always' }],
    exitRules: [{ id: 'bh-exit', description: "Détention jusqu'à la fin", condition: 'never' }],
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
    entryRules: [
      { id: 'ec-entry', description: 'EMA10 > EMA20', condition: 'ema_fast > ema_slow' },
    ],
    exitRules: [{ id: 'ec-exit', description: 'EMA10 < EMA20', condition: 'ema_fast < ema_slow' }],
    riskRules: [],
    assumptions: ['Persistance des tendances', 'Liquidité suffisante'],
    caveats: ["Pas d'edge prouvée", 'Whipsaws en marché latéral'],
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
    caveats: ['Risque de couteau qui tombe', "Pas d'edge prouvée"],
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
    exitRules: [{ id: 'orb-exit', description: 'Cassure basse', condition: 'close < range_low' }],
    riskRules: [],
    assumptions: ['Volatilité directionnelle après cassure'],
    caveats: ['Faux signaux fréquents en range'],
  },
} satisfies Record<string, Preset>

type PresetKey = keyof typeof PRESETS

const DEFAULT_PRESET_KEY = 'ema_crossover' satisfies PresetKey
const DEFAULT_PRESET = PRESETS[DEFAULT_PRESET_KEY]

const STRATEGY_TYPE_LABEL: Record<Preset['strategyType'], string> = {
  benchmark: 'Référence',
  experimental: 'Expérimentale',
}

const strategyStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    'active-paper': 'Simulation active',
    archived: 'Archivée',
    draft: 'Brouillon',
  }
  return labels[status] ?? 'État inconnu'
}

const toggleButton = css({
  rounded: 'md',
  borderWidth: '1px',
  borderColor: 'border',
  bg: 'surface.1',
  px: '2',
  py: '1',
  fontSize: '11px',
  color: 'muted.foreground',
  _hover: { color: 'foreground' },
})

const field = css({ display: 'flex', flexDirection: 'column', gap: '1', textStyle: 'xs' })

const fieldLabel = css({ color: 'muted.foreground' })

// The slug field swaps the control's text size for the mono `xs` one.
const control = cva({
  base: {
    rounded: 'md',
    borderWidth: '1px',
    borderColor: 'border',
    bg: 'surface.1',
    px: '2',
    py: '1.5',
    color: 'foreground',
    _disabled: { opacity: '0.5' },
  },
  variants: {
    kind: {
      text: { textStyle: 'sm' },
      slug: { fontFamily: 'mono', textStyle: 'xs' },
    },
  },
  defaultVariants: { kind: 'text' },
})

const createButton = css({
  rounded: 'md',
  borderWidth: '1px',
  borderColor: 'primary/40',
  bg: 'primary/15',
  px: '3',
  py: '1.5',
  textStyle: 'xs',
  fontWeight: 'medium',
  color: 'primary',
  _hover: { bg: 'primary/25' },
  _disabled: { opacity: '0.5' },
})

const strategyRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  rounded: '0.25rem',
  borderWidth: '1px',
  borderColor: 'border/60',
  bg: 'surface.1',
  px: '2',
  py: '1',
  textStyle: 'xs',
})

const archiveButton = css({
  fontSize: '10px',
  color: 'muted.foreground',
  _hover: { color: 'negative' },
})

const summaryKey = css({ color: 'foreground/80' })

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
    onError: () => {
      setFeedback('Création impossible. Réessayez.')
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
    const trimmedSlug = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
    if (!trimmedName || !trimmedSlug) {
      setFeedback('Nom et slug requis.')
      return
    }
    const preset = PRESETS[presetKey]
    if (!preset) {
      setFeedback('Modèle indisponible.')
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
      title="Création de stratégie"
      description={
        isAdmin ? 'Crée une stratégie simulée à partir d’un modèle.' : 'Lecture seule en démo.'
      }
      tone="brand"
      actions={
        <button type="button" className={toggleButton} onClick={() => setOpen(state => !state)}>
          {open ? 'Masquer' : 'Afficher'}
        </button>
      }
    >
      {!open ? (
        <styled.div textStyle="xs" color="muted.foreground">
          {strategies.length} stratégie{strategies.length > 1 ? 's' : ''} active
          {strategies.length > 1 ? 's' : ''}.
        </styled.div>
      ) : (
        <styled.div spaceY="3">
          <styled.div
            display="grid"
            gap="3"
            sm={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
            lg={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
          >
            <label className={field}>
              <span className={fieldLabel}>Modèle</span>
              <select
                className={control()}
                value={presetKey}
                disabled={!isAdmin}
                onChange={event => applyPreset(event.target.value as PresetKey)}
              >
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.name} ({STRATEGY_TYPE_LABEL[preset.strategyType]})
                  </option>
                ))}
              </select>
            </label>
            <label className={field}>
              <span className={fieldLabel}>Nom</span>
              <input
                type="text"
                value={name}
                onChange={event => setName(event.target.value)}
                disabled={!isAdmin}
                className={control()}
              />
            </label>
            <label className={field}>
              <span className={fieldLabel}>Slug</span>
              <input
                type="text"
                value={slug}
                onChange={event => setSlug(event.target.value)}
                disabled={!isAdmin}
                className={control({ kind: 'slug' })}
              />
            </label>
          </styled.div>

          <label className={field}>
            <span className={fieldLabel}>Description</span>
            <textarea
              rows={2}
              value={description}
              onChange={event => setDescription(event.target.value)}
              disabled={!isAdmin}
              className={control()}
            />
          </label>

          <styled.div
            rounded="md"
            borderWidth="1px"
            borderColor="border/60"
            bg="surface.1"
            p="2"
            fontSize="11px"
          >
            <styled.div mb="1" color="muted.foreground">
              Règles et limites du modèle
            </styled.div>
            <PresetSummary preset={PRESETS[presetKey] ?? DEFAULT_PRESET} />
          </styled.div>

          <styled.div display="flex" flexWrap="wrap" alignItems="center" gap="2">
            <button
              type="button"
              disabled={!isAdmin || createMutation.isPending}
              onClick={handleCreate}
              className={createButton}
            >
              {createMutation.isPending ? 'Création…' : 'Créer la stratégie'}
            </button>
            {feedback ? (
              <styled.span textStyle="xs" color="muted.foreground">
                {feedback}
              </styled.span>
            ) : null}
            <styled.span ml="auto" fontSize="10px" color="warning/70">
              Simulation uniquement.
            </styled.span>
          </styled.div>

          <styled.div rounded="md" borderWidth="1px" borderColor="border" bg="surface.0" p="2">
            <styled.div
              mb="1"
              fontSize="11px"
              textTransform="uppercase"
              letterSpacing="wide"
              color="muted.foreground"
            >
              Stratégies existantes
            </styled.div>
            <styled.ul spaceY="1">
              {strategies.length === 0 ? (
                <styled.li textStyle="xs" color="muted.foreground">
                  Aucune stratégie pour le moment.
                </styled.li>
              ) : null}
              {strategies.map(strategy => (
                <li key={strategy.id} className={strategyRow}>
                  <styled.span fontWeight="medium" color="foreground">
                    {strategy.name}
                  </styled.span>
                  <styled.span fontFamily="mono" fontSize="10px" color="muted.foreground">
                    {strategy.slug}
                  </styled.span>
                  <styled.span
                    rounded="full"
                    borderWidth="1px"
                    borderColor="border/60"
                    px="1.5"
                    fontSize="10px"
                    color="muted.foreground"
                  >
                    {strategy.strategyType === 'benchmark'
                      ? 'Référence'
                      : strategy.strategyType === 'experimental'
                        ? 'Expérimentale'
                        : 'Autre'}
                  </styled.span>
                  <styled.span ml="auto" fontSize="10px" color="muted.foreground">
                    {strategyStatusLabel(strategy.status)}
                  </styled.span>
                  {isAdmin && strategy.status !== 'archived' ? (
                    <button
                      type="button"
                      onClick={() => archiveMutation.mutate(strategy.id)}
                      className={archiveButton}
                    >
                      Archiver
                    </button>
                  ) : null}
                </li>
              ))}
            </styled.ul>
          </styled.div>
        </styled.div>
      )}
    </Panel>
  )
}

function PresetSummary({ preset }: { preset: Preset }) {
  return (
    <styled.div spaceY="1" color="muted.foreground">
      <div>
        <span className={summaryKey}>Indicateurs : </span>
        {preset.indicators.length === 0
          ? 'aucun'
          : preset.indicators
              .map(ind => `${ind.name}(${Object.values(ind.params).join(',')})`)
              .join(', ')}
      </div>
      <div>
        <span className={summaryKey}>Entrée : </span>
        {preset.entryRules.map(rule => rule.description).join(', ')}
      </div>
      <div>
        <span className={summaryKey}>Sortie : </span>
        {preset.exitRules.map(rule => rule.description).join(', ')}
      </div>
      <div>
        <span className={summaryKey}>Caveats : </span>
        {preset.caveats.join(', ')}
      </div>
    </styled.div>
  )
}
