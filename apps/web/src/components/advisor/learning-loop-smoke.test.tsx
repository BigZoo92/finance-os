// @vitest-environment jsdom
//
// PR6 — DOM smoke tests for the Advisor Learning Loop UI surfaces.
//
// These tests are deliberately narrow: they verify the safety-critical visibility invariants
// that the predicate tests can't fully assert (presence/absence of buttons, disabled state of
// inputs, copy that excludes execution wording). They use jsdom + @testing-library/react via the
// per-file `@vitest-environment jsdom` directive so they don't change the global vitest config
// (which stays `node` for the rest of the suite).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { HypothesisLabSection } from '@/components/trading-lab/hypothesis-lab'
import { PatternDetectionPanel } from '@/components/trading-lab/pattern-detection-panel'
import { StrategyScorecardCard } from '@/components/trading-lab/strategy-scorecard-card'

// RTL's auto-cleanup-after-each isn't wired in this repo's vitest setup, so we register an
// explicit cleanup hook here to keep tests in this file isolated from each other.
afterEach(() => {
  cleanup()
})
const buildQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

const renderWithQueryClient = (ui: ReactElement) => {
  const client = buildQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

// ---------------------------------------------------------------------------
// Hypothesis Lab
// ---------------------------------------------------------------------------

describe('HypothesisLabSection · DOM smoke', () => {
  it('hides admin mutation buttons in demo mode and surfaces paper-only badges', () => {
    renderWithQueryClient(<HypothesisLabSection mode="demo" />)
    expect(screen.queryByRole('button', { name: /nouvelle hypothèse/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /archiver/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /créer un scénario paper/i })).toBeNull()
    // "Édition réservée au mode admin." is the demo-mode disclosure.
    expect(screen.getByText(/édition réservée au mode admin/i)).toBeTruthy()
    // Paper-only badge is permanent.
    expect(screen.getAllByText(/paper only/i).length).toBeGreaterThan(0)
  })

  it('exposes the admin "Nouvelle hypothèse" toggle in admin mode', () => {
    renderWithQueryClient(<HypothesisLabSection mode="admin" />)
    expect(screen.getByRole('button', { name: /nouvelle hypothèse/i })).toBeTruthy()
  })
})
// ---------------------------------------------------------------------------
// PR11 — Pattern Detection Panel
// ---------------------------------------------------------------------------

describe('PatternDetectionPanel · DOM smoke', () => {
  it('renders paper-only / no-execution badges and never an order/buy/sell CTA in demo', () => {
    renderWithQueryClient(<PatternDetectionPanel mode="demo" />)
    expect(screen.getAllByText(/paper only/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/aucune exécution/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/recherche/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/détection déterministe/i).length).toBeGreaterThan(0)
    // Advisory framing — never a transactional CTA, in any case.
    expect(screen.queryByRole('button', { name: /acheter/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /vendre/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /passer un ordre/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /exécut/i })).toBeNull()
    // The "create hypothesis" button is admin-only, must NOT appear in demo.
    expect(screen.queryByRole('button', { name: /créer une hypothèse papier/i })).toBeNull()
  })

  it('lets demo mode render a deterministic detection result without a network call', () => {
    renderWithQueryClient(<PatternDetectionPanel mode="demo" />)
    fireEvent.click(screen.getByRole('button', { name: /voir la détection/i }))
    // Detection cards reuse the canonical FR pattern label.
    expect(screen.getAllByText(/EMA20 \+ niveau horizontal/i).length).toBeGreaterThan(0)
    // Confidence + cautious framing must be present.
    expect(screen.getAllByText(/confiance faible/i).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/cette détection n['’]est pas une recommandation/i).length
    ).toBeGreaterThan(0)
    // Caveats list shows the deterministic disclaimer.
    expect(screen.getAllByText(/déterministes/i).length).toBeGreaterThan(0)
  })

  it('exposes the "Créer une hypothèse papier" CTA in admin mode after running detection', () => {
    renderWithQueryClient(<PatternDetectionPanel mode="admin" />)
    // Admin mode does not auto-run; we only verify the run trigger is present and labelled
    // without execution wording. Asserting the post-run CTA would require a network mock.
    expect(screen.getByRole('button', { name: /lancer la détection/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /trade now/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /enter trade/i })).toBeNull()
  })

  // PR15B — SMC/ICT detector pack visibility in the selector.
  it('PR15B: exposes SMC/ICT pattern checkboxes in the selector', () => {
    renderWithQueryClient(<PatternDetectionPanel mode="demo" />)
    expect(screen.getByLabelText(/^Fair Value Gap$/i)).toBeTruthy()
    expect(screen.getByLabelText(/^Liquidity Sweep$/i)).toBeTruthy()
    expect(screen.getByLabelText(/^Break of Structure$/i)).toBeTruthy()
    expect(screen.getByLabelText(/^Change of Character$/i)).toBeTruthy()
    expect(screen.getByLabelText(/Order Block \(candidate\)/i)).toBeTruthy()
  })

  it('PR15B: surfaces SMC/ICT research badge + candidate-structure copy when an SMC pattern is selected and run', () => {
    renderWithQueryClient(<PatternDetectionPanel mode="demo" />)
    // Tick the FVG checkbox so the SMC badge appears.
    fireEvent.click(screen.getByLabelText(/^Fair Value Gap$/i))
    expect(screen.getAllByText(/SMC\/ICT research/i).length).toBeGreaterThan(0)
    // Run detection in demo to render the FVG detection card.
    fireEvent.click(screen.getByRole('button', { name: /voir la détection/i }))
    // Detection card shows the canonical FR label + the candidate-structure caption.
    expect(screen.getAllByText(/^Fair Value Gap$/i).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/structure candidate\. pas un signal\. simulation uniquement/i).length
    ).toBeGreaterThan(0)
    // Never an execution-shaped CTA on SMC paths.
    expect(screen.queryByRole('button', { name: /trade now/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /enter trade/i })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// PR12 — Strategy Scorecard card
// ---------------------------------------------------------------------------

describe('StrategyScorecardCard · DOM smoke', () => {
  it('renders nothing when the learning-loop UI flag is off', () => {
    const { container } = renderWithQueryClient(
      <StrategyScorecardCard strategyId={42} mode="demo" learningLoopEnabled={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders permanent paper-only badges and the toggle when the flag is on', () => {
    renderWithQueryClient(
      <StrategyScorecardCard strategyId={42} mode="demo" learningLoopEnabled={true} />
    )
    expect(screen.getAllByText(/paper only/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/qualité de preuve/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/recherche/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /afficher le scorecard de preuve/i })).toBeTruthy()
    // Permanent disclaimer must be present, not a recommendation.
    expect(screen.getAllByText(/ne constitue pas une recommandation/i).length).toBeGreaterThan(0)
  })

  it('expands in demo mode and renders the deterministic Prometteur grade + quality flags', async () => {
    renderWithQueryClient(
      <StrategyScorecardCard
        strategyId={42}
        mode="demo"
        learningLoopEnabled={true}
        defaultOpen={true}
      />
    )
    expect(await screen.findByText(/prometteur/i)).toBeTruthy()
    // Permanent paper-only quality flag from the demo fixture.
    expect(
      screen.getAllByText(/recherche paper uniquement, aucune exécution/i).length
    ).toBeGreaterThan(0)
    // No-walk-forward flag is part of the demo fixture.
    expect(screen.getAllByText(/aucun walk-forward/i).length).toBeGreaterThan(0)
    // Caveats section: no predictivity claim.
    expect(screen.getAllByText(/ne prédisent pas les résultats futurs/i).length).toBeGreaterThan(0)
    // Never an execution-shaped CTA in this card.
    expect(screen.queryByRole('button', { name: /acheter/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /vendre/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /passer un ordre/i })).toBeNull()
  })

  // PR14 — advanced-metrics subsection.
  it('PR14: shows the collapsed advanced-metrics toggle and the retrospective disclaimer', async () => {
    renderWithQueryClient(
      <StrategyScorecardCard
        strategyId={42}
        mode="demo"
        learningLoopEnabled={true}
        defaultOpen={true}
      />
    )
    expect(
      await screen.findByRole('button', { name: /afficher les métriques avancées/i })
    ).toBeTruthy()
    expect(screen.getAllByText(/ne prédisent pas les résultats futurs/i).length).toBeGreaterThan(0)
    // Collapsed by default — should not show the Calmar / Ulcer fields yet.
    expect(screen.queryByText(/^calmar$/i)).toBeNull()
  })

  it('PR14: expanding the advanced-metrics subsection renders Calmar / Ulcer / VaR + assumptions', async () => {
    renderWithQueryClient(
      <StrategyScorecardCard
        strategyId={42}
        mode="demo"
        learningLoopEnabled={true}
        defaultOpen={true}
      />
    )
    fireEvent.click(await screen.findByRole('button', { name: /afficher les métriques avancées/i }))
    // Field labels surface.
    expect(screen.getByText(/^calmar$/i)).toBeTruthy()
    expect(screen.getByText(/^ulcer index$/i)).toBeTruthy()
    expect(screen.getByText(/var 95% \(historique\)/i)).toBeTruthy()
    // Assumptions block surfaces the annualisation period + the historical-VaR disclaimer.
    expect(screen.getByText(/252 périodes\/an/i)).toBeTruthy()
    expect(screen.getByText(/var \/ cvar sont des estimations historiques/i)).toBeTruthy()
    // Demo warning must be present.
    expect(screen.getAllByText(/mode démo/i).length).toBeGreaterThan(0)
    // No execution wording in the new subsection.
    expect(screen.queryByRole('button', { name: /trade now/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /enter trade/i })).toBeNull()
  })
})
