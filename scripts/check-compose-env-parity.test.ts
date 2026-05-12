import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  API_REQUIRED_KEYS,
  checkComposeEnvParity,
  extractServiceEnvKeys,
  FORBIDDEN_KEYS_BY_SERVICE,
  OPS_ALERTS_REQUIRED_KEYS,
  WEB_REQUIRED_KEYS,
  WORKER_REQUIRED_KEYS,
} from './check-compose-env-parity'

const COMPOSE_PATH = resolve(import.meta.dir, '..', 'docker-compose.prod.yml')

describe('docker-compose.prod.yml env parity', () => {
  it('has zero parity issues (no missing or forbidden keys)', () => {
    const yaml = readFileSync(COMPOSE_PATH, 'utf8')
    const issues = checkComposeEnvParity(yaml)
    if (issues.length > 0) {
      const formatted = issues
        .map(issue => `${issue.service}/${issue.kind}/${issue.key}`)
        .join('\n')
      throw new Error(`Compose env parity issues:\n${formatted}`)
    }
    expect(issues).toEqual([])
  })

  it('api block contains every API_REQUIRED_KEYS entry', () => {
    const yaml = readFileSync(COMPOSE_PATH, 'utf8')
    const keys = extractServiceEnvKeys(yaml, 'api')
    const missing = API_REQUIRED_KEYS.filter(key => !keys.has(key))
    expect(missing).toEqual([])
  })

  it('worker block contains every WORKER_REQUIRED_KEYS entry', () => {
    const yaml = readFileSync(COMPOSE_PATH, 'utf8')
    const keys = extractServiceEnvKeys(yaml, 'worker')
    const missing = WORKER_REQUIRED_KEYS.filter(key => !keys.has(key))
    expect(missing).toEqual([])
  })

  it('web block contains every WEB_REQUIRED_KEYS entry', () => {
    const yaml = readFileSync(COMPOSE_PATH, 'utf8')
    const keys = extractServiceEnvKeys(yaml, 'web')
    const missing = WEB_REQUIRED_KEYS.filter(key => !keys.has(key))
    expect(missing).toEqual([])
  })

  it('ops-alerts block contains every OPS_ALERTS_REQUIRED_KEYS entry', () => {
    const yaml = readFileSync(COMPOSE_PATH, 'utf8')
    const keys = extractServiceEnvKeys(yaml, 'ops-alerts')
    const missing = OPS_ALERTS_REQUIRED_KEYS.filter(key => !keys.has(key))
    expect(missing).toEqual([])
  })

  it('web container does NOT receive any backend secret', () => {
    const yaml = readFileSync(COMPOSE_PATH, 'utf8')
    const keys = extractServiceEnvKeys(yaml, 'web')
    const forbiddenLeaked = FORBIDDEN_KEYS_BY_SERVICE.web.filter(key => keys.has(key))
    expect(forbiddenLeaked).toEqual([])
  })

  it('ops-alerts container does NOT receive any backend secret', () => {
    const yaml = readFileSync(COMPOSE_PATH, 'utf8')
    const keys = extractServiceEnvKeys(yaml, 'ops-alerts')
    const forbiddenLeaked = FORBIDDEN_KEYS_BY_SERVICE['ops-alerts'].filter(key => keys.has(key))
    expect(forbiddenLeaked).toEqual([])
  })
})

describe('checkComposeEnvParity (synthetic inputs)', () => {
  it('reports missing keys when an env block is incomplete', () => {
    const yaml = `name: test
services:
  api:
    image: img
    environment:
      NODE_ENV: production
  worker:
    image: img
    environment:
      NODE_ENV: production
  web:
    image: img
    environment:
      VITE_API_BASE_URL: /api
  ops-alerts:
    image: img
    environment:
      ALERTS_ENABLED: "true"
`
    const issues = checkComposeEnvParity(yaml)
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.some(i => i.kind === 'missing' && i.key === 'MARKET_DATA_ENABLED')).toBe(true)
    expect(
      issues.some(i => i.kind === 'missing' && i.key === 'AI_POST_MORTEM_AUTO_RUN_ENABLED')
    ).toBe(true)
  })

  it('reports forbidden keys when a secret leaks into the web container', () => {
    const yaml = `name: test
services:
  api:
    image: img
    environment:
      NODE_ENV: production
  worker:
    image: img
    environment:
      NODE_ENV: production
  web:
    image: img
    environment:
      VITE_API_BASE_URL: /api
      AI_OPENAI_API_KEY: sk-leaked
      AUTH_SESSION_SECRET: secret
  ops-alerts:
    image: img
    environment:
      ALERTS_ENABLED: "true"
`
    const issues = checkComposeEnvParity(yaml)
    expect(
      issues.some(
        i => i.service === 'web' && i.kind === 'forbidden' && i.key === 'AI_OPENAI_API_KEY'
      )
    ).toBe(true)
    expect(
      issues.some(
        i => i.service === 'web' && i.kind === 'forbidden' && i.key === 'AUTH_SESSION_SECRET'
      )
    ).toBe(true)
  })
})
