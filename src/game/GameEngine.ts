import { ARENA, ATTACKS, DIFFICULTIES, EMPTY_CONTROLS, MAX_HP, MAX_STAMINA } from "./constants";
import { createFighter, updateCharacter } from "./characters/CharacterController";
import { resolveAttack, type HitResult } from "./combat/CombatSystem";
import { AIController } from "./ai/AIController";
import { fallbackDecision } from "./ai/FallbackAI";
import { JEV_API_ENABLED } from "./ai/JevAvailability";
import { PlayerBehaviorTracker, type BehaviorContext } from "./ai/PlayerBehaviorTracker";
import { advanceMatch, createMatch, finishRound, startMatch } from "./state/MatchManager";
import type { Controls, Decision, DecisionState, Difficulty, Effect, Fighter, GameSnapshot, Intent, Mode, Prediction } from "./types";

export class GameEngine {
  player = createFighter("player");
  ai = createFighter("ai");
  match = createMatch();
  difficulty: Difficulty = "normal";
  mode: Mode = "fallback";
  prediction: Decision;
  lastAiAction: Intent = "approach";
  lastJevDecision: Intent | null = null;
  jevLatency: number | null = null;
  decisionTime: number | null = null;
  fps = 60;
  effects: Effect[] = [];
  shake = 0;
  hitStop = 0;
  private tracker = new PlayerBehaviorTracker();
  private controller = new AIController();
  private decisionTimer = 0;
  private decisionId = 0;
  private requestPending = false;
  private retryAt = 0;
  private elapsed = 0;
  private queuedIntent: { action: Intent; at: number } | null = null;
  private movementRecordTimer = 0;
  private heavyMissWindow = 0;

  constructor() { this.prediction = fallbackDecision(this.decisionState(), "normal"); }

  start(difficulty: Difficulty): void {
    this.difficulty = difficulty;
    this.player = createFighter("player");
    this.ai = createFighter("ai");
    this.tracker = new PlayerBehaviorTracker();
    this.controller = new AIController();
    this.mode = "fallback";
    this.lastJevDecision = null;
    this.jevLatency = null;
    this.decisionTime = null;
    this.decisionTimer = DIFFICULTIES[difficulty].interval / 1000;
    this.requestPending = false;
    this.retryAt = 0;
    this.decisionId++;
    this.effects = [];
    this.shake = 0;
    this.hitStop = 0;
    this.heavyMissWindow = 0;
    this.movementRecordTimer = 0;
    this.lastAiAction = "approach";
    this.queuedIntent = null;
    this.prediction = fallbackDecision(this.decisionState(), difficulty);
    startMatch(this.match);
  }

  toTitle(): void {
    this.match = createMatch();
    this.player = createFighter("player");
    this.ai = createFighter("ai");
    this.effects = [];
    this.shake = 0;
    this.hitStop = 0;
    this.tracker = new PlayerBehaviorTracker();
    this.controller = new AIController();
    this.lastAiAction = "approach";
    this.lastJevDecision = null;
    this.jevLatency = null;
    this.decisionTime = null;
    this.mode = "fallback";
    this.prediction = fallbackDecision(this.decisionState(), this.difficulty);
    this.decisionId++;
    this.requestPending = false;
    this.queuedIntent = null;
  }

  update(dt: number, input: Controls): void {
    const step = Math.min(dt, 0.035);
    this.elapsed += step;
    this.fps = this.fps * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1;
    this.effects = this.effects.filter((effect) => (effect.life -= step) > 0);
    for (const effect of this.effects) { effect.x += effect.vx * step; effect.y += effect.vy * step; effect.vy += 420 * step; }
    this.shake = Math.max(0, this.shake - step * 20);
    this.heavyMissWindow = Math.max(0, this.heavyMissWindow - step);
    if (advanceMatch(this.match, step)) this.resetFighters();
    if (this.match.phase !== "fighting") return;
    if (this.hitStop > 0) { this.hitStop -= step; return; }

    this.decisionTimer += step;
    if (this.queuedIntent && this.elapsed >= this.queuedIntent.at) {
      this.controller.setIntent(this.queuedIntent.action);
      this.lastAiAction = this.queuedIntent.action;
      this.queuedIntent = null;
    }
    if (this.decisionTimer >= DIFFICULTIES[this.difficulty].interval / 1000) {
      this.decisionTimer = 0;
      this.decide();
    }

    const aiInput = this.controller.controls(this.ai, this.player, step);
    const playerEvents = updateCharacter(this.player, input, this.ai, step);
    const aiEvents = updateCharacter(this.ai, aiInput, this.player, step);
    this.separateFighters();
    if (playerEvents.startedAttack) {
      this.record(playerEvents.startedAttack === "normalAttack" ? "attack" : "heavyAttack");
      if (playerEvents.startedAttack === "heavyAttack") this.decisionTimer = DIFFICULTIES[this.difficulty].interval / 1000;
    }
    if (playerEvents.dodged) this.record("dodge");
    if (playerEvents.jumped) this.record("jump");
    if (playerEvents.guardStarted) this.record("guard");
    if (playerEvents.heavyMiss) this.heavyMissWindow = 1.4;
    this.movementRecordTimer += step;
    if (this.movementRecordTimer >= 0.65 && input.move !== 0 && this.player.action === "run") {
      this.record(input.move === this.player.facing ? "approach" : "retreat");
      this.movementRecordTimer = 0;
    }
    const playerHit = resolveAttack(this.player, this.ai);
    const aiHit = resolveAttack(this.ai, this.player);
    if (playerHit) { this.onHit(playerHit, "player"); if (playerHit.kind === "hit" || playerHit.kind === "break") this.decisionTimer = DIFFICULTIES[this.difficulty].interval / 1000; }
    if (aiHit) this.onHit(aiHit, "ai");
    if (this.player.hp <= 0 || this.ai.hp <= 0) {
      finishRound(this.match, this.ai.hp <= 0 ? "player" : "ai");
      this.queuedIntent = null;
      this.decisionId++;
    }
    void aiEvents;
  }

