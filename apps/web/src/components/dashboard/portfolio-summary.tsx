import { Card, CardContent, CardHeader, CardTitle } from '@finance-os/ui/components'

const rows = [
  { label: 'Cash', value: '12 400 €' },
  { label: 'Livret A', value: '8 900 €' },
  { label: 'Assurance-vie', value: '15 200 €' },
  { label: 'PEA / ETF', value: '0 €' },
  { label: 'Crypto', value: '0 €' },
]

export function PortfolioSummary() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Répartition patrimoine (mock)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium">{row.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
