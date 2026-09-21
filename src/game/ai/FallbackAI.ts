import { DIFFICULTIES } from "../constants";
import type { Decision, DecisionState, Difficulty, Intent, Prediction } from "../types";

const PREDICTIONS: Prediction[] = ["attack", "heavyAttack", "dodge", "guard", "approach", "retreat", "jump", "wait"];

function weightedChoice<T extends string>(weights: Partial<Record<T, number>>, random: () => number): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let draw = random() * total;
  for (const [option, weight] of entries) { draw -= weight; if (draw <= 0) return option; }
  return entries[entries.length - 1][0];
}

export function fallbackDecision(state: DecisionState, difficulty: Difficulty, random: () => number = Math.random): Decision {
  const learn = DIFFICULTIES[difficulty].learning;
  const context = state.playerHpRatio <= 0.3 ? state.behavior.lowHp : state.distance < 190 ? state.behavior.whenAiApproaches : state.behavior.overall;
  const observed = Object.values(context).some((value) => value > 0) ? context : state.behavior.overall;
  const priors: Record<Prediction, number> = { attack: 0.19, heavyAttack: 0.11, dodge: 0.13, guard: 0.1, approach: 0.18, retreat: 0.11, jump: 0.08, wait: 0.1 };
  const probabilities = Object.fromEntries(PREDICTIONS.map((action) => [action, (1 - learn * 0.7) * priors[action] + learn * 0.7 * (observed[action] || 0)])) as Record<Prediction, number>;
  const total = Object.values(probabilities).reduce((sum, n) => sum + n, 0);
  for (const action of PREDICTIONS) probabilities[action] = Number((probabilities[action] / total).toFixed(3));
  const prediction = weightedChoice(probabilities, random);

  let weights: Partial<Record<Intent, number>>;
  if (state.distance > 230) {
    weights = { approach: 0.77, jump: 0.08, wait: 0.1, retreat: 0.05 };
  } else if (state.playerIsAttacking && state.distance < 155) {
    weights = { guard: 0.42, dodge: 0.3, retreat: 0.12, normalAttack: 0.16 };
  } else if (state.aiHpRatio < 0.28) {
    weights = { guard: 0.18, retreat: 0.18, normalAttack: 0.25, heavyAttack: 0.2, dodge: 0.09, wait: 0.1 };
  } else if (state.distance > 135) {
    weights = { approach: 0.65, normalAttack: 0.12, heavyAttack: 0.09, wait: 0.09, jump: 0.05 };
  } else {
    weights = { normalAttack: 0.38, heavyAttack: 0.19, guard: 0.1, dodge: 0.1, retreat: 0.1, wait: 0.08, jump: 0.05 };
  }
  if (difficulty === "hard" && state.behavior.count >= 6) {
    if (probabilities.dodge > 0.27 && state.distance < 165) { weights.wait = (weights.wait || 0) + 0.2; weights.heavyAttack = (weights.heavyAttack || 0) + 0.12; }
    if (probabilities.attack + probabilities.heavyAttack > 0.38) weights.guard = (weights.guard || 0) + 0.19;
  }
  if (!state.aiHeavyAttackReady) weights.heavyAttack = 0;
  if (!state.aiDodgeReady) weights.dodge = 0;
  if (!state.aiAttackReady) weights.normalAttack = 0;
  if (state.aiStaminaRatio < 0.18) { weights.heavyAttack = 0; weights.dodge = 0; weights.guard = 0; }
  const nextAction = weightedChoice(weights, random);
  return { nextAction, playerPrediction: prediction, predictionProbabilities: probabilities };
}
