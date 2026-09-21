import type { Decision, DecisionState, Intent, Prediction } from "../../game/types";

export const INTENTS: Intent[] = ["approach", "retreat", "normalAttack", "heavyAttack", "dodge", "guard", "jump", "wait"];
export const PREDICTIONS: Prediction[] = ["attack", "heavyAttack", "dodge", "guard", "approach", "retreat", "jump", "wait"];

const actionCriteria: Record<Intent, string> = {
  approach: "Close distance to reach attack range while avoiding obvious danger",
  retreat: "Create space to recover or bait an unsafe player action",
  normalAttack: "Fast low-risk poke or punish at close range",
  heavyAttack: "Slow high-damage punish or catch a predictable dodge, only with stamina",
  dodge: "Evade a committed attack when cooldown and stamina allow",
  guard: "Block likely attack, but avoid guard break when stamina is low",
  jump: "Change angle or evade a grounded threat",
  wait: "Briefly bait an expected dodge or attack",
};
const predictionCriteria: Record<Prediction, string> = {
  attack: "Player likely uses a fast normal attack next",
  heavyAttack: "Player likely starts a heavy attack next",
  dodge: "Player likely dodges next",
  guard: "Player likely guards next",
  approach: "Player likely moves toward the AI",
  retreat: "Player likely moves away from the AI",
  jump: "Player likely jumps next",
  wait: "Player likely waits or changes timing",
};

export function buildJevRequest(state: DecisionState) {
  return {
    model: "jev-latest",
    state,
    questions: {
      nextAction: { type: "choice", instructions: "Choose the AI fighter's next short tactical intent. Respect attack readiness, stamina, distance and walls. Use behavior tendencies as uncertain clues, never as certainty.", criteria: actionCriteria },
      playerPrediction: { type: "choice", instructions: "Predict the human player's next action from recent and context-dependent behavior, current combat state, and uncertainty.", criteria: predictionCriteria },
    },
  };
}

function validProbabilities(value: unknown): value is Record<Prediction, number> {
  if (!value || typeof value !== "object") return false;
  const map = value as Record<string, unknown>;
  return PREDICTIONS.every((key) => typeof map[key] === "number" && Number.isFinite(map[key]) && (map[key] as number) >= 0 && (map[key] as number) <= 1);
}

export function parseJevResponse(value: unknown): Decision | null {
  if (!value || typeof value !== "object") return null;
  const answers = (value as { answers?: Record<string, unknown> }).answers;
  if (!answers || typeof answers !== "object") return null;
  const next = answers.nextAction as { type?: unknown; choice?: unknown } | undefined;
  const prediction = answers.playerPrediction as { type?: unknown; choice?: unknown; probabilities?: unknown } | undefined;
  if (next?.type !== "choice" || prediction?.type !== "choice") return null;
  if (!INTENTS.includes(next.choice as Intent) || !PREDICTIONS.includes(prediction.choice as Prediction)) return null;
  if (!validProbabilities(prediction.probabilities)) return null;
  return { nextAction: next.choice as Intent, playerPrediction: prediction.choice as Prediction, predictionProbabilities: prediction.probabilities };
}
