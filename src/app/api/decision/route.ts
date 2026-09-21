import { NextRequest, NextResponse } from "next/server";
import { buildJevRequest, parseJevResponse } from "../../../lib/jev/JevClient";
import { validState } from "../../../lib/jev/validate";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }
  if (!validState(body)) return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  const key = process.env.JEV_API_KEY;
  if (!key) return NextResponse.json({ error: "missing_key" }, { status: 503 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1100);
  try {
    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildJevRequest(body)),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "jev_unavailable" }, { status: 503 });
    const decision = parseJevResponse(await response.json());
    if (!decision) return NextResponse.json({ error: "invalid_jev_response" }, { status: 502 });
    return NextResponse.json(decision, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "jev_timeout_or_network" }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
