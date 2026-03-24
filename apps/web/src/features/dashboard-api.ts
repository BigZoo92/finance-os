import { apiFetch, ApiRequestError } from "@/lib/api";
import {
  getDemoDashboardSummary,
  getDemoDashboardTransactions,
} from "./demo-data";
import type {
  DashboardRange,
  DashboardSummaryResponse,
  DashboardTransactionsResponse,
} from "./dashboard-types";

const toSearchParams = (
  params: Record<string, string | number | undefined>,
) => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    search.set(key, String(value));
  }

  return search.toString();
};

export const fetchDashboardSummary = async (range: DashboardRange) => {
  const query = toSearchParams({ range });

  try {
    return await apiFetch<DashboardSummaryResponse>(
      `/dashboard/summary?${query}`,
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
        return getDemoDashboardSummary(range);
      }
    }

    return getDemoDashboardSummary(range);
  }
};

export const fetchDashboardTransactions = async (params: {
  range: DashboardRange;
  limit: number;
  cursor?: string;
}) => {
  const requestParams = {
    range: params.range,
    limit: params.limit,
    ...(params.cursor ? { cursor: params.cursor } : {}),
  };
  const query = toSearchParams(requestParams);

  try {
    return await apiFetch<DashboardTransactionsResponse>(
      `/dashboard/transactions?${query}`,
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
        return getDemoDashboardTransactions(requestParams);
      }
    }

    return getDemoDashboardTransactions(requestParams);
  }
};

export const patchTransactionClassification = async (params: {
  transactionId: number;
  category: string | null;
  subcategory: string | null;
  tags: string[];
}) => {
  return apiFetch<DashboardTransactionsResponse["items"][number]>(
    `/dashboard/transactions/${params.transactionId}/classification`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        category: params.category,
        subcategory: params.subcategory,
        tags: params.tags,
      }),
    },
  );
};
