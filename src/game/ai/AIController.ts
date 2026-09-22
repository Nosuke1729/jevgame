import { ARENA, ARENA_DEPTH } from "../constants";
import { groundDistance } from "../spatial";
import type { Controls, Fighter, GameMode, Intent } from "../types";

export class AIController {
  intent: Intent = "approach";
  private actionPending = true;
  private intentTime = 0;

  setIntent(intent: Intent): void {
    this.intent = intent;
    this.actionPending = true;
    this.intentTime = 0;
  }

  controls(ai: Fighter, player: Fighter, dt: number, mode: GameMode = "2d"): Controls {
    this.intentTime += dt;
    const towards = (player.x >= ai.x ? 1 : -1) as -1 | 1;
    const away = -towards as -1 | 1;
    const distance = groundDistance(ai, player, mode);
    const input: Controls = { move: 0, jump: false, normalAttack: false, heavyAttack: false, dodge: false, guard: false };
    switch (this.intent) {
      case "approach": input.move = distance > 91 ? towards : 0; break;
      case "retreat": input.move = ai.x < ARENA.left + 85 || ai.x > ARENA.right - 85 ? towards : away; break;
      case "normalAttack":
        if (distance > 109) input.move = towards;
        else if (this.actionPending) { input.normalAttack = true; this.actionPending = false; }
        break;
      case "heavyAttack":
        if (distance > 134) input.move = towards;
        else if (this.actionPending) { input.heavyAttack = true; this.actionPending = false; }
        break;
      case "dodge":
        if (this.actionPending) { input.move = distance < 105 ? away : towards; input.dodge = true; this.actionPending = false; }
        break;
      case "guard": input.guard = this.intentTime < 0.6; break;
      case "jump":
        if (this.actionPending) { input.jump = true; this.actionPending = false; }
        input.move = towards;
        break;
      case "wait": break;
    }
    if (mode === "3d" && input.move !== 0) {
      const retreating = input.move === away;
      const direction = retreating ? -1 : 1;
      input.move = distance > .001 ? (player.x - ai.x) / distance * direction : 0;
      input.depth = distance > .001 ? (player.z - ai.z) / distance * direction : 0;
      if (this.intent === "dodge") {
        input.move = -(player.z - ai.z) / Math.max(distance, 1);
        input.depth = (player.x - ai.x) / Math.max(distance, 1);
        if (ai.z + input.depth * 120 > ARENA_DEPTH.front || ai.z + input.depth * 120 < ARENA_DEPTH.back) { input.move *= -1; input.depth *= -1; }
      } else if (retreating && (ai.z < ARENA_DEPTH.back + 50 || ai.z > ARENA_DEPTH.front - 50)) {
        input.depth = -Math.sign(ai.z);
      }
    }
    return input;
  }
}
