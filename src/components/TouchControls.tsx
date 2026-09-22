import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Shield, Zap, Swords, Footprints } from "lucide-react";
import { KEY_BINDINGS } from "../game/constants";
import type { GameMode } from "../game/types";

export function TouchControls({ disabled, onDown, onUp, gameMode }: { disabled: boolean; onDown: (id: number, code: string) => void; onUp: (id: number) => void; gameMode: GameMode }) {
  const actions = [
    { code: KEY_BINDINGS.left, label: "左へ移動", text: "左", Icon: ArrowLeft, group: "move" },
    { code: gameMode === "3d" ? KEY_BINDINGS.depthBack : KEY_BINDINGS.jump, label: gameMode === "3d" ? "奥へ移動" : "ジャンプ", text: gameMode === "3d" ? "奥" : "跳ぶ", Icon: ArrowUp, group: "move" },
    { code: KEY_BINDINGS.right, label: "右へ移動", text: "右", Icon: ArrowRight, group: "move" },
    ...(gameMode === "3d" ? [{ code: KEY_BINDINGS.depthFront, label: "手前へ移動", text: "手前", Icon: ArrowDown, group: "move" }, { code: KEY_BINDINGS.jump3d, label: "ジャンプ", text: "跳ぶ", Icon: ArrowUp, group: "move" }] : []),
    { code: KEY_BINDINGS.guard, label: "ガード", text: "守る", Icon: Shield, group: "action" },
    { code: KEY_BINDINGS.dodge, label: "回避", text: "回避", Icon: Footprints, group: "action" },
    { code: KEY_BINDINGS.normalAttack, label: "通常攻撃", text: "攻撃", Icon: Swords, group: "action attack" },
    { code: KEY_BINDINGS.heavyAttack, label: "強攻撃", text: "強攻撃", Icon: Zap, group: "action attack" },
  ];
  return <div className={`touch-controls ${gameMode === "3d" ? "touch-3d" : ""}`} aria-label="タッチ操作">{actions.map(({ code, label, text, Icon, group }) => <button key={code} type="button" aria-label={label} className={`touch-key ${group}`} disabled={disabled} onContextMenu={event => event.preventDefault()}
    onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onDown(event.pointerId, code); }}
    onPointerUp={event => onUp(event.pointerId)} onPointerCancel={event => onUp(event.pointerId)} onLostPointerCapture={event => onUp(event.pointerId)}><Icon size={20} /><span>{text}</span></button>)}</div>;
}
