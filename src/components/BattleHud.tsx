import { MAX_HP, MAX_STAMINA } from "../game/constants";
import type { Fighter, MatchState } from "../game/types";

function FighterMeter({ fighter }: { fighter: Fighter }) {
  const player = fighter.side === "player";
  return <div className={`fighter-meter ${player ? "player-meter" : "enemy-meter"}`}>
    <div className="fighter-name"><span><i />{player ? "あなた" : "相手"}</span><strong>{Math.ceil(fighter.hp)}<small> / {MAX_HP}</small></strong></div>
    <div className="health-track" role="meter" aria-label={`${player ? "あなた" : "相手"}の体力`} aria-valuenow={Math.ceil(fighter.hp)} aria-valuemin={0} aria-valuemax={MAX_HP}><span style={{ transform: `scaleX(${fighter.hp / MAX_HP})` }} /></div>
    <div className="energy-track" role="meter" aria-label={`${player ? "あなた" : "相手"}のスタミナ`} aria-valuenow={Math.ceil(fighter.stamina)} aria-valuemin={0} aria-valuemax={MAX_STAMINA}><span style={{ transform: `scaleX(${fighter.stamina / MAX_STAMINA})` }} /></div>
    <div className="energy-label">スタミナ <span>{Math.ceil(fighter.stamina)}</span></div>
  </div>;
}

export function BattleHud({ player, ai, match }: { player: Fighter; ai: Fighter; match: MatchState }) {
  return <div className="battle-hud">
    <FighterMeter fighter={player} />
    <div className="round-score"><span>第{match.round}ラウンド</span><div aria-label={`ラウンド獲得数 あなた${match.playerWins}対相手${match.aiWins}`}><b>{match.playerWins}</b><i>:</i><b>{match.aiWins}</b></div><small>2本先取</small></div>
    <FighterMeter fighter={ai} />
  </div>;
}
