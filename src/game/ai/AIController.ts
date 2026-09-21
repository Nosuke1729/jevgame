import { ARENA } from "../constants";
import type { Controls, Fighter, Intent } from "../types";

export class AIController {
  intent: Intent = "approach";
  private actionPending = true;
  private intentTime = 0;

  setIntent(intent: Intent): void {
    this.intent = intent;
    this.actionPending = true;
    this.intentTime = 0;
  }

  controls(ai: Fighter, player: Fighter, dt: number): Controls {
    this.intentTime += dt;
    const towards = (player.x >= ai.x ? 1 : -1) as -1 | 1;
    const away = -towards as -1 | 1;
    const distance = Math.abs(player.x - ai.x);
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
    return input;
  }
}
