"use client";
import { useEffect, useState } from "react";
import { CharacterDef, StyleId } from "@/lib/types";
import { PRESETS } from "@/lib/presets";
import { deleteChar, exportChar, importChars, listChars, saveChar } from "@/lib/library";

const STYLES: [StyleId, string][] = [["flat", "Flat vector"], ["anime", "Anime"], ["sketch", "Sketch"], ["stick", "Stick"]];
const HAIRS: CharacterDef["hairStyle"][] = ["short", "spiky", "bun", "long", "none"];
const OUTFITS: CharacterDef["outfit"][] = ["pants", "shorts", "skirt"];
const SLEEVES: CharacterDef["sleeve"][] = ["short", "long"];
const SKINS = ["#fde0c5", "#f2c9a0", "#e7b88f", "#c68a5c", "#9a6b4b", "#6f4a2f", "#3d2616"];

const box = "rounded-2xl border border-white/10 bg-white/[0.03] p-3";
const head = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400";

export default function Builder({ def, setDef, voices = [], voiceNote = "", onTestVoice }: {
  def: CharacterDef; setDef: (d: CharacterDef) => void;
  voices?: string[]; voiceNote?: string; onTestVoice?: (d: CharacterDef) => void;
}) {
  const [lib, setLib] = useState<CharacterDef[]>([]);
  useEffect(() => { listChars().then(setLib); }, []);
  const up = (p: Partial<CharacterDef>) => setDef({ ...def, ...p });
  const swap = (src: CharacterDef) => setDef({ ...src, id: def.id, name: def.name });

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick}
      className={`rounded-xl border px-3 py-1.5 text-sm transition ${active ? "border-violet-400 bg-violet-500/20 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>
      {label}
    </button>
  );
  const color = (k: "hair" | "top" | "bottom" | "shoes" | "eye", label: string) => (
    <label key={k} className="flex items-center gap-2 text-sm text-slate-300">
      <input type="color" value={def[k] ?? "#3b2a1e"} onChange={e => up({ [k]: e.target.value } as Partial<CharacterDef>)}
        className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent" />
      {label}
    </label>
  );

  const save = async (asNew: boolean) => {
    const d = asNew || def.id.startsWith("preset-") ? { ...def, id: crypto.randomUUID() } : def;
    setDef(d);
    setLib(await saveChar(d));
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportChar(def)], { type: "application/json" }));
    a.download = `${def.name || "character"}.json`; a.click();
  };
  const upload = async (f?: File) => {
    if (!f) return;
    for (const ch of importChars(await f.text())) await saveChar(ch);
    setLib(await listChars());
  };

  return (
    <div className="space-y-3">
      <div className={box}>
        <p className={head}>Name (used in the script)</p>
        <input value={def.name} onChange={e => up({ name: e.target.value })}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-slate-100 outline-none focus:border-violet-400" />
        <p className={`${head} mt-3`}>Voice</p>
        <div className="flex gap-2">
          <select value={def.voice ?? ""} onChange={e => up({ voice: e.target.value || undefined })}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100">
            <option value="">Auto (the voice named like this character)</option>
            {voices.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          {onTestVoice && (
            <button onClick={() => onTestVoice(def)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">▶ Test</button>
          )}
        </div>
        {voices.length === 0 && voiceNote && <p className="mt-1 text-xs text-amber-400">{voiceNote}</p>}
      </div>

      <div className={box}>
        <p className={head}>Start from a look</p>
        <div className="flex flex-wrap gap-2">{PRESETS.map(p => chip(p.name, false, () => swap(p)))}</div>
      </div>

      <div className={box}>
        <p className={head}>Art style</p>
        <div className="flex flex-wrap gap-2">{STYLES.map(([id, label]) => chip(label, def.style === id, () => up({ style: id })))}</div>
      </div>

      <div className={box}>
        <p className={head}>Skin and hair</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {SKINS.map(s => (
            <button key={s} onClick={() => up({ skin: s })} style={{ background: s }}
              className={`h-8 w-8 rounded-full border-2 ${def.skin === s ? "border-white" : "border-transparent"}`} />
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-2">{HAIRS.map(h => chip(h, def.hairStyle === h, () => up({ hairStyle: h })))}</div>
        <div className="flex flex-wrap gap-4">{color("hair", "Hair")}{color("eye", "Eyes")}</div>
      </div>

      <div className={box}>
        <p className={head}>Outfit</p>
        <div className="mb-3 flex flex-wrap gap-2">{OUTFITS.map(o => chip(o, def.outfit === o, () => up({ outfit: o })))}</div>
        <div className="mb-3 flex flex-wrap gap-2">{SLEEVES.map(s => chip(`${s} sleeves`, (def.sleeve ?? "short") === s, () => up({ sleeve: s })))}</div>
        <div className="flex flex-wrap gap-4">{color("top", "Top")}{color("bottom", "Bottom")}{color("shoes", "Shoes")}</div>
      </div>

      <div className={box}>
        <p className={head}>Body</p>
        <label className="mb-2 block text-sm text-slate-300">Build
          <input type="range" min={0.8} max={1.25} step={0.05} value={def.build ?? 1} onChange={e => up({ build: +e.target.value })} className="w-full accent-violet-500" />
        </label>
        <label className="block text-sm text-slate-300">Height
          <input type="range" min={220} max={380} step={5} value={def.height} onChange={e => up({ height: +e.target.value })} className="w-full accent-violet-500" />
        </label>
      </div>

      <div className={box}>
        <p className={head}>Library</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={() => save(false)} className="rounded-xl bg-emerald-500 px-3 py-1.5 text-sm font-medium text-black">Save</button>
          <button onClick={() => save(true)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm">Save as new</button>
          <button onClick={download} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm">Export JSON</button>
          <label className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm">Import
            <input type="file" accept=".json" hidden onChange={e => upload(e.target.files?.[0])} />
          </label>
        </div>
        {lib.length === 0 ? <p className="text-sm text-slate-500">No saved characters yet.</p> : (
          <div className="flex flex-wrap gap-2">
            {lib.map(ch => (
              <span key={ch.id} className="flex items-center overflow-hidden rounded-xl border border-white/10 bg-white/5 text-sm">
                <button onClick={() => swap(ch)} className="px-3 py-1.5 hover:bg-white/10">{ch.name}</button>
                <button onClick={async () => setLib(await deleteChar(ch.id))} className="px-2 py-1.5 text-red-400 hover:bg-white/10">✕</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
