/**
 * Legacy `/signaux` hub. Radar is the canonical destination; the redirect
 * keeps bookmarks and backend attention links working.
 */
import { createFileRoute, redirect } from '@tanstack/react-router'

export const RADAR_REDIRECT = { to: '/radar', statusCode: 301 } as const

export const Route = createFileRoute('/_app/signaux/')({
  beforeLoad: () => {
    throw redirect(RADAR_REDIRECT)
  },
  component: () => null,
})
