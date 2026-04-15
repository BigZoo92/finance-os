type SchedulerLogger = (event: {
  level: 'info' | 'warn' | 'error'
  msg: string
  [key: string]: unknown
}) => void

export const startPowensAutoSyncScheduler = ({
  externalIntegrationsSafeMode,
  autoSyncEnabled,
  intervalMs,
  trigger,
  log,
  setIntervalFn = setInterval,
}: {
  externalIntegrationsSafeMode: boolean
  autoSyncEnabled: boolean
  intervalMs: number
  trigger: () => Promise<unknown>
  log: SchedulerLogger
  setIntervalFn?: typeof setInterval
}) => {
  if (externalIntegrationsSafeMode) {
    log({
      level: 'warn',
      msg: 'worker scheduler disabled',
      reason: 'EXTERNAL_INTEGRATIONS_SAFE_MODE=true',
    })
    return null
  }

  if (!autoSyncEnabled) {
    log({
      level: 'warn',
      msg: 'worker scheduler disabled',
      reason: 'WORKER_AUTO_SYNC_ENABLED=false',
    })
    return null
  }

  const timer = setIntervalFn(() => {
    void trigger()
  }, intervalMs)

  log({
    level: 'info',
    msg: 'worker scheduler started',
    schedulerIntervalMs: intervalMs,
  })

  return timer
}
