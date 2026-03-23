import { getGlobalStartContext } from "@tanstack/react-start";
import { env } from "@/env";
import { logSsrApiCall } from "@/lib/ssr-logger";

type ApiUrlOptions = {
  requestOrigin?: string;
};

type ApiBaseUrlSource = "client" | "internal" | "origin_fallback";

type ApiBaseUrlResolution = {
  baseUrl: string;
  source: ApiBaseUrlSource;
};

type SsrRequestContext = {
  requestOrigin?: string;
  requestCookieHeader?: string | null;
  requestId?: string;
};

type ApiRequestErrorStatus = number | "network_error";

type ApiRequestResult<TResponse> =
  | {
      ok: true;
      data: TResponse;
      response: Response;
      url: string;
    }
  | {
      ok: false;
      error: ApiRequestError;
      response?: Response;
      url: string;
    };

type ApiErrorPayload = {
  message?: string;
  code?: string;
  requestId?: string;
  details?: unknown;
};

type ParsedApiErrorPayload = {
  payload: ApiErrorPayload;
  bodyPreview?: string;
};

export class ApiRequestError extends Error {
  readonly status: ApiRequestErrorStatus;
  readonly url: string;
  readonly path: string;
  readonly code: string | undefined;
  readonly requestId: string | undefined;
  readonly details?: unknown;
  readonly bodyPreview: string | undefined;
  readonly hint: string | undefined;

  constructor({
    message,
    status,
    url,
    path,
    code,
    requestId,
    details,
    bodyPreview,
    hint,
  }: {
    message: string;
    status: ApiRequestErrorStatus;
    url: string;
    path: string;
    code?: string;
    requestId?: string;
    details?: unknown;
    bodyPreview?: string;
    hint?: string;
  }) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.url = url;
    this.path = path;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
    this.bodyPreview = bodyPreview;
    this.hint = hint;
  }
}

const toOptionalEnv = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const withDefined = <TKey extends string, TValue>(
  key: TKey,
  value: TValue | undefined,
) => {
  if (value === undefined) {
    return {};
  }

  return {
    [key]: value,
  } as { [K in TKey]?: TValue };
};

const readServerRuntimeEnv = (key: string) => {
  if (typeof process === "undefined") {
    return undefined;
  }

  return toOptionalEnv(process.env?.[key]);
};

const getSsrRequestContext = (): SsrRequestContext | null => {
  if (typeof window !== "undefined") {
    return null;
  }

  try {
    return (getGlobalStartContext() as SsrRequestContext | undefined) ?? null;
  } catch {
    return null;
  }
};

const getClientApiBaseUrl = () => env.VITE_API_BASE_URL ?? "/api";

const resolveApiBaseUrl = (options?: ApiUrlOptions): ApiBaseUrlResolution => {
  const clientBaseUrl = getClientApiBaseUrl();
  if (typeof window !== "undefined") {
    return {
      baseUrl: clientBaseUrl,
      source: "client",
    };
  }

  const internalApiUrl = readServerRuntimeEnv("API_INTERNAL_URL");
  if (internalApiUrl) {
    return {
      baseUrl: internalApiUrl,
      source: "internal",
    };
  }

  if (!clientBaseUrl.startsWith("/")) {
    return {
      baseUrl: clientBaseUrl,
      source: "origin_fallback",
    };
  }

  const appOrigin =
    readServerRuntimeEnv("VITE_APP_ORIGIN") ??
    toOptionalEnv(env.VITE_APP_ORIGIN) ??
    toOptionalEnv(options?.requestOrigin);

  if (!appOrigin) {
    throw new Error(
      "Unable to resolve server API URL: set API_INTERNAL_URL or VITE_APP_ORIGIN for SSR runtime.",
    );
  }

  return {
    baseUrl: new URL(
      toAbsolutePathPrefix(clientBaseUrl),
      `${appOrigin.replace(/\/+$/, "")}/`,
    ).toString(),
    source: "origin_fallback",
  };
};

export const getApiBaseUrl = (options?: ApiUrlOptions) => {
  return resolveApiBaseUrl(options).baseUrl;
};

const toAbsolutePathPrefix = (value: string) => {
  const normalized = value.startsWith("/") ? value : `/${value}`;
  return normalized.endsWith("/") && normalized.length > 1
    ? normalized.slice(0, -1)
    : normalized;
};

