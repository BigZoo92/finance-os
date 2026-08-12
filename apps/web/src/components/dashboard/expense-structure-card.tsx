import { CurrencyAmount, Progress, Status } from '@finance-os/ui/components'
import type { ExpensePeriodViewModel } from '@/features/expenses-view-model'

export function ExpenseStructureCard({ model }: { model: ExpensePeriodViewModel }) {
  return (
    <section aria-labelledby="expense-structure-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="expense-structure-title"
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          Structure
        </h2>
        {model.structureIsPartial ? <Status tone="neutral" label="Principaux postes" /> : null}
      </div>
      {model.currency === null ? (
        <div className="mt-4 border border-dashed border-border p-5">
          <Status tone="attention" label="Structure indisponible pour plusieurs devises" />
        </div>
      ) : model.categories.length === 0 ? (
        <div className="mt-4 border border-dashed border-border p-5 text-sm text-muted-foreground">
          Aucune dépense sur la période
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {model.categories.slice(0, 7).map(category => (
            <div key={category.category}>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="truncate text-foreground">{category.category}</span>
                <div className="flex shrink-0 items-center gap-3 font-mono text-xs">
                  <CurrencyAmount value={category.total} currency={model.currency} />
                  <span className="w-12 text-right text-muted-foreground">
                    {category.ratio.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
                  </span>
                </div>
              </div>
              <Progress
                value={category.ratio}
                label={`Part ${category.category}`}
                tone="neutral"
                className="mt-2"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
