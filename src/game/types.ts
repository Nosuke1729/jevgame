export type Side = "player" | "ai";
export type Difficulty = "easy" | "normal" | "hard";
export type Action = "idle" | "run" | "jump" | "normalAttack" | "heavyAttack" | "dodge" | "guard" | "hitStun" | "guardBreak";
export type Intent = "approach" | "retreat" | "normalAttack" | "heavyAttack" | "dodge" | "guard" | "jump" | "wait";
export type Prediction = "attack" | "heavyAttack" | "dodge" | "guard" | "approach" | "retreat" | "jump" | "wait";
export type Mode = "fallback" | "jev";
export type MatchPhase = "title" | "intro" | "fighting" | "roundEnd" | "finished";

export interface Fighter {
  side: Side;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: -1 | 1;
  hp: number;
  stamina: number;
  speed: number;
  jumpPower: number;
  action: Action;
  actionTime: number;
  attackCooldown: number;
  dodgeCooldown: number;
  hitStun: number;
  guarding: boolean;
  attackHasHit: boolean;
  flash: number;
  dodgeInvulnerable: number;
  staminaDelay: number;
}

export interface Controls {
  move: -1 | 0 | 1;
  jump: boolean;
  normalAttack: boolean;
  heavyAttack: boolean;
  dodge: boolean;
  guard: boolean;
}

export interface DecisionState {
  aiHpRatio: number;
  playerHpRatio: number;
  aiStaminaRatio: number;
  playerStaminaRatio: number;
  distance: number;
  playerIsAttacking: boolean;
  playerIsHeavyAttacking: boolean;
  playerIsGuarding: boolean;
  playerIsJumping: boolean;
  aiAttackReady: boolean;
  aiHeavyAttackReady: boolean;
  aiDodgeReady: boolean;
  distanceToLeftWall: number;
  distanceToRightWall: number;
  behavior: BehaviorStats;
}

export interface BehaviorStats {
  count: number;
  overall: Record<Prediction, number>;
  whenAiApproaches: Record<Prediction, number>;
  afterHeavyMiss: Record<Prediction, number>;
  lowHp: Record<Prediction, number>;
  recent: Prediction[];
}

export interface Decision {
  nextAction: Intent;
  playerPrediction: Prediction;
  predictionProbabilities: Record<Prediction, number>;
}

export interface Effect {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface MatchState {
  phase: MatchPhase;
  round: number;
  playerWins: number;
  aiWins: number;
  phaseTime: number;
  lastWinner: Side | null;
}

export interface GameSnapshot {
  paused: boolean;
  player: Fighter;
  ai: Fighter;
  match: MatchState;
  difficulty: Difficulty;
  mode: Mode;
  prediction: Decision;
  lastAiAction: Intent;
  lastJevDecision: Intent | null;
  jevLatency: number | null;
  decisionTime: number | null;
  fps: number;
  behavior: BehaviorStats;
}
