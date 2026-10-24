"use client";
import { useEffect, useState } from "react";
import { SpriteKey, SpritePack } from "@/lib/types";
import { Slice, sliceSheet } from "@/lib/sprite";

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

export default function ArtImporter({ name, hasArt, onApply, onRemove }: {
  name: string; hasArt: boolean; onApply: (p: SpritePack) => void; onRemove: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [cols, setCols] = useState(4);
  const [tol, setTol] = useState(40);
  const [removeBg, setRemoveBg] = useState(true);
  const [slices, setSlices] = useState<Slice[]>([]);
  const [assign, setAssign] = useState<Assign[]>([]);
  const [sideRight, setSideRight] = useState(true);
  const [threeqRight, setThreeqRight] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

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

  const apply = () => {
    const views: Partial<Record<SpriteKey, string>> = {};
    let refH = 0;
    slices.forEach((s, i) => {
      const k = assign[i];
      if (k && k !== "skip" && !views[k]) { views[k] = s.url; refH = Math.max(refH, s.h); }
    });
    if (!views.front) { setMsg("Assign one figure as the Front view first."); return; }
    setMsg("");
    onApply({ views, refH, sideRight, threeqRight });
  };

  const uses = (k: SpriteKey) => assign.includes(k);

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
          📁 Choose a turnaround sheet or character image
          <input type="file" accept="image/*" hidden onChange={e => onFile(e.target.files?.[0])} />
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Works best with figures standing side by side on a plain light background. Crop out any phone status bars or black borders first.
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
          <button onClick={apply} style={grad} className="mt-3 w-full rounded-xl px-4 py-2.5 font-medium text-white">
            Use this art for {name}
          </button>
          {msg && <p className="mt-2 text-sm text-red-400">{msg}</p>}
          <p className="mt-2 text-xs text-slate-500">
            To keep this character, open the Character tab and press Save. Imported art cannot wave arms or open its mouth. It moves as a whole and switches views.
          </p>
        </div>
      )}
    </div>
  );
}
