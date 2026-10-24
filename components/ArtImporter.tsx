"use client";
import { useEffect, useState } from "react";
import { MouthParams, RigData, RigParams, SpriteKey, SpritePack } from "@/lib/types";
import { Slice, autoRig, buildRig, sliceSheet } from "@/lib/sprite";

type Assign = SpriteKey | "skip";
const OPTIONS: { v: Assign; label: string }[] = [
  { v: "front", label: "Front view" },
  { v: "threeq", label: "3/4 view" },
  { v: "side", label: "Side view" },
  { v: "back", label: "Back view" },
  { v: "skip", label: "Skip" },
];
const preset = (n: number): Assign[] => {
  const base: Assign[] = n === 1 ? ["front"] : n === 2 ? ["front", "side"] : n === 3 ? ["front", "side", "back"] : ["front", "threeq", "side", "back"];
  return Array.from({ length: n }, (_, i) => base[i] ?? "skip");
};

const panel = "rounded-2xl border border-white/10 bg-white/[0.03] p-3";
const lbl = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400";
const grad = { background: "linear-gradient(135deg,#8b5cf6,#ec4899)" };

const HLINES: { k: keyof RigParams; label: string; color: string }[] = [
  { k: "neckY", label: "Neck (under the chin)", color: "#22d3ee" },
  { k: "shoulderY", label: "Shoulders", color: "#4ade80" },
  { k: "elbowY", label: "Elbows", color: "#facc15" },
  { k: "armEndY", label: "Bottom of the hands", color: "#fb923c" },
  { k: "hipY", label: "Hips (top of the legs)", color: "#f87171" },
  { k: "kneeY", label: "Knees", color: "#c084fc" },
];
const VLINES: { k: keyof RigParams; label: string; color: string }[] = [
  { k: "lc", label: "Left arm | torso", color: "#f472b6" },
  { k: "rc", label: "Torso | right arm", color: "#f472b6" },
  { k: "cx", label: "Centre between the legs", color: "#e2e8f0" },
];

