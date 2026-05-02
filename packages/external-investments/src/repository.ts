import { createHash } from 'node:crypto'
import { schema, type createDbClient } from '@finance-os/db'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { buildExternalInvestmentContextBundle } from './context-bundle'
import {
  decryptExternalInvestmentCredential,
  encryptExternalInvestmentCredential,
  maskExternalInvestmentCredential,
} from './credentials'
import type {
  ExternalInvestmentBundle,
  ExternalInvestmentBundlePositionInput,
  ExternalInvestmentCanonicalCashFlow,
  ExternalInvestmentCanonicalPosition,
  ExternalInvestmentCanonicalTrade,
  ExternalInvestmentCredentialPayload,
  ExternalInvestmentMaskedCredential,
  ExternalInvestmentNormalizedSnapshot,
  ExternalInvestmentProvider,
  ExternalInvestmentProviderCoverage,
  ExternalInvestmentRawImportDraft,
} from './types'

type ExternalInvestmentsDb = ReturnType<typeof createDbClient>['db']

export type ExternalInvestmentConnectionRecord = {
  id: number
  provider: ExternalInvestmentProvider
  providerConnectionId: string
  accountAlias: string | null
  enabled: boolean
  status: string
  credentialStatus: string
  maskedMetadata: Record<string, unknown> | null
  lastSyncStatus: string | null
  lastSyncReasonCode: string | null
  lastSyncAttemptAt: Date | null
  lastSyncAt: Date | null
  lastSuccessAt: Date | null
  lastFailedAt: Date | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  syncMetadata: Record<string, unknown> | null
  archivedAt: Date | null
  updatedAt: Date
}

export type ExternalInvestmentCredentialRecord = {
  connection: ExternalInvestmentConnectionRecord
  credentialId: number
  credentialKind: string
  encryptedPayload: string
}

const DEFAULT_PROVIDER_CONNECTION_IDS: Record<ExternalInvestmentProvider, string> = {
  ibkr: 'ibkr:flex',
  binance: 'binance:spot',
}

const toProviderConnectionId = (payload: ExternalInvestmentCredentialPayload) =>
  payload.provider === 'ibkr'
    ? DEFAULT_PROVIDER_CONNECTION_IDS.ibkr
    : DEFAULT_PROVIDER_CONNECTION_IDS.binance

const isProvider = (value: string): value is ExternalInvestmentProvider =>
  value === 'ibkr' || value === 'binance'

const toIso = (value: Date | null | undefined) => value?.toISOString() ?? null

const toDateOrNull = (value: string | null | undefined) => {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const toNumericString = (value: string | null, scale = 6) => {
  if (value === null) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(scale) : null
}

const toAssetValuationString = (value: string | null) => {
  if (value === null) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null
}

const redactSensitivePayload = (value: unknown, depth = 0): unknown => {
  if (depth > 5) {
    return '[TRUNCATED_DEPTH]'
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(item => redactSensitivePayload(item, depth + 1))
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 240) {
      return `${value.slice(0, 240)}...`
    }
    return value
  }
  const result: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value).slice(0, 40)) {
    if (/token|secret|signature|apikey|api_key|signed|wallet|address|authorization/i.test(key)) {
      result[key] = '[REDACTED]'
      continue
    }
    result[key] = redactSensitivePayload(entry, depth + 1)
  }
  return result
}

