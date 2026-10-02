import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Button, CurrencyAmount, Input, Status } from '@finance-os/ui/components'
import { useState } from 'react'

type BudgetEntry = { category: string; monthlyBudget: number }

const DEMO_MONTHLY_BUDGETS: BudgetEntry[] = [
  { category: 'Courses', monthlyBudget: 500 },
  { category: 'Transport', monthlyBudget: 230 },
  { category: 'Abonnements', monthlyBudget: 50 },
  { category: 'Restaurants', monthlyBudget: 170 },
]
const STORAGE_KEY = 'finance_os.admin.monthly_category_budgets.v1'
type BudgetStorageState = { entries: BudgetEntry[]; warning: string | null }

const readBudgets = (): BudgetStorageState => {
  if (typeof window === 'undefined') return { entries: [], warning: null }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { entries: [], warning: null }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return { entries: [], warning: 'Budgets sauvegardés invalides' }
    return {
      entries: parsed
        .filter(
          (item): item is BudgetEntry =>
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
    return { entries: [], warning: 'Budgets sauvegardés indisponibles' }
  }
}

const writeBudgets = (entries: BudgetEntry[]): string | null => {
  if (typeof window === 'undefined') return null
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    return null
  } catch {
    return 'Sauvegarde locale indisponible'
  }
}

const eyebrow = css({
  fontFamily: 'mono',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'muted.foreground',
})

export function MonthlyCategoryBudgetsCard({
  isAdmin,
  isDemo,
}: {
  isAdmin: boolean
  isDemo: boolean
}) {
  const [storageState] = useState<BudgetStorageState>(() => readBudgets())
  const [budgets, setBudgets] = useState<BudgetEntry[]>(() => storageState.entries)
  const [warning, setWarning] = useState<string | null>(() => storageState.warning)
  const [categoryInput, setCategoryInput] = useState('')
  const [budgetInput, setBudgetInput] = useState('')
  const visibleBudgets = isDemo ? DEMO_MONTHLY_BUDGETS : budgets

  const addBudget = () => {
    if (!isAdmin) return
    const category = categoryInput.trim()
    const monthlyBudget = Number(budgetInput)
    if (!category || !Number.isFinite(monthlyBudget) || monthlyBudget < 0) return
    const next = [
      ...budgets.filter(entry => entry.category.toLowerCase() !== category.toLowerCase()),
      { category, monthlyBudget },
    ].sort((left, right) => left.category.localeCompare(right.category, 'fr'))
    setBudgets(next)
    setWarning(writeBudgets(next))
    setCategoryInput('')
    setBudgetInput('')
  }

  const deleteBudget = (category: string) => {
    if (!isAdmin) return
    const next = budgets.filter(entry => entry.category !== category)
    setBudgets(next)
    setWarning(writeBudgets(next))
  }

  return (
    <section aria-labelledby="monthly-budgets-title">
      <styled.div
        display="flex"
        flexWrap="wrap"
        alignItems="center"
        justifyContent="space-between"
        gap="3"
      >
        <h2 id="monthly-budgets-title" className={eyebrow}>
          Budgets mensuels
        </h2>
        <Status tone="neutral" label="Plafonds mensuels" />
      </styled.div>
      <Status tone="attention" label="Comparaison suspendue hors mois civil" mt="4" />
      {warning ? <Status tone="attention" label={warning} mt="3" /> : null}

      {isAdmin ? (
        <styled.div
          mt="4"
          display="grid"
          gap="2"
          sm={{ gridTemplateColumns: 'minmax(0, 1fr) 150px auto' }}
        >
          <Input
            value={categoryInput}
            onChange={event => setCategoryInput(event.target.value)}
            placeholder="Catégorie"
          />
          <Input
            value={budgetInput}
            onChange={event => setBudgetInput(event.target.value)}
            placeholder="Montant"
            inputMode="decimal"
          />
          <Button type="button" variant="outline" onClick={addBudget}>
            Ajouter
          </Button>
        </styled.div>
      ) : null}

      <styled.div mt="4" borderTopWidth="1px" borderColor="border">
        {visibleBudgets.length ? (
          visibleBudgets.map(entry => (
            <styled.div
              key={entry.category}
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gap="4"
              borderBottomWidth="1px"
              borderColor="border"
              py="3"
            >
              <styled.span textStyle="sm" color="foreground">
                {entry.category}
              </styled.span>
              <styled.div display="flex" alignItems="center" gap="3">
                <CurrencyAmount
                  value={entry.monthlyBudget}
                  currency="EUR"
                  decimals={0}
                  textStyle="sm"
                />
                {isAdmin ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteBudget(entry.category)}
                  >
                    Supprimer
                  </Button>
                ) : null}
              </styled.div>
            </styled.div>
          ))
        ) : (
          <styled.p
            borderBottomWidth="1px"
            borderColor="border"
            py="5"
            textStyle="sm"
            color="muted.foreground"
          >
            Aucun budget configuré
          </styled.p>
        )}
      </styled.div>
    </section>
  )
}
