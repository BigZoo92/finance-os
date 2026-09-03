/**
 * Legacy `/signaux/marches` Markets dashboard, converged into Radar.
 */
import { createFileRoute, redirect } from '@tanstack/react-router'
import { RADAR_REDIRECT } from './index'

export const Route = createFileRoute('/_app/signaux/marches')({
  beforeLoad: () => {
    throw redirect(RADAR_REDIRECT)
  },
  component: () => null,
})
