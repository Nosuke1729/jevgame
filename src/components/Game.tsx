"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine } from "../game/GameEngine";
import { JEV_API_ENABLED } from "../game/ai/JevAvailability";
import { ARENA, DIFFICULTIES, EMPTY_CONTROLS, KEY_BINDINGS } from "../game/constants";
import { renderGame } from "../game/rendering/CanvasRenderer";
import type { Controls, Difficulty, Fighter, GameSnapshot } from "../game/types";

const actionNames: Record<string, string> = {
  idle: "待機", run: "移動", jump: "跳躍", normalAttack: "通常攻撃", heavyAttack: "強攻撃", dodge: "回避", guard: "ガード", hitStun: "被弾", guardBreak: "ガード崩し",
  approach: "接近", retreat: "後退", wait: "様子見",
};
const behaviorNames: Record<string, string> = { attack: "通常攻撃", heavyAttack: "強攻撃", dodge: "回避", guard: "ガード", approach: "接近", retreat: "後退", jump: "ジャンプ", wait: "様子見" };
const inputLabels = [
  ["A / D", "左右移動"], ["W", "ジャンプ"], ["J", "通常攻撃"], ["K", "強攻撃"], ["L", "回避"], ["I", "ガード"],
];

function Meter({ fighter, mirror = false }: { fighter: Fighter; mirror?: boolean }) {
  return <div className={`meter-block ${mirror ? "mirror" : ""}`}>
    <div className="fighter-label"><span>{fighter.side === "player" ? "あなた" : "AIファイター"}</span><strong>{Math.ceil(fighter.hp)}<small> / 100 HP</small></strong></div>
    <div className="meter hp"><span style={{ width: `${fighter.hp}%` }} /></div>
    <div className="stamina-row"><span>スタミナ</span><span>{Math.ceil(fighter.stamina)} / 100</span></div>
    <div className="meter stamina"><span style={{ width: `${fighter.stamina}%` }} /></div>
  </div>;
}

