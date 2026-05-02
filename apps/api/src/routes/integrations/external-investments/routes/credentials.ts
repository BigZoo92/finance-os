import type {
  BinanceSpotCredentialPayload,
  ExternalInvestmentCredentialPayload,
  ExternalInvestmentProvider,
  IbkrFlexCredentialPayload,
} from '@finance-os/external-investments'
import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../../auth/context'
import { demoOrReal } from '../../../../auth/demo-mode'
import { requireAdmin } from '../../../../auth/guard'
import { getExternalInvestmentsRuntime } from '../context'
import {
  externalInvestmentCredentialBodySchema,
  externalInvestmentProviderParamSchema,
} from '../schemas'

type CredentialBody = {
  accountAlias?: string | null
  baseUrl?: string
  flexToken?: string
  queryIds?: string[]
  expectedAccountIds?: string[]
  userAgent?: string
  apiKey?: string
  apiSecret?: string
  permissionsMetadata?: {
    canRead?: boolean
    tradingEnabled?: boolean
    withdrawEnabled?: boolean
    ipRestricted?: boolean
  }
  ipRestrictionNote?: string
}

const requireString = (value: string | undefined, message: string) => {
  const normalized = value?.trim()
  if (!normalized) {
    throw new Error(message)
  }
  return normalized
}

const requireStringArray = (value: string[] | undefined, message: string) => {
  const normalized = (value ?? []).map(entry => entry.trim()).filter(Boolean)
  if (normalized.length === 0) {
    throw new Error(message)
  }
  return normalized
}

const optionalString = (value: string | null | undefined) => {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : undefined
}

const optionalStringArray = (value: string[] | undefined) => {
  const normalized = (value ?? []).map(entry => entry.trim()).filter(Boolean)
  return normalized.length > 0 ? normalized : undefined
}

const buildIbkrPayload = ({
  body,
  defaults,
}: {
  body: CredentialBody
  defaults: {
    baseUrl: string
    userAgent: string
  }
}): IbkrFlexCredentialPayload => {
  const accountAlias = optionalString(body.accountAlias)
  const expectedAccountIds = optionalStringArray(body.expectedAccountIds)
  return {
    provider: 'ibkr',
    kind: 'ibkr_flex',
    flexToken: requireString(body.flexToken, 'IBKR Flex token is required.'),
    queryIds: requireStringArray(body.queryIds, 'At least one IBKR Flex query id is required.'),
    ...(accountAlias ? { accountAlias } : {}),
    ...(expectedAccountIds ? { expectedAccountIds } : {}),
    baseUrl: optionalString(body.baseUrl) ?? defaults.baseUrl,
    userAgent: optionalString(body.userAgent) ?? defaults.userAgent,
  }
}

const buildPermissionsMetadata = (body: CredentialBody) => {
  const metadata = body.permissionsMetadata
  if (!metadata) {
    return undefined
  }

  return {
    ...(metadata.canRead !== undefined ? { canRead: metadata.canRead } : {}),
    ...(metadata.tradingEnabled !== undefined ? { tradingEnabled: metadata.tradingEnabled } : {}),
    ...(metadata.withdrawEnabled !== undefined ? { withdrawEnabled: metadata.withdrawEnabled } : {}),
    ...(metadata.ipRestricted !== undefined ? { ipRestricted: metadata.ipRestricted } : {}),
  }
}

const buildBinancePayload = ({
  body,
  defaults,
}: {
  body: CredentialBody
  defaults: {
    baseUrl: string
  }
}): BinanceSpotCredentialPayload => {
  const accountAlias = optionalString(body.accountAlias)
  const permissionsMetadata = buildPermissionsMetadata(body)
  const ipRestrictionNote = optionalString(body.ipRestrictionNote)
  return {
    provider: 'binance',
    kind: 'binance_spot',
    apiKey: requireString(body.apiKey, 'Binance API key is required.'),
    apiSecret: requireString(body.apiSecret, 'Binance API secret is required.'),
    ...(accountAlias ? { accountAlias } : {}),
    baseUrl: optionalString(body.baseUrl) ?? defaults.baseUrl,
    ...(permissionsMetadata ? { permissionsMetadata } : {}),
    ...(ipRestrictionNote ? { ipRestrictionNote } : {}),
  }
}

