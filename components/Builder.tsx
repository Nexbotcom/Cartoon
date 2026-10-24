"use client";
import { useEffect, useState } from "react";
import { CharacterDef, StyleId } from "@/lib/types";
import { PRESETS } from "@/lib/presets";
import { deleteChar, exportChar, importChars, listChars, saveChar } from "@/lib/library";

const STYLES: StyleId[] = ["stick", "flat", "anime", "sketch"];
const HAIRS: CharacterDef["hairStyle"][] = ["short", "spiky", "bun", "long", "none"];
const OUTFITS: CharacterDef["outfit"][] = ["pants", "shorts", "skirt"];
const SKINS = ["#fde0c5", "#f2c9a0", "#d9a066", "#a8714a", "#6f4a2f", "#3d2616"];

export default function Builder({ def, setDef }: { def: CharacterDef; setDef: (d: CharacterDef) => void }) {
  const [lib, setLib] = useState<CharacterDef[]>([]);
  useEffect(() => { listChars().then(setLib); }, []);
  const up = (p: Partial<CharacterDef>) => setDef({ ...def, ...p });

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick}
      className={`rounded-lg border px-3 py-1 text-sm ${active ? "bg-black text-white" : ""}`}>{label}</button>
  );
  const color = (k: "hair" | "top" | "bottom" | "shoes", label: string) => (
    <label key={k} className="flex items-center gap-1 text-sm">{label}
      <input type="color" value={def[k]} onChange={e => up({ [k]: e.target.value } as Partial<CharacterDef>)} />
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
    for (const c of importChars(await f.text())) await saveChar(c);
    setLib(await listChars());
  };

  return (
    <section className="space-y-3 rounded-xl border p-3">
      <div className="flex flex-wrap gap-2">{PRESETS.map(p => chip(p.name, def.id === p.id, () => setDef(p)))}</div>
      <input value={def.name} onChange={e => up({ name: e.target.value })} className="w-full rounded-lg border p-2" placeholder="Name" />

      <div className="flex flex-wrap gap-2">{STYLES.map(s => chip(s, def.style === s, () => up({ style: s })))}</div>
      <div className="flex flex-wrap items-center gap-2">
        {SKINS.map(s => (
          <button key={s} onClick={() => up({ skin: s })} style={{ background: s }}
            className={`h-7 w-7 rounded-full border-2 ${def.skin === s ? "border-black" : "border-transparent"}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">{HAIRS.map(h => chip(h, def.hairStyle === h, () => up({ hairStyle: h })))}</div>
      <div className="flex flex-wrap gap-2">{OUTFITS.map(o => chip(o, def.outfit === o, () => up({ outfit: o })))}</div>
      <div className="flex flex-wrap gap-3">{color("hair", "Hair")}{color("top", "Top")}{color("bottom", "Bottom")}{color("shoes", "Shoes")}</div>

      <label className="block text-sm">Build
        <input type="range" min={0.8} max={1.25} step={0.05} value={def.build} onChange={e => up({ build: +e.target.value })} className="w-full" />
      </label>
      <label className="block text-sm">Height
        <input type="range" min={220} max={380} step={5} value={def.height} onChange={e => up({ height: +e.target.value })} className="w-full" />
      </label>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => save(false)} className="rounded-lg bg-emerald-600 px-3 py-1 text-white">Save</button>
        <button onClick={() => save(true)} className="rounded-lg border px-3 py-1">Save as new</button>
        <button onClick={download} className="rounded-lg border px-3 py-1">Export JSON</button>
        <label className="cursor-pointer rounded-lg border px-3 py-1">Import
          <input type="file" accept=".json" hidden onChange={e => upload(e.target.files?.[0])} />
        </label>
      </div>

      {lib.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">My library</p>
          <div className="flex flex-wrap gap-2">
            {lib.map(c => (
              <span key={c.id} className="flex items-center overflow-hidden rounded-lg border text-sm">
                <button onClick={() => setDef(c)} className={`px-3 py-1 ${def.id === c.id ? "bg-black text-white" : ""}`}>{c.name}</button>
                <button onClick={async () => setLib(await deleteChar(c.id))} className="px-2 py-1 text-red-600">✕</button>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
