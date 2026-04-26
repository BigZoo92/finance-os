import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/memoire')({
  beforeLoad: () => {
    throw redirect({ to: '/ia/memoire', statusCode: 301 })
  },
  component: () => null,
})
