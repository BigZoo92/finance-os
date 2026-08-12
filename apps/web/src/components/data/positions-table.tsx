import {
  Amount,
  Button,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  PercentChange,
} from '@finance-os/ui/components'
import type { InvestmentPositionRow } from '@/features/investments/view-model'

export function PositionsTable({
  positions,
  onSelect,
}: {
  positions: InvestmentPositionRow[]
  onSelect: (position: InvestmentPositionRow, trigger: HTMLButtonElement) => void
}) {
  return (
    <div className="border-y border-border">
      <DataTable className="max-md:block">
        <DataTableHeader className="max-md:sr-only">
          <DataTableRow>
            <DataTableHead>Actif</DataTableHead>
            <DataTableHead>Classe</DataTableHead>
            <DataTableHead>Provider</DataTableHead>
            <DataTableHead numeric>Valeur</DataTableHead>
            <DataTableHead numeric>Poids</DataTableHead>
            <DataTableHead numeric>P&amp;L</DataTableHead>
            <DataTableHead>
              <span className="sr-only">Détail</span>
            </DataTableHead>
          </DataTableRow>
        </DataTableHeader>
        <DataTableBody className="max-md:block max-md:divide-y-0">
          {positions.map(position => (
            <DataTableRow
              key={position.id}
              className="max-md:my-1 max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-4 max-md:border-b max-md:border-border max-md:py-3"
            >
              <DataTableCell className="max-md:order-1 max-md:p-0">
                <p className="font-medium">{position.symbol ?? position.asset}</p>
                {position.symbol ? (
                  <p className="mt-1 text-xs text-muted-foreground">{position.asset}</p>
                ) : null}
              </DataTableCell>
              <DataTableCell className="text-muted-foreground max-md:order-3 max-md:py-2 max-md:pl-0">
                {position.assetClass === 'unknown'
                  ? 'Non classé'
                  : position.assetClass.toUpperCase()}
              </DataTableCell>
              <DataTableCell className="max-md:order-4 max-md:py-2 max-md:pr-0 max-md:text-right">
                {position.provider === 'ibkr'
                  ? 'IBKR'
                  : position.provider === 'binance'
                    ? 'Binance'
                    : position.provider === 'powens'
                      ? 'Powens'
                      : 'Manuel'}
              </DataTableCell>
              <DataTableCell numeric className="max-md:order-2 max-md:p-0">
                <Amount value={position.value} unavailable="dash" />
              </DataTableCell>
              <DataTableCell
                numeric
                className="text-muted-foreground max-md:order-5 max-md:py-2 max-md:pl-0"
              >
                {position.weightPct === null ? (
                  <span>
                    <span aria-hidden="true">-</span>
                    <span className="sr-only">Indisponible</span>
                  </span>
                ) : (
                  `${position.weightPct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
                )}
              </DataTableCell>
              <DataTableCell numeric className="max-md:order-6 max-md:py-2 max-md:pr-0">
                <div>
                  <Amount value={position.pnlAmount} signed unavailable="dash" />
                </div>
                <PercentChange
                  value={position.pnlPercent}
                  decimals={1}
                  unavailableLabel="P&L indisponible"
                  className="text-[11px]"
                />
              </DataTableCell>
              <DataTableCell className="text-right max-md:order-7 max-md:col-span-2 max-md:p-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={event => onSelect(position, event.currentTarget)}
                  className="min-h-11 md:min-h-0"
                >
                  Détail
                </Button>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </div>
  )
}
