import { apiFetch } from "@/lib/api";
import type { PushDeliveryResponse, PushSettingsResponse } from "./types";

export const fetchPushSettings = () => {
  return apiFetch<PushSettingsResponse>("/notifications/push/settings");
};

export const postPushOptIn = (payload: {
  optIn: boolean;
  permission: "unknown" | "denied" | "granted";
}) => {
  return apiFetch<{ ok: boolean; requestId: string; mode: "demo" | "admin" }>(
    "/notifications/push/opt-in",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
};

export const postPushSubscription = (payload: {
  endpoint: string;
  keys: { auth: string; p256dh: string };
  expiresAt?: string;
}) => {
  return apiFetch<{ ok: boolean; requestId: string; mode: "demo" | "admin" }>(
    "/notifications/push/subscription",
    {
      method: "POST",
      body: JSON.stringify({
        endpoint: payload.endpoint,
        keys: payload.keys,
        ...(payload.expiresAt ? { expiresAt: payload.expiresAt } : {}),
      }),
    },
  );
};

export const postPushPreview = () => {
  return apiFetch<PushDeliveryResponse>("/notifications/push/send-preview", {
    method: "POST",
  });
};
