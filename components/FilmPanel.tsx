"use client";
import { useEffect, useMemo, useState } from "react";
import { FILM } from "@/lib/film";
import { SERIES } from "@/lib/series";
import { parseScript } from "@/lib/parser";
import { SceneFile, deleteScene, exportScenes, importScenes, listScenes, saveScene } from "@/lib/projects";

const panel = "rounded-2xl border border-white/10 bg-white/[0.03] p-3";
const lbl = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400";
const grad = { background: "linear-gradient(135deg,#8b5cf6,#ec4899)" };
const length = (s: SceneFile) => parseScript(s.script, s.cast, s.props).duration;
const clock = (t: number) => { const n = Math.round(t); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; };

export default function FilmPanel({ current, onLoad }: { current: () => SceneFile; onLoad: (s: SceneFile) => void }) {
  const [mine, setMine] = useState<SceneFile[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { listScenes().then(setMine); }, []);

  
  const filmLens = useMemo(() => FILM.map(length), []);
  const seriesLens = useMemo(() => SERIES.map(length), []);
  const total = filmLens.reduce((a, b) => a + b, 0);
  const mineLens = useMemo(() => mine.map(length), [mine]);

  const save = async () => {
    const n = name.trim();
    if (!n) { setMsg("Give the scene a name first."); return; }
    setMine(await saveScene({ ...current(), name: n }));
    setMsg(`Saved "${n}".`);
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportScenes(mine)], { type: "application/json" }));
    a.download = "my-scenes.json"; a.click();
  };
  const upload = async (f?: File) => {
    if (!f) return;
    try {
      const list = importScenes(await f.text());
      for (const s of list) await saveScene(s);
      setMine(await listScenes());
      setMsg(`Imported ${list.length} scene(s).`);
    } catch { setMsg("That file could not be read."); }
  };

  const card = (s: SceneFile, len: number, extra?: React.ReactNode) => (
    <div key={s.name} className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 font-medium">{s.name}</p>
        <span className="text-sm tabular-nums text-slate-400">{clock(len)}</span>
      </div>
      {s.note && <p className="mt-1 text-xs text-slate-400">{s.note}</p>}
      <div className="mt-2 flex gap-2">
        <button onClick={() => onLoad(s)} style={grad} className="rounded-lg px-3 py-1.5 text-sm font-medium text-white">Load this scene</button>
        {extra}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className={panel}>
        <div className="mb-2 flex items-baseline gap-2">
          <p className={`${lbl} mb-0`}>Starter film: The Surprise</p>
          <span className="ml-auto text-sm tabular-nums text-slate-400">total {clock(total)}</span>
        </div>
        <div className="space-y-2">{FILM.map((s, i) => card(s, filmLens[i]))}</div>
      </div>

      <div className={`${panel} text-sm leading-relaxed text-slate-400`}>
        <p className={lbl}>How to make the film</p>
        <p>1. Load scene 1, press Play to check it, then press Export video.</p>
        <p>2. Repeat for scenes 2, 3 and 4. Scenes 3 and 4 have a 360° shot, which only shows in 3D mode (switch to 3D first). You can export all four in 3D for a matching look.</p>
        <p>3. Join the four clips in CapCut. Add your voice-overs, music and a fade between scenes. If you will record voices or add captions in CapCut, switch off Speech bubbles before exporting.</p>
        <p>4. Too short or too long? Add <span className="text-slate-200">wait 2 seconds</span> lines or change dialogue. The time next to each scene is calculated by the app.</p>
      </div>

      <div className={panel}>
        <p className={lbl}>My scenes</p>
        <div className="mb-3 flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name for the current scene"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-violet-400" />
          <button onClick={save} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-black">Save</button>
        </div>
        <div className="space-y-2">
          {mine.map((s, i) => card(s, mineLens[i],
            <button onClick={async () => setMine(await deleteScene(s.name))} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-red-400">Delete</button>))}
          {mine.length === 0 && <p className="text-sm text-slate-500">Nothing saved yet. Set up a scene, give it a name and press Save.</p>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={download} disabled={mine.length === 0} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm disabled:opacity-40">Export all (JSON)</button>
          <label className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm">Import
            <input type="file" accept=".json" hidden onChange={e => upload(e.target.files?.[0])} />
          </label>
        </div>
        {msg && <p className="mt-2 text-sm text-slate-300">{msg}</p>}
        <p className="mt-2 text-xs text-slate-500">Scenes are stored in this browser. Export them now and then as a backup.</p>
      </div>
    </div>
  );
}
