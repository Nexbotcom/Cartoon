"use client";
import { Action, Scene } from "@/lib/types";

const CLIP_COL: Record<string, string> = {
  walk: "#3b82f6", run: "#2563eb", talk: "#ec4899", wave: "#f59e0b", type: "#10b981",
  jump: "#ef4444", point: "#14b8a6", shrug: "#a78bfa", idle: "#64748b",
};
const colorOf = (a: Action) => (a.clip ? CLIP_COL[a.clip] : a.say ? CLIP_COL.talk : a.expr ? "#f59e0b" : "#64748b");
const labelOf = (a: Action) =>
  a.say ? `“${a.say}”` : a.clip ?? a.expr ?? (a.look ? `look ${a.look}` : a.nod ? "nod" : a.shake ? "shake" : a.view ?? a.posture ?? (a.ride !== undefined ? "in car" : ""));

const RULER = 26, LANE = 52, CAM = 34;

export default function Timeline({ scene, time, onSeek, pps }: {
  scene: Scene; time: number; onSeek: (t: number) => void; pps: number;
}) {
  const width = Math.max(300, scene.duration * pps + 24);
  const height = RULER + scene.actors.length * LANE + CAM + 8;

  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(scene.duration, (e.clientX - r.left) / pps)));
  };

  const camBlocks = scene.cam.slice(0, -1).map((a, i) => ({ a, b: scene.cam[i + 1] }))
    .filter(({ a, b }) => b.t > a.t && (a.zoom !== b.zoom || a.x !== b.x || a.y !== b.y || a.follow !== b.follow));

  const ticks: number[] = [];
  for (let s = 0; s <= Math.ceil(scene.duration); s++) ticks.push(s);
  const every = pps < 40 ? 5 : pps < 70 ? 2 : 1;

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
      <div
        className="relative select-none"
        style={{ width, height, touchAction: "none" }}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); seek(e); }}
        onPointerMove={e => { if (e.buttons) seek(e); }}
      >
        {ticks.map(s => (
          <div key={s} className="absolute top-0 border-l border-white/10" style={{ left: s * pps, height }}>
            {s % every === 0 && <span className="absolute left-1 top-1 text-[10px] text-slate-500">{s}s</span>}
          </div>
        ))}

        {scene.actors.map((a, ai) => {
          const top = RULER + ai * LANE;
          return (
            <div key={ai} className="absolute left-0 right-0 border-t border-white/10" style={{ top, height: LANE }}>
              <span className="absolute left-1 top-0.5 text-[10px] font-semibold text-slate-400">{a.def.name}</span>
              {a.actions.map((act, k) => (
                <div key={k} className="absolute overflow-hidden whitespace-nowrap rounded-md px-1 text-[10px] leading-5 text-white"
                  style={{ left: act.t0 * pps, width: Math.max(4, (act.t1 - act.t0) * pps - 2), top: 14, height: 22, background: colorOf(act) }}>
                  {labelOf(act)}
                </div>
              ))}
              {a.keys.map((k, j) => (
                <div key={j} className="absolute overflow-hidden whitespace-nowrap rounded-md border border-violet-300 bg-violet-500/40 px-1 text-[9px] leading-3 text-violet-100"
                  style={{ left: k.t0 * pps, width: Math.max(4, (k.t1 - k.t0) * pps - 2), top: 38, height: 12 }}>
                  pose
                </div>
              ))}
            </div>
          );
        })}

        <div className="absolute left-0 right-0 border-t border-white/10" style={{ top: RULER + scene.actors.length * LANE, height: CAM }}>
          <span className="absolute left-1 top-0.5 text-[10px] font-semibold text-slate-400">Camera</span>
          {camBlocks.map(({ a, b }, i) => (
            <div key={i} className="absolute overflow-hidden rounded-md bg-sky-500/70 px-1 text-[10px] leading-4 text-white"
              style={{ left: a.t * pps, width: Math.max(4, (b.t - a.t) * pps - 2), top: 14, height: 16 }}>
              {b.zoom > a.zoom ? "zoom in" : b.zoom < a.zoom ? "zoom out" : b.follow !== undefined ? "follow" : "pan"}
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute top-0 w-0.5 bg-red-500" style={{ left: time * pps, height }}>
          <div className="absolute -left-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
        </div>
      </div>
    </div>
  );
}
