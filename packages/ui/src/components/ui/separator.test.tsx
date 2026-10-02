import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Separator } from './separator'

describe('Separator', () => {
  it('renders a decorative horizontal rule by default', () => {
    const html = renderToStaticMarkup(<Separator className="legacy-class" />)
    expect(html).toContain('data-slot="separator"')
    expect(html).toContain('data-orientation="horizontal"')
    expect(html).toContain('role="none"')
    expect(html).toContain('bg_border')
    expect(html).toContain('legacy-class')
  })

  it('keeps the semantic vertical orientation', () => {
    const html = renderToStaticMarkup(<Separator orientation="vertical" decorative={false} />)
    expect(html).toContain('role="separator"')
    expect(html).toContain('aria-orientation="vertical"')
    expect(html).toContain('data-orientation="vertical"')
  })
})
