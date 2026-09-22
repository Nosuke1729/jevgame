import assert from "node:assert/strict";
import test from "node:test";
import { createFighter, updateCharacter } from "../src/game/characters/CharacterController";
import { resolveAttack } from "../src/game/combat/CombatSystem";
import { EMPTY_CONTROLS } from "../src/game/constants";
import { fallbackDecision } from "../src/game/ai/FallbackAI";
import { PlayerBehaviorTracker } from "../src/game/ai/PlayerBehaviorTracker";
import { advanceMatch, createMatch, finishRound, startMatch } from "../src/game/state/MatchManager";
import { buildJevRequest, parseJevResponse } from "../src/lib/jev/JevClient";
import { validState } from "../src/lib/jev/validate";
import { GameEngine } from "../src/game/GameEngine";
import { AIController } from "../src/game/ai/AIController";
import { groundDistance, separateSpatialFighters } from "../src/game/spatial";
import { ARENA_DEPTH } from "../src/game/constants";
import type { Controls, DecisionState } from "../src/game/types";

const controls = (patch: Partial<Controls> = {}): Controls => ({ ...EMPTY_CONTROLS, ...patch });

test("3D movement uses depth, normalizes diagonals and stays inside the arena", () => {
  const opponent = createFighter("ai");
  const straight = createFighter("player");
  const diagonal = createFighter("player");
  updateCharacter(straight, controls({ depth: 1 }), opponent, .1, "3d");
  updateCharacter(diagonal, controls({ move: 1, depth: 1 }), opponent, .1, "3d");
  assert.equal(straight.z, 26);
  assert.ok(Math.abs(Math.hypot(diagonal.x - 260, diagonal.z) - 26) < .0001);
  for (let i = 0; i < 600; i++) updateCharacter(straight, controls({ depth: 1 }), opponent, 1 / 60, "3d");
  assert.equal(straight.z, ARENA_DEPTH.front);
  for (let i = 0; i < 600; i++) updateCharacter(straight, controls({ depth: -1 }), opponent, 1 / 60, "3d");
  assert.equal(straight.z, ARENA_DEPTH.back);
  updateCharacter(diagonal, controls({ depth: 1, jump: true }), opponent, 1 / 60, "2d");
  assert.equal(diagonal.z, 0);
  assert.equal(diagonal.vz, 0);
  assert.ok(diagonal.vy < 0, "2D retains jumping independently of depth input");
});

test("3D attacks use depth and facing, and apply depth knockback", () => {
  const attacker = createFighter("player"), target = createFighter("ai");
  target.x = attacker.x;
  target.z = 180;
  attacker.headingX = 0;
  attacker.headingZ = 1;
  attacker.action = "normalAttack";
  attacker.actionTime = .12;
  assert.equal(resolveAttack(attacker, target, "3d"), null, "same x does not hit across depth");
  target.z = -70;
  assert.equal(resolveAttack(attacker, target, "3d"), null, "cannot hit behind locked attack heading");
  target.z = 70;
  assert.equal(resolveAttack(attacker, target, "3d")?.damage, 10);
  assert.equal(target.vx, 0);
  assert.ok(target.vz > 0);
  assert.equal(resolveAttack(attacker, target, "3d"), null, "one hit per attack");
});

test("3D directional guard and depth dodge preserve combat rules", () => {
  const attacker = createFighter("player"), target = createFighter("ai");
  target.x = attacker.x; target.z = 70;
  attacker.headingX = 0; attacker.headingZ = 1;
  attacker.action = "normalAttack"; attacker.actionTime = .12;
  target.headingX = 0; target.headingZ = -1; target.guarding = true;
  assert.equal(resolveAttack(attacker, target, "3d")?.kind, "guard");
  attacker.attackHasHit = false;
  target.headingZ = 1;
  assert.equal(resolveAttack(attacker, target, "3d")?.kind, "hit", "guard does not cover the back");
  const dodger = createFighter("ai");
  dodger.x = attacker.x; dodger.z = 70;
  updateCharacter(dodger, controls({ depth: 1, dodge: true }), attacker, 1 / 60, "3d");
  assert.equal(dodger.vx, 0);
  assert.equal(dodger.vz, 540);
  attacker.attackHasHit = false;
  assert.equal(resolveAttack(attacker, dodger, "3d")?.kind, "dodge");
});

