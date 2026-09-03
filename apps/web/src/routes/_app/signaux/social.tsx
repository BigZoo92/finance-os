/**
 * Legacy `/signaux/social`. Social Intelligence now lives at its canonical
 * route outside the Signaux hierarchy.
 */
import { createFileRoute, redirect } from '@tanstack/react-router'

export const SOCIAL_REDIRECT = { to: '/social-intelligence', statusCode: 301 } as const

export const Route = createFileRoute('/_app/signaux/social')({
  beforeLoad: () => {
    throw redirect(SOCIAL_REDIRECT)
  },
  component: () => null,
})
