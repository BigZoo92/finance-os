// PR11 — Trading Lab pattern detection panel.
//
// Reads the existing `POST /dashboard/trading-lab/patterns/detect` endpoint added in PR10.
// NEVER an execution path; the panel is research/paper-only:
//   • Demo mode renders the deterministic fixture without contacting the API.
//   • Admin mode runs the API, which proxies to quant-service.
//   • Flag-gated by VITE_LEARNING_LOOP_UI_ENABLED — when off, the panel is not rendered.
//   • No buy/sell/order/execute wording. Confidence + limitations + invalidation hints are
//     surfaced verbatim from the deterministic engine.
//
// Conversion to a manual hypothesis draft uses the existing PR3 endpoint via
// `postTradingLabHypothesis`; on success the hypotheses query keys are invalidated.

import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Badge, Button, Input } from '@finance-os/ui/components'
import { ChartNetworkPixelIcon } from '@finance-os/ui/icons/pixel'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Panel } from '@/components/surfaces/panel'
import type { AuthMode } from '@/features/auth-types'
import {
  DEMO_TRADING_LAB_PATTERN_CANDLES,
  getDemoTradingLabPatternDetection,
  postTradingLabHypothesis,
  postTradingLabPatternDetection,
} from '@/features/dashboard-api'
import { LEARNING_LOOP_INVALIDATION_KEYS } from '@/features/dashboard-query-options'
import type {
  DashboardTradingLabPatternCandle,
  DashboardTradingLabPatternDetection,
  DashboardTradingLabPatternDetectRequest,
  DashboardTradingLabPatternDetectResponse,
  DashboardTradingLabPatternKey,
} from '@/features/dashboard-types'
import {
  buildHypothesisDraftFromDetection,
  PATTERN_CONFIDENCE_LABEL_FR,
  PATTERN_LABELS_FR,
  TREND_PATTERN_DIRECTION_LABEL_FR,
} from '@/features/learning-loop-view-model'
import { toErrorMessage } from '@/lib/format'

const PATTERN_OPTIONS: ReadonlyArray<{ key: DashboardTradingLabPatternKey; label: string }> = [
  { key: 'ema20_horizontal_level', label: PATTERN_LABELS_FR.ema20_horizontal_level },
  { key: 'ema200_one_touch', label: PATTERN_LABELS_FR.ema200_one_touch },
  { key: 'parabolic_sar_rci', label: PATTERN_LABELS_FR.parabolic_sar_rci },
  { key: 'volume_profile_zones', label: PATTERN_LABELS_FR.volume_profile_zones },
  // PR15B — SMC/ICT research patterns. Deliberately last in the selector so the
  // historically-shipped detectors stay above.
  { key: 'fair_value_gap', label: PATTERN_LABELS_FR.fair_value_gap },
  { key: 'liquidity_sweep', label: PATTERN_LABELS_FR.liquidity_sweep },
  { key: 'break_of_structure', label: PATTERN_LABELS_FR.break_of_structure },
  { key: 'change_of_character', label: PATTERN_LABELS_FR.change_of_character },
  { key: 'order_block_candidate', label: PATTERN_LABELS_FR.order_block_candidate },
]

// PR15B — keys whose research framing is SMC/ICT. We surface a separate badge so the user
// knows these detections are interpretive heuristics, not classical indicators.
const SMC_ICT_KEYS: ReadonlySet<DashboardTradingLabPatternKey> = new Set([
  'fair_value_gap',
  'liquidity_sweep',
  'break_of_structure',
  'change_of_character',
  'order_block_candidate',
])

const DEFAULT_TIMEFRAME = '1d'

// Direction, confidence and data-sufficiency tones.
const toneText = cva({
  base: {},
  variants: {
    tone: {
      muted: { color: 'muted.foreground' },
      teal: { color: 'teal' },
      positive: { color: 'positive' },
      warning: { color: 'warning' },
    },
  },
})

type TextTone = 'muted' | 'teal' | 'positive' | 'warning'

