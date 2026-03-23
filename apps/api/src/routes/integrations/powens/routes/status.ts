import { Elysia } from "elysia";
import { demoOrReal } from "../../../../auth/demo-mode";
import { getPowensConnectionsStatusMock } from "../../../../mocks/connectionsStatus.mock";
import { getPowensRuntime } from "../context";

export const createStatusRoute = () =>
  new Elysia().get("/status", async (context) => {
    const powens = getPowensRuntime(context);
    const safeModeActive =
      powens.services.connectUrl.isExternalIntegrationsSafeModeEnabled();

    return demoOrReal({
      context,
      demo: () => ({
        connections: getPowensConnectionsStatusMock(),
        safeModeActive,
        lastCallback: {
          receivedAt: "2026-03-23T08:42:00.000Z",
          status: "allowed" as const,
          actorMode: "state" as const,
          requestId: "demo-powens-callback",
          connectionId: "demo-fortuneo",
        },
      }),
      real: async () => {
        const lastCallback =
          await powens.services.adminAudit.getLatestCallback();

        if (safeModeActive) {
          return {
            connections: getPowensConnectionsStatusMock(),
            safeModeActive: true,
            fallback: "safe_mode",
            lastCallback,
          };
        }

        const connections = await powens.useCases.listStatuses();
        return {
          connections,
          safeModeActive: false,
          lastCallback,
        };
      },
    });
  });
