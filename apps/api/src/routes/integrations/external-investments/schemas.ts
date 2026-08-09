import { t } from 'elysia'

export const externalInvestmentProviderParamSchema = t.Object({
  provider: t.Union([t.Literal('ibkr'), t.Literal('binance')]),
})

export const externalInvestmentSyncBodySchema = t.Optional(
  t.Object({
    trigger: t.Optional(
      t.Union([t.Literal('manual'), t.Literal('scheduled'), t.Literal('internal')])
    ),
  })
)

export const externalInvestmentProviderSyncBodySchema = t.Optional(
  t.Object({
    trigger: t.Optional(
      t.Union([t.Literal('manual'), t.Literal('scheduled'), t.Literal('internal')])
    ),
  })
)

export const externalInvestmentListQuerySchema = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })),
})