test("3D AI follows an opponent on the depth axis and attacks at close range", () => {
  const ai = createFighter("ai"), player = createFighter("player"), controller = new AIController();
  player.x = ai.x; player.z = 200;
  controller.setIntent("normalAttack");
  for (let i = 0; i < 80; i++) {
    updateCharacter(ai, controller.controls(ai, player, 1 / 60, "3d"), player, 1 / 60, "3d");
    if (resolveAttack(ai, player, "3d")) break;
  }
  assert.ok(ai.z > 0);
  assert.equal(player.hp, 90);
  assert.equal(ai.headingX, 0);
  assert.equal(ai.headingZ, 1);
});

test("3D collisions separate discs without blocking fighters on different depth lanes", () => {
  const a = createFighter("player"), b = createFighter("ai");
  b.x = a.x; b.z = 100;
  separateSpatialFighters(a, b);
  assert.equal(a.x, b.x);
  assert.equal(b.z, 100);
  b.z = 10;
  separateSpatialFighters(a, b);
  assert.ok(Math.abs(groundDistance(a, b, "3d") - 44) < .0001);
  b.x = a.x; b.z = a.z;
  separateSpatialFighters(a, b);
  assert.equal(groundDistance(a, b, "3d"), 44);
});

test("mode switching resets depth, retains 2D and cannot change a running match", () => {
  const game = new GameEngine();
  game.setGameMode("3d");
  game.start("easy");
  assert.equal(game.snapshot().gameMode, "3d");
  game.player.z = 80;
  game.setGameMode("2d");
  assert.equal(game.gameMode, "3d");
  game.setPaused(true);
  const before = game.snapshot();
  game.update(1 / 60, controls({ depth: 1 }));
  assert.deepEqual(game.snapshot(), before);
  game.toTitle();
  game.setGameMode("2d");
  game.start("normal");
  assert.equal(game.snapshot().gameMode, "2d");
  assert.equal(game.player.z, 0);
  assert.equal(game.ai.z, 0);
  assert.equal(game.paused, false);
});

test("pause freezes the round, fighters and effects, and resume continues the same match", () => {
  const game = new GameEngine();
  game.start("easy");
  game.effects.push({ x: 10, y: 20, vx: 30, vy: 40, life: 1, maxLife: 1, color: "white", size: 3 });
  game.setPaused(true);
  const before = game.snapshot();
  for (let i = 0; i < 120; i++) game.update(1 / 60, controls({ move: 1, heavyAttack: true }));
  assert.deepEqual(game.snapshot(), before);
  assert.equal(game.effects[0].life, 1);
  game.setPaused(false);
  game.update(1 / 60, controls());
  assert.ok(game.match.phaseTime > before.match.phaseTime);
  assert.equal(game.match.round, 1);
  assert.equal(game.player.hp, 100);
  game.setPaused(true);
  game.toTitle();
  assert.equal(game.paused, false);
});

test("a Jev response started before pause cannot modify the paused game", async (t) => {
  let resolveRequest: ((response: Response) => void) | undefined;
  t.mock.method(globalThis, "fetch", () => new Promise<Response>(resolve => { resolveRequest = resolve; }));
  const game = new GameEngine();
  game.start("normal");
  game.match.phase = "fighting";
  game.update(1 / 60, controls());
  assert.ok(resolveRequest);
  game.setPaused(true);
  const paused = game.snapshot();
  resolveRequest!(Response.json({ ...game.prediction, nextAction: "guard" }));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(game.snapshot(), paused);
  assert.equal(game.lastJevDecision, null);
});

test("normal and heavy attacks have distinct timing, damage and stamina costs", () => {
  const player = createFighter("player");
  const ai = createFighter("ai");
  ai.x = player.x + 85;
  updateCharacter(player, controls({ normalAttack: true }), ai, 1 / 60);
  assert.equal(player.stamina, 100);
  assert.equal(resolveAttack(player, ai), null);
  for (let i = 0; i < 7; i++) updateCharacter(player, controls(), ai, 1 / 60);
  assert.equal(resolveAttack(player, ai)?.damage, 10);
  assert.equal(ai.hp, 90);
  assert.equal(resolveAttack(player, ai), null);

  const heavy = createFighter("player");
  const defender = createFighter("ai");
  defender.x = heavy.x + 100;
  updateCharacter(heavy, controls({ heavyAttack: true }), defender, 1 / 60);
  assert.equal(heavy.stamina, 74);
  for (let i = 0; i < 8; i++) updateCharacter(heavy, controls(), defender, 1 / 60);
  assert.equal(resolveAttack(heavy, defender), null);
  for (let i = 0; i < 12; i++) updateCharacter(heavy, controls(), defender, 1 / 60);
  assert.equal(resolveAttack(heavy, defender)?.damage, 24);
});

