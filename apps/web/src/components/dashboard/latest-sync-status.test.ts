import { describe, expect, it } from "vitest";
import { getLatestSyncStatus } from "./latest-sync-status";

describe("getLatestSyncStatus", () => {
  it("returns a neutral empty state when there are no runs", () => {
    expect(getLatestSyncStatus([])).toEqual({
      badgeLabel: "-",
      badgeVariant: "outline",
      summary: "Aucun run recent",
      details: "Aucune synchronisation worker tracee pour l'instant.",
    });
  });

  it("returns OK when the latest run succeeded", () => {
    const status = getLatestSyncStatus([
      {
        id: "run-success",
        requestId: "req-success",
        connectionId: "fortuneo",
        startedAt: "2026-03-23T09:00:00.000Z",
        endedAt: "2026-03-23T09:03:00.000Z",
        result: "success",
      },
      {
        id: "run-error",
        requestId: "req-error",
        connectionId: "revolut",
        startedAt: "2026-03-22T09:00:00.000Z",
        endedAt: "2026-03-22T09:05:00.000Z",
        result: "error",
        errorMessage: "timeout",
      },
    ]);

    expect(status.badgeLabel).toBe("OK");
    expect(status.badgeVariant).toBe("secondary");
    expect(status.summary).toContain("23/03/2026");
    expect(status.details).toBe("Connexion fortuneo");
  });

  it("returns KO when the latest run failed", () => {
    const status = getLatestSyncStatus([
      {
        id: "run-error",
        requestId: "req-error",
        connectionId: "revolut",
        startedAt: "2026-03-23T10:00:00.000Z",
        endedAt: "2026-03-23T10:06:00.000Z",
        result: "error",
        errorMessage: "Powens timeout",
      },
    ]);

    expect(status.badgeLabel).toBe("KO");
    expect(status.badgeVariant).toBe("destructive");
    expect(status.summary).toContain("23/03/2026");
    expect(status.details).toBe("Powens timeout");
  });

  it("returns RUN when the latest run is still running", () => {
    const status = getLatestSyncStatus([
      {
        id: "run-running",
        requestId: null,
        connectionId: "fortuneo",
        startedAt: "2026-03-23T11:00:00.000Z",
        endedAt: null,
        result: "running",
      },
      {
        id: "run-success",
        requestId: "req-success",
        connectionId: "revolut",
        startedAt: "2026-03-23T09:00:00.000Z",
        endedAt: "2026-03-23T09:03:00.000Z",
        result: "success",
      },
    ]);

    expect(status.badgeLabel).toBe("RUN");
    expect(status.badgeVariant).toBe("outline");
    expect(status.summary).toContain("23/03/2026");
    expect(status.details).toBe("Connexion fortuneo");
  });
});
