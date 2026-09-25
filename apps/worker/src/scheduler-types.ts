/**
 * Narrow injection contracts shared by the worker schedulers. Tests and callers
 * provide plain functions; production passes the platform `fetch`/`setInterval`.
 */
export type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type IntervalScheduler = (
  handler: () => void,
  intervalMs: number
) => ReturnType<typeof setInterval>
