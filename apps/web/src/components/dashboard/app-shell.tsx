import { ApiStatusCard } from '@/components/dashboard/api-status-card'
import { ExpensesList } from '@/components/dashboard/expenses-list'
import { MetricCard } from '@/components/dashboard/metric-card'
import { NewsFeed } from '@/components/dashboard/news-feed'
import { PortfolioSummary } from '@/components/dashboard/portfolio-summary'
import { PowensConnectionsCard } from '@/components/dashboard/powens-connections-card'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { Topbar } from '@/components/dashboard/topbar'

export function DashboardAppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <SidebarNav />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <main className="flex-1 p-4 md:p-6 space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Dépenses du mois"
                value="1 248 €"
                hint="Catégorisation auto bientôt"
                trend="down"
              />
              <MetricCard
                title="Épargne mensuelle"
                value="620 €"
                hint="Objectif: 700 €"
                trend="up"
              />
              <MetricCard
                title="Patrimoine net"
                value="36 500 €"
                hint="Vue consolidée (mock)"
                trend="up"
              />
              <MetricCard
                title="Score de sync"
                value="2/5"
                hint="Connecteurs à brancher"
                trend="neutral"
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <ExpensesList />
              </div>

              <div className="space-y-4">
                <PortfolioSummary />
                <PowensConnectionsCard />
                <ApiStatusCard />
              </div>
            </section>

            <section>
              <NewsFeed />
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
