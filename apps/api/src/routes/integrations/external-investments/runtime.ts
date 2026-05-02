import {
  createExternalInvestmentsRepository,
  decryptExternalInvestmentCredential,
  isExternalInvestmentProvider,
  maskExternalInvestmentCredential,
} from '@finance-os/external-investments'
import { createExternalInvestmentsJobQueueRepository } from './repositories/external-investments-job-queue-repository'
import type {
  ExternalInvestmentsRouteRuntime,
  ExternalInvestmentsRoutesDependencies,
} from './types'

export const createExternalInvestmentsRouteRuntime = ({
  db,
  redisClient,
  env,
}: ExternalInvestmentsRoutesDependencies): ExternalInvestmentsRouteRuntime => {
  const repository = createExternalInvestmentsRepository({
    db,
    staleAfterMinutes: env.EXTERNAL_INVESTMENTS_STALE_AFTER_MINUTES,
  })
  const jobs = createExternalInvestmentsJobQueueRepository(redisClient)

  return {
    config: {
      enabled: env.EXTERNAL_INVESTMENTS_ENABLED,
      safeModeActive: env.EXTERNAL_INTEGRATIONS_SAFE_MODE || env.EXTERNAL_INVESTMENTS_SAFE_MODE,
      staleAfterMinutes: env.EXTERNAL_INVESTMENTS_STALE_AFTER_MINUTES,
      providerEnabled: {
        ibkr: env.IBKR_FLEX_ENABLED,
        binance: env.BINANCE_SPOT_ENABLED,
      },
      credentialDefaults: {
        ibkrBaseUrl: env.IBKR_FLEX_BASE_URL,
        ibkrUserAgent: env.IBKR_FLEX_USER_AGENT,
        binanceBaseUrl: env.BINANCE_SPOT_BASE_URL,
      },
    },
    repository,
    jobs,
    credentials: {
      async upsertCredential({ payload }) {
        return repository.upsertCredential({
          payload,
          encryptionKey: env.APP_ENCRYPTION_KEY,
        })
      },

      async deleteCredential(provider) {
        return repository.deleteCredential(provider)
      },

      async testCredential(provider) {
        if (!isExternalInvestmentProvider(provider)) {
          return {
            ok: false,
            provider: 'ibkr',
            configured: false,
            credentialKind: null,
            warnings: ['Unknown provider.'],
          }
        }

        const [record] = await repository.listCredentialRecords(provider)
        if (!record) {
          return {
            ok: false,
            provider,
            configured: false,
            credentialKind: null,
            warnings: ['Credential is not configured.'],
          }
        }

        const payload = decryptExternalInvestmentCredential(
          record.encryptedPayload,
          env.APP_ENCRYPTION_KEY
        )
        const masked = maskExternalInvestmentCredential(payload)

        return {
          ok: true,
          provider,
          configured: true,
          credentialKind: record.credentialKind,
          warnings: masked.warnings,
        }
      },
    },
  }
}
