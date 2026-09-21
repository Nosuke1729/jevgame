import type { Difficulty } from "./types";

export const ARENA = { width: 960, height: 540, floor: 437, left: 42, right: 918 } as const;
export const MAX_HP = 100;
export const MAX_STAMINA = 100;
export const FIGHTER_HALF_WIDTH = 22;
export const GRAVITY = 1750;

export const ATTACKS = {
  normalAttack: { startup: 0.09, active: 0.13, recovery: 0.23, cooldown: 0.42, reach: 104, damage: 10, stun: 0.2, guardCost: 14, stamina: 0 },
  heavyAttack: { startup: 0.29, active: 0.17, recovery: 0.42, cooldown: 0.92, reach: 128, damage: 24, stun: 0.36, guardCost: 31, stamina: 26 },
} as const;

export const DIFFICULTIES: Record<Difficulty, { label: string; interval: number; reaction: number; learning: number }> = {
  easy: { label: "やさしい", interval: 680, reaction: 260, learning: 0.2 },
  normal: { label: "ふつう", interval: 420, reaction: 145, learning: 0.65 },
  hard: { label: "むずかしい", interval: 300, reaction: 95, learning: 0.9 },
};

export const KEY_BINDINGS = {
  left: "KeyA",
  right: "KeyD",
  jump: "KeyW",
  normalAttack: "KeyJ",
  heavyAttack: "KeyK",
  dodge: "KeyL",
  guard: "KeyI",
  debug: "F3",
} as const;

export const EMPTY_CONTROLS = { move: 0, jump: false, normalAttack: false, heavyAttack: false, dodge: false, guard: false } as const;
