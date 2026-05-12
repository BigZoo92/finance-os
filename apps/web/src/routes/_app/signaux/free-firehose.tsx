import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Badge } from '@finance-os/ui/components'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import {
  estimateFreeFirehose,
  runFreeFirehose,
  type FreeFirehoseEstimateResponse,
  type FreeFirehoseRunResponse,
} from '@/features/free-firehose-api'
import { formatCount } from '@/features/x-twitter-view-model'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'

export const Route = createFileRoute('/_app/signaux/free-firehose')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(authMeQueryOptions())
  },
  component: FreeFirehoseAdminPage,
})

function FreeFirehoseAdminPage() {
  const authQuery = useQuery(authMeQueryOptions())
  const viewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAdmin = viewState === 'admin'
  const [estimate, setEstimate] = useState<FreeFirehoseEstimateResponse | undefined>(undefined)
  const [runResult, setRunResult] = useState<FreeFirehoseRunResponse | undefined>(undefined)

  const estimateMutation = useMutation({
    mutationFn: estimateFreeFirehose,
    onSuccess: data => setEstimate(data),
  })
  const runMutation = useMutation({
    mutationFn: (input: { dryRun: boolean; confirmation: boolean }) =>
      runFreeFirehose(input),
    onSuccess: data => setRunResult(data),
  })

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Import massif gratuit"
        description="Volontairement manuel. Sources gratuites seulement (GDELT, HN, ECB, Fed, SEC, FRED). Jamais X, jamais provider payant, jamais LLM automatique."
      />

      {!isAdmin ? (
        <Panel>
          <p className="text-sm text-slate-300">Admin only.</p>
        </Panel>
      ) : (
        <>
          <Panel title="Garde-fous">
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300" data-testid="firehose-guards">
              <li>Jamais X / Twitter</li>
              <li>Jamais EODHD / TwelveData / Alpha Vantage</li>
              <li>Jamais OpenAI / Anthropic auto-enrichment</li>
              <li>Jamais déclenché par cron / daily intelligence / worker auto</li>
              <li>Cap 1 run/semaine (FREE_FIREHOSE_MAX_RUNS_PER_WEEK)</li>
              <li>Confirmation explicite obligatoire pour live</li>
            </ul>
          </Panel>

          <Panel title="Étape 1 — Estimer">
            <button
              type="button"
              onClick={() => estimateMutation.mutate()}
              disabled={estimateMutation.isPending}
              className="rounded border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800 disabled:opacity-50"
              data-testid="firehose-estimate-btn"
            >
              {estimateMutation.isPending ? 'Estimation…' : 'Estimer import massif gratuit'}
            </button>

            {estimateMutation.isError && (
              <p className="mt-3 text-sm text-red-400" data-testid="firehose-estimate-error">
                Erreur lors de l'estimation.
              </p>
            )}

            {estimate && !estimate.ok && (
              <div className="mt-3 rounded border border-amber-700 bg-amber-950/50 p-3 text-sm text-amber-200" data-testid="firehose-estimate-disabled">
                <p className="font-semibold">{estimate.code}</p>
                <p className="mt-1 text-xs">{estimate.message}</p>
                {estimate.code === 'FREE_FIREHOSE_DISABLED' && (
                  <p className="mt-2 text-xs text-amber-300">
                    Activer en mettant <code>FREE_FIREHOSE_ENABLED=true</code> côté API.
                  </p>
                )}
              </div>
            )}

            {estimate?.ok && (
              <div className="mt-4 space-y-3" data-testid="firehose-estimate-result">
                <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                  <Stat label="Records max">{formatCount(estimate.maxRecords)}</Stat>
                  <Stat label="Runs cette semaine">{formatCount(estimate.runsLastWeek)}</Stat>
                  <Stat label="Cap hebdo">{estimate.weeklyCap ?? '—'}</Stat>
                  <Stat label="LLM auto">{estimate.llmEnrichmentEnabled ? 'oui' : 'non'}</Stat>
                </div>
                {estimate.wouldBeBlockedByCap && (
                  <p className="text-xs text-amber-400" data-testid="firehose-blocked-cap">
                    Le cap hebdomadaire est atteint — un run live retournera 429.
                  </p>
                )}
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Providers</p>
                  <ul className="text-sm" data-testid="firehose-providers">
                    {estimate.providers?.map(p => (
                      <li key={p.id} className="flex items-center justify-between border-b border-slate-800 py-1">
                        <span>{p.id}</span>
                        <Badge variant="ghost">{formatCount(p.maxRecords)} max</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Étape 2 — Lancer">
            <p className="text-xs text-slate-500">
              Dry-run obligatoire avant le live. Live nécessite confirmation explicite.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!estimate?.ok || runMutation.isPending}
                onClick={() => runMutation.mutate({ dryRun: true, confirmation: false })}
                className="rounded border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800 disabled:opacity-50"
                data-testid="firehose-dryrun-btn"
              >
                Dry-run
              </button>
              <button
                type="button"
                disabled={!estimate?.ok || runMutation.isPending}
                onClick={() => {
                  const ok = window.confirm(
                    "Confirmer l'import massif gratuit live ? Cela peut écrire des milliers de signaux."
                  )
                  if (!ok) return
                  runMutation.mutate({ dryRun: false, confirmation: true })
                }}
                className="rounded bg-amber-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                data-testid="firehose-run-btn"
              >
                {runMutation.isPending ? 'Run…' : 'Lancer (live)'}
              </button>
            </div>

            {runResult && (
              <div className="mt-3 rounded border border-slate-800 p-3 text-sm" data-testid="firehose-run-result">
                <p className="font-semibold">Status : {runResult.status ?? '—'}</p>
                <div className="mt-1 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                  <Stat label="Fetched">{formatCount(runResult.counts?.fetched)}</Stat>
                  <Stat label="Insérés">{formatCount(runResult.counts?.inserted)}</Stat>
                  <Stat label="Dédupliqués">{formatCount(runResult.counts?.deduped)}</Stat>
                  <Stat label="Échecs">{formatCount(runResult.counts?.failed)}</Stat>
                </div>
                {runResult.providerBreakdown && (
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Provider breakdown
                    </p>
                    <table className="mt-1 w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th>Provider</th>
                          <th>Fetched</th>
                          <th>Inserted</th>
                          <th>Failed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(runResult.providerBreakdown).map(([id, p]) => (
                          <tr key={id} className="border-t border-slate-800">
                            <td>{id}</td>
                            <td>{formatCount(p.fetchedCount)}</td>
                            <td>{formatCount(p.insertedCount)}</td>
                            <td>{formatCount(p.failedCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {runResult.errorSummary && (
                  <p className="mt-2 text-xs text-amber-400">Erreurs : {runResult.errorSummary}</p>
                )}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/40 p-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-0.5 text-sm text-slate-100">{children}</div>
    </div>
  )
}
