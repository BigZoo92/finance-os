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
    VITE_UI_RECONNECT_BANNER_ENABLED: 'true',
    VITE_PWA_NOTIFICATIONS_ENABLED: 'true',
    VITE_PWA_CRITICAL_ENABLED: 'true',
    VITE_AI_ADVISOR_ENABLED: 'true',
    VITE_AI_ADVISOR_ADMIN_ONLY: 'false',
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
  const initialReconnectBannerEnabled = process.env.VITE_UI_RECONNECT_BANNER_ENABLED
  const initialPwaNotificationsEnabled = process.env.VITE_PWA_NOTIFICATIONS_ENABLED
  const initialPwaCriticalEnabled = process.env.VITE_PWA_CRITICAL_ENABLED
  const initialAiAdvisorEnabled = process.env.VITE_AI_ADVISOR_ENABLED
  const initialAiAdvisorAdminOnly = process.env.VITE_AI_ADVISOR_ADMIN_ONLY

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

    if (typeof initialReconnectBannerEnabled === 'undefined') {
      delete process.env.VITE_UI_RECONNECT_BANNER_ENABLED
    } else {
      process.env.VITE_UI_RECONNECT_BANNER_ENABLED = initialReconnectBannerEnabled
    }

    if (typeof initialPwaNotificationsEnabled === 'undefined') {
      delete process.env.VITE_PWA_NOTIFICATIONS_ENABLED
    } else {
      process.env.VITE_PWA_NOTIFICATIONS_ENABLED = initialPwaNotificationsEnabled
    }

    if (typeof initialPwaCriticalEnabled === 'undefined') {
      delete process.env.VITE_PWA_CRITICAL_ENABLED
    } else {
      process.env.VITE_PWA_CRITICAL_ENABLED = initialPwaCriticalEnabled
    }

    if (typeof initialAiAdvisorEnabled === 'undefined') {
      delete process.env.VITE_AI_ADVISOR_ENABLED
    } else {
      process.env.VITE_AI_ADVISOR_ENABLED = initialAiAdvisorEnabled
    }

    if (typeof initialAiAdvisorAdminOnly === 'undefined') {
      delete process.env.VITE_AI_ADVISOR_ADMIN_ONLY
    } else {
      process.env.VITE_AI_ADVISOR_ADMIN_ONLY = initialAiAdvisorAdminOnly
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
    process.env.VITE_UI_RECONNECT_BANNER_ENABLED = 'false'
    process.env.VITE_PWA_NOTIFICATIONS_ENABLED = 'true'
    process.env.VITE_PWA_CRITICAL_ENABLED = 'true'
    process.env.VITE_AI_ADVISOR_ENABLED = 'true'
    process.env.VITE_AI_ADVISOR_ADMIN_ONLY = 'false'

    expect(getPublicRuntimeEnv()).toEqual({
      VITE_APP_TITLE: 'Finance OS Runtime',
      VITE_APP_ORIGIN: 'https://runtime.example.test',
      VITE_API_BASE_URL: '/runtime-api',
      VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED: 'false',
      VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS: '120',
      VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED: 'false',
      VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED: 'true',
      VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED: 'false',
      VITE_UI_RECONNECT_BANNER_ENABLED: 'false',
      VITE_PWA_NOTIFICATIONS_ENABLED: 'true',
      VITE_PWA_CRITICAL_ENABLED: 'true',
      VITE_AI_ADVISOR_ENABLED: 'true',
      VITE_AI_ADVISOR_ADMIN_ONLY: 'false',
    })
  })

  it('uses window-injected runtime env in the browser', () => {
    vi.stubGlobal('window', {
      __FINANCE_OS_PUBLIC_RUNTIME_ENV__: {
        VITE_APP_TITLE: 'Finance OS Browser',
        VITE_API_BASE_URL: '/browser-api',
        VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED: 'false',
        VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED: 'false',
        VITE_UI_RECONNECT_BANNER_ENABLED: 'false',
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
    expect(readPublicRuntimeEnv('VITE_UI_RECONNECT_BANNER_ENABLED')).toBe('false')
    expect(readPublicRuntimeEnv('VITE_PWA_NOTIFICATIONS_ENABLED')).toBe('true')
    expect(readPublicRuntimeEnv('VITE_PWA_CRITICAL_ENABLED')).toBe('true')
    expect(readPublicRuntimeEnv('VITE_AI_ADVISOR_ENABLED')).toBe('true')
    expect(readPublicRuntimeEnv('VITE_AI_ADVISOR_ADMIN_ONLY')).toBe('false')
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
    process.env.VITE_UI_RECONNECT_BANNER_ENABLED = 'false'

    const script = getPublicRuntimeEnvScript()
    const prefix = 'window.__FINANCE_OS_PUBLIC_RUNTIME_ENV__='

    expect(script.startsWith(prefix)).toBe(true)
    expect(script.endsWith(';')).toBe(true)
    expect(script).toContain('Finance \\u003cOS\\u003e')
    expect(script).not.toContain('Finance <OS>')
    expect(JSON.parse(script.slice(prefix.length, -1))).toEqual({
      VITE_APP_TITLE: 'Finance <OS>',
      VITE_APP_ORIGIN: 'https://build.example.test',
      VITE_API_BASE_URL: '/api',
      VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED: 'false',
      VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS: '300',
      VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED: 'true',
      VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED: 'false',
      VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED: 'true',
      VITE_UI_RECONNECT_BANNER_ENABLED: 'false',
      VITE_PWA_NOTIFICATIONS_ENABLED: 'true',
      VITE_PWA_CRITICAL_ENABLED: 'true',
      VITE_AI_ADVISOR_ENABLED: 'true',
      VITE_AI_ADVISOR_ADMIN_ONLY: 'false',
    })
  })
})
