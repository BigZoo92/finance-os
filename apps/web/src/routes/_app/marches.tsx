import { createFileRoute, redirect } from '@tanstack/react-router'
import { RADAR_REDIRECT } from './signaux/index'

export const Route = createFileRoute('/_app/marches')({
  beforeLoad: () => {
    throw redirect(RADAR_REDIRECT)
  },
  component: () => null,
})
