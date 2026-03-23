import { afterEach, describe, expect, it, vi } from 'vitest'

const { envMock } = vi.hoisted(() => ({
  envMock: {
    VITE_API_BASE_URL: '/api',
    VITE_APP_ORIGIN: 'https://build.example.test',
    VITE_APP_TITLE: 'Finance OS Build',
  },
}))

vi.mock('@/env', () => ({
  env: envMock,
}))

import {
  getPublicRuntimeEnv,
  getPublicRuntimeEnvScript,
  readPublicRuntimeEnv,
} from './public-runtime-env'

describe('public runtime env', () => {
  const initialAppTitle = process.env.VITE_APP_TITLE
  const initialAppOrigin = process.env.VITE_APP_ORIGIN
  const initialApiBaseUrl = process.env.VITE_API_BASE_URL

  afterEach(() => {
    if (typeof initialAppTitle === 'undefined') {
      delete process.env.VITE_APP_TITLE
    } else {
      process.env.VITE_APP_TITLE = initialAppTitle
    }

    if (typeof initialAppOrigin === 'undefined') {
      delete process.env.VITE_APP_ORIGIN
    } else {
      process.env.VITE_APP_ORIGIN = initialAppOrigin
    }

    if (typeof initialApiBaseUrl === 'undefined') {
      delete process.env.VITE_API_BASE_URL
    } else {
      process.env.VITE_API_BASE_URL = initialApiBaseUrl
    }

    vi.unstubAllGlobals()
  })

  it('prefers server runtime env over build-time values during SSR', () => {
    process.env.VITE_APP_TITLE = 'Finance OS Runtime'
    process.env.VITE_APP_ORIGIN = 'https://runtime.example.test'
    process.env.VITE_API_BASE_URL = '/runtime-api'

    expect(getPublicRuntimeEnv()).toEqual({
      VITE_APP_TITLE: 'Finance OS Runtime',
      VITE_APP_ORIGIN: 'https://runtime.example.test',
      VITE_API_BASE_URL: '/runtime-api',
    })
  })

  it('uses window-injected runtime env in the browser', () => {
    vi.stubGlobal('window', {
      __FINANCE_OS_PUBLIC_RUNTIME_ENV__: {
        VITE_APP_TITLE: 'Finance OS Browser',
        VITE_API_BASE_URL: '/browser-api',
      },
    } as Window & typeof globalThis)

    expect(readPublicRuntimeEnv('VITE_APP_TITLE')).toBe('Finance OS Browser')
    expect(readPublicRuntimeEnv('VITE_API_BASE_URL')).toBe('/browser-api')
    expect(readPublicRuntimeEnv('VITE_APP_ORIGIN')).toBe('https://build.example.test')
  })

  it('serializes only defined public runtime keys for SSR injection', () => {
    delete process.env.VITE_APP_ORIGIN
    delete process.env.VITE_API_BASE_URL
    process.env.VITE_APP_TITLE = 'Finance <OS>'

    expect(getPublicRuntimeEnvScript()).toBe(
      'window.__FINANCE_OS_PUBLIC_RUNTIME_ENV__={"VITE_APP_TITLE":"Finance \\u003cOS\\u003e","VITE_APP_ORIGIN":"https://build.example.test","VITE_API_BASE_URL":"/api"};'
    )
  })
})
