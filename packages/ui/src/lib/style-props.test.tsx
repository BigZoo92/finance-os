/**
 * Style props on function components merge at the object level: a consumer
 * override replaces the component's own declaration instead of adding a
 * second atom whose outcome would depend on sheet order.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Amount } from '../components/finance/amount'
import { Progress } from '../components/finance/progress'
import { Status } from '../components/status/status'
import { withStyleProps } from './style-props'

const classesOf = (html: string) => /class="([^"]*)"/.exec(html)?.[1]?.split(' ') ?? []

describe('withStyleProps', () => {
  it('merges style props over the base styles and keeps the other props', () => {
    const { className, rest } = withStyleProps(
      { mt: '3', color: 'foreground', css: { display: 'block' }, id: 'x', title: 't' },
      { color: 'muted.foreground', textStyle: 'sm' }
    )
    const classes = className.split(' ')
    expect(classes).toContain('mt_3')
    expect(classes).toContain('c_foreground')
    expect(classes).toContain('textStyle_sm')
    expect(classes).toContain('d_block')
    expect(classes).not.toContain('c_muted.foreground')
    expect(rest).toEqual({ id: 'x', title: 't' })
  })
})

describe('shared function components accept style props', () => {
  it('Amount: a textStyle override sets the size and keeps the mono figures', () => {
    const classes = classesOf(renderToStaticMarkup(<Amount value={12} textStyle="sm" mt="2" />))
    expect(classes).toContain('textStyle_sm')
    expect(classes).toContain('mt_2')
    expect(classes).toContain('ff_mono')
    expect(classes).toContain('fv-num_tabular-nums')
  })

  it('Amount: a color override on the unavailable state replaces muted text', () => {
    const classes = classesOf(renderToStaticMarkup(<Amount value={null} color="foreground" />))
    expect(classes).toContain('c_foreground')
    expect(classes).not.toContain('c_muted.foreground')
  })

  it('Status: layout overrides merge with the tone and never leak to the DOM', () => {
    const html = renderToStaticMarkup(
      <Status tone="positive" label="À jour" display="flex" fontSize="13px" lineHeight="inherit" />
    )
    const classes = classesOf(html)
    expect(classes).toContain('d_flex')
    expect(classes).not.toContain('d_inline-flex')
    expect(classes).toContain('c_positive')
    expect(classes).toContain('fs_13px')
    expect(html).not.toContain('display="flex"')
    expect(html).not.toContain('fontSize=')
  })

  it('Progress: root style props apply to the root only', () => {
    const html = renderToStaticMarkup(<Progress value={40} label="Couverture" mt="4" />)
    expect(classesOf(html)).toContain('mt_4')
    expect(html).not.toContain('mt="4"')
  })
})