test("dodge avoids an attack, guard consumes stamina and can break", () => {
  const attacker = createFighter("player");
  const defender = createFighter("ai");
  defender.x = attacker.x + 75;
  updateCharacter(defender, controls({ dodge: true, move: 1 }), attacker, 1 / 60);
  assert.equal(defender.stamina, 77);
  attacker.action = "normalAttack";
  attacker.actionTime = 0.12;
  assert.equal(resolveAttack(attacker, defender)?.kind, "dodge");
  assert.equal(defender.hp, 100);

  const guarded = createFighter("ai");
  guarded.x = attacker.x + 75;
  guarded.guarding = true;
  guarded.action = "guard";
  guarded.stamina = 20;
  attacker.action = "heavyAttack";
  attacker.actionTime = 0.32;
  attacker.attackHasHit = false;
  assert.equal(resolveAttack(attacker, guarded)?.kind, "break");
  assert.equal(guarded.action, "guardBreak");
  assert.equal(guarded.stamina, 0);
  assert.equal(guarded.hp, 95);
});

test("stamina recovers over time, and expensive actions are refused when insufficient", () => {
  const fighter = createFighter("player");
  const opponent = createFighter("ai");
  fighter.stamina = 10;
  updateCharacter(fighter, controls({ heavyAttack: true, dodge: true }), opponent, 1 / 60);
  assert.notEqual(fighter.action, "heavyAttack");
  assert.notEqual(fighter.action, "dodge");
  for (let i = 0; i < 60; i++) updateCharacter(fighter, controls(), opponent, 1 / 60);
  assert.ok(fighter.stamina > 30);
});

test("best of three ends at two wins and round transition resets phase", () => {
  const match = createMatch();
  startMatch(match);
  assert.equal(match.phase, "intro");
  advanceMatch(match, 1.3);
  finishRound(match, "player");
  assert.equal(match.phase, "roundEnd");
  assert.equal(advanceMatch(match, 2.2), true);
  assert.equal(match.round, 2);
  advanceMatch(match, 1.3);
  finishRound(match, "player");
  assert.equal(match.phase, "finished");
  assert.equal(match.playerWins, 2);
});

test("behavior tracker keeps 30 recent actions and context distributions", () => {
  const tracker = new PlayerBehaviorTracker();
  for (let i = 0; i < 35; i++) tracker.record("attack", ["whenAiApproaches"]);
  tracker.record("dodge", ["afterHeavyMiss", "lowHp"]);
  const stats = tracker.snapshot();
  assert.equal(stats.count, 30);
  assert.equal(stats.overall.attack, 0.967);
  assert.equal(stats.afterHeavyMiss.dodge, 1);
  assert.equal(stats.lowHp.dodge, 1);
});

test("Jev answer validation rejects malformed choices and probability maps", () => {
  const stats = new PlayerBehaviorTracker().snapshot();
  const state: DecisionState = { aiHpRatio: 1, playerHpRatio: 1, aiStaminaRatio: 1, playerStaminaRatio: 1, distance: 300, playerIsAttacking: false, playerIsHeavyAttacking: false, playerIsGuarding: false, playerIsJumping: false, aiAttackReady: true, aiHeavyAttackReady: true, aiDodgeReady: true, distanceToLeftWall: 500, distanceToRightWall: 400, behavior: stats };
  const request = buildJevRequest(state);
  assert.equal(validState(state), true);
  assert.equal(validState({ ...state, behavior: { ...state.behavior, recent: ["invalid"] } }), false);
  assert.equal(request.questions.nextAction.type, "choice");
  const probs = { attack: .4, heavyAttack: .1, dodge: .2, guard: .1, approach: .1, retreat: .05, jump: .03, wait: .02 };
  const response = { answers: { nextAction: { type: "choice", choice: "approach" }, playerPrediction: { type: "choice", choice: "attack", probabilities: probs } } };
  assert.equal(parseJevResponse(response)?.nextAction, "approach");
  assert.equal(parseJevResponse({ answers: { ...response.answers, nextAction: { type: "choice", choice: "teleport" } } }), null);
  assert.equal(parseJevResponse({ answers: { ...response.answers, playerPrediction: { type: "choice", choice: "attack", probabilities: { attack: 1 } } } }), null);
  assert.equal(fallbackDecision(state, "normal", () => 0).nextAction, "approach");
});
