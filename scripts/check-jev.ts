import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { PlayerBehaviorTracker } from "../src/game/ai/PlayerBehaviorTracker";
import type { DecisionState } from "../src/game/types";
import { POST } from "../src/app/api/decision/route";

const envKey = /^JEV_API_KEY=(\S+)$/m.exec(readFileSync(".env.local", "utf8"))?.[1];
if (!envKey) throw new Error("JEV_API_KEY is missing from .env.local");
process.env.JEV_API_KEY = envKey;

const state: DecisionState = {
  aiHpRatio: 1,
  playerHpRatio: 1,
  aiStaminaRatio: 1,
  playerStaminaRatio: 1,
  distance: 150,
  playerIsAttacking: false,
  playerIsHeavyAttacking: false,
  playerIsGuarding: false,
  playerIsJumping: false,
  aiAttackReady: true,
  aiHeavyAttackReady: true,
  aiDodgeReady: true,
  distanceToLeftWall: 400,
  distanceToRightWall: 400,
  behavior: new PlayerBehaviorTracker().snapshot(),
};

const request = new NextRequest("http://localhost/api/decision", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(state),
});
async function main() {
  const response = process.env.JEV_CHECK_URL
    ? await fetch(new URL("/api/decision", process.env.JEV_CHECK_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    })
    : await POST(request);
  const result = await response.json();
  if (!response.ok) {
    console.error(`Jev check failed: HTTP ${response.status}, ${result.error ?? "unknown_error"}`);
    process.exitCode = 1;
  } else {
    console.log(`Jev check passed: HTTP ${response.status}, action=${result.nextAction}, prediction=${result.playerPrediction}`);
  }
}

void main().catch((error: unknown) => {
  console.error(`Jev check failed: ${error instanceof Error ? error.name : "unknown_error"}`);
  process.exitCode = 1;
});
