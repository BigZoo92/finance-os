import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  type AdvisorGraphSearch,
  validateAdvisorGraphSearch,
} from '@/features/advisor-graph-search-params'

export const getMemoryGraphRedirect = (search: AdvisorGraphSearch) =>
  ({
    to: '/ia/memoire',
    search,
    replace: true,
    statusCode: 301,
  }) as const

export const Route = createFileRoute('/_app/ia/memoire/graph')({
  validateSearch: (raw: Record<string, unknown>) => validateAdvisorGraphSearch(raw),
  beforeLoad: ({ search }) => {
    throw redirect(getMemoryGraphRedirect(search))
  },
  component: () => null,
})
