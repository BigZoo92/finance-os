import { apiFetch, ApiRequestError } from "@/lib/api";
import { createPowensRequestId } from "./reconnect-banner";
import {
  getDemoPowensAuditTrail,
  getDemoPowensStatus,
  getDemoPowensSyncRuns,
} from "../demo-data";
import type {
  PowensAuditTrailResponse,
  PowensStatusResponse,
  PowensSyncBacklogResponse,
  PowensSyncRunsResponse,
  PowensDiagnosticsResponse,
  PowensDisconnectResponse,
} from "./types";

export const fetchPowensStatus = async () => {
  const requestId = createPowensRequestId("status");

  try {
    return await apiFetch<PowensStatusResponse>("/integrations/powens/status", {
      headers: {
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (
        error.status === "network_error" ||
        error.status === 401 ||
        error.status === 403 ||
        error.status === 404 ||
        error.status >= 500
      ) {
        return getDemoPowensStatus();
      }
    }

    return getDemoPowensStatus();
  }
};

export const fetchPowensConnectUrl = ({ requestId }: { requestId?: string } = {}) => {
  const resolvedRequestId = requestId ?? createPowensRequestId("reconnect");

  return apiFetch<{ url: string }>("/integrations/powens/connect-url", {
    headers: {
      "x-request-id": resolvedRequestId,
    },
  });
};

export const postPowensCallback = (payload: {
  connectionId: string;
  code: string;
  state?: string;
}) => {
  return apiFetch<{ ok: boolean }>("/integrations/powens/callback", {
    method: "POST",
    body: JSON.stringify({
      connection_id: payload.connectionId,
      code: payload.code,
      ...(payload.state ? { state: payload.state } : {}),
    }),
  });
};

export const postPowensSync = (payload?: { connectionId?: string; fullResync?: boolean }) => {
  const init: RequestInit = {
    method: "POST",
  };

  if (payload?.connectionId || payload?.fullResync === true) {
    init.body = JSON.stringify({
      ...(payload?.connectionId ? { connectionId: payload.connectionId } : {}),
      ...(payload?.fullResync === true ? { fullResync: true } : {}),
    });
  }

  return apiFetch<{ ok: boolean }>("/integrations/powens/sync", {
    ...init,
  });
};

export const deletePowensConnection = (connectionId: string) => {
  return apiFetch<PowensDisconnectResponse>(
    `/integrations/powens/connections/${encodeURIComponent(connectionId)}`,
    {
      method: "DELETE",
    },
  );
};

export const fetchPowensSyncRuns = async () => {
  try {
    return await apiFetch<PowensSyncRunsResponse>(
      "/integrations/powens/sync-runs",
    );
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (
        error.status === "network_error" ||
        error.status === 401 ||
        error.status === 403 ||
        error.status === 404 ||
        error.status >= 500
      ) {
        return getDemoPowensSyncRuns();
      }
    }

    return getDemoPowensSyncRuns();
  }
};

export const fetchPowensSyncBacklog = async () => {
  try {
    return await apiFetch<PowensSyncBacklogResponse>(
      "/integrations/powens/backlog",
    );
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (
        error.status === "network_error" ||
        error.status === 401 ||
        error.status === 403 ||
        error.status === 404 ||
        error.status >= 500
      ) {
        return { syncBacklogCount: 0 };
      }
    }

    return { syncBacklogCount: 0 };
  }
};

export const fetchPowensAuditTrail = async () => {
  try {
    return await apiFetch<PowensAuditTrailResponse>(
      "/integrations/powens/audit-trail?limit=20",
    );
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (
        error.status === "network_error" ||
        error.status === 401 ||
        error.status === 403 ||
        error.status === 404 ||
        error.status >= 500
      ) {
        return getDemoPowensAuditTrail();
      }
    }

    return getDemoPowensAuditTrail();
  }
};

export const fetchPowensDiagnostics = async () => {
  try {
    return await apiFetch<PowensDiagnosticsResponse>("/integrations/powens/diagnostics");
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.status === "network_error") {
        return {
          enabled: true,
          mode: "admin",
          provider: "powens",
          outcome: "timeout",
          issueType: "timeout",
          guidance: "Network timeout while contacting provider. Retry is safe.",
          retryable: true,
          lastCheckedAt: new Date().toISOString(),
        } satisfies PowensDiagnosticsResponse;
      }

      if (error.status === 401 || error.status === 403) {
        return {
          enabled: true,
          mode: "admin",
          provider: "powens",
          outcome: "auth_error",
          issueType: "auth",
          guidance: "Provider credentials need admin attention. Reconnect the institution.",
          retryable: false,
          lastCheckedAt: new Date().toISOString(),
        } satisfies PowensDiagnosticsResponse;
      }
    }

    return {
      enabled: true,
      mode: "admin",
      provider: "powens",
      outcome: "provider_error",
      issueType: "provider",
      guidance: "Provider diagnostics failed unexpectedly. Dashboard remains usable.",
      retryable: true,
      lastCheckedAt: new Date().toISOString(),
    } satisfies PowensDiagnosticsResponse;
  }
};
