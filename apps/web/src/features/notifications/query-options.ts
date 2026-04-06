import { queryOptions } from "@tanstack/react-query";
import type { AuthMode } from "../auth-types";
import { fetchPushSettings } from "./api";
import { getPushUiConfig } from "./ui-config";

export const notificationsQueryKeys = {
  all: ["notifications"] as const,
  pushSettings: () => [...notificationsQueryKeys.all, "push-settings"] as const,
};

export const pushSettingsQueryOptionsWithMode = ({
  mode,
}: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: notificationsQueryKeys.pushSettings(),
    queryFn: () => {
      const uiConfig = getPushUiConfig();
      if (mode === "demo") {
        return {
          enabled: true,
          mode: "demo",
          featureEnabled: uiConfig.enabled,
          criticalEnabled: uiConfig.criticalEnabled,
          providerAvailable: false,
          providerStatus: "unavailable",
          optIn: true,
          permission: "granted",
          subscriptionStale: false,
          requestId: "demo-notifications",
        } as const;
      }

      return fetchPushSettings();
    },
    enabled: mode !== undefined,
    staleTime: mode === "demo" ? Number.POSITIVE_INFINITY : 10_000,
  });
