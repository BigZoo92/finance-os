import { createFileRoute, redirect } from '@tanstack/react-router'

export const COSTS_REDIRECT = { to: '/couts', statusCode: 301 } as const

export const Route = createFileRoute('/_app/ia/couts')({
  beforeLoad: () => {
    throw redirect(COSTS_REDIRECT)
  },
  component: () => null,
})
