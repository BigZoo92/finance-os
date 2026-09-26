import { cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'

const dataTable = cva({
  base: { w: 'full', borderCollapse: 'collapse', textStyle: 'sm' },
})

const dataTableHeader = cva({
  base: { borderBottomWidth: '1px', borderColor: 'border' },
})

const dataTableBody = cva({
  base: { '& > :not(:last-child)': { borderBottomWidth: '1px', borderColor: 'border' } },
})

const dataTableRow = cva({
  base: {
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    _hover: { bg: 'surface.1' },
    _focusWithin: { bg: 'surface.1' },
  },
})

const dataTableHead = cva({
  base: {
    px: '4',
    py: '3',
    textAlign: 'left',
    fontFamily: 'mono',
    fontSize: '10px',
    fontWeight: 'medium',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'muted.foreground',
  },
  variants: {
    numeric: { true: { textAlign: 'right' }, false: {} },
  },
})

// Financial figures as longhands (see `@finance-os/ui/lib/typography`): a
// caller's `textStyle="xs"` must not erase the mono treatment.
const dataTableCell = cva({
  base: { px: '4', py: '3', verticalAlign: 'middle', color: 'foreground' },
  variants: {
    numeric: {
      true: {
        textAlign: 'right',
        fontFamily: 'mono',
        fontFeatureSettings: '"tnum", "zero", "ss01"',
        letterSpacing: '-0.01em',
        fontVariantNumeric: 'tabular-nums',
      },
      false: {},
    },
  },
})

const DataTable = styled('table', dataTable)
const DataTableHeader = styled('thead', dataTableHeader)
const DataTableBody = styled('tbody', dataTableBody)
const DataTableRow = styled('tr', dataTableRow)
const DataTableHead = styled('th', dataTableHead)
const DataTableCell = styled('td', dataTableCell)

export { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow }
