import { PREDICTIONS } from "./JevClient";
import type { DecisionState } from "../../game/types";

const numbers = ["aiHpRatio", "playerHpRatio", "aiStaminaRatio", "playerStaminaRatio", "distance", "distanceToLeftWall", "distanceToRightWall"] as const;
const booleans = ["playerIsAttacking", "playerIsHeavyAttacking", "playerIsGuarding", "playerIsJumping", "aiAttackReady", "aiHeavyAttackReady", "aiDodgeReady"] as const;
const groups = ["overall", "whenAiApproaches", "afterHeavyMiss", "lowHp"] as const;

export function validState(value: unknown): value is DecisionState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  if (!numbers.every((key) => typeof state[key] === "number" && Number.isFinite(state[key]) && (state[key] as number) >= 0 && (state[key] as number) <= 1000)) return false;
  if (!booleans.every((key) => typeof state[key] === "boolean")) return false;
  const behavior = state.behavior;
  if (!behavior || typeof behavior !== "object" || Array.isArray(behavior)) return false;
  const stats = behavior as Record<string, unknown>;
  if (!Number.isInteger(stats.count) || (stats.count as number) < 0 || (stats.count as number) > 30) return false;
  if (!Array.isArray(stats.recent) || stats.recent.length > 30 || !stats.recent.every((item) => PREDICTIONS.includes(item))) return false;
  return groups.every((group) => {
    const value = stats[group];
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const probabilities = value as Record<string, unknown>;
    return PREDICTIONS.every((key) => typeof probabilities[key] === "number" && Number.isFinite(probabilities[key]) && (probabilities[key] as number) >= 0 && (probabilities[key] as number) <= 1);
  });
}
