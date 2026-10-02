/**
 * Shared-secret authentication for calls from the API to the internal Python services
 * (knowledge-service, quant-service). `INTERNAL_SERVICE_TOKEN` is server-only: it is
 * threaded through runtime config objects, sent as a request header, and never logged.
 */
export const INTERNAL_SERVICE_TOKEN_HEADER = 'x-internal-service-token'

/** Header fragment to spread into an internal-service fetch; empty when no token is configured. */
export const internalServiceHeaders = (token: string | undefined): Record<string, string> =>
  token ? { [INTERNAL_SERVICE_TOKEN_HEADER]: token } : {}
