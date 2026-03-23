import { describe, expect, it } from "bun:test";
import { createPowensAdminAuditService } from "./create-powens-admin-audit-service";

const createRedisListMock = () => {
  const storage: string[] = [];

  return {
    client: {
      storage,
      lPush: async function (this: { storage: string[] }, _key: string, value: string) {
        this.storage.unshift(value);
      },
      lTrim: async function (this: { storage: string[] }, _key: string, start: number, stop: number) {
        const next = this.storage.slice(start, stop + 1);
        this.storage.splice(0, this.storage.length, ...next);
      },
      lRange: async function (this: { storage: string[] }, _key: string, start: number, stop: number) {
        return this.storage.slice(start, stop + 1);
      },
    },
    storage,
  };
};

describe("createPowensAdminAuditService", () => {
  it("stores and returns newest entries first", async () => {
    const redis = createRedisListMock();
    const service = createPowensAdminAuditService(redis.client as never);

    await service.recordEvent({
      id: "evt-1",
      action: "manual_sync",
      result: "allowed",
      actorMode: "admin",
      at: "2026-03-16T12:00:00.000Z",
      requestId: "req-1",
    });

    await service.recordEvent({
      id: "evt-2",
      action: "callback",
      result: "failed",
      actorMode: "state",
      at: "2026-03-16T12:01:00.000Z",
      requestId: "req-2",
      connectionId: "conn-2",
      details: "exchange_failed",
    });

    const events = await service.listRecentEvents(10);
    expect(events.map((event: { id: string }) => event.id)).toEqual([
      "evt-2",
      "evt-1",
    ]);
    expect(events[0]).toMatchObject({
      connectionId: "conn-2",
      details: "exchange_failed",
    });
  });

  it("returns the latest callback summary only", async () => {
    const redis = createRedisListMock();
    const service = createPowensAdminAuditService(redis.client as never);

    await service.recordEvent({
      id: "evt-1",
      action: "manual_sync",
      result: "allowed",
      actorMode: "admin",
      at: "2026-03-16T12:00:00.000Z",
      requestId: "req-1",
    });

    await service.recordEvent({
      id: "evt-2",
      action: "callback",
      result: "blocked",
      actorMode: "state",
      at: "2026-03-16T12:02:00.000Z",
      requestId: "req-2",
      connectionId: "conn-2",
      details: "safe_mode_enabled",
    });

    await service.recordEvent({
      id: "evt-3",
      action: "callback",
      result: "allowed",
      actorMode: "admin",
      at: "2026-03-16T12:03:00.000Z",
      requestId: "req-3",
      connectionId: "conn-3",
    });

    await service.recordEvent({
      id: "evt-4",
      action: "connect_url",
      result: "allowed",
      actorMode: "admin",
      at: "2026-03-16T12:04:00.000Z",
      requestId: "req-4",
    });

    await expect(service.getLatestCallback()).resolves.toEqual({
      receivedAt: "2026-03-16T12:03:00.000Z",
      status: "allowed",
      actorMode: "admin",
      requestId: "req-3",
      connectionId: "conn-3",
    });
  });

  it("ignores malformed payloads from Redis", async () => {
    const redis = createRedisListMock();
    redis.storage.unshift('{"bad":true}');
    const service = createPowensAdminAuditService(redis.client as never);

    const events = await service.listRecentEvents(10);
    expect(events).toEqual([]);
  });
});
