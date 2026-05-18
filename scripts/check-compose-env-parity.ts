#!/usr/bin/env bun
/**
 * Compose ↔ env-schema parity guard.
 *
 * Source of truth: `packages/env/src/diagnostics.ts`. This script is a thin
 * CI-facing wrapper that loads docker-compose.prod.yml, checks the
 * `environment:` block of each service against the canonical required /
 * forbidden lists, and fails with a precise diff on drift.
 *
 * Run:
 *   bun scripts/check-compose-env-parity.ts
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  API_REQUIRED_KEYS as DIAG_API_REQUIRED_KEYS,
  FORBIDDEN_KEYS_BY_SERVICE as DIAG_FORBIDDEN_KEYS_BY_SERVICE,
  OPS_ALERTS_REQUIRED_KEYS as DIAG_OPS_ALERTS_REQUIRED_KEYS,
  WEB_REQUIRED_KEYS as DIAG_WEB_REQUIRED_KEYS,
  WORKER_REQUIRED_KEYS as DIAG_WORKER_REQUIRED_KEYS,
} from '../packages/env/src/diagnostics'

const COMPOSE_PATH = resolve(import.meta.dir, '..', 'docker-compose.prod.yml')

type ServiceName = 'api' | 'worker' | 'web' | 'ops-alerts'

/**
 * Re-export the canonical lists from the diagnostics module so the parity
 * script and the runtime `/ops/env/diagnostics` endpoint share one truth.
 */
export const API_REQUIRED_KEYS = DIAG_API_REQUIRED_KEYS
export const WORKER_REQUIRED_KEYS = DIAG_WORKER_REQUIRED_KEYS
export const WEB_REQUIRED_KEYS = DIAG_WEB_REQUIRED_KEYS
export const OPS_ALERTS_REQUIRED_KEYS = DIAG_OPS_ALERTS_REQUIRED_KEYS
export const FORBIDDEN_KEYS_BY_SERVICE: Record<ServiceName, readonly string[]> = {
  api: DIAG_FORBIDDEN_KEYS_BY_SERVICE.api,
  worker: DIAG_FORBIDDEN_KEYS_BY_SERVICE.worker,
  web: DIAG_FORBIDDEN_KEYS_BY_SERVICE.web,
  'ops-alerts': DIAG_FORBIDDEN_KEYS_BY_SERVICE['ops-alerts'],
}

const REQUIRED_BY_SERVICE: Record<ServiceName, readonly string[]> = {
  api: API_REQUIRED_KEYS,
  worker: WORKER_REQUIRED_KEYS,
  web: WEB_REQUIRED_KEYS,
  'ops-alerts': OPS_ALERTS_REQUIRED_KEYS,
}

/**
 * Lightweight YAML reader: extracts the `environment:` block keys for a
 * specific top-level service in docker-compose.prod.yml. Avoids pulling a
 * full yaml parser dep — we only care about top-level keys named like
 * `^      ([A-Z_][A-Z0-9_]*):` directly under `services.<name>.environment`.
 */
export const extractServiceEnvKeys = (composeYaml: string, service: ServiceName): Set<string> => {
  const lines = composeYaml.split('\n')
  const keys = new Set<string>()

  let insideService = false
  let insideEnv = false
  let envBaseIndent = -1

  for (const line of lines) {
    // Top-level service header: 2 spaces + `<name>:`
    const serviceHeaderMatch = line.match(/^ {2}([a-zA-Z0-9_-]+):\s*$/)
    if (serviceHeaderMatch) {
      insideService = serviceHeaderMatch[1] === service
      insideEnv = false
      envBaseIndent = -1
      continue
    }

    if (!insideService) continue

    if (!insideEnv) {
      const envHeader = line.match(/^( {4,})environment:\s*$/)
      if (envHeader) {
        insideEnv = true
        envBaseIndent = envHeader[1].length
      }
      continue
    }

    // Stop conditions: empty line outside or a new sibling key at same indent
    // as `environment:`.
    if (line.trim() === '') {
      continue
    }
    const leadingSpaces = line.match(/^( *)/)?.[1].length ?? 0
    if (leadingSpaces <= envBaseIndent && line.trim().length > 0) {
      // left the environment block
      insideEnv = false
      envBaseIndent = -1
      continue
    }

    const keyMatch = line.match(/^ {6,}([A-Z_][A-Z0-9_]*):/)
    if (keyMatch) {
      keys.add(keyMatch[1])
    }
  }

  return keys
}

export type ParityIssue =
  | { service: ServiceName; kind: 'missing'; key: string }
  | { service: ServiceName; kind: 'forbidden'; key: string }

export const checkComposeEnvParity = (composeYaml: string): ParityIssue[] => {
  const issues: ParityIssue[] = []

  const services: ServiceName[] = ['api', 'worker', 'web', 'ops-alerts']
  for (const service of services) {
    const declared = extractServiceEnvKeys(composeYaml, service)
    const required = REQUIRED_BY_SERVICE[service]
    const forbidden = FORBIDDEN_KEYS_BY_SERVICE[service] ?? []

    for (const key of required) {
      if (!declared.has(key)) {
        issues.push({ service, kind: 'missing', key })
      }
    }
    for (const key of forbidden) {
      if (declared.has(key)) {
        issues.push({ service, kind: 'forbidden', key })
      }
    }
  }

  return issues
}

const formatIssue = (issue: ParityIssue): string => {
  if (issue.kind === 'missing') {
    return `  [${issue.service}] MISSING ${issue.key} — declared as required by code but absent from docker-compose.prod.yml ${issue.service}.environment`
  }
  return `  [${issue.service}] FORBIDDEN ${issue.key} — must not be propagated to this container (secret/scope leak)`
}

const main = () => {
  const yaml = readFileSync(COMPOSE_PATH, 'utf8')
  const issues = checkComposeEnvParity(yaml)
  if (issues.length === 0) {
    console.log('✓ docker-compose.prod.yml env parity OK')
    return
  }

  console.error('✗ docker-compose.prod.yml env parity FAILED')
  for (const issue of issues) {
    console.error(formatIssue(issue))
  }
  process.exit(1)
}

if (import.meta.main) {
  main()
}
