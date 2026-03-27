import { afterEach, describe, expect, it, vi } from 'vitest'

const { envMock } = vi.hoisted(() => ({
  envMock: {
    VITE_API_BASE_URL: '/api',
    VITE_APP_ORIGIN: 'https://build.example.test',
    VITE_APP_TITLE: 'Finance OS Build',
    VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED: 'true',
    VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS: '300',
    VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED: 'true',
    VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED: 'true',
    VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED: 'true',
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
  const initialSyncCooldownUiEnabled = process.env.VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED
  const initialSyncCooldownUiSeconds = process.env.VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS
  const initialDashboardHealthSignalsEnabled = process.env.VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED
  const initialDashboardHealthGlobalIndicatorEnabled =
    process.env.VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED
  const initialDashboardHealthWidgetBadgesEnabled =
    process.env.VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED

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

    if (typeof initialSyncCooldownUiEnabled === 'undefined') {
      delete process.env.VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED
    } else {
      process.env.VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED = initialSyncCooldownUiEnabled
    }

    if (typeof initialSyncCooldownUiSeconds === 'undefined') {
      delete process.env.VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS
    } else {
      process.env.VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS = initialSyncCooldownUiSeconds
    }

    if (typeof initialDashboardHealthSignalsEnabled === 'undefined') {
      delete process.env.VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED
    } else {
      process.env.VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED = initialDashboardHealthSignalsEnabled
    }

    if (typeof initialDashboardHealthGlobalIndicatorEnabled === 'undefined') {
      delete process.env.VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED
    } else {
      process.env.VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED =
        initialDashboardHealthGlobalIndicatorEnabled
    }

    if (typeof initialDashboardHealthWidgetBadgesEnabled === 'undefined') {
      delete process.env.VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED
    } else {
      process.env.VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED =
        initialDashboardHealthWidgetBadgesEnabled
    }

    vi.unstubAllGlobals()
  })

  it('prefers server runtime env over build-time values during SSR', () => {
    process.env.VITE_APP_TITLE = 'Finance OS Runtime'
    process.env.VITE_APP_ORIGIN = 'https://runtime.example.test'
    process.env.VITE_API_BASE_URL = '/runtime-api'
    process.env.VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED = 'false'
    process.env.VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS = '120'
    process.env.VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED = 'false'
    process.env.VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED = 'true'
    process.env.VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED = 'false'

    expect(getPublicRuntimeEnv()).toEqual({
      VITE_APP_TITLE: 'Finance OS Runtime',
      VITE_APP_ORIGIN: 'https://runtime.example.test',
      VITE_API_BASE_URL: '/runtime-api',
      VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED: 'false',
      VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS: '120',
      VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED: 'false',
      VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED: 'true',
      VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED: 'false',
    })
  })

  it('uses window-injected runtime env in the browser', () => {
    vi.stubGlobal('window', {
      __FINANCE_OS_PUBLIC_RUNTIME_ENV__: {
        VITE_APP_TITLE: 'Finance OS Browser',
        VITE_API_BASE_URL: '/browser-api',
        VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED: 'false',
        VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED: 'false',
      },
    } as Window & typeof globalThis)

    expect(readPublicRuntimeEnv('VITE_APP_TITLE')).toBe('Finance OS Browser')
    expect(readPublicRuntimeEnv('VITE_API_BASE_URL')).toBe('/browser-api')
    expect(readPublicRuntimeEnv('VITE_APP_ORIGIN')).toBe('https://build.example.test')
    expect(readPublicRuntimeEnv('VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED')).toBe('false')
    expect(readPublicRuntimeEnv('VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS')).toBe('300')
    expect(readPublicRuntimeEnv('VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED')).toBe('true')
    expect(readPublicRuntimeEnv('VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED')).toBe('true')
    expect(readPublicRuntimeEnv('VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED')).toBe('false')
  })

  it('serializes only defined public runtime keys for SSR injection', () => {
    delete process.env.VITE_APP_ORIGIN
    delete process.env.VITE_API_BASE_URL
    delete process.env.VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS
    process.env.VITE_APP_TITLE = 'Finance <OS>'
    process.env.VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED = 'false'
    process.env.VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED = 'true'
    process.env.VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED = 'false'
    process.env.VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED = 'true'

    expect(getPublicRuntimeEnvScript()).toBe(
      'window.__FINANCE_OS_PUBLIC_RUNTIME_ENV__={"VITE_APP_TITLE":"Finance \\u003cOS\\u003e","VITE_APP_ORIGIN":"https://build.example.test","VITE_API_BASE_URL":"/api","VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED":"false","VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS":"300","VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED":"true","VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED":"false","VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED":"true"};'
    )
  })
})
