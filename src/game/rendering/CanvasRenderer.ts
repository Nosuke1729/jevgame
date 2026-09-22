import { ARENA, ATTACKS } from "../constants";
import type { Effect, Fighter, MatchState } from "../types";

function polygon(ctx: CanvasRenderingContext2D, points: number[][], color: string): void {
  ctx.fillStyle = color; ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
}

function limb(ctx: CanvasRenderingContext2D, points: number[][], color: string, width: number): void {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
}

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, time: number): void {
  const color = f.side === "player" ? "#9bcac1" : "#dba58c";
  const cloth = f.side === "player" ? "#3b716b" : "#945f50";
  const dark = f.side === "player" ? "#233f3c" : "#543d34";
  const airborne = ARENA.floor - f.y;
  const moving = Math.abs(f.vx) > 25;
  const stride = moving && airborne < 3 ? Math.sin(time * 18) * 13 : 0;
  const attacking = f.action === "normalAttack" || f.action === "heavyAttack";
  const attack = attacking ? ATTACKS[f.action as keyof typeof ATTACKS] : null;
  const active = attack && f.actionTime >= attack.startup && f.actionTime <= attack.startup + attack.active;
  const windup = attack && f.actionTime < attack.startup;
  const guard = f.action === "guard";
  const lean = f.action === "hitStun" ? -13 : active ? 17 : moving ? 5 : windup ? -7 : 0;
  const bob = moving ? Math.abs(stride) * .15 : Math.sin(time * 3) * 1.2;
  ctx.save();
  ctx.fillStyle = "#15251d"; ctx.globalAlpha = .3;
  ctx.beginPath(); ctx.ellipse(f.x, ARENA.floor + 4, Math.max(14, 35 - airborne * .05), 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(f.x, f.y + bob); ctx.scale(f.facing, 1);
  if (f.action === "dodge") {
    for (let i = 3; i > 0; i--) {
      ctx.globalAlpha = .12 / i;
      polygon(ctx, [[-25 - i * 16,-92], [13 - i * 16,-92], [24 - i * 16,-34], [-22 - i * 16,-34]], color);
    }
    ctx.globalAlpha = .85;
  }
  const fill = f.flash > 0 ? "#f7efd8" : cloth;
  limb(ctx, [[-8,-47], [-16-stride,-23], [-21-stride,-4]], dark, 15);
  limb(ctx, [[9,-47], [17+stride,-24], [24+stride,-4]], fill, 16);
  limb(ctx, [[-24-stride,-3], [-10-stride,-3]], "#202e27", 8);
  limb(ctx, [[19+stride,-3], [32+stride,-3]], "#202e27", 8);
  polygon(ctx, [[-21+lean,-85], [12+lean,-89], [20,-42], [-23,-42]], fill);
  polygon(ctx, [[-6+lean,-87], [9+lean,-89], [4,-50], [-9,-49]], color);
  limb(ctx, [[-21,-46], [19,-46]], "#d2c49b", 6);
  polygon(ctx, [[12,-46],[24+Math.sin(time*5)*3,-22],[13,-28],[6,-46]], "#d2c49b");
  limb(ctx, [[-12+lean,-80], [-27+lean,-62], [-13+lean,-59]], dark, 11);
  ctx.fillStyle = f.flash > 0 ? "#fff5df" : "#d5b99a";
  ctx.beginPath(); ctx.ellipse(lean,-105,14,18,-.15,0,Math.PI*2); ctx.fill();
  polygon(ctx, [[-16+lean,-111],[-13+lean,-121],[7+lean,-125],[16+lean,-114],[12+lean,-106],[-5+lean,-111]], "#27352d");
  limb(ctx, [[-13+lean,-111], [13+lean,-111]], color, 5);
  polygon(ctx, [[-12+lean,-111],[-38+lean,-110+Math.sin(time*5)*5],[-30+lean,-104],[-12+lean,-107]], color);
  ctx.fillStyle="#29352c"; ctx.fillRect(7+lean,-105,4,2);
  const handX = active ? 58 : guard ? 24 : windup ? -20 : 27;
  const handY = active ? -66 : guard ? -104 : windup ? -91 : -66;
  limb(ctx, [[10+lean,-80], [active ? 35+lean : 26+lean,-79], [handX+lean,handY]], fill, 13);
  limb(ctx, [[handX+lean-3,handY], [handX+lean+3,handY-2]], "#dfc8a4", 10);
  if (guard) {
    ctx.strokeStyle=color; ctx.globalAlpha=.7; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(7,-65,53,-1.2,1.1); ctx.stroke(); ctx.globalAlpha=1;
  }
  if (active) {
    ctx.strokeStyle=f.action==="heavyAttack"?"#edc992":color; ctx.lineWidth=f.action==="heavyAttack"?10:5; ctx.globalAlpha=.8;
    ctx.beginPath(); ctx.ellipse(15,-65,attack!.reach*.7,42,0,-.9,.6); ctx.stroke(); ctx.globalAlpha=1;
  }
  if (f.action === "guardBreak") { ctx.fillStyle="#f0d48f"; ctx.font="bold 20px sans-serif"; ctx.fillText("!",-4,-140); }
  ctx.restore();
}

function pine(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.fillStyle=color;ctx.fillRect(x-2,y-size,4,size);
  for(let level=0;level<4;level++) {
    const top=y-size-level*size*.12, width=size*(.27-level*.035);
    polygon(ctx,[[x,top-size*.3],[x-width,top+size*.2],[x+width,top+size*.2]],color);
  }
}

function drawEnvironment(ctx: CanvasRenderingContext2D, time: number): void {
  const sky=ctx.createLinearGradient(0,0,0,430);
  sky.addColorStop(0,"#647e79");sky.addColorStop(.65,"#bac2a5");sky.addColorStop(1,"#d3c79e");
  ctx.fillStyle=sky;ctx.fillRect(0,0,960,540);
  ctx.fillStyle="#e3c992";ctx.beginPath();ctx.arc(701,128,48,0,Math.PI*2);ctx.fill();
  polygon(ctx,[[0,277],[87,208],[135,237],[252,134],[355,242],[454,183],[568,255],[668,201],[760,262],[888,163],[960,235],[960,430],[0,430]],"#8b9e8d");
  polygon(ctx,[[0,300],[114,266],[199,295],[328,234],[440,301],[579,247],[671,291],[792,241],[960,315],[960,435],[0,435]],"#708c7d");
  polygon(ctx,[[0,340],[102,323],[189,352],[302,305],[433,349],[536,315],[692,351],[811,299],[960,333],[960,450],[0,450]],"#567967");
  ctx.globalAlpha=.2;ctx.fillStyle="#e2d9b7";ctx.fillRect(0,289,960,10);ctx.fillRect(0,331,960,5);ctx.globalAlpha=1;
  for(const [x,s] of [[52,83],[106,107],[165,74],[798,103],[853,143],[915,99]]) pine(ctx,x,385,s,"#426553");
  // A distant gate anchors the arena without competing with the fighters.
  ctx.fillStyle="#45604c";ctx.fillRect(555,295,7,79);ctx.fillRect(626,295,7,79);
  polygon(ctx,[[537,288],[549,293],[638,293],[650,286],[643,304],[545,304]],"#425b46");
  ctx.fillRect(548,314,93,5);
  // Timber posts frame the view from an open dojo.
  ctx.fillStyle="#344e3e";ctx.fillRect(0,0,34,442);ctx.fillRect(926,0,34,442);
  ctx.fillStyle="#4b6550";ctx.fillRect(30,0,7,436);ctx.fillRect(923,0,7,436);
  polygon(ctx,[[0,0],[960,0],[960,28],[0,14]],"#2e4738");
  ctx.fillStyle="#44614a";ctx.fillRect(0,30,960,5);
  for (const x of [48,898]) { ctx.fillStyle="#8d936a";ctx.fillRect(x,35,2,33);ctx.fillStyle="#dac994";ctx.beginPath();ctx.roundRect(x-8,68,19,31,4);ctx.fill();ctx.fillStyle="#5e7250";ctx.fillRect(x-9,66,21,4);ctx.fillRect(x-9,97,21,4); }
  // Deck rail and foreground boards.
  ctx.fillStyle="#557051";ctx.fillRect(0,377,960,7);ctx.fillRect(0,414,960,5);
  for(let x=13;x<960;x+=83) ctx.fillRect(x,381,6,55);
  ctx.fillStyle="#334e39";ctx.fillRect(0,430,960,9);
  const floor=ctx.createLinearGradient(0,437,0,540);floor.addColorStop(0,"#8a936a");floor.addColorStop(1,"#576c4b");
  ctx.fillStyle=floor;ctx.fillRect(0,437,960,103);
  ctx.fillStyle="#b1ae7e";ctx.fillRect(0,437,960,3);
  ctx.strokeStyle="#394f3866";ctx.lineWidth=1;
  for(const y of [461,491,529]) {ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(960,y);ctx.stroke();}
  for(let x=-150;x<1150;x+=126) {ctx.beginPath();ctx.moveTo(x,540);ctx.lineTo(480+(x-480)*.72,437);ctx.stroke();}
  ctx.globalAlpha=.15;ctx.fillStyle="#dbe0b1";
  for(let i=0;i<8;i++){const x=(i*137+time*9)%960,y=110+(i*53)%257+Math.sin(time*.6+i)*9;ctx.beginPath();ctx.ellipse(x,y,3,1.2,-.5,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
}

function drawEffects(ctx: CanvasRenderingContext2D, effects: Effect[]): void {
  for(const effect of effects){ctx.globalAlpha=effect.life/effect.maxLife;ctx.fillStyle=effect.color;ctx.fillRect(effect.x,effect.y,effect.size,effect.size);}
  ctx.globalAlpha=1;
}

export function renderGame(ctx: CanvasRenderingContext2D, player: Fighter, ai: Fighter, match: MatchState, effects: Effect[], shake: number, time: number): void {
  ctx.save();ctx.clearRect(0,0,ARENA.width,ARENA.height);
  if(shake>0)ctx.translate((Math.random()-.5)*shake*2,(Math.random()-.5)*shake*2);
  drawEnvironment(ctx,time);drawFighter(ctx,player,time);drawFighter(ctx,ai,time);drawEffects(ctx,effects);
  if(match.phase==="intro"||match.phase==="roundEnd") {
    ctx.fillStyle="#16241c99";ctx.fillRect(0,0,960,540);ctx.textAlign="center";
    ctx.fillStyle="#d7dec6";ctx.font="500 21px sans-serif";ctx.fillText("第"+match.round+"ラウンド",480,224);
    ctx.fillStyle=match.phase==="intro"?"#f0e3bf":match.lastWinner==="player"?"#a7d8c6":"#edb99a";
    ctx.font="600 53px sans-serif";ctx.fillText(match.phase==="intro"?"開始！":match.lastWinner==="player"?"あなたの勝利":"相手の勝利",480,297);
  }
  ctx.restore();
}
