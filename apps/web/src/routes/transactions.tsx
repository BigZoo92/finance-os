import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/transactions')({
  beforeLoad: () => {
    throw redirect({ to: '/depenses', statusCode: 301 })
  },
  component: () => null,
})