const CONFIDENCE_TONE: Record<DashboardTradingLabPatternDetection['confidence'], TextTone> = {
  low: 'muted',
  medium: 'teal',
  high: 'positive',
}

const DIRECTION_TONE: Record<DashboardTradingLabPatternDetection['direction'], TextTone> = {
  bullish: 'positive',
  bearish: 'warning',
  neutral: 'muted',
  unknown: 'muted',
}

const fieldLabel = css({
  display: 'block',
  textStyle: 'xs',
  fontWeight: 'medium',
  color: 'muted.foreground',
})

const sectionLabel = css({
  textStyle: 'xs',
  fontWeight: 'semibold',
  textTransform: 'uppercase',
  letterSpacing: 'wide',
  color: 'muted.foreground',
})

// Tailwind's `space-y-1` rule kept verbatim: the first child is the fieldset legend.
const patternFieldset = css({ '& > :not(:last-child)': { marginBlockEnd: '1' } })

const optionLabel = css({ display: 'flex', alignItems: 'center', gap: '2', textStyle: 'xs' })

const checkbox = css({ boxSize: '3' })

const candlesInput = css({
  mt: '1',
  display: 'block',
  w: 'full',
  rounded: 'md',
  borderWidth: '1px',
  borderColor: 'border/60',
  bg: 'background',
  px: '2',
  py: '1',
  fontFamily: 'mono',
  textStyle: 'xs',
})

const mutedText = css({ color: 'muted.foreground' })

const qualityBar = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '2',
  rounded: 'xl',
  borderWidth: '1px',
  borderColor: 'border/40',
  bg: 'surface.1/40',
  px: '3',
  py: '2',
  textStyle: 'xs',
})

// Tailwind's `space-x-2` rule kept verbatim: the children are inline spans that may wrap.
const qualitySummary = css({ '& > :not(:last-child)': { marginInlineEnd: '2' } })

const emptyState = css({
  rounded: 'xl',
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: 'border/45',
  bg: 'surface.1/35',
  px: '4',
  py: '6',
  textAlign: 'center',
  textStyle: 'sm',
  color: 'muted.foreground',
})

const detectionCard = css({
  rounded: 'xl',
  borderWidth: '1px',
  borderColor: 'border/50',
  bg: 'background/40',
  p: '3',
  textStyle: 'sm',
})

const bulletList = cva({
  base: {
    mt: '1',
    listStylePosition: 'inside',
    listStyleType: 'disc',
    textStyle: 'xs',
  },
  variants: {
    tone: {
      body: { color: 'foreground/90' },
      muted: { color: 'muted.foreground' },
    },
  },
  defaultVariants: { tone: 'body' },
})

interface PatternDetectionPanelProps {
  mode: AuthMode
}

const parseCandlesJson = (
  raw: string
): { ok: true; candles: DashboardTradingLabPatternCandle[] } | { ok: false; error: string } => {
  if (raw.trim().length === 0) {
    return { ok: false, error: 'Le champ JSON est vide.' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'JSON invalide. Vérifiez la structure des données.' }
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'Le JSON doit être un tableau de candles.' }
  }
  const candles: DashboardTradingLabPatternCandle[] = []
  for (const [i, item] of parsed.entries()) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: `Candle #${i + 1} invalide.` }
    }
    const rec = item as Record<string, unknown>
    const timestamp = typeof rec.timestamp === 'string' ? rec.timestamp : null
    const open = typeof rec.open === 'number' ? rec.open : null
    const high = typeof rec.high === 'number' ? rec.high : null
    const low = typeof rec.low === 'number' ? rec.low : null
    const close = typeof rec.close === 'number' ? rec.close : null
    if (timestamp === null || open === null || high === null || low === null || close === null) {
      return { ok: false, error: `Candle #${i + 1}: champs requis manquants.` }
    }
    const volume =
      typeof rec.volume === 'number' ? rec.volume : rec.volume === null ? null : undefined
    const candle: DashboardTradingLabPatternCandle = { timestamp, open, high, low, close }
    if (volume !== undefined) candle.volume = volume
    candles.push(candle)
  }
  if (candles.length === 0) {
    return { ok: false, error: 'Au moins une candle est requise.' }
  }
  return { ok: true, candles }
}

