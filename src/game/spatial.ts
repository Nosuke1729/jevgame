import { ARENA, ARENA_DEPTH, FIGHTER_HALF_WIDTH } from "./constants";
import type { Fighter, GameMode } from "./types";

export function groundDistance(a: Fighter, b: Fighter, mode: GameMode): number {
  return Math.hypot(b.x - a.x, mode === "3d" ? b.z - a.z : 0);
}

export function clampGround(fighter: Fighter): void {
  fighter.x = Math.max(ARENA.left + FIGHTER_HALF_WIDTH, Math.min(ARENA.right - FIGHTER_HALF_WIDTH, fighter.x));
  fighter.z = Math.max(ARENA_DEPTH.back, Math.min(ARENA_DEPTH.front, fighter.z));
}

export function separateSpatialFighters(a: Fighter, b: Fighter): void {
  if (Math.abs(a.y - b.y) >= 68) return;
  const dx = b.x - a.x, dz = b.z - a.z, distance = Math.hypot(dx, dz);
  const overlap = FIGHTER_HALF_WIDTH * 2 - distance;
  if (overlap <= 0) return;
  const nx = distance > .001 ? dx / distance : 1;
  const nz = distance > .001 ? dz / distance : 0;
  a.x -= nx * overlap / 2; a.z -= nz * overlap / 2;
  b.x += nx * overlap / 2; b.z += nz * overlap / 2;
  clampGround(a); clampGround(b);
}
