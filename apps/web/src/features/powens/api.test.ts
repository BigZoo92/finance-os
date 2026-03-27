import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/lib/api";

const apiFetchMock = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");

  return {
    ...actual,
    apiFetch: (...args: Parameters<typeof actual.apiFetch>) => apiFetchMock(...args),
  };
});

import {
  fetchPowensAuditTrail,
  postPowensSync,
  fetchPowensStatus,
  fetchPowensSyncBacklog,
  fetchPowensSyncRuns,
} from "./api";
import {
  getDemoPowensAuditTrail,
  getDemoPowensStatus,
  getDemoPowensSyncRuns,
} from "../demo-data";
import { powensStatusQueryOptionsWithMode } from "./query-options";

describe("powens API fallbacks", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("returns deterministic demo Powens status when the status endpoint is unavailable", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiRequestError({
        message: "Route not found",
        status: 404,
        code: "ROUTE_NOT_FOUND",
        url: "http://api:3001/integrations/powens/status",
        path: "/integrations/powens/status",
      }),
    );

    await expect(fetchPowensStatus()).resolves.toEqual(getDemoPowensStatus());
  });

  it("returns deterministic demo sync runs when Powens sync history is unavailable", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiRequestError({
        message: "Powens provider timeout",
        status: 503,
        url: "http://api:3001/integrations/powens/sync-runs",
        path: "/integrations/powens/sync-runs",
      }),
    );

    await expect(fetchPowensSyncRuns()).resolves.toEqual(
      getDemoPowensSyncRuns(),
    );
  });

  it("returns a safe zero backlog when the backlog endpoint is unavailable", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiRequestError({
        message: "connect ECONNREFUSED",
        status: "network_error",
        url: "http://api:3001/integrations/powens/backlog",
        path: "/integrations/powens/backlog",
      }),
    );

    await expect(fetchPowensSyncBacklog()).resolves.toEqual({
      syncBacklogCount: 0,
    });
  });

  it("returns deterministic demo audit events when observability storage is unavailable", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiRequestError({
        message: "Redis unavailable",
        status: 503,
        url: "http://api:3001/integrations/powens/audit-trail?limit=20",
        path: "/integrations/powens/audit-trail?limit=20",
      }),
    );

    await expect(fetchPowensAuditTrail()).resolves.toEqual(
      getDemoPowensAuditTrail(),
    );
  });

  it("skips the Powens status API call entirely in demo mode", () => {
    const queryOptions = powensStatusQueryOptionsWithMode({
      mode: "demo",
    });
    const queryFn = queryOptions.queryFn as () => ReturnType<
      typeof getDemoPowensStatus
    >;

    expect(queryFn()).toEqual(getDemoPowensStatus());
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("sends a full resync payload when requested for one connection", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });

    await postPowensSync({
      connectionId: "conn-1",
      fullResync: true,
    });

    expect(apiFetchMock).toHaveBeenCalledWith("/integrations/powens/sync", {
      method: "POST",
      body: JSON.stringify({
        connectionId: "conn-1",
        fullResync: true,
      }),
    });
  });

  it("omits connectionId and keeps only fullResync when no connection is provided", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });

    await postPowensSync({
      fullResync: true,
    });

    expect(apiFetchMock).toHaveBeenCalledWith("/integrations/powens/sync", {
      method: "POST",
      body: JSON.stringify({
        fullResync: true,
      }),
    });
  });
});