//CODEX DON'T TOUCH THIS FUNCTION
export const toApiUrl = (path: string, options?: ApiUrlOptions) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getApiBaseUrl(options);

  if (baseUrl.startsWith("/")) {
    return `${toAbsolutePathPrefix(baseUrl)}${normalizedPath}`;
  }

  const normalizedRelativePath = normalizedPath.replace(/^\/+/, "");
  return new URL(
    normalizedRelativePath,
    `${baseUrl.replace(/\/+$/, "")}/`,
  ).toString();
};

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
};

const toApiErrorPayload = async (
  response: Response,
): Promise<ParsedApiErrorPayload> => {
  try {
    const rawText = await response.text();
    const trimmed = rawText.trim();
    if (!trimmed) {
      return { payload: {} };
    }

    try {
      return {
        payload: JSON.parse(trimmed) as ApiErrorPayload,
        bodyPreview: truncate(trimmed, 300),
      };
    } catch {
      return {
        payload: {},
        bodyPreview: truncate(trimmed, 300),
      };
    }
  } catch {
    return { payload: {} };
  }
};

const resolveMethod = (init?: RequestInit) => {
  return (init?.method ?? "GET").toUpperCase();
};

const toHintFromStatus = ({
  status,
  code,
}: {
  status: ApiRequestErrorStatus;
  code?: string;
}) => {
  if (status === "network_error") {
    return "network_unreachable";
  }

  if (status === 404) {
    if (code === "ROUTE_NOT_FOUND") {
      return "route_missing_or_wrong_base_path";
    }

    return "route_not_found";
  }

  if (status === 401 || status === 403) {
    return "unauthorized_or_missing_session";
  }

  if (typeof status === "number" && status >= 500) {
    return "api_internal_error";
  }

  return undefined;
};

const resolveServerInternalToken = () => {
  return (
    readServerRuntimeEnv("PRIVATE_ACCESS_TOKEN") ??
    readServerRuntimeEnv("API_INTERNAL_TOKEN")
  );
};

const createRequestHeaders = ({
  init,
  requestContext,
}: {
  init?: RequestInit;
  requestContext: SsrRequestContext | null;
}) => {
  const headers = new Headers(init?.headers);
  let cookiesForwarded = false;
  let internalTokenForwarded = false;

  headers.set("Accept", "application/json");

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!requestContext) {
    return {
      headers,
      cookiesForwarded,
      internalTokenForwarded,
    };
  }

  if (requestContext.requestCookieHeader && !headers.has("Cookie")) {
    headers.set("Cookie", requestContext.requestCookieHeader);
    cookiesForwarded = true;
  }

  if (requestContext.requestId && !headers.has("x-request-id")) {
    headers.set("x-request-id", requestContext.requestId);
  }

  const internalToken = resolveServerInternalToken();
  if (internalToken) {
    headers.set("x-internal-token", internalToken);
    internalTokenForwarded = true;
  }

  return {
    headers,
    cookiesForwarded,
    internalTokenForwarded,
  };
};