export default function Game() {
  const engineRef = useRef<GameEngine | null>(null);
  if (!engineRef.current) engineRef.current = new GameEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<string>());
  const presses = useRef(new Set<string>());
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => engineRef.current!.snapshot());
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (Object.values(KEY_BINDINGS).includes(event.code as never)) event.preventDefault();
      if (event.code === KEY_BINDINGS.debug && !event.repeat) setDebug((value) => !value);
      if (!keys.current.has(event.code)) presses.current.add(event.code);
      keys.current.add(event.code);
    };
    const onUp = (event: KeyboardEvent) => { keys.current.delete(event.code); };
    const onBlur = () => { keys.current.clear(); presses.current.clear(); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); window.removeEventListener("blur", onBlur); };
  }, []);

  useEffect(() => {
    const engine = engineRef.current!;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let previous = performance.now();
    let accumulator = 0;
    let uiTime = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      accumulator += dt;
      let steps = 0;
      while (accumulator >= 1 / 60 && steps < 5) {
        const active = keys.current;
        const edge = presses.current;
        const input: Controls = {
          move: active.has(KEY_BINDINGS.left) === active.has(KEY_BINDINGS.right) ? 0 : active.has(KEY_BINDINGS.left) ? -1 : 1,
          jump: edge.has(KEY_BINDINGS.jump), normalAttack: edge.has(KEY_BINDINGS.normalAttack),
          heavyAttack: edge.has(KEY_BINDINGS.heavyAttack), dodge: edge.has(KEY_BINDINGS.dodge), guard: active.has(KEY_BINDINGS.guard),
        };
        engine.update(1 / 60, engine.match.phase === "fighting" ? input : EMPTY_CONTROLS as Controls);
        edge.clear();
        accumulator -= 1 / 60;
        steps++;
      }
      renderGame(ctx, engine.player, engine.ai, engine.match, engine.effects, engine.shake, now / 1000);
      uiTime += dt;
      if (uiTime >= 0.1) { setSnapshot(engine.snapshot()); uiTime = 0; }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const start = useCallback(() => {
    engineRef.current!.start(difficulty);
    setSnapshot(engineRef.current!.snapshot());
    rootRef.current?.focus();
  }, [difficulty]);
  const title = useCallback(() => { engineRef.current!.toTitle(); setSnapshot(engineRef.current!.snapshot()); }, []);
  const probs = snapshot.prediction.predictionProbabilities;
  const predictionRows = [
    ["攻撃", probs.attack + probs.heavyAttack],
    ["回避", probs.dodge],
    ["ガード", probs.guard],
    ["その他", Math.max(0, 1 - probs.attack - probs.heavyAttack - probs.dodge - probs.guard)],
  ] as const;

  return <main className="page" ref={rootRef} tabIndex={-1}>
    <div className="topline"><div className="brand-mark">J<span>EV</span><i>//</i></div><div className="topline-right">読み合いの闘技場 <span>01 / 対戦モード</span></div></div>
    <section className="shell">
      <div className="section-head"><span className="section-index">01 — 対戦</span><h1>相手は、あなたの<span>癖</span>を読む。</h1><p>攻めるか、誘うか。選択の一つひとつが、次の読み合いになる。</p></div>
      <div className="game-grid">
        <div className="arena-column">
          <div className="match-hud">
            <Meter fighter={snapshot.player} />
            <div className="round-hud"><div className="round-small">ラウンド</div><strong>{String(snapshot.match.round).padStart(2, "0")}</strong><div className="round-pips"><span className={snapshot.match.playerWins > 0 ? "won" : ""} /><span className={snapshot.match.playerWins > 1 ? "won" : ""} /><b>:</b><span className={snapshot.match.aiWins > 0 ? "won ai" : ""} /><span className={snapshot.match.aiWins > 1 ? "won ai" : ""} /></div></div>
            <Meter fighter={snapshot.ai} mirror />
          </div>
          <div className="canvas-wrap"><canvas ref={canvasRef} width={ARENA.width} height={ARENA.height} aria-label="2D対戦アリーナ" />
            {snapshot.match.phase === "title" && <div className="title-overlay"><div className="title-eyebrow">人間 対 学習するAI</div><h2>読み合いを、<br /><em>始めよう。</em></h2><p>あなたの行動を記憶するAIファイターに挑もう。</p><div className="difficulty-label">難易度を選択</div><div className="difficulty-buttons">{(["easy", "normal", "hard"] as Difficulty[]).map((value) => <button key={value} className={difficulty === value ? "selected" : ""} onClick={() => setDifficulty(value)}>{DIFFICULTIES[value].label}</button>)}</div><button className="primary-button" onClick={start}>対戦開始 <span>↗</span></button></div>}
            {snapshot.match.phase === "finished" && <div className="finish-actions"><button className="primary-button" onClick={start}>もう一度戦う <span>↗</span></button><button className="secondary-button" onClick={title}>タイトルへ戻る</button></div>}
          </div>
          <div className="arena-footer"><span><i className={`status-dot ${snapshot.mode}`} />{snapshot.mode === "jev" ? "Jev接続中：戦術判断を反映" : JEV_API_ENABLED ? "AI接続なし：標準AIで対戦中" : "GitHub Pages版：標準AIで対戦中"}</span><span>先に2ラウンド勝利で決着</span></div>
        </div>
        <aside className="sidebar">
          <div className="panel prediction"><div className="panel-top"><span>02 — 戦術解析</span><span className="pulse" /></div><h2>AIの予測</h2><p className="panel-sub">次にあなたが取る行動</p><div className="prediction-bars">{predictionRows.map(([name, chance]) => <div className="prediction-row" key={name}><span>{name}</span><div className="prediction-track"><i style={{ width: `${Math.round(chance * 100)}%` }} /></div><strong>{Math.round(chance * 100)}%</strong></div>)}</div><div className="prediction-note">予測は確定ではありません。読みを外して、主導権を奪いましょう。</div></div>
          <div className="panel controls"><div className="panel-top"><span>03 — 操作方法</span></div><h2>操作する</h2><div className="control-grid">{inputLabels.map(([key, label]) => <div className="control-item" key={key}><kbd>{key}</kbd><span>{label}</span></div>)}</div><div className="controls-tip">強攻撃・回避・ガードはスタミナを消費します。</div></div>
          <div className="side-footer"><span>戦闘データを読み取り、次の一手を選ぶ。</span><strong>JEV<span> / </span>ARENA</strong></div>
        </aside>
      </div>
      {debug && <div className="debug-panel"><div>デバッグ表示 <small>F3 で非表示</small></div><pre>{[
        `描画速度: ${Math.round(snapshot.fps)} FPS`,
        `あなたの状態: ${actionNames[snapshot.player.action]}`,
        `AIの状態: ${actionNames[snapshot.ai.action]}`,
        `AIの直近行動: ${actionNames[snapshot.lastAiAction]}`,
        `Jevの直近判断: ${snapshot.lastJevDecision ? actionNames[snapshot.lastJevDecision] : "なし"}`,
        `Jev応答時間: ${snapshot.jevLatency === null ? "なし" : `${snapshot.jevLatency} ms`}`,
        `判断時刻: ${snapshot.decisionTime === null ? "なし" : new Date(snapshot.decisionTime).toLocaleTimeString("ja-JP")}`,
        `判断モード: ${snapshot.mode === "jev" ? "Jev" : "標準AI"}`,
        `距離: ${Math.round(Math.abs(snapshot.player.x - snapshot.ai.x))}`,
        `記録した行動: ${snapshot.behavior.count}件`,
        ...Object.entries(snapshot.behavior.overall).map(([action, ratio]) => `${behaviorNames[action]}: ${Math.round(ratio * 100)}%`),
        `AI接近時の回避: ${Math.round(snapshot.behavior.whenAiApproaches.dodge * 100)}%`,
        `強攻撃失敗後の回避: ${Math.round(snapshot.behavior.afterHeavyMiss.dodge * 100)}%`,
        `低HP時の後退: ${Math.round(snapshot.behavior.lowHp.retreat * 100)}%`,
      ].join("\n")}</pre></div>}
    </section>
    <footer className="page-footer"><span>JEV // ARENA</span><span>人間の直感 × AIの予測</span></footer>
  </main>;
}
