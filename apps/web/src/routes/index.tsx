import { createFileRoute } from '@tanstack/react-router'
import { DashboardAppShell } from '@/components/dashboard/app-shell'
import { powensStatusQueryOptions } from '@/features/powens/query-options'
import { apiHealthQueryOptions } from '@/features/system/query-options'

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(powensStatusQueryOptions()),
      context.queryClient.ensureQueryData(apiHealthQueryOptions()),
    ])
  },
  component: HomePage,
})

function HomePage() {
  return <DashboardAppShell />
}
