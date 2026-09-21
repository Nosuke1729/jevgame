import { DurableObject } from "cloudflare:workers";
import { buildJevRequest, parseJevResponse } from "../lib/jev/JevClient";
import { validState } from "../lib/jev/validate";

const ALLOWED_ORIGIN = "https://nosuke1729.github.io";
const DAILY_JEV_LIMIT = 500;
const MAX_BODY_BYTES = 4096;

interface Env {
  JEV_API_KEY: string;
  DECISION_QUOTA: { getByName(name: string): { consume(): Promise<boolean> } };
  REQUEST_RATE: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

function json(value: unknown, status: number, origin: string | null): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(origin === ALLOWED_ORIGIN ? { "Access-Control-Allow-Origin": ALLOWED_ORIGIN, Vary: "Origin" } : {}),
    },
  });
}

export class DecisionQuota extends DurableObject {
  async consume(): Promise<boolean> {
    const day = new Date().toISOString().slice(0, 10);
    return this.ctx.storage.transaction(async (transaction) => {
      const used = (await transaction.get<number>(day)) ?? 0;
      if (used >= DAILY_JEV_LIMIT) return false;
      await transaction.put(day, used + 1);
      return true;
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const pathname = new URL(request.url).pathname;
    if (pathname !== "/decision") return json({ error: "not_found" }, 404, origin);
    if (origin !== ALLOWED_ORIGIN) return json({ error: "forbidden_origin" }, 403, origin);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "600",
          Vary: "Origin",
        },
      });
    }
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
    if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return json({ error: "invalid_content_type" }, 415, origin);
    if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) return json({ error: "request_too_large" }, 413, origin);

    let body: unknown;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "request_too_large" }, 413, origin);
      body = JSON.parse(raw);
    } catch {
      return json({ error: "invalid_request" }, 400, origin);
    }
    if (!validState(body)) return json({ error: "invalid_state" }, 400, origin);
    if (!env.JEV_API_KEY) return json({ error: "missing_key" }, 503, origin);

    try {
      // Origin/CORS is browser scoping, not authentication. These two limits also
      // bound requests from clients that forge the Origin header.
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const { success } = await env.REQUEST_RATE.limit({ key: ip });
      if (!success) return json({ error: "rate_limited" }, 429, origin);
      if (!await env.DECISION_QUOTA.getByName("global").consume()) return json({ error: "daily_limit" }, 429, origin);

      const response = await fetch("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.JEV_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildJevRequest(body)),
        signal: AbortSignal.timeout(1100),
      });
      if (!response.ok) return json({ error: "jev_unavailable" }, 503, origin);
      const decision = parseJevResponse(await response.json());
      if (!decision) return json({ error: "invalid_jev_response" }, 502, origin);
      return json(decision, 200, origin);
    } catch {
      return json({ error: "jev_timeout_or_network" }, 503, origin);
    }
  },
};
