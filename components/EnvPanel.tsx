"use client";
import { PROP_LIST } from "@/lib/props";
import { PART_LABEL } from "@/lib/templates";
import { PropKind } from "@/lib/types";

const panel = "rounded-2xl border border-white/10 bg-white/[0.03] p-3";
const lbl = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400";
const grad = { background: "linear-gradient(135deg,#8b5cf6,#ec4899)" };
const btn = "rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10";

const GROUPS: { label: string; kinds: PropKind[] }[] = [
  { label: "Living room", kinds: ["sofa", "chair", "table", "tv", "bookshelf", "lamp", "plant", "rug"] },
  { label: "Bedroom", kinds: ["bed", "wardrobe", "desk", "chair", "lamp", "rug"] },
  { label: "Kitchen", kinds: ["fridge", "counter", "table", "chair", "bin"] },
  { label: "Walls & ceiling", kinds: ["picture", "clock", "window", "curtains", "fan", "door"] },
  { label: "School", kinds: ["board", "desk", "chair", "locker", "bin"] },
  { label: "Hospital", kinds: ["bed", "ivstand", "curtains", "chair", "locker"] },
  { label: "Outdoors", kinds: ["tree", "bush", "bench", "streetlight", "fence", "car", "bin"] },
  { label: "Sports & crowd", kinds: ["goal", "ball", "crowd", "bench"] },
  { label: "Small things", kinds: ["box", "cake", "bag", "ball", "phone"] },
];
const labelOf = (k: PropKind) => PROP_LIST.find(p => p.kind === k)?.label ?? k;

export interface EnvSelected { label: string; kind: "prop" | "actor"; rot: number; scale: number; y: number }

export default function EnvPanel(p: {
  mode: "2d" | "3d"; setMode: (m: "2d" | "3d") => void;
  editor: boolean; setEditor: (b: boolean) => void;
  alive: boolean; setAlive: (b: boolean) => void;
  grid: boolean; setGrid: (b: boolean) => void;
  wallSnap: boolean; setWallSnap: (b: boolean) => void;
  parts: string[]; hidden: string[]; toggleHidden: (name: string) => void;
  selected: EnvSelected | null;
  onRot: (d: number) => void; onScale: (d: number) => void; onLift: (d: number) => void;
  onDup: () => void; onDel: () => void; onDeselect: () => void;
  onAdd: (k: PropKind) => void; onFurnish: () => void; onClear: () => void; onResetCam: () => void;
  propCount: number;
}) {
  const sw = (label: string, on: boolean, set: (b: boolean) => void) => (
    <label key={label} className="flex items-center gap-2 text-sm text-slate-300">
      <input type="checkbox" checked={on} onChange={e => set(e.target.checked)} className="accent-violet-500" />{label}
    </label>
  );
  return (
    <div className="space-y-3">
      <div className={panel}>
        <p className={lbl}>360° environment editor</p>
        {p.mode === "2d" ? (
          <button onClick={() => p.setMode("3d")} style={grad} className="w-full rounded-xl px-4 py-2.5 font-medium text-white">Switch to 3D to edit</button>
        ) : (
          <button onClick={() => p.setEditor(!p.editor)} style={p.editor ? undefined : grad}
            className={`w-full rounded-xl px-4 py-2.5 font-medium ${p.editor ? "border border-emerald-400/50 bg-emerald-500/20 text-emerald-200" : "text-white"}`}>
            {p.editor ? "✓ Editing: tap to finish" : "Start editing (360° camera)"}
          </button>
        )}
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          One finger on an object moves it. One finger on empty space turns the camera around the room. Two fingers pinch to zoom and drag to pan.
          On a computer: wheel to zoom, right-drag to pan. The editor camera is separate from your director camera.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {sw("Alive (swaying, fans, clouds)", p.alive, p.setAlive)}
          {sw("Snap to grid", p.grid, p.setGrid)}
          {sw("Snap to walls", p.wallSnap, p.setWallSnap)}
        </div>
        <button onClick={p.onResetCam} className={`${btn} mt-3`}>Reset editor camera</button>
      </div>

      {p.selected && (
        <div className={`${panel} border-amber-400/40`}>
          <div className="mb-2 flex items-center gap-2">
            <p className={`${lbl} mb-0`}>Selected: {p.selected.label}</p>
            <button onClick={p.onDeselect} className="ml-auto rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-white/10">Done</button>
          </div>
          {p.selected.kind === "prop" ? (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => p.onRot(-15)} className={btn}>⟲ Turn left</button>
              <button onClick={() => p.onRot(15)} className={btn}>⟳ Turn right</button>
              <button onClick={() => p.onScale(-0.1)} className={btn}>− Smaller</button>
              <button onClick={() => p.onScale(0.1)} className={btn}>+ Bigger</button>
              <button onClick={() => p.onLift(-0.1)} className={btn}>↓ Lower</button>
              <button onClick={() => p.onLift(0.1)} className={btn}>↑ Raise</button>
              <button onClick={p.onDup} className={btn}>⧉ Duplicate</button>
              <button onClick={p.onDel} className={`${btn} text-red-400`}>🗑 Delete</button>
              <p className="col-span-2 text-xs text-slate-500">
                Turn {Math.round(p.selected.rot)}° · size {p.selected.scale.toFixed(1)}× · height {p.selected.y.toFixed(2)} m
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Drag this character to place it. Use the Stage tab for the rest.</p>
          )}
        </div>
      )}

      <div className={panel}>
        <p className={lbl}>Show or hide parts</p>
        <div className="flex flex-wrap gap-2">
          {p.parts.map(n => (
            <button key={n} onClick={() => p.toggleHidden(n)}
              className={`rounded-xl border px-3 py-1.5 text-sm ${p.hidden.includes(n) ? "border-white/10 bg-white/5 text-slate-500 line-through" : "border-violet-400/40 bg-violet-500/15 text-slate-100"}`}>
              {PART_LABEL[n] ?? n}
            </button>
          ))}
          {p.parts.length === 0 && <p className="text-sm text-slate-500">Open the editor in 3D to see this place&apos;s parts.</p>}
        </div>
      </div>

      <div className={panel}>
        <p className={lbl}>Furnish</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={p.onFurnish} style={grad} className="rounded-xl px-4 py-2 text-sm font-medium text-white">✨ Furnish this place</button>
          <button onClick={p.onClear} disabled={p.propCount === 0} className={`${btn} disabled:opacity-40`}>Clear all props ({p.propCount})</button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Adds a starter layout for this background. Then move things wherever you like. Your layout is saved automatically.</p>
      </div>

      <div className={panel}>
        <p className={lbl}>Add a prop</p>
        <div className="space-y-3">
          {GROUPS.map(gp => (
            <div key={gp.label}>
              <p className="mb-1 text-xs text-slate-500">{gp.label}</p>
              <div className="flex flex-wrap gap-2">
                {gp.kinds.map(kd => <button key={kd} onClick={() => p.onAdd(kd)} className={btn}>+ {labelOf(kd)}</button>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
