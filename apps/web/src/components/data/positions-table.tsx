import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
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

const visuallyHidden = css({ srOnly: true })

export function PositionsTable({
  positions,
  onSelect,
}: {
  positions: InvestmentPositionRow[]
  onSelect: (position: InvestmentPositionRow, trigger: HTMLButtonElement) => void
}) {
  return (
    <div className={tableFrame}>
      <DataTable mdDown={{ display: 'block' }}>
        <DataTableHeader mdDown={{ srOnly: true }}>
          <DataTableRow>
            <DataTableHead>Actif</DataTableHead>
            <DataTableHead>Classe</DataTableHead>
            <DataTableHead>Provider</DataTableHead>
            <DataTableHead numeric>Valeur</DataTableHead>
            <DataTableHead numeric>Poids</DataTableHead>
            <DataTableHead numeric>P&amp;L</DataTableHead>
            <DataTableHead>
              <span className={visuallyHidden}>Détail</span>
            </DataTableHead>
          </DataTableRow>
        </DataTableHeader>
        <DataTableBody mdDown={{ display: 'block' }}>
          {positions.map(position => (
            <DataTableRow key={position.id} className={mobileRow}>
              <DataTableCell mdDown={{ order: '1', p: '0' }}>
                <styled.p fontWeight="medium">{position.symbol ?? position.asset}</styled.p>
                {position.symbol ? (
                  <styled.p mt="1" textStyle="xs" color="muted.foreground">
                    {position.asset}
                  </styled.p>
                ) : null}
              </DataTableCell>
              <DataTableCell color="muted.foreground" mdDown={{ order: '3', py: '2', pl: '0' }}>
                {position.assetClass === 'unknown'
                  ? 'Non classé'
                  : position.assetClass.toUpperCase()}
              </DataTableCell>
              <DataTableCell mdDown={{ order: '4', py: '2', pr: '0', textAlign: 'right' }}>
                {position.provider === 'ibkr'
                  ? 'IBKR'
                  : position.provider === 'binance'
                    ? 'Binance'
                    : position.provider === 'powens'
                      ? 'Powens'
                      : 'Manuel'}
              </DataTableCell>
              <DataTableCell numeric mdDown={{ order: '2', p: '0' }}>
                <Amount value={position.value} unavailable="dash" />
              </DataTableCell>
              <DataTableCell
                numeric
                color="muted.foreground"
                mdDown={{ order: '5', py: '2', pl: '0' }}
              >
                {position.weightPct === null ? (
                  <span>
                    <span aria-hidden="true">-</span>
                    <span className={visuallyHidden}>Indisponible</span>
                  </span>
                ) : (
                  `${position.weightPct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
                )}
              </DataTableCell>
              <DataTableCell numeric mdDown={{ order: '6', py: '2', pr: '0' }}>
                <div>
                  <Amount value={position.pnlAmount} signed unavailable="dash" />
                </div>
                <PercentChange
                  value={position.pnlPercent}
                  decimals={1}
                  unavailableLabel="P&L indisponible"
                  fontSize="11px"
                />
              </DataTableCell>
              <DataTableCell
                textAlign="right"
                mdDown={{ order: '7', gridColumn: 'span 2 / span 2', p: '0' }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={event => onSelect(position, event.currentTarget)}
                  minH="11"
                  md={{ minH: '0' }}
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
