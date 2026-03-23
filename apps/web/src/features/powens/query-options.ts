import { queryOptions } from "@tanstack/react-query";
import type { AuthMode } from "../auth-types";
import {
  getDemoPowensAuditTrail,
  getDemoPowensStatus,
  getDemoPowensSyncRuns,
} from "../demo-data";
import {
  fetchPowensAuditTrail,
  fetchPowensStatus,
  fetchPowensSyncBacklog,
  fetchPowensSyncRuns,
} from "./api";

export const powensQueryKeys = {
  all: ["powens"] as const,
  status: () => [...powensQueryKeys.all, "status"] as const,
  syncRuns: () => [...powensQueryKeys.all, "sync-runs"] as const,
  syncBacklog: () => [...powensQueryKeys.all, "sync-backlog"] as const,
  auditTrail: () => [...powensQueryKeys.all, "audit-trail"] as const,
};

export const powensStatusQueryOptions = () =>
  powensStatusQueryOptionsWithMode({
    mode: "admin",
  });

export const powensStatusQueryOptionsWithMode = ({
  mode,
}: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: powensQueryKeys.status(),
    queryFn: () => {
      if (mode === "demo") {
        return getDemoPowensStatus();
      }

      return fetchPowensStatus();
    },
    enabled: mode !== undefined,
    staleTime: mode === "demo" ? Number.POSITIVE_INFINITY : 10_000,
  });

export const powensSyncRunsQueryOptionsWithMode = ({
  mode,
}: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: powensQueryKeys.syncRuns(),
    queryFn: () => {
      if (mode === "demo") {
        return getDemoPowensSyncRuns();
      }

      return fetchPowensSyncRuns();
    },
    enabled: mode !== undefined,
    staleTime: mode === "demo" ? Number.POSITIVE_INFINITY : 10_000,
  });

export const powensSyncBacklogQueryOptionsWithMode = ({
  mode,
}: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: powensQueryKeys.syncBacklog(),
    queryFn: () => {
      if (mode === "demo") {
        return { syncBacklogCount: 0 };
      }

      return fetchPowensSyncBacklog();
    },
    enabled: mode !== undefined,
    staleTime: mode === "demo" ? Number.POSITIVE_INFINITY : 10_000,
  });

export const powensAuditTrailQueryOptionsWithMode = ({
  mode,
}: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: powensQueryKeys.auditTrail(),
    queryFn: () => {
      if (mode === "demo") {
        return getDemoPowensAuditTrail();
      }

      return fetchPowensAuditTrail();
    },
    enabled: mode !== undefined,
    staleTime: mode === "demo" ? Number.POSITIVE_INFINITY : 10_000,
  });
