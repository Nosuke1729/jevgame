"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Box, Check, CircleHelp, Maximize, Minimize, Pause, Play, RotateCcw, Settings2, Swords, Target, Square } from "lucide-react";
import { ARENA, DIFFICULTIES } from "../game/constants";
import { JEV_API_ENABLED } from "../game/ai/JevAvailability";
import type { Difficulty, GameMode } from "../game/types";
import { groundDistance } from "../game/spatial";
import { BattleHud } from "./BattleHud";
import { ControlsDialog, controlLabels } from "./ControlsDialog";
import { TouchControls } from "./TouchControls";
import { useGameSession } from "./useGameSession";

const descriptions: Record<Difficulty, string> = { easy: "ゆっくり、間合いをつかむ", normal: "攻めと守りを試す", hard: "癖を読まれる緊張感" };
const actionNames: Record<string, string> = { idle: "待機", run: "移動", jump: "ジャンプ", normalAttack: "通常攻撃", heavyAttack: "強攻撃", dodge: "回避", guard: "ガード", hitStun: "被弾", guardBreak: "ガード崩し", approach: "接近", retreat: "後退", wait: "様子見" };

export default function Game() {
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [gameMode, setGameMode] = useState<GameMode>("2d");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [help, setHelp] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState("");
  const rootRef = useRef<HTMLElement>(null);
  const resumeAfterHelp = useRef(false);
  const game = useGameSession(reducedMotion, gameMode);
  const { snapshot } = game;
  const phase = snapshot.match.phase;
  const title = phase === "title";
  const finished = phase === "finished";
  const inMatch = !title && !finished;

  useEffect(() => {
    try {
      const stored = localStorage.getItem("jev-difficulty");
      if (stored === "easy" || stored === "normal" || stored === "hard") setDifficulty(stored);
      const storedMode = localStorage.getItem("jev-game-mode");
      if (storedMode === "2d" || storedMode === "3d") setGameMode(storedMode);
      const motion = localStorage.getItem("jev-reduced-motion");
      setReducedMotion(motion === null ? matchMedia("(prefers-reduced-motion: reduce)").matches : motion === "true");
    } catch { /* Preferences are optional when storage is unavailable. */ }
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  const chooseDifficulty = (value: Difficulty) => { setDifficulty(value); try { localStorage.setItem("jev-difficulty", value); } catch {} };
  const chooseMode = (value: GameMode) => { game.title(); setGameMode(value); try { localStorage.setItem("jev-game-mode", value); } catch {} };
  const toggleMotion = () => { const value = !reducedMotion; setReducedMotion(value); try { localStorage.setItem("jev-reduced-motion", String(value)); } catch {} };
  const openHelp = () => { resumeAfterHelp.current = inMatch && !snapshot.paused; game.pause(); setHelp(true); };
  const closeHelp = () => { setHelp(false); if (resumeAfterHelp.current) game.resume(); };
  const toggleFullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await rootRef.current?.requestFullscreen(); }
    catch { setNotice("このブラウザーでは全画面表示を利用できません。"); }
  };
  const probs = snapshot.prediction.predictionProbabilities;
  const predictions = [
    { name: "攻撃", value: probs.attack + probs.heavyAttack }, { name: "回避", value: probs.dodge },
    { name: "ガード", value: probs.guard }, { name: "その他", value: Math.max(0, 1 - probs.attack - probs.heavyAttack - probs.dodge - probs.guard) },
  ];
  const strongest = [...predictions].sort((a, b) => b.value - a.value)[0];
  const status = title ? "対戦準備完了" : snapshot.paused ? "一時停止中" : finished ? "対戦終了" : snapshot.mode === "jev" ? "Jev接続中" : "標準AIで対戦中";

  return <main className={`game-app ${reducedMotion ? "reduced-motion" : ""}`} ref={rootRef}>
    <header className="app-header">
      <div className="wordmark"><span className="brand-icon" aria-hidden="true"><Swords size={19} /></span><strong>JEV</strong><span className="brand-divider" /><span>読み合いの闘技場</span></div>
      <nav aria-label="ゲーム設定"><button className="toolbar-button" onClick={openHelp}><CircleHelp size={17} /><span>操作方法</span></button><button className="toolbar-button" aria-pressed={reducedMotion} onClick={toggleMotion} title="演出の動きと画面の揺れを抑える"><Settings2 size={17} /><span>動きを抑える</span>{reducedMotion && <Check size={13} />}</button></nav>
    </header>
    <div className="game-layout">
      <section className="play-section" aria-label="対戦">
        <div className="section-toolbar"><div><h1>対戦</h1><span className="mode-label">{gameMode === "3d" ? "3D 立体対戦" : "2D 横視点"}</span></div><div className="arena-tools">{inMatch && <button className="toolbar-button" onClick={() => snapshot.paused ? game.resume() : game.pause()}>{snapshot.paused ? <Play size={16} /> : <Pause size={16} />}<span>{snapshot.paused ? "再開" : "一時停止"}</span><kbd>Esc</kbd></button>}<button className="icon-button" onClick={toggleFullscreen} aria-label={fullscreen ? "全画面を終了" : "全画面表示"} title={fullscreen ? "全画面を終了" : "全画面表示"}>{fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button></div></div>
        {title && <fieldset className="game-mode-picker"><legend>遊ぶモード</legend>{(["2d", "3d"] as GameMode[]).map(mode => <label key={mode} className={gameMode === mode ? "selected" : ""}><input type="radio" name="game-mode" checked={gameMode === mode} onChange={() => chooseMode(mode)} value={mode} aria-label={mode === "2d" ? "2D 横視点" : "3D 立体対戦"} />{mode === "2d" ? <Square size={20} /> : <Box size={20} />}<span><b>{mode === "2d" ? "2D 横視点" : "3D 立体対戦"}</b><small>{mode === "2d" ? "左右の間合いで勝負" : "奥行きを使って回り込む"}</small></span>{gameMode === mode && <Check size={15} />}</label>)}</fieldset>}
        <div className="arena-frame">
          <BattleHud player={snapshot.player} ai={snapshot.ai} match={snapshot.match} />
          <div className={`stage ${title ? "is-title" : ""}`} ref={game.stageRef} tabIndex={0} aria-label={gameMode === "3d" ? "3D対戦アリーナ。WASDで移動、Spaceでジャンプ、Escで一時停止。" : "対戦アリーナ。AとDで移動、Jで攻撃、Escで一時停止。"} onKeyDown={event => { if (event.code === "Enter" && title && event.target === event.currentTarget) game.start(difficulty); }}>
            <canvas ref={game.canvasRef} width={ARENA.width} height={ARENA.height} aria-label="夕暮れの道場で戦う2人のファイター" style={{ visibility: gameMode === "3d" ? "hidden" : "visible" }} aria-hidden={gameMode === "3d"} />
            <div className="three-stage" ref={game.threeContainerRef} hidden={gameMode !== "3d"} />
            <span className="stage-caption" aria-hidden="true">夕凪の道場 {gameMode === "3d" ? "・ 3D" : ""}</span>
            {gameMode === "3d" && !snapshot.paused && (phase === "intro" || phase === "roundEnd") && <div className="round-overlay" role="status"><span>第{snapshot.match.round}ラウンド</span><strong>{phase === "intro" ? "開始！" : snapshot.match.lastWinner === "player" ? "あなたの勝利" : "相手の勝利"}</strong></div>}
            {title && <div className="lobby-overlay"><div className="lobby-panel">
              <span className="lobby-tag"><span /> 1 対 1 ・ 2本先取</span><h2>対戦をはじめる</h2><p>あなたの動きを覚える相手と、<br />攻めと守りの駆け引きを。</p>
              <fieldset className="difficulty-picker"><legend>難易度</legend><div>{(["easy", "normal", "hard"] as Difficulty[]).map(value => <label key={value} className={difficulty === value ? "selected" : ""}><input type="radio" name="difficulty" value={value} checked={difficulty === value} onChange={() => chooseDifficulty(value)} /><span>{DIFFICULTIES[value].label}</span></label>)}</div></fieldset>
              <p className="difficulty-description">{descriptions[difficulty]}</p>{gameMode === "3d" && <p className="mode-controls-hint">WASD で前後左右 ／ Space でジャンプ</p>}<button className="button primary start-button" disabled={gameMode === "3d" && game.graphics !== "ready"} onClick={() => game.start(difficulty)}><Play size={17} fill="currentColor" />{gameMode === "3d" && game.graphics === "loading" ? "3Dを準備中…" : "対戦開始"}<ArrowRight size={18} /></button><button className="lobby-help" onClick={openHelp}>はじめて遊ぶ方へ <CircleHelp size={14} /></button>
            </div><div className="lobby-seal" aria-hidden="true">読<br />み<br />合<br />い</div></div>}
            {snapshot.paused && <div className="pause-overlay"><div className="pause-panel"><span className="overlay-icon"><Pause size={23} /></span><h2>ひと休み</h2><p>準備ができたら、続きから。</p><button className="button primary full-width" onClick={game.resume}><Play size={17} />対戦を再開</button><button className="button subtle full-width" onClick={game.title}>タイトルへ戻る</button><small>Esc キーでも再開できます</small></div></div>}
            {finished && <div className="result-overlay"><div className="result-panel"><span className="lobby-tag">最終結果</span><h2>{snapshot.match.lastWinner === "player" ? "あなたの勝利" : "相手の勝利"}</h2><div className="result-score"><b>{snapshot.match.playerWins}</b><span>—</span><b>{snapshot.match.aiWins}</b></div><p>{snapshot.match.lastWinner === "player" ? "読み合いを制しました。次の一戦へ。" : "次は攻め方を変えて、もう一度。"}</p><button className="button primary full-width" onClick={() => game.start(difficulty)}><RotateCcw size={17} />もう一度戦う</button><button className="button subtle full-width" onClick={game.title}>モード・難易度を変える</button></div></div>}
            {gameMode === "3d" && game.graphics === "error" && <div className="graphics-error" role="alert"><h2>3Dの表示を続けられません</h2><p>WebGLが使えるブラウザーで再読み込みするか、2Dで遊んでください。</p><button className="button primary" onClick={() => chooseMode("2d")}>2Dで遊ぶ</button></div>}
          </div>
          <div className="arena-status"><span><i className={`status-dot ${snapshot.mode === "jev" ? "connected" : ""}`} />{status}</span><span>{DIFFICULTIES[title ? difficulty : snapshot.difficulty].label}<span className="status-separator">·</span>{inMatch ? "Esc で一時停止" : "先に2ラウンドで勝利"}</span></div>
        </div>
        <TouchControls gameMode={gameMode} disabled={!inMatch || snapshot.paused || help || game.graphics !== "ready"} onDown={game.touchDown} onUp={game.touchUp} />
        <div className="keyboard-strip" aria-label="キーボード操作">{controlLabels(gameMode).map(([key, label]) => <span key={key}><kbd>{key}</kbd>{label}</span>)}</div>
        <p className="play-tip"><span>ひとこと</span> 強攻撃を外したら、すぐに攻めずに相手の出方を見よう。</p>
      </section>
      <aside className="insight-section" aria-label="相手の戦術">
        <div className="insight-heading"><Target size={18} /><h2>相手の読み</h2><span>AIの予測</span></div>
        <p className="insight-intro">次にあなたが取る行動</p>
        <div className={`prediction-list ${title ? "awaiting" : ""}`}>{predictions.map(({ name, value }) => <div className={`prediction-row ${!title && name === strongest.name ? "leading" : ""}`} key={name}><div><span>{name}</span><strong>{title ? "—" : `${Math.round(value * 100)}%`}</strong></div><div className="prediction-track"><span style={{ transform: `scaleX(${title ? 0 : value})` }} /></div></div>)}</div>
        <div className="reading-note"><span className="note-marker" /><p>{title ? "対戦が始まると、相手の予測がここに表示されます。" : snapshot.behavior.count < 5 ? "まだ様子を見ています。動いて、相手の反応を探ろう。" : strongest.name === "その他" ? "相手は移動や待機を読んでいます。踏み込むタイミングを変えてみよう。" : `相手は${strongest.name}を警戒しています。別の手で意表を突こう。`}</p></div>
        <div className="insight-divider" /><div className="match-note"><h3>読みを、裏切る。</h3><p>同じ行動を重ねるほど、相手はその癖を覚えます。ときには待つことも、ひとつの攻め方。</p><div className="learning-count"><span>記録した行動</span><b>{snapshot.behavior.count}<small> / 30</small></b></div></div>
        <details className="connection-details"><summary>接続について</summary><p>{JEV_API_ENABLED ? "Jevが相手の戦術を判断します。接続できない場合も、標準AIとの対戦を続けられます。" : "この環境では標準AIと対戦します。行動の記録と予測は利用できます。"}</p></details>
      </aside>
    </div>
    <footer className="app-footer"><span>JEV <span>・</span> 読み合いの闘技場</span><a href="./third-party-notices.txt" target="_blank" rel="noreferrer">素材クレジット</a></footer>
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>閉じる</button></div>}
    {game.debug && <div className="debug-panel"><b>デバッグ <small>F3 で閉じる</small></b><pre>{[
      `描画速度: ${Math.round(snapshot.fps)} FPS`, `あなたの状態: ${actionNames[snapshot.player.action]}`, `AIの状態: ${actionNames[snapshot.ai.action]}`,
      `AIの直近行動: ${actionNames[snapshot.lastAiAction]}`, `Jevの直近判断: ${snapshot.lastJevDecision ? actionNames[snapshot.lastJevDecision] : "なし"}`,
      `Jev応答時間: ${snapshot.jevLatency === null ? "なし" : `${snapshot.jevLatency} ms`}`, `判断時刻: ${snapshot.decisionTime === null ? "なし" : new Date(snapshot.decisionTime).toLocaleTimeString("ja-JP")}`,
      `対戦モード: ${snapshot.gameMode.toUpperCase()}`, `判断モード: ${snapshot.mode === "jev" ? "Jev" : "標準AI"}`, `一時停止: ${snapshot.paused}`, `距離: ${Math.round(groundDistance(snapshot.player, snapshot.ai, snapshot.gameMode))}`, `あなたの奥行き: ${Math.round(snapshot.player.z)}`, `相手の奥行き: ${Math.round(snapshot.ai.z)}`, `記録した行動: ${snapshot.behavior.count}件`,
      ...Object.entries(snapshot.behavior.overall).map(([action, ratio]) => `${actionNames[action] ?? action}: ${Math.round(ratio * 100)}%`),
      `AI接近時の回避: ${Math.round(snapshot.behavior.whenAiApproaches.dodge * 100)}%`, `強攻撃失敗後の回避: ${Math.round(snapshot.behavior.afterHeavyMiss.dodge * 100)}%`, `低HP時の後退: ${Math.round(snapshot.behavior.lowHp.retreat * 100)}%`,
    ].join("\n")}</pre></div>}
    <ControlsDialog open={help} onClose={closeHelp} gameMode={gameMode} />
  </main>;
}
