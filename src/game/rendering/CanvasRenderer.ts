import { ARENA, ATTACKS } from "../constants";
import type { Effect, Fighter, MatchState } from "../types";

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
}

function fighterColor(f: Fighter): string { return f.side === "player" ? "#45e3e5" : "#ff6e86"; }

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, time: number): void {
  const color = fighterColor(f);
  const airborne = ARENA.floor - f.y;
  const moving = Math.abs(f.vx) > 25;
  const step = moving && airborne < 3 ? Math.sin(time * 19) * 7 : 0;
  ctx.save();
  ctx.globalAlpha = Math.max(0.12, 0.28 - airborne / 650);
  ctx.fillStyle = "#040811";
  ctx.beginPath(); ctx.ellipse(f.x, ARENA.floor + 3, 37 - airborne * 0.04, 9 - airborne * 0.01, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.facing, 1);
  if (f.action === "dodge") {
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.17 / i; ctx.fillStyle = color;
      roundedRect(ctx, -17 - f.facing * i * 20, -86, 34, 76, 8); ctx.fill();
    }
    ctx.globalAlpha = 0.75;
  }
  if (f.action === "guard" || f.action === "guardBreak") {
    ctx.save();
    ctx.globalAlpha = f.action === "guardBreak" ? 0.55 : 0.32;
    ctx.strokeStyle = f.action === "guardBreak" ? "#ffdc70" : color;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(9, -52, 53, -1.4, 1.35); ctx.stroke();
    ctx.restore();
  }
  const lean = f.action === "heavyAttack" ? 12 : f.action === "normalAttack" ? 6 : f.action === "hitStun" ? -10 : 0;
  ctx.shadowBlur = 25; ctx.shadowColor = color;
  ctx.fillStyle = f.flash > 0 ? "#ffffff" : "#121c2b";
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  roundedRect(ctx, -13 + lean * 0.25, -49, 11, 44, 4); ctx.fill(); ctx.stroke();
  roundedRect(ctx, 3 + lean * 0.25, -49, 11, 44 + step, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = f.flash > 0 ? "#ffffff" : f.side === "player" ? "#13485b" : "#643049";
  ctx.beginPath(); ctx.moveTo(-21 + lean, -84); ctx.lineTo(16 + lean, -84); ctx.lineTo(20 + lean, -39); ctx.lineTo(-19 + lean, -39); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.globalAlpha = 0.75;
  roundedRect(ctx, -13 + lean, -67, 27, 8, 3); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = f.flash > 0 ? "#ffffff" : "#192333";
  ctx.beginPath(); ctx.arc(lean + 1, -104, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  roundedRect(ctx, lean + 3, -109, 16, 5, 2); ctx.fill();
  const attack = f.action === "normalAttack" || f.action === "heavyAttack" ? ATTACKS[f.action] : null;
  const active = attack && f.actionTime >= attack.startup && f.actionTime <= attack.startup + attack.active;
  const windup = attack && f.actionTime < attack.startup;
  ctx.strokeStyle = f.flash > 0 ? "#fff" : color; ctx.lineCap = "round";
  ctx.lineWidth = f.action === "heavyAttack" ? 11 : 8;
  ctx.beginPath();
  ctx.moveTo(lean + 11, -76);
  ctx.lineTo(lean + (active ? 48 : windup ? -10 : 27), active ? -56 : windup ? -100 : -56);
  ctx.stroke();
  if (attack && (active || windup)) {
    ctx.save();
    ctx.globalAlpha = active ? 0.72 : 0.32;
    ctx.strokeStyle = f.action === "heavyAttack" ? "#ffd278" : color;
    ctx.lineWidth = f.action === "heavyAttack" ? 14 : 8;
    ctx.shadowBlur = 23; ctx.shadowColor = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(14, -65, f.action === "heavyAttack" ? 89 : 65, -0.8, 0.48);
    ctx.stroke();
    ctx.restore();
  }
  if (f.action === "guardBreak") {
    ctx.fillStyle = "#ffda73"; ctx.font = "bold 20px sans-serif"; ctx.fillText("!", -6, -134);
  }
  ctx.restore();
}

function drawEnvironment(ctx: CanvasRenderingContext2D, time: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, ARENA.height);
  sky.addColorStop(0, "#080e21"); sky.addColorStop(0.55, "#172444"); sky.addColorStop(1, "#1b2340");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  ctx.fillStyle = "#dbe2fa"; ctx.globalAlpha = 0.75;
  ctx.beginPath(); ctx.arc(746, 116, 51, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = "#131b33";
  for (let i = 0; i < 10; i++) {
    const x = i * 119 - 30;
    const h = 103 + (i % 4) * 29;
    ctx.fillRect(x, 316 - h, 93, h + 121);
    ctx.fillStyle = "#263959";
    for (let y = 240 - h; y < 298; y += 19) for (let col = 0; col < 3; col++) {
      if ((i * 11 + y + col) % 4 !== 0) ctx.fillRect(x + 13 + col * 25, y + 10, 7, 4);
    }
    ctx.fillStyle = "#131b33";
  }
  const horizon = ctx.createLinearGradient(0, 328, 0, 448);
  horizon.addColorStop(0, "#394c73"); horizon.addColorStop(1, "#0b1226");
  ctx.fillStyle = horizon; ctx.fillRect(0, 334, ARENA.width, 110);
  ctx.strokeStyle = "rgba(89,211,233,.12)"; ctx.lineWidth = 1;
  for (let x = 30; x < 960; x += 70) { ctx.beginPath(); ctx.moveTo(x, 335); ctx.lineTo(x, 444); ctx.stroke(); }
  ctx.fillStyle = "#0c1529"; ctx.fillRect(0, ARENA.floor, ARENA.width, ARENA.height - ARENA.floor);
  const floor = ctx.createLinearGradient(0, 438, 0, 540);
  floor.addColorStop(0, "#162b47"); floor.addColorStop(1, "#080e1c");
  ctx.fillStyle = floor; ctx.fillRect(0, ARENA.floor, ARENA.width, ARENA.height - ARENA.floor);
  ctx.strokeStyle = "#48b9d5"; ctx.globalAlpha = 0.42; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, ARENA.floor); ctx.lineTo(960, ARENA.floor); ctx.stroke();
  ctx.globalAlpha = 0.16;
  for (let x = -100; x < 1100; x += 95) { ctx.beginPath(); ctx.moveTo(x, 540); ctx.lineTo(480 + (x - 480) * 0.46, ARENA.floor); ctx.stroke(); }
  for (const y of [466, 498, 530]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#59dce4"; ctx.globalAlpha = 0.25;
  for (let i = 0; i < 16; i++) {
    const x = (i * 173 + time * (i % 3 + 1) * 8) % 960;
    const y = 70 + (i * 97) % 308;
    ctx.beginPath(); ctx.arc(x, y, 1.2 + i % 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawEffects(ctx: CanvasRenderingContext2D, effects: Effect[]): void {
  for (const effect of effects) {
    ctx.globalAlpha = effect.life / effect.maxLife;
    ctx.fillStyle = effect.color;
    ctx.fillRect(effect.x, effect.y, effect.size, effect.size);
  }
  ctx.globalAlpha = 1;
}

export function renderGame(ctx: CanvasRenderingContext2D, player: Fighter, ai: Fighter, match: MatchState, effects: Effect[], shake: number, time: number): void {
  ctx.save();
  ctx.clearRect(0, 0, ARENA.width, ARENA.height);
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
  drawEnvironment(ctx, time);
  drawFighter(ctx, player, time);
  drawFighter(ctx, ai, time);
  drawEffects(ctx, effects);
  if (match.phase === "intro" || match.phase === "roundEnd" || match.phase === "finished") {
    ctx.fillStyle = "rgba(5,10,23,.43)"; ctx.fillRect(0, 0, 960, 540);
    ctx.textAlign = "center";
    ctx.fillStyle = "#b5c4e1"; ctx.font = "700 22px sans-serif";
    if (match.phase === "intro") {
      ctx.fillText(`第${match.round}ラウンド`, 480, 222);
      ctx.fillStyle = "#f2f6ff"; ctx.font = "900 70px sans-serif"; ctx.fillText("開始！", 480, 306);
    } else {
      ctx.fillText(match.phase === "finished" ? "最終勝者" : `第${match.round}ラウンド`, 480, 222);
      ctx.fillStyle = match.lastWinner === "player" ? "#53e8e8" : "#ff8398";
      ctx.font = "900 64px sans-serif";
      ctx.fillText(match.lastWinner === "player" ? "あなたの勝利" : "AIの勝利", 480, 306);
    }
  }
  ctx.restore();
}
