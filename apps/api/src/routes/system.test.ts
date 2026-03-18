import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { registerSystemRoutes } from './system'

const initialEnv = {
  NODE_ENV: process.env.NODE_ENV,
  GIT_SHA: process.env.GIT_SHA,
  GIT_TAG: process.env.GIT_TAG,
  BUILD_TIME: process.env.BUILD_TIME,
  APP_COMMIT_SHA: process.env.APP_COMMIT_SHA,
  APP_VERSION: process.env.APP_VERSION,
}

const createApp = () =>
  registerSystemRoutes(new Elysia(), {
    NODE_ENV: process.env.NODE_ENV ?? 'test',
    APP_COMMIT_SHA: process.env.APP_COMMIT_SHA,
    APP_VERSION: process.env.APP_VERSION,
  })

describe('registerSystemRoutes', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    process.env.GIT_SHA = 'git-sha-123'
    process.env.GIT_TAG = 'v1.2.3'
    process.env.BUILD_TIME = '2026-03-18T00:00:00.000Z'
    delete process.env.APP_COMMIT_SHA
    delete process.env.APP_VERSION
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(initialEnv)) {
      if (typeof value === 'undefined') {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it('returns the shared health payload', async () => {
    const response = await createApp().handle(new Request('http://finance-os.local/health'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      service: 'api',
    })
  })

  it('returns the shared version payload with no-store caching', async () => {
    const response = await createApp().handle(new Request('http://finance-os.local/version'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      service: 'api',
      GIT_SHA: 'git-sha-123',
      GIT_TAG: 'v1.2.3',
      BUILD_TIME: '2026-03-18T00:00:00.000Z',
      NODE_ENV: 'test',
    })
  })
})