export const apiRequest = async <TResponse>(
  path: string,
  init?: RequestInit,
): Promise<ApiRequestResult<TResponse>> => {
  const requestContext = getSsrRequestContext();
  const method = resolveMethod(init);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseResolution = resolveApiBaseUrl(
    requestContext?.requestOrigin
      ? {
          requestOrigin: requestContext.requestOrigin,
        }
      : undefined,
  );
  const fallbackPath = normalizedPath.startsWith("/api/")
    ? normalizedPath.slice(4) || "/"
    : `/api${normalizedPath}`;
  const candidatePaths =
    requestContext && fallbackPath !== normalizedPath
      ? [normalizedPath, fallbackPath]
      : [normalizedPath];

  const requestHeaders = createRequestHeaders({
    requestContext,
    ...withDefined("init", init),
  });
  let lastErrorResult: ApiRequestResult<TResponse> | null = null;

  for (const [index, candidatePath] of candidatePaths.entries()) {
    const url = toApiUrl(
      candidatePath,
      requestContext?.requestOrigin
        ? {
            requestOrigin: requestContext.requestOrigin,
          }
        : undefined,
    );

    let response: Response;
    try {
      response = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        ...init,
        headers: requestHeaders.headers,
      });
    } catch (error) {
      const apiError = new ApiRequestError({
        message:
          error instanceof Error ? error.message : "Network request failed",
        status: "network_error",
        url,
        path: candidatePath,
        ...withDefined("requestId", requestContext?.requestId),
        ...withDefined(
          "hint",
          toHintFromStatus({
            status: "network_error",
          }),
        ),
      });

      logSsrApiCall({
        method,
        path: candidatePath,
        url,
        baseUrl: baseResolution.baseUrl,
        baseUrlSource: baseResolution.source,
        cookiesForwarded: requestHeaders.cookiesForwarded,
        internalTokenForwarded: requestHeaders.internalTokenForwarded,
        status: "network_error",
        ...withDefined("requestId", requestContext?.requestId),
        ...withDefined("code", apiError.code),
        ...withDefined("hint", apiError.hint),
      });

      return {
        ok: false,
        error: apiError,
        url,
      };
    }

    if (!response.ok) {
      const parsed = await toApiErrorPayload(response);
      const payload = parsed.payload;
      const message =
        typeof payload.message === "string" && payload.message.length > 0
          ? payload.message
          : `HTTP ${response.status}`;
      const hint = toHintFromStatus({
        status: response.status,
        ...withDefined("code", payload.code),
      });
      const apiError = new ApiRequestError({
        message,
        status: response.status,
        url,
        path: candidatePath,
        ...withDefined("code", payload.code),
        ...withDefined(
          "requestId",
          payload.requestId ?? requestContext?.requestId,
        ),
        details: payload.details,
        ...withDefined("bodyPreview", parsed.bodyPreview),
        ...withDefined("hint", hint),
      });

      logSsrApiCall({
        method,
        path: candidatePath,
        url,
        baseUrl: baseResolution.baseUrl,
        baseUrlSource: baseResolution.source,
        cookiesForwarded: requestHeaders.cookiesForwarded,
        internalTokenForwarded: requestHeaders.internalTokenForwarded,
        status: response.status,
        ...withDefined("requestId", apiError.requestId),
        ...withDefined("code", apiError.code),
        ...withDefined("bodyPreview", apiError.bodyPreview),
        ...withDefined("hint", apiError.hint),
      });

      const isFirstCandidate = index === 0;
      const canRetryForPrefix =
        isFirstCandidate &&
        response.status === 404 &&
        candidatePaths.length > 1;
      if (canRetryForPrefix) {
        lastErrorResult = {
          ok: false,
          error: apiError,
          response,
          url,
        };
        continue;
      }

      return {
        ok: false,
        error: apiError,
        response,
        url,
      };
    }

    logSsrApiCall({
      method,
      path: candidatePath,
      url,
      baseUrl: baseResolution.baseUrl,
      baseUrlSource: baseResolution.source,
      cookiesForwarded: requestHeaders.cookiesForwarded,
      internalTokenForwarded: requestHeaders.internalTokenForwarded,
      status: response.status,
      ...withDefined(
        "requestId",
        response.headers.get("x-request-id") ?? requestContext?.requestId,
      ),
    });

    try {
      return {
        ok: true,
        data: (await response.json()) as TResponse,
        response,
        url,
      };
    } catch {
      const apiError = new ApiRequestError({
        message: `Invalid JSON response from ${url}`,
        status: response.status,
        url,
        path: candidatePath,
        ...withDefined(
          "requestId",
          response.headers.get("x-request-id") ?? requestContext?.requestId,
        ),
        hint: "invalid_json_response",
      });

      return {
        ok: false,
        error: apiError,
        response,
        url,
      };
    }
  }

  if (lastErrorResult) {
    return lastErrorResult;
  }

  const fallbackUrl = toApiUrl(
    path,
    requestContext?.requestOrigin
      ? {
          requestOrigin: requestContext.requestOrigin,
        }
      : undefined,
  );
  return {
    ok: false,
    error: new ApiRequestError({
      message: `HTTP 404`,
      status: 404,
      url: fallbackUrl,
      path,
      hint: "route_not_found",
    }),
    url: fallbackUrl,
  };
};

export const apiFetch = async <TResponse>(path: string, init?: RequestInit) => {
  const result = await apiRequest<TResponse>(path, init);
  if (!result.ok) {
    throw result.error;
  }

  return result.data;
};
