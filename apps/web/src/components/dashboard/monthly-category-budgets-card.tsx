import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@finance-os/ui/components'
import { useMemo, useState } from 'react'
import type { DashboardTransactionsResponse } from '@/features/dashboard-types'

type MonthlyCategoryBudgetsCardProps = {
  isAdmin: boolean
  isDemo: boolean
  transactions: DashboardTransactionsResponse['items']
}

type BudgetEntry = {
  category: string
  monthlyBudget: number
}

const STORAGE_KEY = 'finance_os.admin.monthly_category_budgets.v1'

type BudgetStorageState = {
  entries: BudgetEntry[]
  warning: string | null
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)

const readBudgets = (): BudgetStorageState => {
  if (typeof window === 'undefined') {
    return { entries: [], warning: null }
  }

  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return {
      entries: [],
      warning: 'Le stockage local est indisponible. Les budgets restent utilisables pour cette session.',
    }
  }

  if (!raw) {
    return { entries: [], warning: null }
  }

  try {
    const parsed = JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) {
      return {
        entries: [],
        warning: 'Les budgets sauvegardes etaient invalides et ont ete ignores.',
      }
    }

    return {
      entries: parsed
        .filter(item =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.category === 'string' &&
          typeof item.monthlyBudget === 'number' &&
          Number.isFinite(item.monthlyBudget) &&
          item.category.trim().length > 0
        )
        .map(item => ({
          category: item.category.trim(),
          monthlyBudget: Math.max(0, Math.round(item.monthlyBudget)),
        })),
      warning: null,
    }
  } catch {
    return {
      entries: [],
      warning: 'Impossible de relire les budgets sauvegardes. La carte reste utilisable.',
    }
  }
}

const writeBudgets = (entries: BudgetEntry[]): string | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    return null
  } catch {
    return 'Impossible de sauvegarder localement. Les changements restent visibles sans etre persistes.'
  }
}

export function MonthlyCategoryBudgetsCard({ isAdmin, isDemo, transactions }: MonthlyCategoryBudgetsCardProps) {
  const [storageState] = useState<BudgetStorageState>(() => readBudgets())
  const [budgets, setBudgets] = useState<BudgetEntry[]>(() => storageState.entries)
  const [storageWarning, setStorageWarning] = useState<string | null>(() => storageState.warning)
  const [categoryInput, setCategoryInput] = useState('')
  const [budgetInput, setBudgetInput] = useState('')

  const spentByCategory = useMemo(() => {
    return transactions
      .filter(transaction => transaction.direction === 'expense')
      .reduce<Map<string, number>>((accumulator, transaction) => {
        const key = (transaction.category ?? 'Sans categorie').trim() || 'Sans categorie'
        accumulator.set(key, (accumulator.get(key) ?? 0) + Math.abs(transaction.amount))
        return accumulator
      }, new Map())
  }, [transactions])

  const budgetRows = useMemo(
    () =>
      budgets
        .map(entry => {
          const spent = spentByCategory.get(entry.category) ?? 0
          const delta = entry.monthlyBudget - spent
          return {
            ...entry,
            spent,
            delta,
          }
        })
        .sort((a, b) => a.delta - b.delta),
    [budgets, spentByCategory]
  )


  const budgetAlerts = useMemo(() => {
    const overspentRows = budgetRows.filter(row => row.delta < 0)
    const nearLimitRows = budgetRows.filter(
      row => row.delta >= 0 && row.monthlyBudget > 0 && row.spent / row.monthlyBudget >= 0.9
    )

    return {
      overspentRows,
      nearLimitRows,
    }
  }, [budgetRows])

  const handleAddBudget = () => {
    if (!isAdmin) {
      return
    }

    const category = categoryInput.trim()
    const monthlyBudget = Number.parseInt(budgetInput.trim(), 10)

    if (!category || !Number.isFinite(monthlyBudget) || monthlyBudget < 0) {
      return
    }

    const next = [
      ...budgets.filter(entry => entry.category.toLowerCase() !== category.toLowerCase()),
      { category, monthlyBudget },
    ].sort((a, b) => a.category.localeCompare(b.category, 'fr'))

    setBudgets(next)
    setStorageWarning(writeBudgets(next))
    setCategoryInput('')
    setBudgetInput('')
  }

  const handleDeleteBudget = (category: string) => {
    if (!isAdmin) {
      return
    }

    const next = budgets.filter(entry => entry.category !== category)
    setBudgets(next)
    setStorageWarning(writeBudgets(next))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Budgets mensuels par categorie
          <Badge variant={isAdmin ? 'secondary' : 'outline'}>{isAdmin ? 'Admin' : 'Lecture demo'}</Badge>
        </CardTitle>
        <CardDescription>
          Budgets simples compares aux depenses de la plage visible. Les modifications sont reservees au mode admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isDemo ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            Demo: edition des budgets desactivee. Passe en mode admin pour definir les plafonds mensuels.
          </p>
        ) : null}

        {storageWarning ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            {storageWarning}
          </p>
        ) : null}

        <div className="grid gap-2 md:grid-cols-[2fr_1fr_auto]">
          <Input
            value={categoryInput}
            onChange={event => setCategoryInput(event.target.value)}
            placeholder="Categorie (ex: Courses)"
            disabled={!isAdmin}
          />
          <Input
            value={budgetInput}
            onChange={event => setBudgetInput(event.target.value)}
            placeholder="Budget EUR"
            inputMode="numeric"
            disabled={!isAdmin}
          />
          <Button type="button" variant="outline" onClick={handleAddBudget} disabled={!isAdmin}>
            Ajouter
          </Button>
        </div>

        {isAdmin && budgetAlerts.overspentRows.length + budgetAlerts.nearLimitRows.length > 0 ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-medium">Alertes budgetaires</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {budgetAlerts.overspentRows.map(row => (
                <li key={`overspent-${row.category}`}>
                  {row.category}: depassement de {formatMoney(Math.abs(row.delta))}
                </li>
              ))}
              {budgetAlerts.nearLimitRows.map(row => (
                <li key={`near-limit-${row.category}`}>
                  {row.category}: {Math.round((row.spent / row.monthlyBudget) * 100)}% du budget consomme
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {budgetRows.length ? (
          <div className="space-y-2">
            {budgetRows.map(row => {
              const overspent = row.delta < 0

              return (
                <div
                  key={row.category}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{row.category}</p>
                    <p className="text-xs text-muted-foreground">
                      Budget {formatMoney(row.monthlyBudget)} · Depense {formatMoney(row.spent)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={overspent ? 'destructive' : 'secondary'}>
                      {overspent ? `Depasse de ${formatMoney(Math.abs(row.delta))}` : `Reste ${formatMoney(row.delta)}`}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteBudget(row.category)}
                      disabled={!isAdmin}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-muted-foreground">Aucun budget configure.</p>
        )}
      </CardContent>
    </Card>
  )
}
