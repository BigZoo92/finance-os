import type { PowensAdminAuditEvent, RedisClient } from "../types";

const AUDIT_LOG_KEY = "powens:admin:audit-trail";
const MAX_EVENTS = 100;

const safeParseEvent = (value: string): PowensAdminAuditEvent | null => {
  try {
    const parsed = JSON.parse(value) as PowensAdminAuditEvent;
    if (
      typeof parsed.id === "string" &&
      typeof parsed.action === "string" &&
      typeof parsed.result === "string" &&
      typeof parsed.actorMode === "string" &&
      typeof parsed.at === "string" &&
      typeof parsed.requestId === "string"
    ) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
};

const bindRedisFunction = <TArgs extends unknown[], TResult>(
  redisClient: RedisClient,
  candidate: ((...args: TArgs) => TResult) | undefined,
  name: string,
) => {
  if (typeof candidate !== "function") {
    throw new Error(`Redis client is missing ${name}`);
  }

  return (...args: TArgs) =>
    Reflect.apply(candidate as (...args: TArgs) => TResult, redisClient, args);
};

export const createPowensAdminAuditService = (redisClient: RedisClient) => {
  const lPush = bindRedisFunction(
    redisClient,
    (
      redisClient as never as {
        lPush?: (...args: [string, string]) => Promise<unknown>;
      }
    ).lPush,
    "lPush",
  );
  const lTrim = bindRedisFunction(
    redisClient,
    (
      redisClient as never as {
        lTrim?: (...args: [string, number, number]) => Promise<unknown>;
      }
    ).lTrim,
    "lTrim",
  );
  const lRange = bindRedisFunction(
    redisClient,
    (
      redisClient as never as {
        lRange?: (...args: [string, number, number]) => Promise<unknown>;
      }
    ).lRange,
    "lRange",
  );

  const recordEvent = async (event: PowensAdminAuditEvent) => {
    const serialized = JSON.stringify(event);
    await lPush(AUDIT_LOG_KEY, serialized);
    await lTrim(AUDIT_LOG_KEY, 0, MAX_EVENTS - 1);
  };

  const listRecentEvents = async (limit = 20) => {
    const normalizedLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(100, Math.floor(limit)))
      : 20;
    const raw = await lRange(AUDIT_LOG_KEY, 0, normalizedLimit - 1);
    const rows = Array.isArray(raw) ? raw : [];

    return rows
      .map((entry) =>
        typeof entry === "string" ? safeParseEvent(entry) : null,
      )
      .filter((entry): entry is PowensAdminAuditEvent => entry !== null);
  };

  const getLatestCallback = async () => {
    const events = await listRecentEvents(MAX_EVENTS);
    const latestCallback = events.find((event) => event.action === "callback");

    if (!latestCallback) {
      return null;
    }

    return {
      receivedAt: latestCallback.at,
      status: latestCallback.result,
      actorMode: latestCallback.actorMode,
      requestId: latestCallback.requestId,
      ...(latestCallback.connectionId
        ? { connectionId: latestCallback.connectionId }
        : {}),
      ...(latestCallback.details ? { details: latestCallback.details } : {}),
    };
  };

  return {
    recordEvent,
    listRecentEvents,
    getLatestCallback,
  };
};
