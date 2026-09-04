import { describe, expect, it } from 'vitest'
import { COSTS_REDIRECT, Route } from './ia/couts'

describe('legacy Costs route', () => {
  it('redirects /ia/couts permanently to /couts', async () => {
    const beforeLoad = Route.options.beforeLoad
    if (!beforeLoad) throw new Error('Missing compatibility redirect')
    try {
      await beforeLoad({} as never)
    } catch (error) {
      expect(COSTS_REDIRECT).toEqual({ to: '/couts', statusCode: 301 })
      expect(error).toMatchObject({ options: COSTS_REDIRECT })
      return
    }
    throw new Error('Legacy route did not redirect')
  })
})
