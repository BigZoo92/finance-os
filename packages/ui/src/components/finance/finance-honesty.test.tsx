/**
 * Structural guardrail tests for the redesign: an unknown financial value
 * must never render as zero, and a real zero must stay a real zero.
 * Components are asserted through static server rendering (SSR-safe by
 * construction).
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Amount, CurrencyAmount } from './amount'
import { PercentChange, TrendIndicator } from './percent-change'
import { Progress } from './progress'
import { Status } from '../status/status'
import { ValuationState } from '../status/valuation-state'

const render = (node: React.ReactElement) =>
  renderToStaticMarkup(node).replace(/[\u00A0\u202F\u2009\u2007]/g, " ").replace(/−/g, '-')

describe('Amount', () => {
  it('renders Indisponible for null, never 0 €', () => {
    const html = render(<Amount value={null} />)
    expect(html).toContain('Indisponible')
    expect(html).not.toContain('0,00')
  })

  it('renders Indisponible for undefined', () => {
    expect(render(<Amount value={undefined} />)).toContain('Indisponible')
  })

  it('keeps an accessible label in dense dash mode', () => {
    const html = render(<Amount value={null} unavailable="dash" />)
    expect(html).toContain('>-<')
    expect(html).toContain('Indisponible')
  })

  it('renders a real zero as 0,00 €', () => {
    expect(render(<Amount value={0} />)).toContain('0,00 €')
  })

  it('renders positive and negative amounts with tabular mono treatment', () => {
    const positive = render(<Amount value={67070.44} />)
    expect(positive).toContain('67 070,44 €')
    expect(positive).toContain('font-financial')
    expect(positive).toContain('tabular-nums')
    expect(render(<Amount value={-1234.5} />)).toContain('-1 234,50 €')
  })
})

describe('CurrencyAmount', () => {
  it('renders explicit currencies', () => {
    expect(render(<CurrencyAmount value={100} currency="USD" />)).toContain('$')
  })

  it('never infers EUR when the currency is unknown', () => {
    const html = render(<CurrencyAmount value={1500} currency={null} />)
    expect(html).toContain('1 500,00')
    expect(html).not.toContain('€')
  })

  it('renders Indisponible for unknown values regardless of currency', () => {
    expect(render(<CurrencyAmount value={null} currency="USD" />)).toContain('Indisponible')
  })
})

describe('PercentChange', () => {
  it('renders Indisponible for null, never 0 %', () => {
    const html = render(<PercentChange value={null} />)
    expect(html).toContain('Indisponible')
    expect(html).not.toContain('%')
  })

  it('renders a real zero without fake sign or semantic color', () => {
    const html = render(<PercentChange value={0} />)
    expect(html).toContain('0,00 %')
    expect(html).not.toContain('text-positive')
    expect(html).not.toContain('text-negative')
  })

  it('keeps the sign in the text so color is never the only signal', () => {
    const up = render(<PercentChange value={8.51} />)
    expect(up).toContain('+8,51 %')
    expect(up).toContain('text-positive')
    const down = render(<PercentChange value={-3.2} />)
    expect(down).toContain('-3,20 %')
    expect(down).toContain('text-negative')
  })
})

describe('TrendIndicator', () => {
  it('renders nothing for unknown deltas', () => {
    expect(render(<span><TrendIndicator value={null} /></span>)).toBe('<span></span>')
  })

  it('pairs the glyph with a text equivalent', () => {
    const html = render(<TrendIndicator value={2} />)
    expect(html).toContain('▲')
    expect(html).toContain('en hausse')
  })
})

describe('Progress', () => {
  it('exposes progressbar semantics with min/max/now', () => {
    const html = render(<Progress value={66.3} label="Progression globale" />)
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuemin="0"')
    expect(html).toContain('aria-valuemax="100"')
    expect(html).toContain('aria-valuenow="66.3"')
  })

  it('renders unknown progress as unavailable, not an empty 0 % bar', () => {
    const html = render(<Progress value={null} showValue />)
    expect(html).toContain('Indisponible')
    expect(html).not.toContain('aria-valuenow')
  })

  it('renders a real zero as 0 %', () => {
    const html = render(<Progress value={0} showValue />)
    expect(html).toContain('aria-valuenow="0"')
    expect(html).toContain('0 %')
  })

  it('clamps out-of-range values', () => {
    expect(render(<Progress value={140} />)).toContain('aria-valuenow="100"')
  })
})

describe('Status', () => {
  it('always renders a visible label next to the dot', () => {
    const html = render(<Status tone="attention" label="Reconnexion requise" />)
    expect(html).toContain('Reconnexion requise')
    expect(html).toContain('aria-hidden="true"')
  })
})

describe('ValuationState', () => {
  it('maps every canonical state to a human label', () => {
    expect(render(<ValuationState state="priced" />)).toContain('Réel')
    expect(render(<ValuationState state="derived" />)).toContain('Dérivé')
    expect(render(<ValuationState state="estimated" />)).toContain('Estimé')
    expect(render(<ValuationState state="manual" />)).toContain('Manuel')
    expect(render(<ValuationState state="stale" />)).toContain('Ancien')
    expect(render(<ValuationState state="unresolved" />)).toContain('Non résolu')
    expect(render(<ValuationState state="unavailable" />)).toContain('Indisponible')
  })

  it('supports label overrides without losing the semantic tone', () => {
    const html = render(<ValuationState state="estimated" label="Estimée" />)
    expect(html).toContain('Estimée')
    expect(html).toContain('data-tone="attention"')
  })
})
