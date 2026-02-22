export class PowensManualSyncRateLimitError extends Error {
  retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super('Manual sync is rate limited. Please retry later.')
    this.name = 'PowensManualSyncRateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}
