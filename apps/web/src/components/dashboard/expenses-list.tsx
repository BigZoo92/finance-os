import { Badge, Card, CardContent, CardHeader, CardTitle } from '@finance-os/ui/components'

const transactions = [
  { id: 1, label: 'Carrefour', amount: -54.2, category: 'Courses' },
  { id: 2, label: 'Spotify', amount: -10.99, category: 'Abonnement' },
  { id: 3, label: 'Salaire', amount: 2150, category: 'Revenus' },
  { id: 4, label: 'SNCF', amount: -38, category: 'Transport' },
]

export function ExpensesList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions récentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {transactions.map(tx => (
          <div
            key={tx.id}
            className="flex items-center justify-between gap-3 rounded-md border p-3"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{tx.label}</p>
              <p className="text-muted-foreground text-xs">{tx.category}</p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline">{tx.category}</Badge>
              <span className={tx.amount < 0 ? 'font-medium' : 'font-semibold'}>
                {tx.amount < 0 ? '-' : '+'}
                {Math.abs(tx.amount).toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
