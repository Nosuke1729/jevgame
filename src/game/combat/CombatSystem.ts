import { ATTACKS, FIGHTER_HALF_WIDTH } from "../constants";
import { setAction } from "../characters/CharacterController";
import type { Fighter, GameMode } from "../types";

export interface HitResult { kind: "hit" | "guard" | "break" | "dodge"; damage: number; x: number; y: number; z?: number }

export function resolveAttack(attacker: Fighter, target: Fighter, mode: GameMode = "2d"): HitResult | null {
  if (attacker.action !== "normalAttack" && attacker.action !== "heavyAttack") return null;
  if (attacker.attackHasHit) return null;
  const attack = ATTACKS[attacker.action];
  if (attacker.actionTime < attack.startup || attacker.actionTime > attack.startup + attack.active) return null;
  const dx = target.x - attacker.x;
  const dz = mode === "3d" ? target.z - attacker.z : 0;
  const distance = Math.hypot(dx, dz);
  const facingTarget = mode === "3d" ? (dx * attacker.headingX + dz * attacker.headingZ) / Math.max(distance, .001) >= .45 : dx * attacker.facing >= 0;
  if (!facingTarget || distance > attack.reach + FIGHTER_HALF_WIDTH || Math.abs(target.y - attacker.y) > 75) return null;
  attacker.attackHasHit = true;
  const point = { x: (target.x + attacker.x) / 2, y: target.y - 56, z: (target.z + attacker.z) / 2 };
  if (target.dodgeInvulnerable > 0) return { kind: "dodge", damage: 0, ...point };
  const facingAttacker = mode === "3d" ? (-dx * target.headingX - dz * target.headingZ) / Math.max(distance, .001) >= .3 : target.facing === -attacker.facing;
  if (target.guarding && facingAttacker) {
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
  const knockback = attacker.action === "heavyAttack" ? 290 : 180;
  target.vx = (mode === "3d" ? attacker.headingX : attacker.facing) * knockback;
  target.vz = mode === "3d" ? attacker.headingZ * knockback : 0;
  target.guarding = false;
  setAction(target, "hitStun");
  return { kind: "hit", damage: attack.damage, ...point };
}