  snapshot(): GameSnapshot {
    return {
      player: { ...this.player }, ai: { ...this.ai }, match: { ...this.match }, difficulty: this.difficulty,
      mode: this.mode, prediction: this.prediction, lastAiAction: this.lastAiAction,
      lastJevDecision: this.lastJevDecision, jevLatency: this.jevLatency, decisionTime: this.decisionTime,
      fps: this.fps, behavior: this.tracker.snapshot(),
    };
  }

  private resetFighters(): void {
    this.player = createFighter("player");
    this.ai = createFighter("ai");
    this.controller = new AIController();
    this.decisionTimer = DIFFICULTIES[this.difficulty].interval / 1000;
    this.queuedIntent = null;
    this.decisionId++;
  }

  private separateFighters(): void {
    const dx = this.ai.x - this.player.x;
    const overlap = 43 - Math.abs(dx);
    if (overlap > 0 && Math.abs(this.ai.y - this.player.y) < 68) {
      const direction = dx >= 0 ? 1 : -1;
      this.player.x = Math.max(ARENA.left + 22, Math.min(ARENA.right - 22, this.player.x - direction * overlap / 2));
      this.ai.x = Math.max(ARENA.left + 22, Math.min(ARENA.right - 22, this.ai.x + direction * overlap / 2));
    }
  }

  private onHit(hit: HitResult, attacker: "player" | "ai"): void {
    const colors = { hit: attacker === "player" ? "#39dfe6" : "#ff727e", guard: "#80bbff", break: "#ffd36a", dodge: "#dcfbff" };
    const color = colors[hit.kind];
    for (let i = 0; i < (hit.kind === "hit" ? 15 : 9); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 230;
      const life = 0.2 + Math.random() * 0.25;
      this.effects.push({ x: hit.x, y: hit.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color, size: 2 + Math.random() * 4 });
    }
    this.shake = hit.kind === "hit" ? Math.min(8, hit.damage * 0.3) : 3;
    this.hitStop = hit.kind === "hit" ? (hit.damage > 20 ? 0.08 : 0.045) : 0.025;
  }

  private record(action: Prediction): void {
    const contexts: BehaviorContext[] = [];
    if (this.controller.intent === "approach" && Math.abs(this.ai.x - this.player.x) < 260) contexts.push("whenAiApproaches");
    if (this.heavyMissWindow > 0) contexts.push("afterHeavyMiss");
    if (this.player.hp / MAX_HP <= 0.3) contexts.push("lowHp");
    this.tracker.record(action, contexts);
  }

  private decisionState(): DecisionState {
    return {
      aiHpRatio: Number((this.ai.hp / MAX_HP).toFixed(2)), playerHpRatio: Number((this.player.hp / MAX_HP).toFixed(2)),
      aiStaminaRatio: Number((this.ai.stamina / MAX_STAMINA).toFixed(2)), playerStaminaRatio: Number((this.player.stamina / MAX_STAMINA).toFixed(2)),
      distance: Math.round(Math.abs(this.ai.x - this.player.x)),
      playerIsAttacking: this.player.action === "normalAttack" || this.player.action === "heavyAttack",
      playerIsHeavyAttacking: this.player.action === "heavyAttack",
      playerIsGuarding: this.player.guarding,
      playerIsJumping: this.player.y < ARENA.floor - 2,
      aiAttackReady: this.ai.attackCooldown <= 0,
      aiHeavyAttackReady: this.ai.attackCooldown <= 0 && this.ai.stamina >= ATTACKS.heavyAttack.stamina,
      aiDodgeReady: this.ai.dodgeCooldown <= 0 && this.ai.stamina >= 23,
      distanceToLeftWall: Math.round(this.ai.x - ARENA.left), distanceToRightWall: Math.round(ARENA.right - this.ai.x),
      behavior: this.tracker.snapshot(),
    };
  }

  private decide(): void {
    const state = this.decisionState();
    const fallback = fallbackDecision(state, this.difficulty);
    this.prediction = fallback;
    this.queueIntent(fallback.nextAction);
    if (!JEV_API_ENABLED || this.requestPending || performance.now() < this.retryAt) return;
    this.requestPending = true;
    const id = ++this.decisionId;
    const started = performance.now();
    void fetch("/api/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) })
      .then(async (response) => { if (!response.ok) throw new Error("Jev unavailable"); return response.json() as Promise<Decision>; })
      .then((decision) => {
        if (id !== this.decisionId || this.match.phase !== "fighting" || performance.now() - started > 900) return;
        if (!decision || typeof decision.nextAction !== "string" || typeof decision.playerPrediction !== "string" || !decision.predictionProbabilities) throw new Error("Invalid decision");
        this.mode = "jev";
        this.jevLatency = Math.round(performance.now() - started);
        this.lastJevDecision = decision.nextAction;
        this.decisionTime = Date.now();
        this.prediction = decision;
        this.queueIntent(decision.nextAction);
      })
      .catch(() => { this.mode = "fallback"; this.retryAt = performance.now() + 12000; })
      .finally(() => { this.requestPending = false; });
  }

  private queueIntent(action: Intent): void {
    this.queuedIntent = { action, at: this.elapsed + DIFFICULTIES[this.difficulty].reaction / 1000 };
  }
}
