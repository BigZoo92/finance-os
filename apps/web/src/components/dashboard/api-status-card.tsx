import { Badge, Card, CardContent, CardHeader, CardTitle } from '@finance-os/ui/components'
import { useQuery } from '@tanstack/react-query'
import { apiHealthQueryOptions } from '@/features/system/query-options'

const toErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message
  }

  return String(value)
}

type ApiStatus =
  | { status: 'loading' }
  | { status: 'ok'; payload: unknown }
  | { status: 'error'; message: string }

const toApiStatus = (params: {
  isPending: boolean
  isError: boolean
  data: unknown
  error: unknown
}): ApiStatus => {
  if (params.isPending) {
    return { status: 'loading' }
  }

  if (params.isError) {
    return {
      status: 'error',
      message: toErrorMessage(params.error),
    }
  }

  return {
    status: 'ok',
    payload: params.data,
  }
}

export function ApiStatusCard() {
  const query = useQuery(apiHealthQueryOptions())

  const state = toApiStatus({
    isPending: query.isPending,
    isError: query.isError,
    data: query.data,
    error: query.error,
  })

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
