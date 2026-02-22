import { Badge, Card, CardContent, CardHeader, CardTitle } from '@finance-os/ui/components'
import { useEffect, useState } from 'react'

type ApiStatus =
  | { status: 'loading' }
  | { status: 'ok'; payload: unknown }
  | { status: 'error'; message: string }

export function ApiStatusCard() {
  const [state, setState] = useState<ApiStatus>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/health', {
          credentials: 'include',
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const payload = (await res.json()) as unknown

        if (!cancelled) {
          setState({ status: 'ok', payload })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!cancelled) {
          setState({ status: 'error', message })
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>API Status</CardTitle>
        <Badge variant={state.status === 'ok' ? 'secondary' : 'outline'}>{state.status}</Badge>
      </CardHeader>
      <CardContent>
        <pre className="text-xs overflow-auto rounded-md border p-3 bg-muted/30">
          {JSON.stringify(state, null, 2)}
        </pre>
      </CardContent>
    </Card>
  )
}
