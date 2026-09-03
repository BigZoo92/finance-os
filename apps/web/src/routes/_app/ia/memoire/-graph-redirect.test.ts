import { describe, expect, it } from 'vitest'
import { validateAdvisorGraphSearch } from '@/features/advisor-graph-search-params'
import { getMemoryGraphRedirect, Route } from './graph'

describe('legacy Memory graph route', () => {
  it('preserves validated node and lens search on the canonical redirect', async () => {
    const search = validateAdvisorGraphSearch({
      node: 'snapshot:me',
      lens: 'risk',
      ignored: 'value',
    })
    expect(getMemoryGraphRedirect(search)).toEqual({
      to: '/ia/memoire',
      search: { node: 'snapshot:me', lens: 'risk' },
      replace: true,
      statusCode: 301,
    })

    const beforeLoad = Route.options.beforeLoad
    if (!beforeLoad) throw new Error('Missing compatibility redirect')

    let thrown: unknown
    try {
      await beforeLoad({ search } as never)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toMatchObject({ options: getMemoryGraphRedirect(search) })
  })

  it('drops invalid search values before redirecting', () => {
    const search = validateAdvisorGraphSearch({
      node: '<script>',
      lens: 'unknown',
    })

    expect(getMemoryGraphRedirect(search).search).toEqual({
      node: undefined,
      lens: undefined,
    })
  })
})
