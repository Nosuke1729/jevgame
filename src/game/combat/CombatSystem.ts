import { ATTACKS, FIGHTER_HALF_WIDTH } from "../constants";
import { setAction } from "../characters/CharacterController";
import type { Fighter } from "../types";

export interface HitResult { kind: "hit" | "guard" | "break" | "dodge"; damage: number; x: number; y: number }

export function resolveAttack(attacker: Fighter, target: Fighter): HitResult | null {
  if (attacker.action !== "normalAttack" && attacker.action !== "heavyAttack") return null;
  if (attacker.attackHasHit) return null;
  const attack = ATTACKS[attacker.action];
  if (attacker.actionTime < attack.startup || attacker.actionTime > attack.startup + attack.active) return null;
  const dx = target.x - attacker.x;
  if (dx * attacker.facing < 0 || Math.abs(dx) > attack.reach + FIGHTER_HALF_WIDTH || Math.abs(target.y - attacker.y) > 75) return null;
  attacker.attackHasHit = true;
  const point = { x: (target.x + attacker.x) / 2, y: target.y - 56 };
  if (target.dodgeInvulnerable > 0) return { kind: "dodge", damage: 0, ...point };
  if (target.guarding && target.facing === -attacker.facing) {
    const damage = Math.ceil(attack.damage * 0.17);
    target.hp = Math.max(0, target.hp - damage);
    target.stamina = Math.max(0, target.stamina - attack.guardCost);
    target.staminaDelay = 0.7;
    target.flash = 0.1;
    if (target.stamina === 0) {
      target.guarding = false;
      target.hitStun = 0.86;
      setAction(target, "guardBreak");
      return { kind: "break", damage, ...point };
    }
    return { kind: "guard", damage, ...point };
  }
  target.hp = Math.max(0, target.hp - attack.damage);
  target.flash = 0.17;
  target.hitStun = attack.stun;
  target.vx = attacker.facing * (attacker.action === "heavyAttack" ? 290 : 180);
  target.guarding = false;
  setAction(target, "hitStun");
  return { kind: "hit", damage: attack.damage, ...point };
}
