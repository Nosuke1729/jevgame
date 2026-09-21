import type { MatchState, Side } from "../types";

export function createMatch(): MatchState {
  return { phase: "title", round: 1, playerWins: 0, aiWins: 0, phaseTime: 0, lastWinner: null };
}

export function startMatch(state: MatchState): void {
  state.phase = "intro";
  state.round = 1;
  state.playerWins = 0;
  state.aiWins = 0;
  state.lastWinner = null;
  state.phaseTime = 0;
}

export function finishRound(state: MatchState, winner: Side): void {
  if (state.phase !== "fighting") return;
  state.lastWinner = winner;
  if (winner === "player") state.playerWins += 1;
  else state.aiWins += 1;
  state.phase = state.playerWins >= 2 || state.aiWins >= 2 ? "finished" : "roundEnd";
  state.phaseTime = 0;
}

export function advanceMatch(state: MatchState, dt: number): boolean {
  state.phaseTime += dt;
  if (state.phase === "intro" && state.phaseTime >= 1.25) {
    state.phase = "fighting";
    state.phaseTime = 0;
  }
  if (state.phase === "roundEnd" && state.phaseTime >= 2.1) {
    state.round += 1;
    state.phase = "intro";
    state.phaseTime = 0;
    return true;
  }
  return false;
}