const stringifyCandles = (candles: DashboardTradingLabPatternCandle[]): string =>
  JSON.stringify(candles, null, 2)

export function PatternDetectionPanel({ mode }: PatternDetectionPanelProps) {
  const queryClient = useQueryClient()
  const isAdmin = mode === 'admin'

  const [symbol, setSymbol] = useState('TEST.US')
  const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME)
  const [selectedPatterns, setSelectedPatterns] = useState<DashboardTradingLabPatternKey[]>([
    'ema20_horizontal_level',
    'parabolic_sar_rci',
  ])
  const [candlesJson, setCandlesJson] = useState(() =>
    stringifyCandles(DEMO_TRADING_LAB_PATTERN_CANDLES)
  )
  const [parseError, setParseError] = useState<string | null>(null)
  const [demoResult, setDemoResult] = useState<DashboardTradingLabPatternDetectResponse | null>(
    null
  )
  const [createdMessage, setCreatedMessage] = useState<string | null>(null)

  const detectMutation = useMutation({
    mutationFn: postTradingLabPatternDetection,
  })

  const createHypothesisMutation = useMutation({
    mutationFn: postTradingLabHypothesis,
    onSuccess: async () => {
      setCreatedMessage('Hypothèse paper créée.')
      await Promise.all(
        LEARNING_LOOP_INVALIDATION_KEYS.afterHypothesisChange().map(queryKey =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
    },
  })

  const togglePattern = (key: DashboardTradingLabPatternKey) => {
    setSelectedPatterns(prev => (prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]))
  }

  const handleRun = () => {
    setParseError(null)
    setCreatedMessage(null)
    const parsed = parseCandlesJson(candlesJson)
    if (!parsed.ok) {
      setParseError(parsed.error)
      return
    }
    const trimmedSymbol = symbol.trim()
    const request: DashboardTradingLabPatternDetectRequest = {
      timeframe: timeframe.trim().length > 0 ? timeframe.trim() : DEFAULT_TIMEFRAME,
      candles: parsed.candles,
      ...(trimmedSymbol.length > 0 ? { symbol: trimmedSymbol } : {}),
      ...(selectedPatterns.length > 0 ? { patterns: selectedPatterns } : {}),
    }
    if (mode === 'demo') {
      setDemoResult(getDemoTradingLabPatternDetection(request))
      return
    }
    detectMutation.mutate(request)
  }

  const handleResetDemo = () => {
    setCandlesJson(stringifyCandles(DEMO_TRADING_LAB_PATTERN_CANDLES))
    setSymbol('TEST.US')
    setTimeframe(DEFAULT_TIMEFRAME)
    setSelectedPatterns(['ema20_horizontal_level', 'parabolic_sar_rci'])
    setDemoResult(null)
    setParseError(null)
    setCreatedMessage(null)
  }

  const result: DashboardTradingLabPatternDetectResponse | null = useMemo(() => {
    if (mode === 'demo') return demoResult
    return detectMutation.data ?? null
  }, [mode, demoResult, detectMutation.data])

  const handleCreateHypothesis = (detection: DashboardTradingLabPatternDetection) => {
    setCreatedMessage(null)
    const draft = buildHypothesisDraftFromDetection(detection, {
      symbol: symbol.trim().length > 0 ? symbol.trim() : null,
      timeframe: timeframe.trim().length > 0 ? timeframe.trim() : null,
    })
    createHypothesisMutation.mutate(draft)
  }

  return (
    <Panel
      title="Détection technique déterministe"
      description="Recherche paper-only. Aucune recommandation, aucune exécution."
      icon={<ChartNetworkPixelIcon size={16} />}
      tone="plain"
    >
      <styled.div spaceY="4">
        <styled.div display="flex" flexWrap="wrap" alignItems="center" gap="2" textStyle="xs">
          <Badge variant="outline">Paper only</Badge>
          <Badge variant="outline">Aucune exécution</Badge>
          <Badge variant="outline">Recherche</Badge>
          <Badge variant="outline">Détection déterministe</Badge>
          {selectedPatterns.some(p => SMC_ICT_KEYS.has(p)) ? (
            <Badge variant="outline">SMC/ICT research</Badge>
          ) : null}
        </styled.div>

        <styled.div
          display="grid"
          gap="3"
          sm={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
        >
          <div>
            <label htmlFor="pattern-detect-symbol" className={fieldLabel}>
              Symbole (libre)
            </label>
            <Input
              id="pattern-detect-symbol"
              mt="1"
              value={symbol}
              onChange={event => setSymbol(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pattern-detect-timeframe" className={fieldLabel}>
              Timeframe
            </label>
            <Input
              id="pattern-detect-timeframe"
              mt="1"
              value={timeframe}
              onChange={event => setTimeframe(event.target.value)}
            />
          </div>
        </styled.div>

        <fieldset className={patternFieldset}>
          <legend className={sectionLabel}>Patterns à évaluer</legend>
          <styled.div
            display="grid"
            gap="1"
            sm={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
          >
            {PATTERN_OPTIONS.map(option => {
              const id = `pattern-detect-${option.key}`
              const checked = selectedPatterns.includes(option.key)
              return (
                <label key={option.key} htmlFor={id} className={optionLabel}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePattern(option.key)}
                    className={checkbox}
                  />
                  <styled.span color="foreground">{option.label}</styled.span>
                </label>
              )
            })}
          </styled.div>
        </fieldset>

        <div>
          <label htmlFor="pattern-detect-candles" className={fieldLabel}>
            Candles (JSON, OHLCV)
          </label>
          <textarea
            id="pattern-detect-candles"
            rows={6}
            className={candlesInput}
            value={candlesJson}
            onChange={event => setCandlesJson(event.target.value)}
          />
          <styled.p mt="1" fontSize="11px" color="muted.foreground">
            Format : tableau d&apos;objets{' '}
            <code>{'{ timestamp, open, high, low, close, volume? }'}</code>. Le mode démo prérempli
            ce champ avec une fixture déterministe.
          </styled.p>
        </div>

        {parseError ? (
          <styled.p textStyle="xs" color="destructive">
            {parseError}
          </styled.p>
        ) : null}

        <styled.div display="flex" flexWrap="wrap" alignItems="center" gap="2">
          <Button type="button" size="sm" onClick={handleRun} disabled={detectMutation.isPending}>
            {mode === 'demo'
              ? 'Voir la détection (démo)'
              : detectMutation.isPending
                ? 'Détection…'
                : 'Lancer la détection'}
          </Button>
          {mode === 'demo' ? (
            <Button type="button" size="sm" variant="outline" onClick={handleResetDemo}>
              Réinitialiser la démo
            </Button>
          ) : null}
          {!isAdmin && mode !== 'demo' ? (
            <styled.span textStyle="xs" color="muted.foreground">
              Détection réservée au mode admin.
            </styled.span>
          ) : null}
        </styled.div>

        {detectMutation.isError ? (
          <styled.p textStyle="xs" color="destructive">
            Échec de la détection : {toErrorMessage(detectMutation.error)}
          </styled.p>
        ) : null}

        {result ? (
          <styled.div spaceY="3">
            <div className={qualityBar}>
              <div className={qualitySummary}>
                <span className={mutedText}>Candles :</span>
                <styled.span fontWeight="medium" color="foreground">
                  {result.dataQuality.candleCount}
                </styled.span>
                <span className={mutedText}>/</span>
                <span className={mutedText}>Données suffisantes :</span>
                <span
                  className={toneText({
                    tone: result.dataQuality.sufficient ? 'positive' : 'warning',
                  })}
                >
                  {result.dataQuality.sufficient ? 'oui' : 'non'}
                </span>
              </div>
              {result.dataQuality.hasVolume ? null : <Badge variant="outline">Volume absent</Badge>}
            </div>

            {result.dataQuality.warnings.length > 0 ? (
              <styled.ul spaceY="1" fontSize="11px" color="warning">
                {result.dataQuality.warnings.map(warning => (
                  <li key={warning}>{warning}</li>
                ))}
              </styled.ul>
            ) : null}

            {result.detections.length === 0 ? (
              <p className={emptyState}>Aucune détection sur cette série de candles.</p>
            ) : (
              <styled.ul spaceY="3">
                {result.detections.map(detection => (
                  <li key={detection.id} className={detectionCard}>
                    <styled.div
                      display="flex"
                      flexWrap="wrap"
                      alignItems="center"
                      justifyContent="space-between"
                      gap="2"
                    >
                      <div>
                        <styled.p fontWeight="medium" color="foreground">
                          {PATTERN_LABELS_FR[detection.patternType] ?? detection.patternType}
                        </styled.p>
                        <styled.p textStyle="xs" color="muted.foreground">
                          Observé le {detection.observedAt}
                        </styled.p>
                        {SMC_ICT_KEYS.has(detection.patternType) ? (
                          <styled.p
                            mt="1"
                            fontSize="11px"
                            textTransform="uppercase"
                            letterSpacing="wide"
                            color="muted.foreground"
                          >
                            Structure candidate. Pas un signal. Simulation uniquement.
                          </styled.p>
                        ) : null}
                      </div>
                      <styled.div
                        display="flex"
                        flexWrap="wrap"
                        alignItems="center"
                        gap="2"
                        textStyle="xs"
                      >
                        <span className={toneText({ tone: DIRECTION_TONE[detection.direction] })}>
                          {TREND_PATTERN_DIRECTION_LABEL_FR[detection.direction]}
                        </span>
                        <span className={toneText({ tone: CONFIDENCE_TONE[detection.confidence] })}>
                          {PATTERN_CONFIDENCE_LABEL_FR[detection.confidence]}
                        </span>
                      </styled.div>
                    </styled.div>

                    {detection.evidence.length > 0 ? (
                      <styled.div mt="2">
                        <p className={sectionLabel}>Indices</p>
                        <ul className={bulletList()}>
                          {detection.evidence.map(line => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </styled.div>
                    ) : null}

                    {detection.invalidationHints.length > 0 ? (
                      <styled.div mt="2">
                        <p className={sectionLabel}>Invalidation</p>
                        <ul className={bulletList()}>
                          {detection.invalidationHints.map(line => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </styled.div>
                    ) : null}

                    {detection.limitations.length > 0 ? (
                      <styled.div mt="2">
                        <p className={sectionLabel}>Limites</p>
                        <ul className={bulletList({ tone: 'muted' })}>
                          {detection.limitations.map(line => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </styled.div>
                    ) : null}

                    <styled.p mt="2" fontSize="11px" color="muted.foreground">
                      Cette détection n&apos;est pas une recommandation. Les résultats doivent être
                      backtestés avant toute conclusion.
                    </styled.p>

                    {isAdmin ? (
                      <styled.div mt="3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={createHypothesisMutation.isPending}
                          onClick={() => handleCreateHypothesis(detection)}
                        >
                          {createHypothesisMutation.isPending
                            ? 'Création…'
                            : 'Créer une hypothèse papier'}
                        </Button>
                      </styled.div>
                    ) : null}
                  </li>
                ))}
              </styled.ul>
            )}

            {result.caveats && result.caveats.length > 0 ? (
              <styled.ul spaceY="1" fontSize="11px" color="muted.foreground">
                {result.caveats.map(caveat => (
                  <li key={caveat}>{caveat}</li>
                ))}
              </styled.ul>
            ) : null}
          </styled.div>
        ) : null}

        {createdMessage ? (
          <styled.p textStyle="xs" color="positive">
            {createdMessage}
          </styled.p>
        ) : null}
        {createHypothesisMutation.isError ? (
          <styled.p textStyle="xs" color="destructive">
            Échec de la création d&apos;hypothèse : {toErrorMessage(createHypothesisMutation.error)}
          </styled.p>
        ) : null}
      </styled.div>
    </Panel>
  )
}
