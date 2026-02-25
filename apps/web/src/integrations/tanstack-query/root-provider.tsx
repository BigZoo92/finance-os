import { QueryClient } from '@tanstack/react-query'

export interface AppRouterContext {
  queryClient: QueryClient
}

export const createAppRouterContext = (): AppRouterContext => {
  return {
    queryClient: new QueryClient(),
  }
}
