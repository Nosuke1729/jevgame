import { X, Keyboard, MoveHorizontal, Shield, Swords, Footprints } from "lucide-react";
import { useEffect, useRef } from "react";

export const controlLabels = [["A / D", "移動"], ["W", "ジャンプ"], ["J", "通常攻撃"], ["K", "強攻撃"], ["L", "回避"], ["I", "ガード"]] as const;

export function ControlsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) ref.current?.showModal(); else ref.current?.close(); }, [open]);
  return <dialog ref={ref} className="help-dialog" aria-labelledby="help-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-body"><div className="dialog-heading"><Keyboard size={22} /><h2 id="help-title">操作方法</h2><button className="icon-button" aria-label="操作方法を閉じる" onClick={onClose}><X size={20} /></button></div>
      <p>先に2ラウンド取れば勝利。攻め方を変えて、相手の読みを外そう。</p>
      <div className="help-keys">{controlLabels.map(([key, label]) => <div key={key}><span>{label}</span><kbd>{key}</kbd></div>)}<div><span>一時停止・再開</span><kbd>Esc</kbd></div></div>
      <div className="help-tips"><p><MoveHorizontal size={18} /><span><b>まずは間合いをつかむ</b>近づいて J で攻撃。離れると相手の攻撃を避けられます。</span></p><p><Swords size={18} /><span><b>大きな隙には強攻撃</b>K は強力ですが、出すまでに時間がかかります。</span></p><p><Shield size={18} /><span><b>守った後が攻めどき</b>I を押し続けるとガード。L は短時間、攻撃をすり抜けます。</span></p><p><Footprints size={18} /><span><b>同じ動きを続けない</b>相手は直近の行動を読みます。攻撃・回避・ガードを織り交ぜよう。</span></p></div>
      <p className="help-note">スマートフォンでは画面下のボタンで操作できます。強攻撃・回避・ガードはスタミナを消費します。</p>
      <button className="button primary full-width" onClick={onClose}>わかった</button>
    </div>
  </dialog>;
}
