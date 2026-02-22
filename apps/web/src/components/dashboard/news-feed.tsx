import { Badge, Card, CardContent, CardHeader, CardTitle } from '@finance-os/ui/components'

const news = [
  { id: 1, title: 'ETF Monde : volatilité modérée sur la semaine', tag: 'ETF' },
  { id: 2, title: 'Bitcoin repasse au-dessus d’un seuil clé', tag: 'Crypto' },
  { id: 3, title: 'Taux : impact potentiel sur l’épargne réglementée', tag: 'Macro' },
]

export function NewsFeed() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actualités financières (mock)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {news.map(item => (
          <div key={item.id} className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug">{item.title}</p>
              <Badge variant="secondary">{item.tag}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
