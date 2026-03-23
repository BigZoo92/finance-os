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
  fetchDashboardSummary,
  fetchDashboardTransactions,
} from "./dashboard-api";
import {
  getDemoDashboardSummary,
  getDemoDashboardTransactions,
} from "./demo-data";

describe("dashboard API fallbacks", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("returns deterministic demo summary when the dashboard summary call hits a provider outage", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiRequestError({
        message: "Powens upstream unavailable",
        status: 503,
        url: "http://api:3001/dashboard/summary?range=30d",
        path: "/dashboard/summary?range=30d",
      }),
    );

    await expect(fetchDashboardSummary("30d")).resolves.toEqual(
      getDemoDashboardSummary("30d"),
    );
  });

  it("returns deterministic demo transactions when the dashboard transactions call fails over the network", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiRequestError({
        message: "connect ECONNREFUSED",
        status: "network_error",
        url: "http://api:3001/dashboard/transactions?range=30d&limit=30",
        path: "/dashboard/transactions?range=30d&limit=30",
      }),
    );

    await expect(
      fetchDashboardTransactions({
        range: "30d",
        limit: 30,
      }),
    ).resolves.toEqual(
      getDemoDashboardTransactions({
        range: "30d",
        limit: 30,
      }),
    );
  });
});
