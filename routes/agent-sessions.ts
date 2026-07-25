import type { Context } from "hono";
import { ZodError } from "zod";
import { storage } from "../db";
import { queryAgentSessions } from "../services/agent-sessions";
import { agentSessionQuerySchema } from "../shared/validation";

function parseDateOnly(
  value: string,
  boundary: "start" | "end",
): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = boundary === "start" ? 0 : 23;
  const minute = boundary === "start" ? 0 : 59;
  const second = boundary === "start" ? 0 : 59;
  const millisecond = boundary === "start" ? 0 : 999;
  const date = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond),
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return date;
}

function parseDateParam(
  value: string | number | undefined,
  boundary: "start" | "end",
): Date | undefined {
  if (value === undefined) return undefined;

  if (typeof value === "number") {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseDateOnly(trimmed, boundary);
  }

  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    const ms = num < 1_000_000_000_000 ? num * 1000 : num;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function getAgentSessions(c: Context): Promise<Response> {
  const projectId = c.get("projectId") as string;
  const rawQuery = c.req.query();

  let params;
  try {
    params = agentSessionQuerySchema.parse(rawQuery);
  } catch (err) {
    if (err instanceof ZodError) {
      return c.json(
        { error: "Invalid query parameters", details: err.issues },
        400,
      );
    }
    throw err;
  }

  const dateFrom = parseDateParam(params.date_from, "start");
  const dateTo = parseDateParam(params.date_to, "end");
  if (params.date_from !== undefined && !dateFrom) {
    return c.json({ error: "Invalid date_from parameter" }, 400);
  }
  if (params.date_to !== undefined && !dateTo) {
    return c.json({ error: "Invalid date_to parameter" }, 400);
  }

  const result = await queryAgentSessions(
    projectId,
    {
      source: params.source,
      dateFrom,
      dateTo,
      limit: params.limit,
      offset: params.offset,
      sort: params.sort,
    },
    storage,
  );

  return c.json(result, 200);
}
