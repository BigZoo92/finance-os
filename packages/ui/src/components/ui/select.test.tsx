import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Select, SelectSeparator, SelectTrigger, SelectValue } from './select'

describe('Select', () => {
  it('renders the trigger atoms, the slot contract and the size attribute', () => {
    const html = renderToStaticMarkup(
      <Select>
        <SelectTrigger size="sm" className="legacy-class">
          <SelectValue placeholder="Choisir" />
        </SelectTrigger>
      </Select>
    )
    expect(html).toContain('data-slot="select-trigger"')
    expect(html).toContain('data-size="sm"')
    expect(html).toContain('data-slot="select-value"')
    expect(html).toContain('h_8')
    expect(html).toContain('bdr_control')
    expect(html).toContain('legacy-class')
    expect(html).not.toContain(' size="sm"')
  })

  it('renders the separator slot', () => {
    const html = renderToStaticMarkup(<SelectSeparator />)
    expect(html).toContain('data-slot="select-separator"')
    expect(html).toContain('h_1px')
    expect(html).toContain('bg_border')
  })
})
