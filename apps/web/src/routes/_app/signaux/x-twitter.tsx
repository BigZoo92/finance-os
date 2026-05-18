/**
 * Legacy admin route /signaux/x-twitter — kept for bookmarks and historical
 * links. The Social Intelligence cockpit has been consolidated under
 * /signaux/social; the X / Twitter health, account lookup, and previous-day
 * sync panels live there alongside the followed-account CRUD.
 */
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/signaux/x-twitter')({
  beforeLoad: () => {
    throw redirect({ to: '/signaux/social', replace: true })
  },
  component: () => null,
})
