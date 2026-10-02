import { describe, expect, it } from 'vitest'
import { COSTS_REDIRECT, Route } from './ia/couts'

describe('legacy Costs route', () => {
  it('redirects /ia/couts permanently to /couts', async () => {
    const beforeLoad = Route.options.beforeLoad
    if (!beforeLoad) throw new Error('Missing compatibility redirect')
    // The async wrapper turns the synchronous `throw redirect(...)` into a
    // rejection; a route that does not redirect resolves to `null` and fails.
    const thrown = await (async () => beforeLoad({} as never))().then(
      () => null,
      (error: unknown) => error
    )
    expect(COSTS_REDIRECT).toEqual({ to: '/couts', statusCode: 301 })
    expect(thrown).toMatchObject({ options: COSTS_REDIRECT })
  })
})
