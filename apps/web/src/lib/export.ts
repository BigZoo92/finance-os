import type { DashboardTransactionsResponse, DashboardSummaryResponse, DashboardRange } from '@/features/dashboard-types'
import { formatMoney } from './format'

const sanitizeCsvCell = (value: string | number | null) => {
  const text = value === null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

export const buildTransactionsCsv = (transactions: DashboardTransactionsResponse['items']) => {
  const header = [
    'id', 'bookingDate', 'label', 'amount', 'currency', 'direction',
    'category', 'subcategory', 'resolvedCategory', 'incomeType', 'tags',
    'accountName', 'powensConnectionId', 'powensAccountId',
  ]
  const rows = transactions.map(tx => [
    tx.id, tx.bookingDate, tx.label, tx.amount.toFixed(2), tx.currency, tx.direction,
    tx.category, tx.subcategory, tx.resolvedCategory, tx.incomeType, tx.tags.join('|'),
    tx.accountName, tx.powensConnectionId, tx.powensAccountId,
  ].map(sanitizeCsvCell).join(','))
  return [header.join(','), ...rows].join('\n')
}

export const downloadFile = ({ filename, mimeType, content }: { filename: string; mimeType: string; content: string }) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const exportTransactionsCsv = (transactions: DashboardTransactionsResponse['items'], range: DashboardRange) => {
  const datePart = new Date().toISOString().slice(0, 10)
  downloadFile({
    filename: `finance-os-transactions-${range}-${datePart}.csv`,
    mimeType: 'text/csv;charset=utf-8',
    content: buildTransactionsCsv(transactions),
  })
}