export default function ArtImporter({ name, hasArt, onApply, onRemove }: {
  name: string; hasArt: boolean; onApply: (p: SpritePack) => void; onRemove: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [cols, setCols] = useState(1);
  const [tol, setTol] = useState(40);
  const [removeBg, setRemoveBg] = useState(true);
  const [slices, setSlices] = useState<Slice[]>([]);
  const [assign, setAssign] = useState<Assign[]>([]);
  const [sideRight, setSideRight] = useState(true);
  const [threeqRight, setThreeqRight] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [useRig, setUseRig] = useState(true);
  const [walkFront, setWalkFront] = useState(true);
  const [rp, setRp] = useState<RigParams | null>(null);
  const [mouth, setMouth] = useState<MouthParams>({ x: 0.5, y: 0.12, w: 0.06 });

  const onFile = (f?: File) => {
    if (!f) return;
    const im = new Image();
    im.onload = () => setImg(im);
    im.src = URL.createObjectURL(f);
  };

  useEffect(() => {
    if (!img) return;
    setBusy(true);
    const id = setTimeout(() => {
      try {
        const s = sliceSheet(img, cols, tol, removeBg);
        setSlices(s);
        setAssign(a => (a.length === s.length ? a : preset(s.length)));
        setMsg("");
      } catch (e) { setMsg(String(e)); }
      setBusy(false);
    }, 150);
    return () => clearTimeout(id);
  }, [img, cols, tol, removeBg]);

  const frontIdx = assign.indexOf("front");
  const frontUrl = frontIdx >= 0 ? slices[frontIdx]?.url : undefined;

  const detect = () => {
    if (!frontUrl) return;
    autoRig(frontUrl).then(r => { setRp(r.rig); setMouth(r.mouth); }).catch(e => setMsg(String(e)));
  };
  useEffect(() => { if (useRig && frontUrl) detect(); /* eslint-disable-next-line */ }, [useRig, frontUrl]);

  const apply = async () => {
    const views: Partial<Record<SpriteKey, string>> = {};
    let refH = 0;
    slices.forEach((s, i) => {
      const k = assign[i];
      if (k && k !== "skip" && !views[k]) { views[k] = s.url; refH = Math.max(refH, s.h); }
    });
    if (!views.front) { setMsg("Assign one figure as the Front view first."); return; }
    let rig: RigData | undefined;
    if (useRig && rp) {
      try { setBusy(true); rig = await buildRig(views.front, rp, mouth); }
      catch (e) { setMsg(String(e)); setBusy(false); return; }
      setBusy(false);
    }
    setMsg("");
    onApply({ views, refH, sideRight, threeqRight, rig, walkFront });
  };

  const uses = (k: SpriteKey) => assign.includes(k);

  const slider = (label: string, color: string, value: number, onChange: (v: number) => void) => (
    <label key={label} className="block text-xs text-slate-300">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />{label}
        <span className="ml-auto text-slate-500">{Math.round(value * 100)}%</span>
      </span>
      <input type="range" min={0} max={100} value={Math.round(value * 100)} onChange={e => onChange(+e.target.value / 100)} className="w-full accent-violet-500" />
    </label>
  );

  return (
    <div className="space-y-3">
      <div className={panel}>
        <p className={lbl}>Imported art for {name}</p>
        {hasArt && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-2 text-sm text-emerald-200">
            <span>This actor is using imported art.</span>
            <button onClick={onRemove} className="ml-auto rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/10">Go back to built-in look</button>
          </div>
        )}
        <label className="block cursor-pointer rounded-xl border border-dashed border-white/20 bg-black/20 p-4 text-center text-sm text-slate-300 hover:bg-white/5">
          📁 Choose a character image
          <input type="file" accept="image/*" hidden onChange={e => onFile(e.target.files?.[0])} />
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Best: one character, front view, standing, arms slightly away from the body and feet slightly apart, on a plain light background.
          A sheet with several views also works: raise the slider below.
        </p>
      </div>

      {img && (
        <div className={panel}>
          <p className={lbl}>Slice and clean</p>
          <label className="mb-2 block text-sm text-slate-300">
            <span className="flex justify-between"><span>Figures in the image (left to right)</span><span className="text-slate-500">{cols}</span></span>
            <input type="range" min={1} max={6} value={cols} onChange={e => setCols(+e.target.value)} className="w-full accent-violet-500" />
          </label>
          <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={removeBg} onChange={e => setRemoveBg(e.target.checked)} className="accent-violet-500" />
            Remove the background
          </label>
          {removeBg && (
            <label className="block text-sm text-slate-300">
              <span className="flex justify-between"><span>Background tolerance</span><span className="text-slate-500">{tol}</span></span>
              <input type="range" min={0} max={150} value={tol} onChange={e => setTol(+e.target.value)} className="w-full accent-violet-500" />
              <span className="text-xs text-slate-500">Raise it if a halo is left around the figure. Lower it if parts of the figure vanish.</span>
            </label>
          )}
        </div>
      )}

      {busy && <p className="text-sm text-slate-400">Processing...</p>}

      {slices.length > 0 && (
        <div className={panel}>
          <p className={lbl}>Assign each figure to a view</p>
          <div className="grid grid-cols-2 gap-2">
            {slices.map((s, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="mb-2 flex h-40 items-end justify-center rounded-lg bg-[#1b1f2e]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt={`figure ${i + 1}`} className="max-h-40 max-w-full object-contain" />
                </div>
                <select value={assign[i] ?? "skip"} onChange={e => setAssign(a => a.map((v, k) => (k === i ? (e.target.value as Assign) : v)))}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm">
                  {OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1">
            {uses("side") && (
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={sideRight} onChange={e => setSideRight(e.target.checked)} className="accent-violet-500" />
                Side view faces right in the image
              </label>
            )}
            {uses("threeq") && (
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={threeqRight} onChange={e => setThreeqRight(e.target.checked)} className="accent-violet-500" />
                3/4 view faces right in the image
              </label>
            )}
          </div>
        </div>
      )}

      {frontUrl && (
        <div className={panel}>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
            <input type="checkbox" checked={useRig} onChange={e => setUseRig(e.target.checked)} className="accent-violet-500" />
            Make the arms, legs and mouth move (cut-out rig)
          </label>

          {useRig && rp && (
            <>
              <p className="mb-2 text-xs text-slate-500">
                Drag each slider until its line sits on the joint. Press Auto-detect to guess them again.
                The red dot is where the mouth opens.
              </p>
              <div className="mb-3 flex justify-center rounded-xl bg-[#1b1f2e] p-2">
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={frontUrl} alt="front" className="block max-h-96 w-auto" />
                  {HLINES.map(l => (
                    <div key={l.k} className="absolute left-0 right-0 border-t-2 border-dashed" style={{ top: `${rp[l.k] * 100}%`, borderColor: l.color }} />
                  ))}
                  {VLINES.map(l => (
                    <div key={l.k} className="absolute bottom-0 top-0 border-l-2 border-dashed" style={{ left: `${rp[l.k] * 100}%`, borderColor: l.color }} />
                  ))}
                  <div className="absolute rounded-full bg-red-500/90"
                    style={{ left: `${mouth.x * 100}%`, top: `${mouth.y * 100}%`, width: `${mouth.w * 100}%`, height: 6, transform: "translate(-50%,-50%)" }} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                {HLINES.map(l => slider(l.label, l.color, rp[l.k], v => setRp(r => (r ? ({ ...r, [l.k]: v } as RigParams) : r))))}
                {VLINES.map(l => slider(l.label, l.color, rp[l.k], v => setRp(r => (r ? ({ ...r, [l.k]: v } as RigParams) : r))))}
                {slider("Mouth: left / right", "#ef4444", mouth.x, v => setMouth(m => ({ ...m, x: v })))}
                {slider("Mouth: up / down", "#ef4444", mouth.y, v => setMouth(m => ({ ...m, y: v })))}
                {slider("Mouth: size", "#ef4444", mouth.w * 4, v => setMouth(m => ({ ...m, w: v / 4 })))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button onClick={detect} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">Auto-detect</button>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={walkFront} onChange={e => setWalkFront(e.target.checked)} className="accent-violet-500" />
                  Walk facing the camera (limbs move)
                </label>
              </div>
            </>
          )}
        </div>
      )}

      {slices.length > 0 && (
        <div className={panel}>
          <button onClick={apply} disabled={busy} style={grad} className="w-full rounded-xl px-4 py-2.5 font-medium text-white disabled:opacity-50">
            {busy ? "Working..." : `Use this art for ${name}`}
          </button>
          {msg && <p className="mt-2 text-sm text-red-400">{msg}</p>}
          <p className="mt-2 text-xs text-slate-500">
            To keep this character, open the Character tab and press Save. Without the rig, imported art moves as one piece.
          </p>
        </div>
      )}
    </div>
  );
}
