// PR5 — deterministic demo fixtures for the Advisor Learning Loop UI surfaces.
//
// The backend already ships its own demo fixtures for these endpoints; these client-side
// fallbacks ensure the UI renders consistently in demo mode without any network call.
// They are intentionally small and stable.

import type {
  DashboardAdvisorDecisionJournalListResponse,
  DashboardAdvisorPostMortemListResponse,
  DashboardTradingLabHypothesisListResponse,
} from './dashboard-types'

export const getDemoAdvisorDecisionJournal = (): DashboardAdvisorDecisionJournalListResponse => ({
  items: [
    {
      id: 1,
      recommendationId: null,
      runId: null,
      recommendationKey: 'cash-drag',
      decision: 'accepted',
      reasonCode: 'accepted',
      freeNote: 'Réduction du cash en cours sur le PEA.',
      decidedBy: 'admin',
      decidedAt: '2026-04-12T09:00:00.000Z',
      expectedOutcomeAt: '2026-05-12T09:00:00.000Z',
      scope: 'demo',
      metadata: null,
      createdAt: '2026-04-12T09:00:00.000Z',
      updatedAt: '2026-04-12T09:00:00.000Z',
      outcomes: [],
    },
    {
      id: 2,
      recommendationId: null,
      runId: null,
      recommendationKey: 'sector-rotation',
      decision: 'deferred',
      reasonCode: 'deferred_need_more_data',
      freeNote: 'On attend la confirmation des prochains signaux macro.',
      decidedBy: 'admin',
      decidedAt: '2026-04-22T09:00:00.000Z',
      expectedOutcomeAt: null,
      scope: 'demo',
      metadata: null,
      createdAt: '2026-04-22T09:00:00.000Z',
      updatedAt: '2026-04-22T09:00:00.000Z',
      outcomes: [],
    },
  ],
})

export const getDemoAdvisorPostMortems = (): DashboardAdvisorPostMortemListResponse => ({
  items: [
    {
      id: 1,
      runId: null,
      recommendationId: null,
      decisionId: null,
      recommendationKey: 'cash-drag',
      status: 'completed',
      horizonDays: 30,
      evaluatedAt: '2026-04-30T09:00:00.000Z',
      expectedOutcomeAt: '2026-04-29T09:00:00.000Z',
      inputSummary: { itemCount: 1 },
      findings: {
        summary:
          "Réduction du cash globalement tenue ; l'incertitude reste sur le rôle réel du contexte macro.",
        overallOutcome: 'mixed',
        evidenceReview: {
          supportedSignals: ["L'allocation de cash s'est rapprochée de la cible"],
          contradictedSignals: [],
          missingEvidence: ["Aucun contre-factuel sur les allocations alternatives"],
          staleOrWeakEvidence: [],
        },
        outcomeDrivers: {
          likelyDrivers: ["Discipline d'allocation"],
          alternativeExplanations: ["Vent porteur macro indépendant de la recommandation"],
          unknowns: ["Flux nets venant de comptes non suivis"],
        },
        lessons: {
          keep: ["Faire ressortir explicitement les bandes de dérive"],
          change: ["Plafonner la confiance lorsque les preuves corroborantes sont minces"],
          avoid: ["Traiter une coïncidence macro comme une causalité"],
        },
      },
      calibration: {
        previousConfidence: 'high',
        calibratedConfidence: 'medium',
        rationale:
          "Les preuves hors-échantillon étaient plus minces que ce que la note initiale suggérait.",
      },
      learningActions: [
        {
          kind: 'caveat',
          title: 'Plafonner la confiance quand les preuves corroborantes sont minces',
          description:
            'Quand une recommandation cite une observation à période unique, la confiance calibrée doit rester au plus moyenne tant que des preuves additionnelles ne sont pas apparues.',
          scope: 'advisory-only',
          confidence: 'medium',
          appliesTo: ['advisor.recommendation.causal_reasoning'],
        },
      ],
      riskNotes: { graphIngest: 'deferred', scope: 'advisory-only' },
      skippedReason: null,
      errorCode: null,
      createdAt: '2026-04-30T09:00:00.000Z',
      updatedAt: '2026-04-30T09:00:00.000Z',
    },
  ],
})

export const getDemoTradingLabHypotheses = (): DashboardTradingLabHypothesisListResponse => ({
  ok: true,
  hypotheses: [
    {
      id: 101,
      name: 'EUR/USD mean reversion after FOMC drift',
      slug: 'eur-usd-fomc-mean-reversion',
      description:
        'Hypothèse paper-only : après les jours FOMC, EUR/USD overshoot intra-journalier puis revient à la moyenne sous 48h.',
      strategyType: 'manual-hypothesis',
      status: 'active-paper',
      enabled: true,
      tags: ['paper-only', 'fx', 'macro'],
      parameters: {
        hypothesis: {
          thesis: 'Le drift post-FOMC revient à la moyenne sous 48h.',
          invalidationCriteria: [
            'Drift persiste au-delà de 72h après FOMC sur 3 événements consécutifs',
            'Volatilité réalisée EUR/USD au-delà de 1.5x médiane historique',
          ],
        },
      },
      indicators: [],
      entryRules: [],
      exitRules: [],
      riskRules: [],
      assumptions: [
        "Liquidité comparable à l'échantillon historique",
        'Surprises macro dans les bornes historiques',
      ],
      caveats: ['Paper-only run, pas un conseil financier'],
      scope: 'demo',
      createdAt: '2026-04-26T10:00:00.000Z',
      updatedAt: '2026-04-26T10:00:00.000Z',
    },
  ],
})
