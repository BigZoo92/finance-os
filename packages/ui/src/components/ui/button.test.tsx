import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button, buttonVariants } from './button'

describe('Button', () => {
  it('renders the recipe atoms, the slot contract and the variant attributes', () => {
    const html = renderToStaticMarkup(
      <Button variant="outline" size="sm">
        Valider
      </Button>
    )
    expect(html).toContain('<button')
    expect(html).toContain('data-slot="button"')
    expect(html).toContain('data-variant="outline"')
    expect(html).toContain('data-size="sm"')
    expect(html).toContain('d_inline-flex')
    expect(html).toContain('h_8')
    expect(html).toContain('bd-c_border')
    expect(html).not.toContain(' variant=')
    expect(html).not.toContain(' size=')
  })

  it('renders the child element with asChild and keeps consumer classes', () => {
    const html = renderToStaticMarkup(
      <Button asChild className="legacy-class">
        <a href="/accueil">Accueil</a>
      </Button>
    )
    expect(html).toContain('<a')
    expect(html).toContain('href="/accueil"')
    expect(html).toContain('data-slot="button"')
    expect(html).toContain('legacy-class')
    expect(html).not.toContain('<button')
  })

  it('exposes the class-string recipe', () => {
    expect(buttonVariants({ variant: 'ghost', size: 'icon' })).toContain('c_muted.foreground')
    expect(buttonVariants({ variant: 'ghost', size: 'icon' })).toContain('size_9')
  })
})