const serializeForDigest = (value: unknown) => {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const buildRawImportPersistence = ({
  draft,
  connection,
  requestId,
}: {
  draft: ExternalInvestmentRawImportDraft
  connection: ExternalInvestmentConnectionRecord
  requestId?: string
}) => {
  const preview = redactSensitivePayload(draft.payload) as Record<string, unknown> | null
  const serialized = serializeForDigest(preview)
  return {
    provider: draft.provider,
    connectionId: connection.id,
    providerConnectionId: connection.providerConnectionId,
    accountExternalId: draft.accountExternalId,
    objectType: draft.objectType,
    externalObjectId: draft.externalObjectId,
    importStatus: draft.importStatus,
    providerObjectAt: toDateOrNull(draft.providerObjectAt),
    lastSeenAt: new Date(),
    ...(requestId ? { requestId } : {}),
    payloadDigest: createHash('sha256').update(serialized).digest('hex'),
    payloadBytes: Buffer.byteLength(serialized, 'utf8'),
    payloadPreview: preview,
    updatedAt: new Date(),
  }
}

const mapConnectionRow = (row: typeof schema.externalInvestmentConnection.$inferSelect) => ({
  ...row,
  provider: isProvider(row.provider) ? row.provider : 'ibkr',
}) satisfies ExternalInvestmentConnectionRecord

const mapMasked = (value: ExternalInvestmentMaskedCredential) =>
  value as unknown as Record<string, unknown>

const sumCounts = (snapshot: ExternalInvestmentNormalizedSnapshot) => ({
  accounts: snapshot.accounts.length,
  instruments: snapshot.instruments.length,
  positions: snapshot.positions.length,
  trades: snapshot.trades.length,
  cashFlows: snapshot.cashFlows.length,
  rawImports: snapshot.rawImports.length,
})

const positionMetadata = (position: ExternalInvestmentCanonicalPosition) => ({
  externalInvestment: {
    provider: position.provider,
    connectionId: position.connectionId,
    accountExternalId: position.accountExternalId,
    instrumentKey: position.instrumentKey,
    assetClass: position.assetClass,
    valueSource: position.valueSource,
    sourceConfidence: position.sourceConfidence,
    assumptions: position.assumptions,
    degradedReasons: position.degradedReasons,
  },
})

export const createExternalInvestmentsRepository = ({
  db,
  staleAfterMinutes,
}: {
  db: ExternalInvestmentsDb
  staleAfterMinutes: number
}) => {
  const getConnectionByProvider = async (provider: ExternalInvestmentProvider) => {
    const [row] = await db
      .select()
      .from(schema.externalInvestmentConnection)
      .where(
        and(
          eq(schema.externalInvestmentConnection.provider, provider),
          isNull(schema.externalInvestmentConnection.archivedAt)
        )
      )
      .orderBy(desc(schema.externalInvestmentConnection.updatedAt))
      .limit(1)

    return row ? mapConnectionRow(row) : null
  }

  const getConnectionById = async (connectionId: number) => {
    const [row] = await db
      .select()
      .from(schema.externalInvestmentConnection)
      .where(eq(schema.externalInvestmentConnection.id, connectionId))
      .limit(1)

    return row ? mapConnectionRow(row) : null
  }

  const listConnections = async () => {
    const rows = await db
      .select()
      .from(schema.externalInvestmentConnection)
      .where(isNull(schema.externalInvestmentConnection.archivedAt))
      .orderBy(schema.externalInvestmentConnection.provider)
    return rows.map(mapConnectionRow)
  }

  const ensureConnection = async (payload: ExternalInvestmentCredentialPayload) => {
    const now = new Date()
    const providerConnectionId = toProviderConnectionId(payload)
    const masked = maskExternalInvestmentCredential(payload)
    await db
      .insert(schema.externalInvestmentConnection)
      .values({
        provider: payload.provider,
        providerConnectionId,
        accountAlias: masked.accountAlias,
        enabled: true,
        status: 'configured',
        credentialStatus: 'configured',
        maskedMetadata: mapMasked(masked),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.externalInvestmentConnection.provider,
          schema.externalInvestmentConnection.providerConnectionId,
        ],
        set: {
          accountAlias: masked.accountAlias,
          enabled: true,
          status: sql`case when ${schema.externalInvestmentConnection.status} = 'syncing' then 'syncing' else 'configured' end`,
          credentialStatus: 'configured',
          maskedMetadata: mapMasked(masked),
          archivedAt: null,
          archivedReason: null,
          updatedAt: now,
        },
      })

    const connection = await getConnectionByProvider(payload.provider)
    if (!connection) {
      throw new Error('Failed to load external investment connection')
    }
    return connection
  }

  return {
    getConnectionByProvider,
    getConnectionById,
    listConnections,

    async upsertCredential({
      payload,
      encryptionKey,
    }: {
      payload: ExternalInvestmentCredentialPayload
      encryptionKey: string
    }) {
      const connection = await ensureConnection(payload)
      const encryptedPayload = encryptExternalInvestmentCredential(payload, encryptionKey)
      const masked = maskExternalInvestmentCredential(payload)
      const now = new Date()
      const [active] = await db
        .select()
        .from(schema.externalInvestmentCredential)
        .where(
          and(
            eq(schema.externalInvestmentCredential.connectionId, connection.id),
            eq(schema.externalInvestmentCredential.provider, payload.provider),
            eq(schema.externalInvestmentCredential.kind, payload.kind),
            isNull(schema.externalInvestmentCredential.deletedAt)
          )
        )
        .limit(1)

      if (active) {
        await db
          .update(schema.externalInvestmentCredential)
          .set({
            encryptedPayload,
            maskedMetadata: mapMasked(masked),
            rotatedAt: now,
            updatedAt: now,
          })
          .where(eq(schema.externalInvestmentCredential.id, active.id))
      } else {
        await db.insert(schema.externalInvestmentCredential).values({
          connectionId: connection.id,
          provider: payload.provider,
          kind: payload.kind,
          encryptedPayload,
          maskedMetadata: mapMasked(masked),
        })
      }

      return {
        connection,
        credential: masked,
      }
    },

    async deleteCredential(provider: ExternalInvestmentProvider) {
      const connection = await getConnectionByProvider(provider)
      if (!connection) {
        return false
      }
      const now = new Date()
      await db
        .update(schema.externalInvestmentCredential)
        .set({
          deletedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.externalInvestmentCredential.connectionId, connection.id),
            isNull(schema.externalInvestmentCredential.deletedAt)
          )
        )
      await db
        .update(schema.externalInvestmentConnection)
        .set({
          status: 'disabled',
          credentialStatus: 'missing',
          enabled: false,
          updatedAt: now,
        })
        .where(eq(schema.externalInvestmentConnection.id, connection.id))
      return true
    },

    async listCredentialRecords(provider?: ExternalInvestmentProvider) {
      const whereClause = provider
        ? and(
            eq(schema.externalInvestmentCredential.provider, provider),
            isNull(schema.externalInvestmentCredential.deletedAt),
            isNull(schema.externalInvestmentConnection.archivedAt)
          )
        : and(
            isNull(schema.externalInvestmentCredential.deletedAt),
            isNull(schema.externalInvestmentConnection.archivedAt)
          )

      const rows = await db
        .select({
          credentialId: schema.externalInvestmentCredential.id,
          credentialKind: schema.externalInvestmentCredential.kind,
          encryptedPayload: schema.externalInvestmentCredential.encryptedPayload,
          connection: schema.externalInvestmentConnection,
        })
        .from(schema.externalInvestmentCredential)
        .innerJoin(
          schema.externalInvestmentConnection,
          eq(
            schema.externalInvestmentCredential.connectionId,
            schema.externalInvestmentConnection.id
          )
        )
        .where(whereClause)

      return rows.map(row => ({
        credentialId: row.credentialId,
        credentialKind: row.credentialKind,
        encryptedPayload: row.encryptedPayload,
        connection: mapConnectionRow(row.connection),
      })) satisfies ExternalInvestmentCredentialRecord[]
    },

    async listCredentialPayloads({
      encryptionKey,
      provider,
    }: {
      encryptionKey: string
      provider?: ExternalInvestmentProvider
    }) {
      const records = await this.listCredentialRecords(provider)
      return records.map(record => ({
        ...record,
        payload: decryptExternalInvestmentCredential(record.encryptedPayload, encryptionKey),
      }))
    },

    async createSyncRun(input: {
      runId: string
      requestId?: string
      provider: ExternalInvestmentProvider
      connectionId?: number
      providerConnectionId?: string
      triggerSource: string
    }) {
      await db.insert(schema.externalInvestmentSyncRun).values({
        id: input.runId,
        ...(input.requestId ? { requestId: input.requestId } : {}),
        provider: input.provider,
        ...(input.connectionId !== undefined ? { connectionId: input.connectionId } : {}),
        ...(input.providerConnectionId ? { providerConnectionId: input.providerConnectionId } : {}),
        triggerSource: input.triggerSource,
        status: 'running',
      })
    },

    async finishSyncRun(input: {
      runId: string
      status: 'success' | 'degraded' | 'failed' | 'skipped'
      startedAt: Date
      errorCode?: string | null
      errorMessage?: string | null
      rowCounts?: Record<string, number>
      degradedReasons?: string[]
    }) {
      await db
        .update(schema.externalInvestmentSyncRun)
        .set({
          status: input.status,
          finishedAt: new Date(),
          durationMs: Date.now() - input.startedAt.getTime(),
          ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
          ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
          ...(input.rowCounts !== undefined ? { rowCounts: input.rowCounts } : {}),
          ...(input.degradedReasons !== undefined ? { degradedReasons: input.degradedReasons } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.externalInvestmentSyncRun.id, input.runId))
    },

    async updateConnectionSyncState(input: {
      connectionId: number
      status: string
      lastSyncStatus?: string | null
      lastSyncReasonCode?: string | null
      lastErrorCode?: string | null
      lastErrorMessage?: string | null
      syncMetadata?: Record<string, unknown> | null
      success?: boolean
      failed?: boolean
      attempted?: boolean
    }) {
      const now = new Date()
      await db
        .update(schema.externalInvestmentConnection)
        .set({
          status: input.status,
          ...(input.lastSyncStatus !== undefined ? { lastSyncStatus: input.lastSyncStatus } : {}),
          ...(input.lastSyncReasonCode !== undefined
            ? { lastSyncReasonCode: input.lastSyncReasonCode }
            : {}),
          ...(input.lastErrorCode !== undefined ? { lastErrorCode: input.lastErrorCode } : {}),
          ...(input.lastErrorMessage !== undefined
            ? { lastErrorMessage: input.lastErrorMessage }
            : {}),
          ...(input.syncMetadata !== undefined ? { syncMetadata: input.syncMetadata } : {}),
          ...(input.attempted === true ? { lastSyncAttemptAt: now } : {}),
          ...(input.success === true ? { lastSyncAt: now, lastSuccessAt: now } : {}),
          ...(input.failed === true ? { lastSyncAt: now, lastFailedAt: now } : {}),
          updatedAt: now,
        })
        .where(eq(schema.externalInvestmentConnection.id, input.connectionId))
    },

    async updateProviderHealth(input: {
      provider: ExternalInvestmentProvider
      enabled: boolean
      status: 'healthy' | 'degraded' | 'failing' | 'idle'
      requestId?: string
      durationMs?: number
      errorCode?: string | null
      errorMessage?: string | null
      rawImportCount?: number
      normalizedRowCount?: number
      success?: boolean
      failed?: boolean
      skipped?: boolean
      metadata?: Record<string, unknown> | null
    }) {
      const now = new Date()
      await db
        .insert(schema.externalInvestmentProviderHealth)
        .values({
          provider: input.provider,
          enabled: input.enabled,
          status: input.status,
          lastAttemptAt: now,
          ...(input.success === true ? { lastSuccessAt: now } : {}),
          ...(input.failed === true ? { lastFailureAt: now } : {}),
          ...(input.errorCode !== undefined ? { lastErrorCode: input.errorCode } : {}),
          ...(input.errorMessage !== undefined ? { lastErrorMessage: input.errorMessage } : {}),
          ...(input.requestId ? { lastRequestId: input.requestId } : {}),
          ...(input.durationMs !== undefined ? { lastDurationMs: input.durationMs } : {}),
          ...(input.rawImportCount !== undefined ? { lastRawImportCount: input.rawImportCount } : {}),
          ...(input.normalizedRowCount !== undefined
            ? { lastNormalizedRowCount: input.normalizedRowCount }
            : {}),
          ...(input.success === true ? { successCount: 1 } : {}),
          ...(input.failed === true ? { failureCount: 1 } : {}),
          ...(input.skipped === true ? { skippedCount: 1 } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.externalInvestmentProviderHealth.provider,
          set: {
            enabled: input.enabled,
            status: input.status,
            lastAttemptAt: now,
            ...(input.success === true ? { lastSuccessAt: now } : {}),
            ...(input.failed === true ? { lastFailureAt: now } : {}),
            ...(input.errorCode !== undefined ? { lastErrorCode: input.errorCode } : {}),
            ...(input.errorMessage !== undefined ? { lastErrorMessage: input.errorMessage } : {}),
            ...(input.requestId ? { lastRequestId: input.requestId } : {}),
            ...(input.durationMs !== undefined ? { lastDurationMs: input.durationMs } : {}),
            ...(input.rawImportCount !== undefined
              ? { lastRawImportCount: input.rawImportCount }
              : {}),
            ...(input.normalizedRowCount !== undefined
              ? { lastNormalizedRowCount: input.normalizedRowCount }
              : {}),
            ...(input.success === true
              ? { successCount: sql`${schema.externalInvestmentProviderHealth.successCount} + 1` }
              : {}),
            ...(input.failed === true
              ? { failureCount: sql`${schema.externalInvestmentProviderHealth.failureCount} + 1` }
              : {}),
            ...(input.skipped === true
              ? { skippedCount: sql`${schema.externalInvestmentProviderHealth.skippedCount} + 1` }
              : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
            updatedAt: now,
          },
        })
    },

    async upsertRawImports({
      connection,
      rawImports,
      requestId,
    }: {
      connection: ExternalInvestmentConnectionRecord
      rawImports: ExternalInvestmentRawImportDraft[]
      requestId?: string
    }) {
      const idByKey = new Map<string, number>()
      for (const draft of rawImports) {
        const row = buildRawImportPersistence({
          draft,
          connection,
          ...(requestId ? { requestId } : {}),
        })
        const [created] = await db
          .insert(schema.externalInvestmentRawImport)
          .values(row)
          .onConflictDoUpdate({
            target: [
              schema.externalInvestmentRawImport.provider,
              schema.externalInvestmentRawImport.providerConnectionId,
              schema.externalInvestmentRawImport.objectType,
              schema.externalInvestmentRawImport.externalObjectId,
            ],
            set: {
              accountExternalId: row.accountExternalId,
              importStatus: row.importStatus,
              providerObjectAt: row.providerObjectAt,
              lastSeenAt: row.lastSeenAt,
              ...(requestId ? { requestId } : {}),
              payloadDigest: row.payloadDigest,
              payloadBytes: row.payloadBytes,
              payloadPreview: row.payloadPreview,
              updatedAt: new Date(),
            },
          })
          .returning({
            id: schema.externalInvestmentRawImport.id,
            objectType: schema.externalInvestmentRawImport.objectType,
            externalObjectId: schema.externalInvestmentRawImport.externalObjectId,
          })
        if (created) {
          idByKey.set(`${created.objectType}:${created.externalObjectId}`, created.id)
        }
      }
      return idByKey
    },

    async upsertCanonicalSnapshot({
      connection,
      snapshot,
      requestId,
    }: {
      connection: ExternalInvestmentConnectionRecord
      snapshot: ExternalInvestmentNormalizedSnapshot
      requestId?: string
    }) {
      const now = new Date()
      const rawImportIds = await this.upsertRawImports({
        connection,
        rawImports: snapshot.rawImports,
        ...(requestId ? { requestId } : {}),
      })

      const accountValues = snapshot.accounts.map(account => ({
        provider: account.provider,
        connectionId: connection.id,
        providerConnectionId: connection.providerConnectionId,
        accountExternalId: account.accountExternalId,
        accountType: account.accountType,
        accountAlias: account.accountAlias,
        baseCurrency: account.baseCurrency,
        metadata: account.metadata,
        degradedReasons: account.degradedReasons,
        sourceConfidence: account.sourceConfidence,
        rawImportId: rawImportIds.get(`account:${account.accountExternalId}`) ?? null,
        lastSeenAt: now,
        updatedAt: now,
      }))
      if (accountValues.length > 0) {
        await db
          .insert(schema.externalInvestmentAccount)
          .values(accountValues)
          .onConflictDoUpdate({
            target: [
              schema.externalInvestmentAccount.provider,
              schema.externalInvestmentAccount.providerConnectionId,
              schema.externalInvestmentAccount.accountExternalId,
            ],
            set: {
              accountType: sql`excluded.account_type`,
              accountAlias: sql`excluded.account_alias`,
              baseCurrency: sql`excluded.base_currency`,
              metadata: sql`excluded.metadata`,
              degradedReasons: sql`excluded.degraded_reasons`,
              sourceConfidence: sql`excluded.source_confidence`,
              rawImportId: sql`excluded.raw_import_id`,
              lastSeenAt: now,
              updatedAt: now,
            },
          })
      }

      const instrumentValues = snapshot.instruments.map(instrument => ({
        provider: instrument.provider,
        connectionId: connection.id,
        providerConnectionId: connection.providerConnectionId,
        instrumentKey: instrument.instrumentKey,
        symbol: instrument.symbol,
        name: instrument.name,
        currency: instrument.currency,
        assetClass: instrument.assetClass,
        isin: instrument.isin,
        cusip: instrument.cusip,
        conid: instrument.conid,
        binanceAsset: instrument.binanceAsset,
        binanceSymbol: instrument.binanceSymbol,
        metadata: instrument.metadata,
        sourceConfidence: instrument.sourceConfidence,
        rawImportId: rawImportIds.get(`instrument:${instrument.instrumentKey}`) ?? null,
        lastSeenAt: now,
        updatedAt: now,
      }))
      if (instrumentValues.length > 0) {
        await db
          .insert(schema.externalInvestmentInstrument)
          .values(instrumentValues)
          .onConflictDoUpdate({
            target: [
              schema.externalInvestmentInstrument.provider,
              schema.externalInvestmentInstrument.providerConnectionId,
              schema.externalInvestmentInstrument.instrumentKey,
            ],
            set: {
              symbol: sql`excluded.symbol`,
              name: sql`excluded.name`,
              currency: sql`excluded.currency`,
              assetClass: sql`excluded.asset_class`,
              isin: sql`excluded.isin`,
              cusip: sql`excluded.cusip`,
              conid: sql`excluded.conid`,
              binanceAsset: sql`excluded.binance_asset`,
              binanceSymbol: sql`excluded.binance_symbol`,
              metadata: sql`excluded.metadata`,
              sourceConfidence: sql`excluded.source_confidence`,
              rawImportId: sql`excluded.raw_import_id`,
              lastSeenAt: now,
              updatedAt: now,
            },
          })
      }

      for (const position of snapshot.positions) {
        const providerExternalAssetId = `external:${position.positionKey}`
        const [assetRow] = await db
          .insert(schema.asset)
          .values({
            assetType: position.assetClass === 'cash' ? 'cash' : 'investment',
            origin: 'provider',
            source: 'external_investment',
            provider: position.provider,
            providerConnectionId: connection.providerConnectionId,
            providerExternalAssetId,
            name: position.name,
            currency: position.valueCurrency ?? position.currency ?? 'EUR',
            valuation: toAssetValuationString(position.normalizedValue),
            valuationAsOf: toDateOrNull(position.valueAsOf),
            enabled: true,
            metadata: positionMetadata(position),
            raw: null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              schema.asset.provider,
              schema.asset.providerConnectionId,
              schema.asset.providerExternalAssetId,
            ],
            set: {
              assetType: position.assetClass === 'cash' ? 'cash' : 'investment',
              source: 'external_investment',
              name: position.name,
              currency: position.valueCurrency ?? position.currency ?? 'EUR',
              valuation: toAssetValuationString(position.normalizedValue),
              valuationAsOf: toDateOrNull(position.valueAsOf),
              enabled: true,
              metadata: positionMetadata(position),
              updatedAt: now,
            },
          })
          .returning({ id: schema.asset.id })

        const assetId = assetRow?.id ?? null
        await db
          .insert(schema.externalInvestmentPosition)
          .values({
            provider: position.provider,
            connectionId: connection.id,
            providerConnectionId: connection.providerConnectionId,
            accountExternalId: position.accountExternalId,
            instrumentKey: position.instrumentKey,
            positionKey: position.positionKey,
            providerPositionId: position.providerPositionId,
            name: position.name,
            symbol: position.symbol,
            assetClass: position.assetClass,
            quantity: toNumericString(position.quantity, 12),
            freeQuantity: toNumericString(position.freeQuantity, 12),
            lockedQuantity: toNumericString(position.lockedQuantity, 12),
            currency: position.currency,
            providerValue: toNumericString(position.providerValue),
            normalizedValue: toNumericString(position.normalizedValue),
            valueCurrency: position.valueCurrency,
            valueSource: position.valueSource,
            valueAsOf: toDateOrNull(position.valueAsOf),
            costBasis: toNumericString(position.costBasis),
            costBasisCurrency: position.costBasisCurrency,
            realizedPnl: toNumericString(position.realizedPnl),
            unrealizedPnl: toNumericString(position.unrealizedPnl),
            assumptions: position.assumptions,
            degradedReasons: position.degradedReasons,
            metadata: position.metadata,
            sourceConfidence: position.sourceConfidence,
            rawImportId: rawImportIds.get(`position:${position.providerPositionId}`) ?? null,
            lastSeenAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.externalInvestmentPosition.positionKey,
            set: {
              name: sql`excluded.name`,
              symbol: sql`excluded.symbol`,
              assetClass: sql`excluded.asset_class`,
              quantity: sql`excluded.quantity`,
              freeQuantity: sql`excluded.free_quantity`,
              lockedQuantity: sql`excluded.locked_quantity`,
              currency: sql`excluded.currency`,
              providerValue: sql`excluded.provider_value`,
              normalizedValue: sql`excluded.normalized_value`,
              valueCurrency: sql`excluded.value_currency`,
              valueSource: sql`excluded.value_source`,
              valueAsOf: sql`excluded.value_as_of`,
              costBasis: sql`excluded.cost_basis`,
              costBasisCurrency: sql`excluded.cost_basis_currency`,
              realizedPnl: sql`excluded.realized_pnl`,
              unrealizedPnl: sql`excluded.unrealized_pnl`,
              assumptions: sql`excluded.assumptions`,
              degradedReasons: sql`excluded.degraded_reasons`,
              metadata: sql`excluded.metadata`,
              sourceConfidence: sql`excluded.source_confidence`,
              rawImportId: sql`excluded.raw_import_id`,
              lastSeenAt: now,
              updatedAt: now,
            },
          })

        await db
          .insert(schema.investmentPosition)
          .values({
            positionKey: position.positionKey,
            assetId,
            source: 'external_investment',
            provider: position.provider,
            providerConnectionId: connection.providerConnectionId,
            providerPositionId: position.providerPositionId,
            name: position.name,
            currency: position.valueCurrency ?? position.currency ?? 'EUR',
            quantity: toNumericString(position.quantity, 8),
            costBasis: toAssetValuationString(position.costBasis),
            costBasisSource: position.costBasis ? 'provider' : 'unknown',
            currentValue: toAssetValuationString(position.normalizedValue),
            lastKnownValue: toAssetValuationString(position.providerValue ?? position.normalizedValue),
            valuedAt: toDateOrNull(position.valueAsOf),
            lastSyncedAt: now,
            metadata: positionMetadata(position),
            raw: null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.investmentPosition.positionKey,
            set: {
              assetId,
              source: 'external_investment',
              provider: position.provider,
              providerConnectionId: connection.providerConnectionId,
              providerPositionId: position.providerPositionId,
              name: position.name,
              currency: position.valueCurrency ?? position.currency ?? 'EUR',
              quantity: toNumericString(position.quantity, 8),
              costBasis: toAssetValuationString(position.costBasis),
              costBasisSource: position.costBasis ? 'provider' : 'unknown',
              currentValue: toAssetValuationString(position.normalizedValue),
              lastKnownValue: toAssetValuationString(position.providerValue ?? position.normalizedValue),
              valuedAt: toDateOrNull(position.valueAsOf),
              lastSyncedAt: now,
              metadata: positionMetadata(position),
              updatedAt: now,
            },
          })

        if (position.normalizedValue !== null) {
          await db
            .insert(schema.externalInvestmentValuationSnapshot)
            .values({
              provider: position.provider,
              connectionId: connection.id,
              providerConnectionId: connection.providerConnectionId,
              positionKey: position.positionKey,
              value: toNumericString(position.normalizedValue),
              currency: position.valueCurrency,
              source: position.valueSource,
              confidence: position.sourceConfidence,
              asOf: toDateOrNull(position.valueAsOf) ?? now,
              assumptions: position.assumptions,
              degradedReasons: position.degradedReasons,
            })
            .onConflictDoNothing()
        }
      }

      const tradeValues = snapshot.trades.map((trade: ExternalInvestmentCanonicalTrade) => ({
        provider: trade.provider,
        connectionId: connection.id,
        providerConnectionId: connection.providerConnectionId,
        accountExternalId: trade.accountExternalId,
        instrumentKey: trade.instrumentKey,
        tradeKey: trade.tradeKey,
        providerTradeId: trade.providerTradeId,
        symbol: trade.symbol,
        side: trade.side,
        quantity: toNumericString(trade.quantity, 12),
        price: toNumericString(trade.price, 8),
        grossAmount: toNumericString(trade.grossAmount),
        netAmount: toNumericString(trade.netAmount),
        currency: trade.currency,
        feeAmount: toNumericString(trade.feeAmount, 8),
        feeAsset: trade.feeAsset,
        tradedAt: new Date(trade.tradedAt),
        metadata: trade.metadata,
        sourceConfidence: trade.sourceConfidence,
        rawImportId: rawImportIds.get(`trade:${trade.providerTradeId}`) ?? null,
        lastSeenAt: now,
        updatedAt: now,
      }))
      if (tradeValues.length > 0) {
        await db
          .insert(schema.externalInvestmentTrade)
          .values(tradeValues)
          .onConflictDoUpdate({
            target: schema.externalInvestmentTrade.tradeKey,
            set: {
              quantity: sql`excluded.quantity`,
              price: sql`excluded.price`,
              grossAmount: sql`excluded.gross_amount`,
              netAmount: sql`excluded.net_amount`,
              currency: sql`excluded.currency`,
              feeAmount: sql`excluded.fee_amount`,
              feeAsset: sql`excluded.fee_asset`,
              metadata: sql`excluded.metadata`,
              sourceConfidence: sql`excluded.source_confidence`,
              rawImportId: sql`excluded.raw_import_id`,
              lastSeenAt: now,
              updatedAt: now,
            },
          })
      }

      const cashFlowValues = snapshot.cashFlows.map(
        (cashFlow: ExternalInvestmentCanonicalCashFlow) => ({
          provider: cashFlow.provider,
          connectionId: connection.id,
          providerConnectionId: connection.providerConnectionId,
          accountExternalId: cashFlow.accountExternalId,
          cashFlowKey: cashFlow.cashFlowKey,
          providerCashFlowId: cashFlow.providerCashFlowId,
          type: cashFlow.type,
          asset: cashFlow.asset,
          amount: toNumericString(cashFlow.amount, 12),
          currency: cashFlow.currency,
          feeAmount: toNumericString(cashFlow.feeAmount, 8),
          feeAsset: cashFlow.feeAsset,
          occurredAt: new Date(cashFlow.occurredAt),
          metadata: cashFlow.metadata,
          sourceConfidence: cashFlow.sourceConfidence,
          rawImportId: rawImportIds.get(`cash_flow:${cashFlow.providerCashFlowId}`) ?? null,
          lastSeenAt: now,
          updatedAt: now,
        })
      )
      if (cashFlowValues.length > 0) {
        await db
          .insert(schema.externalInvestmentCashFlow)
          .values(cashFlowValues)
          .onConflictDoUpdate({
            target: schema.externalInvestmentCashFlow.cashFlowKey,
            set: {
              type: sql`excluded.type`,
              asset: sql`excluded.asset`,
              amount: sql`excluded.amount`,
              currency: sql`excluded.currency`,
              feeAmount: sql`excluded.fee_amount`,
              feeAsset: sql`excluded.fee_asset`,
              metadata: sql`excluded.metadata`,
              sourceConfidence: sql`excluded.source_confidence`,
              rawImportId: sql`excluded.raw_import_id`,
              lastSeenAt: now,
              updatedAt: now,
            },
          })
      }

      const rowCounts = sumCounts(snapshot)
      await this.updateConnectionSyncState({
        connectionId: connection.id,
        status: snapshot.degradedReasons.length > 0 ? 'degraded' : 'connected',
        lastSyncStatus: snapshot.degradedReasons.length > 0 ? 'PARTIAL' : 'OK',
        lastSyncReasonCode: snapshot.degradedReasons[0] ?? 'SUCCESS',
        lastErrorCode: null,
        lastErrorMessage: null,
        syncMetadata: {
          rowCounts,
          warnings: snapshot.warnings,
          degradedReasons: snapshot.degradedReasons,
        },
        success: true,
      })
      return rowCounts
    },

    async listSyncRuns(limit = 40) {
      const rows = await db
        .select()
        .from(schema.externalInvestmentSyncRun)
        .orderBy(desc(schema.externalInvestmentSyncRun.startedAt))
        .limit(limit)
      return rows.map(row => ({
        id: row.id,
        requestId: row.requestId,
        provider: isProvider(row.provider) ? row.provider : 'ibkr',
        providerConnectionId: row.providerConnectionId,
        triggerSource: row.triggerSource,
        status: row.status,
        startedAt: row.startedAt.toISOString(),
        finishedAt: toIso(row.finishedAt),
        durationMs: row.durationMs,
        errorCode: row.errorCode,
        errorMessage: row.errorMessage,
        rowCounts: row.rowCounts,
        degradedReasons: row.degradedReasons,
      }))
    },

    async getProviderHealth() {
      const rows = await db.select().from(schema.externalInvestmentProviderHealth)
      return rows.map(row => ({
        provider: isProvider(row.provider) ? row.provider : 'ibkr',
        enabled: row.enabled,
        status: row.status,
        lastSuccessAt: toIso(row.lastSuccessAt),
        lastAttemptAt: toIso(row.lastAttemptAt),
        lastFailureAt: toIso(row.lastFailureAt),
        lastErrorCode: row.lastErrorCode,
        lastErrorMessage: row.lastErrorMessage,
        lastRequestId: row.lastRequestId,
        lastDurationMs: row.lastDurationMs,
        lastRawImportCount: row.lastRawImportCount,
        lastNormalizedRowCount: row.lastNormalizedRowCount,
        successCount: row.successCount,
        failureCount: row.failureCount,
        skippedCount: row.skippedCount,
        metadata: row.metadata,
      }))
    },

    async getStatus() {
      const [connections, health] = await Promise.all([
        listConnections(),
        this.getProviderHealth(),
      ])
      return {
        connections: connections.map(connection => ({
          ...connection,
          lastSyncAttemptAt: toIso(connection.lastSyncAttemptAt),
          lastSyncAt: toIso(connection.lastSyncAt),
          lastSuccessAt: toIso(connection.lastSuccessAt),
          lastFailedAt: toIso(connection.lastFailedAt),
          archivedAt: toIso(connection.archivedAt),
          updatedAt: connection.updatedAt.toISOString(),
        })),
        health,
      }
    },

    async listAccounts() {
      const rows = await db
        .select()
        .from(schema.externalInvestmentAccount)
        .orderBy(schema.externalInvestmentAccount.provider, schema.externalInvestmentAccount.accountExternalId)
      return rows.map(row => ({
        ...row,
        provider: isProvider(row.provider) ? row.provider : 'ibkr',
        firstSeenAt: row.firstSeenAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))
    },

    async listPositions() {
      const rows = await db
        .select({
          position: schema.externalInvestmentPosition,
          accountAlias: schema.externalInvestmentAccount.accountAlias,
        })
        .from(schema.externalInvestmentPosition)
        .leftJoin(
          schema.externalInvestmentAccount,
          and(
            eq(
              schema.externalInvestmentPosition.providerConnectionId,
              schema.externalInvestmentAccount.providerConnectionId
            ),
            eq(
              schema.externalInvestmentPosition.accountExternalId,
              schema.externalInvestmentAccount.accountExternalId
            )
          )
        )
        .orderBy(desc(schema.externalInvestmentPosition.normalizedValue))
      return rows.map(row => ({
        ...row.position,
        provider: isProvider(row.position.provider) ? row.position.provider : 'ibkr',
        accountAlias: row.accountAlias,
        quantity: toNumber(row.position.quantity),
        freeQuantity: toNumber(row.position.freeQuantity),
        lockedQuantity: toNumber(row.position.lockedQuantity),
        providerValue: toNumber(row.position.providerValue),
        normalizedValue: toNumber(row.position.normalizedValue),
        costBasis: toNumber(row.position.costBasis),
        realizedPnl: toNumber(row.position.realizedPnl),
        unrealizedPnl: toNumber(row.position.unrealizedPnl),
        valueAsOf: toIso(row.position.valueAsOf),
        firstSeenAt: row.position.firstSeenAt.toISOString(),
        lastSeenAt: row.position.lastSeenAt.toISOString(),
        updatedAt: row.position.updatedAt.toISOString(),
      }))
    },

    async listTrades(limit = 50) {
      const rows = await db
        .select()
        .from(schema.externalInvestmentTrade)
        .orderBy(desc(schema.externalInvestmentTrade.tradedAt))
        .limit(limit)
      return rows.map(row => ({
        ...row,
        provider: isProvider(row.provider) ? row.provider : 'ibkr',
        quantity: toNumber(row.quantity),
        price: toNumber(row.price),
        grossAmount: toNumber(row.grossAmount),
        netAmount: toNumber(row.netAmount),
        feeAmount: toNumber(row.feeAmount),
        tradedAt: row.tradedAt.toISOString(),
        firstSeenAt: row.firstSeenAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))
    },

    async listCashFlows(limit = 50) {
      const rows = await db
        .select()
        .from(schema.externalInvestmentCashFlow)
        .orderBy(desc(schema.externalInvestmentCashFlow.occurredAt))
        .limit(limit)
      return rows.map(row => ({
        ...row,
        provider: isProvider(row.provider) ? row.provider : 'ibkr',
        amount: toNumber(row.amount),
        feeAmount: toNumber(row.feeAmount),
        occurredAt: row.occurredAt.toISOString(),
        firstSeenAt: row.firstSeenAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))
    },

    async generateContextBundle({ requestId }: { requestId?: string } = {}) {
      const [status, positions, trades, cashFlows] = await Promise.all([
        this.getStatus(),
        this.listPositions(),
        this.listTrades(100),
        this.listCashFlows(100),
      ])
      const now = new Date()
      const providerCoverage: ExternalInvestmentProviderCoverage[] = (['ibkr', 'binance'] as const).map(
        provider => {
          const connection = status.connections.find(item => item.provider === provider)
          const health = status.health.find(item => item.provider === provider)
          const lastSuccessAt = connection?.lastSuccessAt ?? health?.lastSuccessAt ?? null
          const lastSuccessDate = toDateOrNull(lastSuccessAt)
          const stale =
            !lastSuccessDate ||
            now.getTime() - lastSuccessDate.getTime() > staleAfterMinutes * 60 * 1000
          return {
            provider,
            configured: Boolean(connection && connection.credentialStatus === 'configured'),
            status: !connection
              ? 'missing'
              : stale
                ? 'degraded'
                : health?.status === 'healthy'
                  ? 'healthy'
                  : connection.status === 'error'
                    ? 'failing'
                    : connection.status === 'degraded'
                      ? 'degraded'
                      : 'idle',
            lastSuccessAt,
            lastAttemptAt: connection?.lastSyncAttemptAt ?? health?.lastAttemptAt ?? null,
            stale,
            degradedReasons: [
              ...(connection?.lastErrorCode ? [connection.lastErrorCode] : []),
              ...(connection?.syncMetadata &&
              Array.isArray(connection.syncMetadata.degradedReasons)
                ? connection.syncMetadata.degradedReasons.map(String)
                : []),
            ],
          }
        }
      )
      const bundlePositions: ExternalInvestmentBundlePositionInput[] = positions.map(position => ({
        provider: position.provider,
        connectionId: String(position.connectionId),
        accountExternalId: position.accountExternalId,
        accountAlias: position.accountAlias,
        positionKey: position.positionKey,
        name: position.name,
        symbol: position.symbol,
        assetClass: position.assetClass as ExternalInvestmentBundlePositionInput['assetClass'],
        currency: position.currency,
        quantity: position.quantity,
        value: position.normalizedValue,
        valueCurrency: position.valueCurrency,
        valueSource: position.valueSource as ExternalInvestmentBundlePositionInput['valueSource'],
        valueAsOf: position.valueAsOf,
        costBasis: position.costBasis,
        costBasisSource: position.costBasis === null ? 'unknown' : 'provider',
        unrealizedPnl: position.unrealizedPnl,
        degradedReasons: position.degradedReasons,
        assumptions: position.assumptions,
      }))
      const bundle = buildExternalInvestmentContextBundle({
        generatedAt: now.toISOString(),
        providerCoverage,
        positions: bundlePositions,
        recentTrades: trades.map(trade => ({
          provider: trade.provider,
          side: trade.side as 'buy' | 'sell' | 'unknown',
          feeAmount: trade.feeAmount,
        })),
        recentCashFlows: cashFlows.map(cashFlow => ({
          provider: cashFlow.provider,
          type: cashFlow.type as ExternalInvestmentCanonicalCashFlow['type'],
        })),
        staleAfterMinutes,
      })
      await db
        .insert(schema.advisorInvestmentContextBundle)
        .values({
          singleton: true,
          schemaVersion: bundle.schemaVersion,
          generatedAt: new Date(bundle.generatedAt),
          ...(requestId ? { requestId } : {}),
          bundle: bundle as unknown as Record<string, unknown>,
          staleAfterMinutes,
          providerCoverage: providerCoverage as unknown as Array<Record<string, unknown>>,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.advisorInvestmentContextBundle.singleton,
          set: {
            schemaVersion: bundle.schemaVersion,
            generatedAt: new Date(bundle.generatedAt),
            ...(requestId ? { requestId } : {}),
            bundle: bundle as unknown as Record<string, unknown>,
            staleAfterMinutes,
            providerCoverage: providerCoverage as unknown as Array<Record<string, unknown>>,
            updatedAt: now,
          },
        })
      return bundle
    },

    async getLatestContextBundle() {
      const [row] = await db
        .select()
        .from(schema.advisorInvestmentContextBundle)
        .where(eq(schema.advisorInvestmentContextBundle.singleton, true))
        .limit(1)
      if (!row) {
        return null
      }
      return {
        schemaVersion: row.schemaVersion,
        generatedAt: row.generatedAt.toISOString(),
        requestId: row.requestId,
        bundle: row.bundle as ExternalInvestmentBundle,
        staleAfterMinutes: row.staleAfterMinutes,
        providerCoverage: row.providerCoverage,
        updatedAt: row.updatedAt.toISOString(),
      }
    },

    async getDiagnostics() {
      const [status, rawImportRows, normalizedRows, bundle] = await Promise.all([
        this.getStatus(),
        db
          .select({
            provider: schema.externalInvestmentRawImport.provider,
            count: sql<number>`count(*)::int`,
          })
          .from(schema.externalInvestmentRawImport)
          .groupBy(schema.externalInvestmentRawImport.provider),
        db
          .select({
            provider: schema.externalInvestmentPosition.provider,
            count: sql<number>`count(*)::int`,
          })
          .from(schema.externalInvestmentPosition)
          .groupBy(schema.externalInvestmentPosition.provider),
        this.getLatestContextBundle(),
      ])
      return {
        status,
        rawImportCounts: rawImportRows,
        normalizedPositionCounts: normalizedRows,
        latestBundle: bundle,
      }
    },

    async getAvailableTradeSymbols(provider: ExternalInvestmentProvider, connectionId: number) {
      const rows = await db
        .select({
          symbol: schema.externalInvestmentPosition.symbol,
        })
        .from(schema.externalInvestmentPosition)
        .where(
          and(
            eq(schema.externalInvestmentPosition.provider, provider),
            eq(schema.externalInvestmentPosition.connectionId, connectionId)
          )
        )
      return [
        ...new Set(
          rows
            .map(row => row.symbol)
            .filter((value): value is string => value !== null && value.length > 0)
        ),
      ]
    },

    async getConnectionsForProviders(providers: ExternalInvestmentProvider[]) {
      if (providers.length === 0) {
        return []
      }
      const rows = await db
        .select()
        .from(schema.externalInvestmentConnection)
        .where(
          and(
            inArray(schema.externalInvestmentConnection.provider, providers),
            isNull(schema.externalInvestmentConnection.archivedAt)
          )
        )
      return rows.map(mapConnectionRow)
    },
  }
}
