"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine } from "../game/GameEngine";
import { EMPTY_CONTROLS, KEY_BINDINGS } from "../game/constants";
import { renderGame } from "../game/rendering/CanvasRenderer";
import type { Controls, Difficulty, GameMode } from "../game/types";
import type { ThreeRenderer } from "../game/rendering/ThreeRenderer";

export function useGameSession(reducedMotion: boolean, gameMode: GameMode) {
  const engineRef = useRef<GameEngine | null>(null);
  if (!engineRef.current) engineRef.current = new GameEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);
  const threeRenderer = useRef<ThreeRenderer | null>(null);
  const graphicsReady = useRef(true);
  const [graphics, setGraphics] = useState<"ready" | "loading" | "error">("ready");
  const stageRef = useRef<HTMLDivElement>(null);
  const keyboard = useRef(new Set<string>());
  const pointers = useRef(new Map<number, string>());
  const presses = useRef(new Set<string>());
  const reduced = useRef(reducedMotion);
  reduced.current = reducedMotion;
  const [snapshot, setSnapshot] = useState(() => engineRef.current!.snapshot());
  const [debug, setDebug] = useState(false);

  const clearInput = useCallback(() => { keyboard.current.clear(); pointers.current.clear(); presses.current.clear(); }, []);
  const pause = useCallback((value = true) => {
    clearInput();
    engineRef.current!.setPaused(value);
    setSnapshot(engineRef.current!.snapshot());
  }, [clearInput]);
  const start = useCallback((difficulty: Difficulty) => {
    if (gameMode === "3d" && !graphicsReady.current) return;
    clearInput();
    engineRef.current!.start(difficulty, gameMode);
    setSnapshot(engineRef.current!.snapshot());
    stageRef.current?.focus({ preventScroll: true });
  }, [clearInput, gameMode]);
  const title = useCallback(() => {
    clearInput();
    engineRef.current!.toTitle();
    setSnapshot(engineRef.current!.snapshot());
  }, [clearInput]);
  const resume = useCallback(() => {
    if (!graphicsReady.current) return;
    pause(false);
    requestAnimationFrame(() => stageRef.current?.focus({ preventScroll: true }));
  }, [pause]);
  const touchDown = useCallback((id: number, code: string) => {
    if (![...pointers.current.values()].includes(code)) presses.current.add(code);
    pointers.current.set(id, code);
  }, []);
  const touchUp = useCallback((id: number) => { pointers.current.delete(id); }, []);

  useEffect(() => {
    let cancelled = false;
    engineRef.current!.setGameMode(gameMode);
    clearInput();
    setSnapshot(engineRef.current!.snapshot());
    graphicsReady.current = gameMode === "2d";
    if (gameMode === "2d") { setGraphics("ready"); return; }
    setGraphics("loading");
    const fail = () => { if (!cancelled) { graphicsReady.current = false; engineRef.current!.setPaused(true); setGraphics("error"); } };
    void import("../game/rendering/ThreeRenderer").then(({ ThreeRenderer }) => {
      if (cancelled || !threeContainerRef.current) return;
      threeRenderer.current = new ThreeRenderer(threeContainerRef.current, fail);
      graphicsReady.current = true;
      setGraphics("ready");
    }).catch(fail);
    return () => { cancelled = true; threeRenderer.current?.dispose(); threeRenderer.current = null; };
  }, [gameMode, clearInput]);

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || document.querySelector("dialog[open]")) return;
      if (event.code === "Escape" && !event.repeat) { event.preventDefault(); if (engineRef.current!.paused) resume(); else pause(); return; }
      if (event.code === KEY_BINDINGS.debug && !event.repeat) { event.preventDefault(); setDebug(value => !value); return; }
      if ((event.target as HTMLElement)?.closest("button, input, select, textarea, a")) return;
      if (!Object.values(KEY_BINDINGS).includes(event.code as never)) return;
      event.preventDefault();
      if (!keyboard.current.has(event.code)) presses.current.add(event.code);
      keyboard.current.add(event.code);
    };
    const onUp = (event: KeyboardEvent) => { keyboard.current.delete(event.code); };
    const onBlur = () => pause(true);
    const onVisibility = () => { if (document.hidden) pause(true); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur); document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pause, resume]);

  useEffect(() => {
    const engine = engineRef.current!;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let frame = 0, previous = performance.now(), accumulator = 0, uiTime = 0, visualTime = 0, fps = 60;
    const loop = (now: number) => {
      const rawDt = (now - previous) / 1000;
      const dt = Math.min(rawDt, .1);
      previous = now;
      if (rawDt > 0) fps = fps * .9 + Math.min(240, 1 / rawDt) * .1;
      if (!engine.paused && graphicsReady.current) {
        visualTime += dt;
        accumulator += dt;
        let steps = 0;
        while (accumulator >= 1 / 60 && steps++ < 5) {
          const active = new Set([...keyboard.current, ...pointers.current.values()]);
          const edge = presses.current;
          const input: Controls = {
            move: active.has(KEY_BINDINGS.left) === active.has(KEY_BINDINGS.right) ? 0 : active.has(KEY_BINDINGS.left) ? -1 : 1,
            depth: engine.gameMode === "3d" ? Number(active.has(KEY_BINDINGS.depthFront)) - Number(active.has(KEY_BINDINGS.depthBack)) : 0,
            jump: edge.has(engine.gameMode === "3d" ? KEY_BINDINGS.jump3d : KEY_BINDINGS.jump), normalAttack: edge.has(KEY_BINDINGS.normalAttack),
            heavyAttack: edge.has(KEY_BINDINGS.heavyAttack), dodge: edge.has(KEY_BINDINGS.dodge), guard: active.has(KEY_BINDINGS.guard),
          };
          engine.update(1 / 60, engine.match.phase === "fighting" ? input : EMPTY_CONTROLS as Controls);
          edge.clear();
          accumulator -= 1 / 60;
        }
      } else accumulator = 0;
      engine.fps = fps;
      if (engine.gameMode === "3d") threeRenderer.current?.render(engine.player, engine.ai, engine.effects, reduced.current ? 0 : visualTime, reduced.current ? 0 : engine.shake);
      else renderGame(ctx, engine.player, engine.ai, engine.match, engine.effects, reduced.current ? 0 : engine.shake, reduced.current ? 0 : visualTime);
      uiTime += dt;
      if (uiTime >= .1) { setSnapshot(engine.snapshot()); uiTime = 0; }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); engine.setPaused(true); };
  }, []);
  return { canvasRef, threeContainerRef, graphics, stageRef, snapshot, debug, start, title, pause, resume, touchDown, touchUp };
}
