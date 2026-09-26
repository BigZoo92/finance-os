import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Badge } from './badge'

describe('Badge', () => {
  it('renders the recipe atoms, the slot contract and the variant attribute', () => {
    const html = renderToStaticMarkup(<Badge variant="outline">Mode démo</Badge>)
    expect(html).toContain('data-slot="badge"')
    expect(html).toContain('data-variant="outline"')
    expect(html).toContain('d_inline-flex')
    expect(html).toContain('bdr_full')
    expect(html).toContain('c_muted.foreground')
    expect(html).not.toContain(' variant=')
  })

  it('keeps consumer classes and style props', () => {
    const html = renderToStaticMarkup(
      <Badge className="legacy-class" mt="2">
        Ok
      </Badge>
    )
    expect(html).toContain('legacy-class')
    expect(html).toContain('mt_2')
  })
})
