import { createFileRoute } from '@tanstack/react-router'
import { DashboardAppShell } from '@/components/dashboard/app-shell'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return <DashboardAppShell />
}
