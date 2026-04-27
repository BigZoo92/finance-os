import { queryOptions } from '@tanstack/react-query'
import {
  fetchAttentionItems,
  fetchTradingLabBacktests,
  fetchTradingLabCapabilities,
  fetchTradingLabScenarios,
  fetchTradingLabStrategies,
} from './trading-lab-api'

export const tradingLabCapabilitiesQueryOptions = () =>
  queryOptions({
    queryKey: ['tradingLab', 'capabilities'],
    queryFn: () => fetchTradingLabCapabilities(),
    staleTime: 5 * 60 * 1000,
  })

export const tradingLabStrategiesQueryOptions = () =>
  queryOptions({
    queryKey: ['tradingLab', 'strategies'],
    queryFn: async () => {
      const result = await fetchTradingLabStrategies()
      return result.strategies ?? []
    },
    staleTime: 60 * 1000,
  })

export const tradingLabBacktestsQueryOptions = (opts?: { strategyId?: number }) =>
  queryOptions({
    queryKey: ['tradingLab', 'backtests', opts],
    queryFn: async () => {
      const result = await fetchTradingLabBacktests(opts)
      return result.backtests ?? []
    },
    staleTime: 30 * 1000,
  })

export const tradingLabScenariosQueryOptions = () =>
  queryOptions({
    queryKey: ['tradingLab', 'scenarios'],
    queryFn: async () => {
      const result = await fetchTradingLabScenarios()
      return result.scenarios ?? []
    },
    staleTime: 60 * 1000,
  })

export const attentionItemsQueryOptions = (opts?: { status?: string }) =>
  queryOptions({
    queryKey: ['attention', 'items', opts],
    queryFn: () => fetchAttentionItems(opts),
    staleTime: 30 * 1000,
  })
