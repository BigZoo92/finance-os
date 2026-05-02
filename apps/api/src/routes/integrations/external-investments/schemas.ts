import { t } from 'elysia'

export const externalInvestmentProviderParamSchema = t.Object({
  provider: t.Union([t.Literal('ibkr'), t.Literal('binance')]),
})

export const externalInvestmentSyncBodySchema = t.Object({
  trigger: t.Optional(t.Union([t.Literal('manual'), t.Literal('scheduled'), t.Literal('internal')])),
})

export const externalInvestmentProviderSyncBodySchema = t.Object({
  trigger: t.Optional(t.Union([t.Literal('manual'), t.Literal('scheduled'), t.Literal('internal')])),
})

export const externalInvestmentListQuerySchema = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })),
})

export const externalInvestmentCredentialBodySchema = t.Object({
  accountAlias: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 120 }), t.Null()])),
  baseUrl: t.Optional(t.String({ format: 'uri' })),
  flexToken: t.Optional(t.String({ minLength: 1, maxLength: 512 })),
  queryIds: t.Optional(t.Array(t.String({ minLength: 1, maxLength: 80 }), { minItems: 1, maxItems: 20 })),
  expectedAccountIds: t.Optional(
    t.Array(t.String({ minLength: 1, maxLength: 80 }), { minItems: 1, maxItems: 20 })
  ),
  userAgent: t.Optional(t.String({ minLength: 1, maxLength: 240 })),
  apiKey: t.Optional(t.String({ minLength: 1, maxLength: 512 })),
  apiSecret: t.Optional(t.String({ minLength: 1, maxLength: 512 })),
  permissionsMetadata: t.Optional(
    t.Object({
      canRead: t.Optional(t.Boolean()),
      tradingEnabled: t.Optional(t.Boolean()),
      withdrawEnabled: t.Optional(t.Boolean()),
      ipRestricted: t.Optional(t.Boolean()),
    })
  ),
  ipRestrictionNote: t.Optional(t.String({ maxLength: 280 })),
})
