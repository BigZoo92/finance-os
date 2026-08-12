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
    <div className="border-y border-border">
      <DataTable className="max-md:block">
        <DataTableHeader className="max-md:sr-only">
          <DataTableRow>
            <DataTableHead>Date</DataTableHead>
            <DataTableHead>Libellé</DataTableHead>
            <DataTableHead>Catégorie</DataTableHead>
            <DataTableHead numeric>Montant</DataTableHead>
            {isAdmin ? (
              <DataTableHead>
                <span className="sr-only">Action</span>
              </DataTableHead>
            ) : null}
          </DataTableRow>
        </DataTableHeader>
        <DataTableBody className="max-md:block max-md:divide-y-0">
          {transactions.map(transaction => (
            <DataTableRow
              key={transaction.id}
              className="max-md:my-1 max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-4 max-md:border-b max-md:border-border max-md:py-3"
            >
              <DataTableCell className="whitespace-nowrap text-muted-foreground max-md:order-2 max-md:p-0 max-md:text-right max-md:font-mono max-md:text-[10px]">
                {formatDate(transaction.bookingDate)}
              </DataTableCell>
              <DataTableCell className="max-md:order-1 max-md:p-0">
                <p className="font-medium">{transaction.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {transaction.accountName ?? transaction.powensAccountId}
                </p>
              </DataTableCell>
              <DataTableCell className="max-md:order-3 max-md:py-2 max-md:pl-0">
                <span className="text-xs text-muted-foreground">
                  {transaction.category ?? 'Non catégorisé'}
                  {transaction.subcategory ? `, ${transaction.subcategory}` : ''}
                </span>
                {!transaction.category ? (
                  <Status tone="attention" label="À classer" className="ml-3" />
                ) : null}
              </DataTableCell>
              <DataTableCell
                numeric
                className={
                  transaction.direction === 'expense'
                    ? 'text-negative max-md:order-4 max-md:py-2 max-md:pr-0'
                    : 'text-positive max-md:order-4 max-md:py-2 max-md:pr-0'
                }
              >
                <CurrencyAmount value={transaction.amount} currency={transaction.currency} />
              </DataTableCell>
              {isAdmin ? (
                <DataTableCell className="text-right max-md:order-5 max-md:col-span-2 max-md:p-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={editing}
                    onClick={() => onEdit(transaction)}
                    className="min-h-11 md:min-h-0"
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
