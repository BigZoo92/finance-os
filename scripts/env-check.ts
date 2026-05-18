#!/usr/bin/env bun
/**
 * Env check CLI — evaluates the current `process.env` against the
 * single-source-of-truth diagnostics in `packages/env/src/diagnostics.ts`.
 *
 * Usage:
 *
 *   pnpm env:check
 *     → check current shell env (typically .env at repo root).
 *
 *   pnpm env:check:prod
 *     → load .env.production.local (if present) then check.
 *
 *   bun scripts/env-check.ts --service=api,worker,web,knowledge-service,quant-service
 *     → narrow to a subset of services.
 *
 *   bun scripts/env-check.ts --compose
 *     → ALSO read docker-compose.prod.yml and validate that each service's
 *       `environment:` block declares every required key.
 *
 *   bun scripts/env-check.ts --json
 *     → emit a machine-readable JSON report (no colors, no exit code rules
 *       changes — same behavior).
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  diagnoseServiceEnv,
  REQUIRED_KEYS_BY_SERVICE,
  isPlaceholderValue,
  type EnvIssue,
  type ServiceDiagnostics,
  type ServiceName,
} from '../packages/env/src/diagnostics'
import { checkComposeEnvParity } from './check-compose-env-parity'

type Args = {
  services: ServiceName[]
  json: boolean
  compose: boolean
  envFile: string | null
}

const ALL_SERVICES: ServiceName[] = [
  'api',
  'worker',
  'web',
  'knowledge-service',
  'quant-service',
  'ops-alerts',
]

const parseArgs = (argv: string[]): Args => {
  let services: ServiceName[] = ALL_SERVICES
  let json = false
  let compose = false
  let envFile: string | null = null

  for (const arg of argv.slice(2)) {
    if (arg === '--json') {
      json = true
    } else if (arg === '--compose') {
      compose = true
    } else if (arg.startsWith('--service=')) {
      services = arg
        .slice('--service='.length)
        .split(',')
        .filter((v): v is ServiceName => ALL_SERVICES.includes(v as ServiceName))
    } else if (arg.startsWith('--env-file=')) {
      envFile = arg.slice('--env-file='.length)
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: bun scripts/env-check.ts [--service=api,worker,...] [--compose] [--json] [--env-file=path]'
      )
      process.exit(0)
    }
  }

  return { services, json, compose, envFile }
}

const maybeLoadEnvFile = (path: string | null) => {
  if (!path) return
  const resolved = resolve(path)
  if (!existsSync(resolved)) {
    console.error(`env-check: --env-file ${resolved} not found`)
    process.exit(2)
  }
  const content = readFileSync(resolved, 'utf8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
}

const formatIssue = (issue: EnvIssue): string => {
  const color =
    issue.level === 'error' ? COLORS.red : issue.level === 'warning' ? COLORS.yellow : COLORS.blue
  const tag = issue.level.toUpperCase().padEnd(7)
  return `  ${color}${tag}${COLORS.reset} [${issue.service}] ${issue.envName} — ${issue.message}${
    issue.remediation ? `\n          ${COLORS.dim}→ ${issue.remediation}${COLORS.reset}` : ''
  }`
}

const renderServiceReport = (report: ServiceDiagnostics): string => {
  const lines: string[] = []
  lines.push(`\n${COLORS.bold}== ${report.service} ==${COLORS.reset}`)

  if (report.features.length === 0) {
    lines.push(`  ${COLORS.dim}(no feature contracts owned by this service)${COLORS.reset}`)
  }

  for (const feature of report.features) {
    const status = feature.canRun
      ? `${COLORS.green}OK${COLORS.reset}`
      : feature.enabled
        ? `${COLORS.red}BLOCKED${COLORS.reset}`
        : `${COLORS.dim}disabled${COLORS.reset}`
    lines.push(
      `  ${status.padEnd(20)} ${feature.feature} (${feature.flagKey}=${feature.enabled})`
    )
    if (feature.reasonIfBlocked) {
      lines.push(`      ${COLORS.dim}↳ ${feature.reasonIfBlocked}${COLORS.reset}`)
    }
    if (feature.missingOptionalSecrets.length > 0) {
      lines.push(
        `      ${COLORS.yellow}optional missing: ${feature.missingOptionalSecrets.join(', ')}${COLORS.reset}`
      )
    }
  }

  if (report.issues.length > 0) {
    lines.push('')
    for (const issue of report.issues) {
      lines.push(formatIssue(issue))
    }
  }

  return lines.join('\n')
}

const checkRawRequiredKeys = (
  service: ServiceName,
  env: Record<string, string | undefined>
): EnvIssue[] => {
  const issues: EnvIssue[] = []
  const required = REQUIRED_KEYS_BY_SERVICE[service]
  for (const key of required) {
    const value = env[key]
    // We don't flag missing here — the parity check covers that. We only
    // flag placeholder values present in the current process env.
    if (value !== undefined && isPlaceholderValue(value)) {
      issues.push({
        level: 'error',
        service,
        code: 'PLACEHOLDER_VALUE',
        envName: key,
        message: `${key} contains a placeholder value ("${value.slice(0, 32)}…").`,
        remediation: `Replace ${key} with the real value.`,
      })
    }
  }
  // Forbidden-leak checks at the CLI level are intentionally skipped:
  // the local dev `.env` always contains every secret (that's how dev works),
  // so the leak detector would fire on every service that isn't `api`. The
  // ground truth for "which secret lives on which container" is
  // `docker-compose.prod.yml`; `pnpm env:check:compose` (or
  // `pnpm env:check:parity`) checks that via the compose-parity script.
  // Runtime `/ops/env/diagnostics` still runs forbidden checks because there
  // the process.env IS the actual service container env.
  return issues
}

const main = () => {
  const args = parseArgs(process.argv)
  maybeLoadEnvFile(args.envFile)

  const env = process.env as Record<string, string | undefined>

  const reports = args.services.map(service => {
    // CLI runs against the developer's local .env which contains every secret
    // by design — only the docker-compose YAML can tell us what each service
    // container actually receives. Skip forbidden-leak checks here; the
    // compose-parity script (`pnpm env:check:parity`) handles that path.
    const base = diagnoseServiceEnv(service, env, { checkForbiddenLeaks: false })
    const extraIssues = checkRawRequiredKeys(service, env)
    return {
      ...base,
      issues: [...base.issues, ...extraIssues],
    }
  })

  let composeIssues: ReturnType<typeof checkComposeEnvParity> = []
  if (args.compose) {
    const composePath = resolve(import.meta.dir, '..', 'docker-compose.prod.yml')
    if (existsSync(composePath)) {
      const yaml = readFileSync(composePath, 'utf8')
      composeIssues = checkComposeEnvParity(yaml)
    } else {
      console.error('env-check: docker-compose.prod.yml not found, skipping compose parity')
    }
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          services: reports,
          composeIssues,
          ok:
            reports.every(r => r.issues.every(i => i.level !== 'error')) &&
            composeIssues.length === 0,
        },
        null,
        2
      )
    )
    const hasError =
      reports.some(r => r.issues.some(i => i.level === 'error')) || composeIssues.length > 0
    process.exit(hasError ? 1 : 0)
  }

  let errorCount = 0
  let warningCount = 0
  for (const report of reports) {
    process.stdout.write(renderServiceReport(report))
    process.stdout.write('\n')
    for (const issue of report.issues) {
      if (issue.level === 'error') errorCount++
      if (issue.level === 'warning') warningCount++
    }
  }

  if (composeIssues.length > 0) {
    console.log(`\n${COLORS.bold}== docker-compose.prod.yml parity ==${COLORS.reset}`)
    for (const issue of composeIssues) {
      console.log(
        `  ${COLORS.red}${issue.kind.toUpperCase()}${COLORS.reset} [${issue.service}] ${issue.key}`
      )
    }
    errorCount += composeIssues.length
  } else if (args.compose) {
    console.log(`\n${COLORS.green}✓ docker-compose.prod.yml env parity OK${COLORS.reset}`)
  }

  console.log(
    `\n${COLORS.bold}Summary:${COLORS.reset} ${errorCount} error(s), ${warningCount} warning(s)`
  )

  process.exit(errorCount > 0 ? 1 : 0)
}

if (import.meta.main) {
  main()
}
