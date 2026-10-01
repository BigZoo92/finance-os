import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Input } from './input'

describe('Input', () => {
  it('renders the recipe atoms and the slot contract', () => {
    const html = renderToStaticMarkup(<Input type="email" placeholder="Courriel" />)
    expect(html).toContain('<input')
    expect(html).toContain('data-slot="input"')
    expect(html).toContain('type="email"')
    expect(html).toContain('h_10')
    expect(html).toContain('bg_surface.1')
  })

  it('keeps consumer classes and style props', () => {
    const html = renderToStaticMarkup(<Input className="legacy-class" mt="2" />)
    expect(html).toContain('legacy-class')
    expect(html).toContain('mt_2')
  })
})