const buildCredentialPayload = ({
  provider,
  body,
  env,
}: {
  provider: ExternalInvestmentProvider
  body: CredentialBody
  env: {
    IBKR_FLEX_BASE_URL: string
    IBKR_FLEX_USER_AGENT: string
    BINANCE_SPOT_BASE_URL: string
  }
}): ExternalInvestmentCredentialPayload =>
  provider === 'ibkr'
    ? buildIbkrPayload({
        body,
        defaults: {
          baseUrl: env.IBKR_FLEX_BASE_URL,
          userAgent: env.IBKR_FLEX_USER_AGENT,
        },
      })
    : buildBinancePayload({
        body,
        defaults: {
          baseUrl: env.BINANCE_SPOT_BASE_URL,
        },
      })

const toCredentialErrorCode = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return /unsafe|trading|withdraw/i.test(message)
    ? 'PROVIDER_PERMISSION_UNSAFE'
    : 'PROVIDER_CREDENTIALS_INVALID'
}

export const createExternalInvestmentsCredentialRoute = () =>
  new Elysia()
    .put(
      '/:provider/credential',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const provider = context.params.provider

        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return {
              ok: false,
              code: 'DEMO_MODE_FORBIDDEN' as const,
              message: 'Admin session required.',
              requestId,
            }
          },
          real: async () => {
            requireAdmin(context)
            const runtime = getExternalInvestmentsRuntime(context)

            try {
              const payload = buildCredentialPayload({
                provider,
                body: context.body as CredentialBody,
                env: {
                  IBKR_FLEX_BASE_URL: runtime.config.credentialDefaults.ibkrBaseUrl,
                  IBKR_FLEX_USER_AGENT: runtime.config.credentialDefaults.ibkrUserAgent,
                  BINANCE_SPOT_BASE_URL: runtime.config.credentialDefaults.binanceBaseUrl,
                },
              })
              const result = await runtime.credentials.upsertCredential({ payload })

              return {
                ok: true,
                requestId,
                provider,
                connection: {
                  id: result.connection.id,
                  provider: result.connection.provider,
                  providerConnectionId: result.connection.providerConnectionId,
                  accountAlias: result.connection.accountAlias,
                  status: result.connection.status,
                  credentialStatus: result.connection.credentialStatus,
                },
                credential: result.credential,
              }
            } catch (error) {
              context.set.status = 400
              return {
                ok: false,
                code: toCredentialErrorCode(error),
                message:
                  toCredentialErrorCode(error) === 'PROVIDER_PERMISSION_UNSAFE'
                    ? 'Credential rejected because unsafe trading or withdrawal permissions are enabled.'
                    : error instanceof Error
                      ? error.message
                      : 'Credential payload is invalid.',
                requestId,
              }
            }
          },
        })
      },
      {
        params: externalInvestmentProviderParamSchema,
        body: externalInvestmentCredentialBodySchema,
      }
    )
    .delete(
      '/:provider/credential',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const provider = context.params.provider

        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return {
              ok: false,
              code: 'DEMO_MODE_FORBIDDEN' as const,
              message: 'Admin session required.',
              requestId,
            }
          },
          real: async () => {
            requireAdmin(context)
            const runtime = getExternalInvestmentsRuntime(context)
            const deleted = await runtime.credentials.deleteCredential(provider)
            return {
              ok: true,
              requestId,
              provider,
              deleted,
            }
          },
        })
      },
      {
        params: externalInvestmentProviderParamSchema,
      }
    )
    .post(
      '/:provider/credential/test',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const provider = context.params.provider

        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return {
              ok: false,
              code: 'DEMO_MODE_FORBIDDEN' as const,
              message: 'Admin session required.',
              requestId,
            }
          },
          real: async () => {
            requireAdmin(context)
            const runtime = getExternalInvestmentsRuntime(context)
            const result = await runtime.credentials.testCredential(provider)
            return {
              requestId,
              ...result,
            }
          },
        })
      },
      {
        params: externalInvestmentProviderParamSchema,
      }
    )
