import assert from "node:assert/strict";
import test from "node:test";
import { createFighter, updateCharacter } from "../src/game/characters/CharacterController";
import { resolveAttack } from "../src/game/combat/CombatSystem";
import { EMPTY_CONTROLS } from "../src/game/constants";
import { fallbackDecision } from "../src/game/ai/FallbackAI";
import { PlayerBehaviorTracker } from "../src/game/ai/PlayerBehaviorTracker";
import { advanceMatch, createMatch, finishRound, startMatch } from "../src/game/state/MatchManager";
import { buildJevRequest, parseJevResponse } from "../src/lib/jev/JevClient";
import type { Controls, DecisionState } from "../src/game/types";

const controls = (patch: Partial<Controls> = {}): Controls => ({ ...EMPTY_CONTROLS, ...patch });

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
  assert.equal(request.questions.nextAction.type, "choice");
  const probs = { attack: .4, heavyAttack: .1, dodge: .2, guard: .1, approach: .1, retreat: .05, jump: .03, wait: .02 };
  const response = { answers: { nextAction: { type: "choice", choice: "approach" }, playerPrediction: { type: "choice", choice: "attack", probabilities: probs } } };
  assert.equal(parseJevResponse(response)?.nextAction, "approach");
  assert.equal(parseJevResponse({ answers: { ...response.answers, nextAction: { type: "choice", choice: "teleport" } } }), null);
  assert.equal(parseJevResponse({ answers: { ...response.answers, playerPrediction: { type: "choice", choice: "attack", probabilities: { attack: 1 } } } }), null);
  assert.equal(fallbackDecision(state, "normal", () => 0).nextAction, "approach");
});
