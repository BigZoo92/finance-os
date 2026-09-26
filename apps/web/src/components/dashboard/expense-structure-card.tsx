import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { CurrencyAmount, Progress, Status } from '@finance-os/ui/components'
import type { ExpensePeriodViewModel } from '@/features/expenses-view-model'

const eyebrow = css({
  fontFamily: 'mono',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'muted.foreground',
})

const emptyFrame = css({
  mt: '4',
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: 'border',
  p: '5',
})

export function ExpenseStructureCard({ model }: { model: ExpensePeriodViewModel }) {
  return (
    <section aria-labelledby="expense-structure-title">
      <styled.div
        display="flex"
        flexWrap="wrap"
        alignItems="center"
        justifyContent="space-between"
        gap="3"
      >
        <h2 id="expense-structure-title" className={eyebrow}>
          Structure
        </h2>
        {model.structureIsPartial ? <Status tone="neutral" label="Principaux postes" /> : null}
      </styled.div>
      {model.currency === null ? (
        <div className={emptyFrame}>
          <Status tone="attention" label="Structure indisponible pour plusieurs devises" />
        </div>
      ) : model.categories.length === 0 ? (
        <styled.div className={emptyFrame} textStyle="sm" color="muted.foreground">
          Aucune dépense sur la période
        </styled.div>
      ) : (
        <styled.div mt="4" spaceY="4">
          {model.categories.slice(0, 7).map(category => (
            <div key={category.category}>
              <styled.div
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap="4"
                textStyle="sm"
              >
                <styled.span truncate color="foreground">
                  {category.category}
                </styled.span>
                <styled.div
                  display="flex"
                  flexShrink="0"
                  alignItems="center"
                  gap="3"
                  fontFamily="mono"
                  textStyle="xs"
                >
                  <CurrencyAmount value={category.total} currency={model.currency} />
                  <styled.span w="12" textAlign="right" color="muted.foreground">
                    {category.ratio.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
                  </styled.span>
                </styled.div>
              </styled.div>
              <Progress
                value={category.ratio}
                label={`Part ${category.category}`}
                tone="neutral"
                mt="2"
              />
            </div>
          ))}
        </styled.div>
      )}
    </section>
  )
}
