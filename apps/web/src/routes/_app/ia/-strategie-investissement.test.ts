import { describe, expect, it } from 'vitest'
import { INVESTMENT_STRATEGY_REDIRECT, Route } from './strategie-investissement'

describe('legacy investment strategy route', () => {
  it('keeps old bookmarks on a permanent redirect to Investments', async () => {
    expect(INVESTMENT_STRATEGY_REDIRECT).toEqual({ to: '/investissements', statusCode: 301 })

    const beforeLoad = Route.options.beforeLoad
    if (!beforeLoad) throw new Error('Missing compatibility redirect')

    let thrown: unknown
    try {
      await beforeLoad({} as never)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toMatchObject({ options: INVESTMENT_STRATEGY_REDIRECT })
  })
})
