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
import {
  PersonalActionsPanel,
  PersonalSectionHeading,
  type PersonalActionItem,
} from '@/components/personal/personal-ux'

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
  const activeGoals = goals.filter(g => !g.archivedAt)
  const goalsNeedingAttention = activeGoals.filter(
    goal => goal.targetAmount > 0 && goal.currentAmount / goal.targetAmount < 0.25
  )
  const nextMilestone = [...activeGoals]
    .filter(goal => goal.targetAmount > 0 && goal.currentAmount < goal.targetAmount)
    .sort((left, right) => {
      if (!left.targetDate && !right.targetDate) return left.id - right.id
      if (!left.targetDate) return 1
      if (!right.targetDate) return -1
      return left.targetDate.localeCompare(right.targetDate)
    })[0]
  const overallProgress = goals.length
    ? Math.round(
        (goals.reduce((sum, g) => sum + Math.min(1, g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0), 0) /
          goals.length) *
          100,
      )
    : 0

  const prefersReducedMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [hovering, setHovering] = useState(false)
  useEffect(() => setMounted(true), [])
  const goalActions: PersonalActionItem[] = [
    {
      label: isAdmin ? 'Créer ou mettre à jour un objectif' : 'Se connecter pour modifier',
      description: isAdmin
        ? 'Ajuster le montant, la date ou la progression réelle.'
        : 'La démo reste lisible mais les modifications sont réservées à l’admin.',
      to: '/objectifs',
      icon: '◎',
      tone: isAdmin ? 'brand' : 'plain',
      disabled: !isAdmin,
    },
    {
      label: 'Comparer avec les dépenses',
      description: 'Voir si le cashflow actuel soutient tes objectifs.',
      to: '/depenses',
      icon: '↔',
      tone: 'plain',
    },
    {
      label: "Demander à l'Advisor",
      description: nextMilestone
        ? `Questionner la trajectoire de "${nextMilestone.name}".`
        : 'Demander quel premier objectif créer.',
      to: '/ia/chat',
      icon: '□',
      tone: goalsNeedingAttention.length > 0 ? 'warning' : 'plain',
    },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cockpit personnel"
        icon="◎"
        title="Objectifs"
        description="Ce que tu veux financer, où tu en es, et ce qui mérite une action."
      />

      <PersonalSectionHeading
        eyebrow="Aujourd'hui"
        title="Progression et prochaine étape"
        description="Une vue simple avant la liste complète des objectifs."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Hero — Antigravity particle ring (hover-only) + circular emblem */}
      <section
        className="group/hero relative isolate overflow-hidden rounded-[28px] border border-border/60"
        style={{ background: 'var(--surface-0)' }}
      >
        <div className="pointer-events-none absolute inset-0 h-full">
          {mounted && !prefersReducedMotion && hovering && (
            <Antigravity
              count={220}
              magnetRadius={9}
              ringRadius={11}
              waveSpeed={0.5}
              waveAmplitude={1.4}
              particleSize={1.6}
              particleVariance={1.4}
              color="#ff7ab8"
              autoAnimate={false}
              particleShape="capsule"
              fieldStrength={12}
              rotationSpeed={0.04}
            />
          )}
          {!hovering && (
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-aurora-mesh opacity-80"
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

        {/* biome-ignore lint/a11y/noStaticElementInteractions: decorative hover surface, no keyboard semantics exposed */}
        <div
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onFocus={() => setHovering(true)}
          onBlur={() => setHovering(false)}
          className="relative grid gap-8 px-6 py-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-12 md:py-14"
        >
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary/85">Overall</p>
            <p className="mt-1 text-5xl font-bold tracking-tighter md:text-6xl">
              <span className="font-financial text-aurora">{overallProgress}%</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {goals.length === 0
                ? 'Définis ton premier objectif ci-dessous.'
                : `${completed} terminé${completed > 1 ? 's' : ''} · ${inProgress - completed} en cours sur ${goals.length}.`}
            </p>
            {nextMilestone ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Prochaine cible: <span className="text-foreground">{nextMilestone.name}</span>
                {nextMilestone.targetDate ? ` · ${nextMilestone.targetDate}` : ''}
              </p>
            ) : null}
            {goalsNeedingAttention.length > 0 ? (
              <p className="mt-2 text-sm text-warning">
                {goalsNeedingAttention.length} objectif{goalsNeedingAttention.length > 1 ? 's' : ''} à reprendre.
              </p>
            ) : null}
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

      <PersonalActionsPanel
        title="Prochaines actions"
        description="Relier les objectifs au cashflow et au patrimoine."
        items={goalActions}
      />
      </div>

      <PersonalSectionHeading
        eyebrow="Mes données"
        title="Objectifs actifs"
        description="Chaque carte doit dire où tu en es et ce qui manque pour atteindre la cible."
      />

      <PersonalFinancialGoalsCard authMode={authMode} isAdmin={isAdmin} isDemo={isDemo} />
    </div>
  )
}
