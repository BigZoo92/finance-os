import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { financialGoalsQueryOptionsWithMode } from '@/features/goals/query-options'
import { PersonalFinancialGoalsCard } from '@/components/dashboard/personal-financial-goals-card'
import { PageHeader } from '@/components/surfaces/page-header'
import { CircularEmblem } from '@/components/brand/circular-emblem'
import Antigravity from '@/components/reactbits/antigravity'

export const Route = createFileRoute('/_app/objectifs')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined = auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return
    await context.queryClient.ensureQueryData(financialGoalsQueryOptionsWithMode({ mode }))
  },
  component: ObjectifsPage,
})

function ObjectifsPage() {
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const goalsQuery = useQuery(financialGoalsQueryOptionsWithMode({ mode: authMode }))
  const goals = goalsQuery.data?.items ?? []
  const completed = goals.filter(g => g.targetAmount > 0 && g.currentAmount / g.targetAmount >= 1).length
  const inProgress = goals.filter(g => !g.archivedAt).length
  const overallProgress = goals.length
    ? Math.round(
        (goals.reduce((sum, g) => sum + Math.min(1, g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0), 0) /
          goals.length) *
          100,
      )
    : 0

  const prefersReducedMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Épargne & cibles"
        icon="◎"
        title="Objectifs"
        description="Suivi de vos cibles d'épargne et de patrimoine personnel, avec projections."
      />

      {/* Hero — Antigravity particle ring + circular emblem displaying overall progress */}
      <section className="relative isolate overflow-hidden rounded-[28px] border border-border/60" style={{ background: 'var(--surface-0)' }}>
        <div className="pointer-events-none absolute inset-0 h-full">
          {mounted && !prefersReducedMotion && (
            <Antigravity
              count={220}
              magnetRadius={9}
              ringRadius={11}
              waveSpeed={0.5}
              waveAmplitude={1.4}
              particleSize={1.6}
              particleVariance={1.4}
              color="#ff7ab8"
              autoAnimate
              particleShape="capsule"
              fieldStrength={12}
              rotationSpeed={0.04}
            />
          )}
          {/* Soft fade so foreground is readable */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(closest-corner at 50% 50%, transparent 0%, oklch(from var(--background) l c h / 35%) 65%, oklch(from var(--background) l c h / 70%) 100%)',
            }}
          />
        </div>

        <div className="relative grid gap-8 px-6 py-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-12 md:py-14">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary/85">Overall</p>
            <p className="mt-1 text-5xl font-bold tracking-tighter md:text-6xl">
              <span className="font-financial text-aurora">{overallProgress}%</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {goals.length === 0
                ? 'Définissez vos premiers objectifs ci-dessous.'
                : `${completed} terminé${completed > 1 ? 's' : ''} · ${inProgress - completed} en cours sur ${goals.length}.`}
            </p>
          </div>

          <CircularEmblem
            text="· OBJECTIFS · ÉPARGNE · CIBLES · "
            size={184}
            spinDuration={28}
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-card/90 backdrop-blur shadow-brand">
              <span className="font-mono text-3xl text-primary" aria-hidden="true">◎</span>
            </div>
          </CircularEmblem>
        </div>
      </section>

      <PersonalFinancialGoalsCard authMode={authMode} isAdmin={isAdmin} isDemo={isDemo} />
    </div>
  )
}
