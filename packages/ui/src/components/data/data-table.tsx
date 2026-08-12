import type * as React from 'react'
import { cn } from '@finance-os/ui/lib/utils'

function DataTable({ className, ...props }: React.ComponentProps<'table'>) {
  return <table className={cn('w-full border-collapse text-sm', className)} {...props} />
}

function DataTableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('border-b border-border', className)} {...props} />
}

function DataTableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />
}

function DataTableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'transition-colors duration-150 hover:bg-surface-1 focus-within:bg-surface-1',
        className
      )}
      {...props}
    />
  )
}

function DataTableHead({
  className,
  numeric,
  ...props
}: React.ComponentProps<'th'> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground',
        numeric && 'text-right',
        className
      )}
      {...props}
    />
  )
}

function DataTableCell({
  className,
  numeric,
  ...props
}: React.ComponentProps<'td'> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'px-4 py-3 align-middle text-foreground',
        numeric && 'text-right font-financial tabular-nums',
        className
      )}
      {...props}
    />
  )
}

export { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow }
