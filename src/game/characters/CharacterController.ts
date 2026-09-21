import { ARENA, ATTACKS, FIGHTER_HALF_WIDTH, GRAVITY, MAX_HP, MAX_STAMINA } from "../constants";
import type { Controls, Fighter, Side } from "../types";

export function createFighter(side: Side): Fighter {
  return {
    side, x: side === "player" ? 260 : 700, y: ARENA.floor, vx: 0, vy: 0,
    facing: side === "player" ? 1 : -1, hp: MAX_HP, stamina: MAX_STAMINA,
    speed: 260, jumpPower: 680, action: "idle", actionTime: 0,
    attackCooldown: 0, dodgeCooldown: 0, hitStun: 0, guarding: false,
    attackHasHit: false, flash: 0, dodgeInvulnerable: 0, staminaDelay: 0,
  };
}

export interface CharacterEvents {
  startedAttack?: "normalAttack" | "heavyAttack";
  dodged?: boolean;
  jumped?: boolean;
  guardStarted?: boolean;
  heavyMiss?: boolean;
}

export function updateCharacter(f: Fighter, input: Controls, opponent: Fighter, dt: number): CharacterEvents {
  const events: CharacterEvents = {};
  const previousAction = f.action;
  f.actionTime += dt;
  f.attackCooldown = Math.max(0, f.attackCooldown - dt);
  f.dodgeCooldown = Math.max(0, f.dodgeCooldown - dt);
  f.hitStun = Math.max(0, f.hitStun - dt);
  f.flash = Math.max(0, f.flash - dt);
  f.dodgeInvulnerable = Math.max(0, f.dodgeInvulnerable - dt);
  f.staminaDelay = Math.max(0, f.staminaDelay - dt);

  if (previousAction === "heavyAttack" && f.actionTime >= attackDuration("heavyAttack") && !f.attackHasHit) events.heavyMiss = true;
  if ((previousAction === "normalAttack" || previousAction === "heavyAttack") && f.actionTime >= attackDuration(previousAction)) setAction(f, "idle");
  if (previousAction === "dodge" && f.actionTime >= 0.3) setAction(f, "idle");
  if ((previousAction === "hitStun" || previousAction === "guardBreak") && f.hitStun <= 0) setAction(f, "idle");

  const locked = f.action === "normalAttack" || f.action === "heavyAttack" || f.action === "dodge" || f.action === "hitStun" || f.action === "guardBreak";
  if (!locked) {
    f.facing = opponent.x >= f.x ? 1 : -1;
    f.guarding = input.guard && f.stamina > 0 && f.y >= ARENA.floor - 1;
    if (f.guarding) {
      f.stamina = Math.max(0, f.stamina - 7 * dt);
      f.staminaDelay = 0.28;
      f.vx = input.move * f.speed * 0.23;
      setAction(f, "guard");
      if (previousAction !== "guard") events.guardStarted = true;
      if (f.stamina === 0) {
        f.guarding = false;
        f.hitStun = 0.86;
        setAction(f, "guardBreak");
      }
    } else {
      f.vx = input.move * f.speed;
      if (input.dodge && f.dodgeCooldown <= 0 && f.stamina >= 23 && f.y >= ARENA.floor - 1) {
        f.stamina -= 23;
        f.staminaDelay = 0.5;
        f.dodgeCooldown = 1.15;
        f.dodgeInvulnerable = 0.22;
        f.vx = (input.move || -f.facing) * 540;
        setAction(f, "dodge");
        events.dodged = true;
      } else if (input.heavyAttack && f.attackCooldown <= 0 && f.stamina >= ATTACKS.heavyAttack.stamina) {
        startAttack(f, "heavyAttack");
        events.startedAttack = "heavyAttack";
      } else if (input.normalAttack && f.attackCooldown <= 0) {
        startAttack(f, "normalAttack");
        events.startedAttack = "normalAttack";
      } else {
        if (input.jump && f.y >= ARENA.floor - 1) {
          f.vy = -f.jumpPower;
          events.jumped = true;
        }
        setAction(f, f.y < ARENA.floor - 1 || f.vy < 0 ? "jump" : input.move ? "run" : "idle");
      }
    }
  } else if (f.action === "normalAttack" || f.action === "heavyAttack") {
    f.vx *= Math.max(0, 1 - 8 * dt);
  } else if (f.action === "hitStun" || f.action === "guardBreak") {
    f.vx *= Math.max(0, 1 - 5 * dt);
  }

  if (!f.guarding && f.staminaDelay <= 0) f.stamina = Math.min(MAX_STAMINA, f.stamina + 25 * dt);
  f.vy += GRAVITY * dt;
  f.x = Math.max(ARENA.left + FIGHTER_HALF_WIDTH, Math.min(ARENA.right - FIGHTER_HALF_WIDTH, f.x + f.vx * dt));
  f.y = Math.min(ARENA.floor, f.y + f.vy * dt);
  if (f.y === ARENA.floor && f.vy > 0) f.vy = 0;
  return events;
}

export function attackDuration(action: "normalAttack" | "heavyAttack"): number {
  const attack = ATTACKS[action];
  return attack.startup + attack.active + attack.recovery;
}

function startAttack(f: Fighter, action: "normalAttack" | "heavyAttack"): void {
  const attack = ATTACKS[action];
  f.stamina -= attack.stamina;
  f.staminaDelay = 0.38;
  f.attackCooldown = attack.cooldown;
  f.guarding = false;
  f.attackHasHit = false;
  setAction(f, action);
}

export function setAction(f: Fighter, action: Fighter["action"]): void {
  if (f.action !== action) { f.action = action; f.actionTime = 0; }
}
