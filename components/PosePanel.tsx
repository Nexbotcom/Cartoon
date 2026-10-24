"use client";
import { Pose, PoseBlock } from "@/lib/types";

const panel = "rounded-2xl border border-white/10 bg-white/[0.03] p-3";
const lbl = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400";
const grad = { background: "linear-gradient(135deg,#8b5cf6,#ec4899)" };
const num = "w-16 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm";

const FIELDS: { k: keyof Pose; label: string; min: number; max: number; def: number }[] = [
  { k: "yaw", label: "Head turn", min: -40, max: 40, def: 0 },
  { k: "pitch", label: "Head up / down", min: -25, max: 25, def: 0 },
  { k: "tilt", label: "Head tilt", min: -20, max: 20, def: 0 },
  { k: "aRU", label: "Arm right, raise", min: 0, max: 170, def: 6 },
  { k: "aRB", label: "Arm right, elbow", min: -90, max: 120, def: 8 },
  { k: "aLU", label: "Arm left, raise", min: 0, max: 170, def: 6 },
  { k: "aLB", label: "Arm left, elbow", min: -90, max: 120, def: 8 },
];

export default function PosePanel(props: {
  name: string; draft: Partial<Pose>; start: number | null; dur: number; blocks: PoseBlock[];
  onChange: (k: keyof Pose, v: number) => void; onDur: (d: number) => void;
  onAdd: () => void; onReset: () => void;
  onDelete: (i: number) => void; onEdit: (i: number) => void;
  onPatch: (i: number, p: { t0?: number; dur?: number }) => void;
}) {
  const has = Object.keys(props.draft).length > 0;
  return (
    <div className="space-y-3">
      <div className={panel}>
        <p className={lbl}>Pose {props.name} at the playhead</p>
        <p className="mb-3 text-xs text-slate-500">
          Scrub to the moment you want, then move a slider. The pose holds for the duration you set and fades in and out.
        </p>
        {FIELDS.map(f => (
          <label key={f.k} className="mb-2 block text-sm text-slate-300">
            <span className="flex justify-between">
              <span>{f.label}</span>
              <span className="tabular-nums text-slate-500">{Math.round(props.draft[f.k] ?? f.def)}°</span>
            </span>
            <input type="range" min={f.min} max={f.max} value={props.draft[f.k] ?? f.def}
              onChange={e => props.onChange(f.k, +e.target.value)} className="w-full accent-violet-500" />
          </label>
        ))}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-300">Duration
            <input type="number" min={0.5} max={20} step={0.5} value={props.dur}
              onChange={e => props.onDur(+e.target.value || 1)} className={`ml-2 ${num}`} /> s
          </label>
          <span className="text-xs text-slate-500">
            {props.start === null ? "starts at the playhead" : `starts at ${props.start.toFixed(1)}s`}
          </span>
          <button onClick={props.onAdd} disabled={!has} style={grad}
            className="ml-auto rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Add pose block</button>
          <button onClick={props.onReset} disabled={!has}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm disabled:opacity-40">Reset</button>
        </div>
      </div>

      <div className={panel}>
        <p className={lbl}>{props.name}&apos;s pose blocks</p>
        {props.blocks.length === 0 && <p className="text-sm text-slate-500">None yet.</p>}
        <div className="space-y-2">
          {props.blocks.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2 text-sm">
              <span className="text-slate-400">#{i + 1}</span>
              <label className="text-xs text-slate-400">start
                <input type="number" step={0.1} min={0} value={Number(b.t0.toFixed(2))}
                  onChange={e => props.onPatch(i, { t0: Math.max(0, +e.target.value) })} className={`ml-1 ${num}`} />
              </label>
              <label className="text-xs text-slate-400">length
                <input type="number" step={0.1} min={0.3} value={Number((b.t1 - b.t0).toFixed(2))}
                  onChange={e => props.onPatch(i, { dur: Math.max(0.3, +e.target.value) })} className={`ml-1 ${num}`} />
              </label>
              <button onClick={() => props.onEdit(i)} className="ml-auto rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-white/10">Edit</button>
              <button onClick={() => props.onDelete(i)} className="px-2 text-red-400">✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
