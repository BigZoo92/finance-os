import { apiFetch, ApiRequestError } from "@/lib/api";
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
} from "./types";

export const fetchPowensStatus = async () => {
  try {
    return await apiFetch<PowensStatusResponse>("/integrations/powens/status");
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

export const fetchPowensConnectUrl = () => {
  return apiFetch<{ url: string }>("/integrations/powens/connect-url");
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

export const postPowensSync = (payload?: { connectionId?: string }) => {
  const init: RequestInit = {
    method: "POST",
  };

  if (payload?.connectionId) {
    init.body = JSON.stringify({
      connectionId: payload.connectionId,
    });
  }

  return apiFetch<{ ok: boolean }>("/integrations/powens/sync", {
    ...init,
  });
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
