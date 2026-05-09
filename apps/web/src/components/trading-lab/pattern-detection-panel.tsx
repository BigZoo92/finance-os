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

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Input } from '@finance-os/ui/components'
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
  DashboardTradingLabPatternDetectRequest,
  DashboardTradingLabPatternDetectResponse,
  DashboardTradingLabPatternDetection,
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

const CONFIDENCE_TONE: Record<DashboardTradingLabPatternDetection['confidence'], string> = {
  low: 'text-muted-foreground',
  medium: 'text-sky-500',
  high: 'text-emerald-500',
}

const DIRECTION_TONE: Record<DashboardTradingLabPatternDetection['direction'], string> = {
  bullish: 'text-emerald-500',
  bearish: 'text-amber-500',
  neutral: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
}

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
  } catch (error) {
    return { ok: false, error: `JSON invalide : ${toErrorMessage(error)}` }
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
      typeof rec.volume === 'number'
        ? rec.volume
        : rec.volume === null
          ? null
          : undefined
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
    setSelectedPatterns(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    )
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
      icon={<span aria-hidden="true">⌬</span>}
      tone="plain"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">Paper only</Badge>
          <Badge variant="outline">Aucune exécution</Badge>
          <Badge variant="outline">Recherche</Badge>
          <Badge variant="outline">Détection déterministe</Badge>
          {selectedPatterns.some(p => SMC_ICT_KEYS.has(p)) ? (
            <Badge variant="outline">SMC/ICT research</Badge>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="pattern-detect-symbol"
              className="block text-xs font-medium text-muted-foreground"
            >
              Symbole (libre)
            </label>
            <Input
              id="pattern-detect-symbol"
              className="mt-1"
              value={symbol}
              onChange={event => setSymbol(event.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="pattern-detect-timeframe"
              className="block text-xs font-medium text-muted-foreground"
            >
              Timeframe
            </label>
            <Input
              id="pattern-detect-timeframe"
              className="mt-1"
              value={timeframe}
              onChange={event => setTimeframe(event.target.value)}
            />
          </div>
        </div>

        <fieldset className="space-y-1">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Patterns à évaluer
          </legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {PATTERN_OPTIONS.map(option => {
              const id = `pattern-detect-${option.key}`
              const checked = selectedPatterns.includes(option.key)
              return (
                <label key={option.key} htmlFor={id} className="flex items-center gap-2 text-xs">
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePattern(option.key)}
                    className="h-3 w-3"
                  />
                  <span className="text-foreground">{option.label}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="pattern-detect-candles"
            className="block text-xs font-medium text-muted-foreground"
          >
            Candles (JSON, OHLCV)
          </label>
          <textarea
            id="pattern-detect-candles"
            rows={6}
            className="mt-1 block w-full rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-xs"
            value={candlesJson}
            onChange={event => setCandlesJson(event.target.value)}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Format : tableau d&apos;objets <code>{'{ timestamp, open, high, low, close, volume? }'}</code>.
            Le mode démo prérempli ce champ avec une fixture déterministe.
          </p>
        </div>

        {parseError ? <p className="text-xs text-destructive">{parseError}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleRun}
            disabled={detectMutation.isPending}
          >
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
            <span className="text-xs text-muted-foreground">
              Détection réservée au mode admin.
            </span>
          ) : null}
        </div>

        {detectMutation.isError ? (
          <p className="text-xs text-destructive">
            Échec de la détection : {toErrorMessage(detectMutation.error)}
          </p>
        ) : null}

        {result ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-surface-1/40 px-3 py-2 text-xs">
              <div className="space-x-2">
                <span className="text-muted-foreground">Candles :</span>
                <span className="font-medium text-foreground">
                  {result.dataQuality.candleCount}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">Données suffisantes :</span>
                <span
                  className={
                    result.dataQuality.sufficient ? 'text-emerald-500' : 'text-amber-500'
                  }
                >
                  {result.dataQuality.sufficient ? 'oui' : 'non'}
                </span>
              </div>
              {result.dataQuality.hasVolume ? null : (
                <Badge variant="outline">Volume absent</Badge>
              )}
            </div>

            {result.dataQuality.warnings.length > 0 ? (
              <ul className="space-y-1 text-[11px] text-amber-500">
                {result.dataQuality.warnings.map(warning => (
                  <li key={warning}>· {warning}</li>
                ))}
              </ul>
            ) : null}

            {result.detections.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/45 bg-surface-1/35 px-4 py-6 text-center text-sm text-muted-foreground">
                Aucune détection sur cette série de candles.
              </p>
            ) : (
              <ul className="space-y-3">
                {result.detections.map(detection => (
                  <li
                    key={detection.id}
                    className="rounded-xl border border-border/50 bg-background/40 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">
                          {PATTERN_LABELS_FR[detection.patternType] ?? detection.patternType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Observé le {detection.observedAt}
                        </p>
                        {SMC_ICT_KEYS.has(detection.patternType) ? (
                          <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                            Candidate structure · Not a signal · Paper only
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={DIRECTION_TONE[detection.direction]}>
                          {TREND_PATTERN_DIRECTION_LABEL_FR[detection.direction]}
                        </span>
                        <span className={CONFIDENCE_TONE[detection.confidence]}>
                          {PATTERN_CONFIDENCE_LABEL_FR[detection.confidence]}
                        </span>
                      </div>
                    </div>

                    {detection.evidence.length > 0 ? (
                      <div className="mt-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Indices
                        </p>
                        <ul className="mt-1 list-inside list-disc text-xs text-foreground/90">
                          {detection.evidence.map(line => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {detection.invalidationHints.length > 0 ? (
                      <div className="mt-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Invalidation
                        </p>
                        <ul className="mt-1 list-inside list-disc text-xs text-foreground/90">
                          {detection.invalidationHints.map(line => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {detection.limitations.length > 0 ? (
                      <div className="mt-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Limites
                        </p>
                        <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                          {detection.limitations.map(line => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Cette détection n&apos;est pas une recommandation. Les résultats doivent
                      être backtestés avant toute conclusion.
                    </p>

                    {isAdmin ? (
                      <div className="mt-3">
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
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {result.caveats && result.caveats.length > 0 ? (
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                {result.caveats.map(caveat => (
                  <li key={caveat}>· {caveat}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {createdMessage ? (
          <p className="text-xs text-emerald-500">{createdMessage}</p>
        ) : null}
        {createHypothesisMutation.isError ? (
          <p className="text-xs text-destructive">
            Échec de la création d&apos;hypothèse : {toErrorMessage(createHypothesisMutation.error)}
          </p>
        ) : null}
      </div>
    </Panel>
  )
}
