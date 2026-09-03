import { createFileRoute, redirect } from '@tanstack/react-router'

export const INVESTMENT_STRATEGY_REDIRECT = { to: '/ia', statusCode: 301 } as const

export const Route = createFileRoute('/_app/ia/strategie-investissement')({
  beforeLoad: () => {
    throw redirect(INVESTMENT_STRATEGY_REDIRECT)
  },
  component: () => null,
})
