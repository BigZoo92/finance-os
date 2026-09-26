import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SegmentedControl } from './segmented-control'

const options = [
  { label: '1M', value: '1m' },
  { label: '1A', value: '1y' },
] as const

describe('SegmentedControl', () => {
  it('renders the recipe atoms, the slot contract and the active state', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        aria-label="Période"
        options={[...options]}
        value="1m"
        onChange={() => {}}
        size="sm"
        className="legacy-class"
      />
    )
    expect(html).toContain('data-slot="segmented-control"')
    expect(html).toContain('aria-label="Période"')
    expect(html).toContain('data-state="on"')
    expect(html).toContain('fs_10px')
    expect(html).toContain('px_2.5')
    expect(html).toContain('legacy-class')
  })

  it('uses the medium metrics by default', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl options={[...options]} value="1y" onChange={() => {}} />
    )
    expect(html).toContain('fs_11px')
    expect(html).toContain('px_3')
  })
})
