import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/marches')({
  beforeLoad: () => {
    throw redirect({ to: '/signaux/marches', statusCode: 301 })
  },
  component: () => null,
})
