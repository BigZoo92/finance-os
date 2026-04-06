export type PushSettingsResponse = {
  enabled: boolean;
  mode: "demo" | "admin";
  featureEnabled: boolean;
  criticalEnabled: boolean;
  providerAvailable: boolean;
  providerStatus: "available" | "unavailable";
  optIn: boolean;
  permission: "unknown" | "denied" | "granted";
  subscriptionStale: boolean;
  unavailableReason?: "feature_disabled" | "critical_disabled" | "provider_unavailable";
  requestId: string;
};

export type PushDeliveryResponse =
  | {
      ok: true;
      requestId: string;
      mode: "demo" | "admin";
      delivery: "mocked" | "sent";
      providerStatus: "available" | "unavailable";
    }
  | {
      ok: false;
      requestId: string;
      mode: "demo" | "admin";
      code: "permission_denied" | "subscription_expired" | "provider_unavailable";
      message: string;
      providerStatus: "available" | "unavailable";
    };
