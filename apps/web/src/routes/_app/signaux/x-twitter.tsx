/**
 * Legacy admin route `/signaux/x-twitter`, kept for bookmarks. The followed
 * X accounts are managed from Social Intelligence.
 */
import { createFileRoute, redirect } from '@tanstack/react-router'
import { SOCIAL_REDIRECT } from './social'

export const Route = createFileRoute('/_app/signaux/x-twitter')({
  beforeLoad: () => {
    throw redirect(SOCIAL_REDIRECT)
  },
  component: () => null,
})
