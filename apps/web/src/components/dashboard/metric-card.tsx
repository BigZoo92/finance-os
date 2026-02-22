import { Badge, Card, CardContent, CardHeader, CardTitle } from '@finance-os/ui/components'

type MetricCardProps = {
  title: string
  value: string
  hint?: string
  trend?: 'up' | 'down' | 'neutral'
}

export function MetricCard({ title, value, hint, trend = 'neutral' }: MetricCardProps) {
  const trendLabel = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '•'

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-primary">{title}</CardTitle>
        <Badge variant="default">{trendLabel}</Badge>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
