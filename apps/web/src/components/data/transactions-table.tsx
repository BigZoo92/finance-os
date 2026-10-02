import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import {
  Button,
  CurrencyAmount,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  Status,
} from '@finance-os/ui/components'
import type { DashboardTransactionsResponse } from '@/features/dashboard-types'
import { formatDate } from '@/lib/format'

type Transaction = DashboardTransactionsResponse['items'][number]

const tableFrame = css({ borderYWidth: '1px', borderColor: 'border' })

// Below `md` every row becomes a two-column card with its own bottom rule.
const mobileRow = css({
  mdDown: {
    my: '1',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    columnGap: '4',
    borderBottomWidth: '1px',
    borderColor: 'border',
    py: '3',
  },
})

// The amount colour follows the transaction direction through a data attribute,
// which outranks the cell recipe's own `color` without racing its atom.
const amountTone = css({
  '&[data-tone=negative]': { color: 'negative' },
  '&[data-tone=positive]': { color: 'positive' },
})

const visuallyHidden = css({ srOnly: true })

export function TransactionsTable({
  transactions,
  isAdmin,
  editing,
  onEdit,
}: {
  transactions: Transaction[]
  isAdmin: boolean
  editing: boolean
  onEdit: (transaction: Transaction) => void
}) {
  return (
    <div className={tableFrame}>
      <DataTable mdDown={{ display: 'block' }}>
        <DataTableHeader mdDown={{ srOnly: true }}>
          <DataTableRow>
            <DataTableHead>Date</DataTableHead>
            <DataTableHead>Libellé</DataTableHead>
            <DataTableHead>Catégorie</DataTableHead>
            <DataTableHead numeric>Montant</DataTableHead>
            {isAdmin ? (
              <DataTableHead>
                <span className={visuallyHidden}>Action</span>
              </DataTableHead>
            ) : null}
          </DataTableRow>
        </DataTableHeader>
        <DataTableBody mdDown={{ display: 'block' }}>
          {transactions.map(transaction => (
            <DataTableRow key={transaction.id} className={mobileRow}>
              <DataTableCell
                whiteSpace="nowrap"
                color="muted.foreground"
                mdDown={{
                  order: '2',
                  p: '0',
                  textAlign: 'right',
                  fontFamily: 'mono',
                  fontSize: '10px',
                }}
              >
                {formatDate(transaction.bookingDate)}
              </DataTableCell>
              <DataTableCell mdDown={{ order: '1', p: '0' }}>
                <styled.p fontWeight="medium">{transaction.label}</styled.p>
                <styled.p mt="1" textStyle="xs" color="muted.foreground">
                  {transaction.accountName ?? transaction.powensAccountId}
                </styled.p>
              </DataTableCell>
              <DataTableCell mdDown={{ order: '3', py: '2', pl: '0' }}>
                <styled.span textStyle="xs" color="muted.foreground">
                  {transaction.category ?? 'Non catégorisé'}
                  {transaction.subcategory ? `, ${transaction.subcategory}` : ''}
                </styled.span>
                {!transaction.category ? (
                  <Status tone="attention" label="À classer" ml="3" />
                ) : null}
              </DataTableCell>
              <DataTableCell
                numeric
                data-tone={transaction.direction === 'expense' ? 'negative' : 'positive'}
                className={amountTone}
                mdDown={{ order: '4', py: '2', pr: '0' }}
              >
                <CurrencyAmount value={transaction.amount} currency={transaction.currency} />
              </DataTableCell>
              {isAdmin ? (
                <DataTableCell
                  textAlign="right"
                  mdDown={{ order: '5', gridColumn: 'span 2 / span 2', p: '0' }}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={editing}
                    onClick={() => onEdit(transaction)}
                    minH="11"
                    md={{ minH: '0' }}
                  >
                    Modifier la catégorie
                  </Button>
                </DataTableCell>
              ) : null}
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </div>
  )
}
