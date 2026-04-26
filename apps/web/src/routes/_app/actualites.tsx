import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/actualites')({
  beforeLoad: () => {
    throw redirect({ to: '/signaux', statusCode: 301 })
  },
  component: () => null,
})
