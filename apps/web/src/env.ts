import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

const apiBaseUrlSchema = z
  .string()
  .min(1)
  .refine(value => value.startsWith('/') || z.string().url().safeParse(value).success, {
    message: 'VITE_API_BASE_URL must be an absolute URL or an absolute path (for example /api)',
  })

const createBooleanUiFlagSchema = (key: string) =>
  z
    .string()
    .min(1)
    .refine(
      value => {
        const normalized = value.trim().toLowerCase()
        return (
          normalized === '1' ||
          normalized === '0' ||
          normalized === 'true' ||
          normalized === 'false' ||
          normalized === 'yes' ||
          normalized === 'no' ||
          normalized === 'on' ||
          normalized === 'off'
        )
      },
      {
        message: `${key} must be a boolean-like string (true/false, 1/0, yes/no, on/off)`,
      }
    )

const positiveIntegerStringSchema = z
  .string()
  .min(1)
  .refine(
    value => {
      const parsed = Number(value.trim())
      return Number.isInteger(parsed) && parsed > 0
    },
    {
      message: 'VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS must be a positive integer',
    }
  )

export const env = createEnv({
  server: {
    SERVER_URL: z.string().url().optional(),
  },

  /**
   * The prefix that client-side variables must have. This is enforced both at
   * a type-level and at runtime.
   */
  clientPrefix: 'VITE_',

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
    VITE_APP_ORIGIN: z.string().min(1).optional(),
    VITE_API_BASE_URL: apiBaseUrlSchema.optional(),
    VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED: createBooleanUiFlagSchema(
      'VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED'
    ).optional(),
    VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS: positiveIntegerStringSchema.optional(),
    VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED: createBooleanUiFlagSchema(
      'VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED'
    ).optional(),
    VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED: createBooleanUiFlagSchema(
      'VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED'
    ).optional(),
    VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED: createBooleanUiFlagSchema(
      'VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED'
    ).optional(),
    VITE_UI_RECONNECT_BANNER_ENABLED: createBooleanUiFlagSchema(
      'VITE_UI_RECONNECT_BANNER_ENABLED'
    ).optional(),
  },

  /**
   * What object holds the environment variables at runtime. This is usually
   * `process.env` or `import.meta.env`.
   */
  runtimeEnv: import.meta.env,

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,
})
