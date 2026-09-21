import type { BehaviorStats, Prediction } from "../types";

export type BehaviorContext = "whenAiApproaches" | "afterHeavyMiss" | "lowHp";
type Sample = { action: Prediction; contexts: BehaviorContext[] };
const ACTIONS: Prediction[] = ["attack", "heavyAttack", "dodge", "guard", "approach", "retreat", "jump", "wait"];

function distribution(samples: Sample[]): Record<Prediction, number> {
  const result = Object.fromEntries(ACTIONS.map((action) => [action, 0])) as Record<Prediction, number>;
  for (const sample of samples) result[sample.action] += 1;
  if (samples.length) for (const action of ACTIONS) result[action] = Number((result[action] / samples.length).toFixed(3));
  return result;
}

export class PlayerBehaviorTracker {
  private samples: Sample[] = [];

  record(action: Prediction, contexts: BehaviorContext[] = []): void {
    this.samples.push({ action, contexts });
    if (this.samples.length > 30) this.samples.shift();
  }

  snapshot(): BehaviorStats {
    return {
      count: this.samples.length,
      overall: distribution(this.samples),
      whenAiApproaches: distribution(this.samples.filter((sample) => sample.contexts.includes("whenAiApproaches"))),
      afterHeavyMiss: distribution(this.samples.filter((sample) => sample.contexts.includes("afterHeavyMiss"))),
      lowHp: distribution(this.samples.filter((sample) => sample.contexts.includes("lowHp"))),
      recent: this.samples.slice(-8).map((sample) => sample.action),
    };
  }
}
