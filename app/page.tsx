"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import ArtImporter from "@/components/ArtImporter";
import Builder from "@/components/Builder";
import PosePanel from "@/components/PosePanel";
import Timeline from "@/components/Timeline";
import { H, THEME_LIST, W, renderFrame } from "@/lib/engine";
import { listChars } from "@/lib/library";
import { parseScript } from "@/lib/parser";
import { PRESETS } from "@/lib/presets";
import { CastMember, CharacterDef, Pose, PoseBlock, ThemeId } from "@/lib/types";

const SAMPLE = `Sam: walk to Mina and wave
Mina: look at Sam, smile, say "Hey Sam! You are late again."
Sam: say "Sorry! The bus was really slow." while shrugging
Camera: close-up on Mina`;

type Tab = "script" | "stage" | "look" | "art" | "pose" | "timeline";
const SLOTS = [380, 900, 640, 200, 1080];
const panel = "rounded-2xl border border-white/10 bg-white/[0.03] p-3";
const lbl = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400";
const grad = { background: "linear-gradient(135deg,#8b5cf6,#ec4899)" };

const INITIAL: CastMember[] = [
  { def: PRESETS[0], x: 380, depth: 0 },
  { def: PRESETS[1], x: 900, depth: 0 },
];

export default function Studio() {
  const cv = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  const timeRef = useRef(0);
  const [cast, setCast] = useState<CastMember[]>(INITIAL);
  const [sel, setSel] = useState(0);
  const [script, setScript] = useState(SAMPLE);
  const [tab, setTab] = useState<Tab>("script");
  const [time, setTime] = useState(0);
  const [recording, setRecording] = useState(false);
  const [bubbles, setBubbles] = useState(true);
  const [theme, setTheme] = useState<ThemeId>("day");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [lib, setLib] = useState<CharacterDef[]>([]);
  const [pps, setPps] = useState(70);
  const [draft, setDraft] = useState<Partial<Pose>>({});
  const [draftT0, setDraftT0] = useState<number | null>(null);
  const [draftDur, setDraftDur] = useState(2);

  const setT = (t: number) => { timeRef.current = t; setTime(t); };

  const castLive = useMemo(() => {
    if (tab !== "pose" || draftT0 === null || !cast[sel] || Object.keys(draft).length === 0) return cast;
    return cast.map((c, i) =>
      i === sel ? { ...c, keys: [...(c.keys ?? []), { t0: draftT0, t1: draftT0 + draftDur, pose: draft }] } : c);
  }, [cast, tab, sel, draft, draftT0, draftDur]);

  const scene = useMemo(() => parseScript(script, castLive), [script, castLive]);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const ctx = () => cv.current!.getContext("2d")!;
  const stop = () => cancelAnimationFrame(raf.current);

  useEffect(() => {
    stop();
    const t = Math.min(timeRef.current, scene.duration);
    setT(t);
    renderFrame(ctx(), scene, t, { bubbles, theme });
    return stop;
  }, [scene, bubbles, theme]);
  useEffect(() => { listChars().then(setLib); }, [tab]);
  useEffect(() => { setDraft({}); setDraftT0(null); }, [sel]);

  // imported images finish loading after the first draw: repaint the current frame
  useEffect(() => {
    const h = () => { if (cv.current) renderFrame(ctx(), sceneRef.current, timeRef.current, { bubbles, theme }); };
    window.addEventListener("toon-sprite", h);
    return () => window.removeEventListener("toon-sprite", h);
  }, [bubbles, theme]);

  const play = (onDone?: () => void) => {
    stop();
    const c = ctx(), t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - t0) / 1000, scene.duration);
      renderFrame(c, scene, t, { bubbles, theme });
      setT(t);
      if (t < scene.duration) raf.current = requestAnimationFrame(tick); else onDone?.();
    };
    raf.current = requestAnimationFrame(tick);
  };
  const scrub = (t: number) => { stop(); setT(t); renderFrame(ctx(), scene, t, { bubbles, theme }); };

  const exportVideo = () => {
    const mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find(m => MediaRecorder.isTypeSupported(m));
    if (!mime) { alert("This browser cannot record video. Try Chrome."); return; }
    const rec = new MediaRecorder(cv.current!.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(chunks, { type: mime }));
      a.download = `scene.${mime.includes("mp4") ? "mp4" : "webm"}`; a.click();
      setRecording(false);
    };
    setRecording(true); rec.start(); play(() => rec.stop());
  };

  const askAI = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/direct", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: script, names: cast.map(c => c.def.name) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "AI request failed");
      setScript(j.script);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const patch = (i: number, p: Partial<CastMember>) => setCast(cs => cs.map((c, k) => (k === i ? { ...c, ...p } : c)));
  const remove = (i: number) => { setCast(cs => cs.filter((_, k) => k !== i)); setSel(0); };
  const addActor = (src: CharacterDef) => {
    const used = cast.map(c => c.def.name.toLowerCase());
    let name = src.name, n = 2;
    while (used.includes(name.toLowerCase())) name = `${src.name} ${n++}`;
    setCast([...cast, { def: { ...src, id: crypto.randomUUID(), name }, x: SLOTS[cast.length % SLOTS.length], depth: 0 }]);
    setSel(cast.length);
  };
  const addLine = (who: string) => setScript(s => `${s.trimEnd()}\n${who}: `);

  // ---- pose blocks ----
  const blocks: PoseBlock[] = cast[sel]?.keys ?? [];
  const resetDraft = () => { setDraft({}); setDraftT0(null); };
  const draftChange = (k: keyof Pose, v: number) => {
    if (draftT0 === null) setDraftT0(timeRef.current);
    setDraft(d => ({ ...d, [k]: v } as Partial<Pose>));
  };
  const addBlock = () => {
    if (draftT0 === null || !cast[sel]) return;
    patch(sel, { keys: [...blocks, { t0: draftT0, t1: draftT0 + draftDur, pose: draft }] });
    resetDraft();
  };
  const delBlock = (i: number) => patch(sel, { keys: blocks.filter((_, k) => k !== i) });
  const editBlock = (i: number) => {
    const b = blocks[i];
    setDraft(b.pose); setDraftT0(b.t0); setDraftDur(b.t1 - b.t0);
    delBlock(i);
  };
  const patchBlock = (i: number, p: { t0?: number; dur?: number }) =>
    patch(sel, { keys: blocks.map((b, k) => k === i ? { ...b, t0: p.t0 ?? b.t0, t1: (p.t0 ?? b.t0) + (p.dur ?? b.t1 - b.t0) } : b) });

  const tabBtn = (id: Tab, label: string) => (
    <button key={id} onClick={() => setTab(id)}
      className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${tab === id ? "text-white" : "text-slate-400 hover:text-slate-200"}`}
      style={tab === id ? grad : undefined}>{label}</button>
  );
  const actorChips = (
    <div className="flex flex-wrap gap-2">
      {cast.map((c, i) => (
        <button key={i} onClick={() => setSel(i)}
          className={`rounded-xl border px-3 py-1.5 text-sm ${sel === i ? "border-violet-400 bg-violet-500/20" : "border-white/10 bg-white/5"}`}>{c.def.name}</button>
      ))}
    </div>
  );
  const needActor = <p className={`${panel} text-sm text-slate-400`}>Add an actor in the Stage tab first.</p>;

  return (
    <div className="min-h-screen bg-[#0b0d14] text-slate-100">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="h-8 w-8 rounded-xl" style={grad} />
        <h1 className="text-lg font-semibold tracking-tight">ToonStage <span className="font-normal text-slate-400">director&apos;s studio</span></h1>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 p-3 lg:grid-cols-[1.4fr_1fr]">
        <section className="sticky top-0 z-20 -mx-3 space-y-2 bg-[#0b0d14]/95 px-3 pb-2 pt-1 backdrop-blur lg:top-3 lg:mx-0 lg:self-start lg:px-0">
          <div className="overflow-hidden rounded-2xl ring-1 ring-white/10" style={{ boxShadow: "0 20px 60px rgba(139,92,246,0.18)" }}>
            <canvas ref={cv} width={W} height={H} className="block w-full bg-black" />
          </div>
          <input type="range" min={0} max={scene.duration} step={0.01} value={time}
            onChange={e => scrub(+e.target.value)} className="w-full accent-violet-500" />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => play()} disabled={recording} style={grad}
              className="rounded-xl px-5 py-2 font-medium text-white disabled:opacity-50">▶ Play</button>
            <button onClick={stop} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">■ Stop</button>
            <button onClick={exportVideo} disabled={recording}
              className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-black disabled:opacity-50">
              {recording ? "Recording..." : "⬇ Export video"}
            </button>
            <label className="ml-auto flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={bubbles} onChange={e => setBubbles(e.target.checked)} className="accent-violet-500" />
              Speech bubbles
            </label>
            <span className="text-sm tabular-nums text-slate-500">{time.toFixed(1)}s / {scene.duration.toFixed(1)}s</span>
          </div>
        </section>

        <section className="min-w-0 space-y-3">
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {tabBtn("script", "🎬 Script")}{tabBtn("stage", "🎭 Stage")}{tabBtn("look", "🎨 Character")}
            {tabBtn("art", "🖼 Art")}{tabBtn("pose", "🕺 Pose")}{tabBtn("timeline", "⏱ Timeline")}
          </div>

          {tab === "script" && (
            <div className="space-y-3">
              <div className={panel}>
                <p className={lbl}>Director&apos;s script</p>
                <textarea value={script} onChange={e => setScript(e.target.value)} rows={9} spellCheck={false}
                  className="w-full rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-sm outline-none focus:border-violet-400" />
                <div className="mt-2 flex flex-wrap gap-2">
                  {cast.map((c, i) => (
                    <button key={i} onClick={() => addLine(c.def.name)}
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs hover:bg-white/10">+ {c.def.name}</button>
                  ))}
                  <button onClick={() => addLine("Camera")} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs hover:bg-white/10">+ Camera</button>
                  <button onClick={askAI} disabled={busy} style={grad}
                    className="ml-auto rounded-lg px-3 py-1 text-xs font-medium text-white disabled:opacity-50">
                    {busy ? "Thinking..." : "✨ Direct with AI"}
                  </button>
                </div>
                {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
              </div>
              <div className={`${panel} text-sm leading-relaxed text-slate-400`}>
                <p className={lbl}>How to direct</p>
                <p>One line per actor: <span className="text-slate-200">Name: walk to Mina, smile, say &quot;Hi!&quot;</span></p>
                <p>Chain actions with <span className="text-slate-200">then</span>. Start a line with <span className="text-slate-200">&amp;</span> to run it at the same time as the line above.</p>
                <p>Moves: walk to a name, left, right, center · wave, point, shrug, jump, type on a laptop · look at a name, nod, shake head, turn around · smile, sad, angry, surprised</p>
                <p>Camera: <span className="text-slate-200">Camera: zoom in on Sam</span>, close-up, pan left or right, follow a name, zoom out</p>
              </div>
            </div>
          )}

          {tab === "stage" && (
            <div className="space-y-3">
              <div className={panel}>
                <p className={lbl}>Background</p>
                <div className="grid grid-cols-5 gap-2">
                  {THEME_LIST.map(t => (
                    <button key={t.id} onClick={() => setTheme(t.id)}
                      className={`rounded-xl border p-1 text-[11px] ${theme === t.id ? "border-violet-400 bg-violet-500/10" : "border-white/10"}`}>
                      <div className="mb-1 h-10 rounded-lg" style={{ background: t.swatch }} />{t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={panel}>
                <p className={lbl}>On stage ({cast.length})</p>
                <div className="space-y-2">
                  {cast.map((c, i) => (
                    <div key={i} className={`rounded-xl border p-2 ${sel === i ? "border-violet-400 bg-violet-500/10" : "border-white/10 bg-white/5"}`}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSel(i)} className="flex-1 text-left font-medium">{c.def.name}
                          <span className="ml-2 text-xs font-normal text-slate-400">{c.def.sprite ? "imported art" : c.def.style}</span></button>
                        <button onClick={() => { setSel(i); setTab("look"); }} className="rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-white/10">Edit look</button>
                        <button onClick={() => remove(i)} className="px-2 text-red-400">✕</button>
                      </div>
                      <label className="mt-2 block text-xs text-slate-400">Position
                        <input type="range" min={60} max={W - 60} value={c.x} onChange={e => patch(i, { x: +e.target.value })} className="w-full accent-violet-500" />
                      </label>
                      <label className="block text-xs text-slate-400">Depth (front to back)
                        <input type="range" min={0} max={1} step={0.05} value={c.depth} onChange={e => patch(i, { depth: +e.target.value })} className="w-full accent-violet-500" />
                      </label>
                    </div>
                  ))}
                  {cast.length === 0 && <p className="text-sm text-slate-500">Nobody on stage. Add an actor below.</p>}
                </div>
              </div>
              <div className={panel}>
                <p className={lbl}>Add an actor</p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map(p => (
                    <button key={p.id} onClick={() => addActor(p)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">+ {p.name}</button>
                  ))}
                </div>
                {lib.length > 0 && (<>
                  <p className={`${lbl} mt-3`}>From my library</p>
                  <div className="flex flex-wrap gap-2">
                    {lib.map(ch => (
                      <button key={ch.id} onClick={() => addActor(ch)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">+ {ch.name}</button>
                    ))}
                  </div>
                </>)}
              </div>
            </div>
          )}

          {tab === "look" && (cast[sel]
            ? (<>{actorChips}<Builder def={cast[sel].def} setDef={d => patch(sel, { def: d })} /></>)
            : needActor)}

          {tab === "art" && (cast[sel]
            ? (<>
                {actorChips}
                <ArtImporter
                  name={cast[sel].def.name}
                  hasArt={!!cast[sel].def.sprite}
                  onApply={pack => patch(sel, { def: { ...cast[sel].def, sprite: pack } })}
                  onRemove={() => { const d = { ...cast[sel].def }; delete d.sprite; patch(sel, { def: d }); }}
                />
              </>)
            : needActor)}

          {tab === "pose" && (cast[sel]
            ? (<>
                {actorChips}
                <PosePanel name={cast[sel].def.name} draft={draft} start={draftT0} dur={draftDur} blocks={blocks}
                  onChange={draftChange} onDur={setDraftDur} onAdd={addBlock} onReset={resetDraft}
                  onDelete={delBlock} onEdit={editBlock} onPatch={patchBlock} />
              </>)
            : needActor)}

          {tab === "timeline" && (
            <div className={panel}>
              <div className="mb-2 flex items-center gap-3">
                <p className={`${lbl} mb-0`}>Timeline</p>
                <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">Zoom
                  <input type="range" min={20} max={160} value={pps} onChange={e => setPps(+e.target.value)} className="w-28 accent-violet-500" />
                </label>
              </div>
              <Timeline scene={scene} time={time} onSeek={scrub} pps={pps} />
              <p className="mt-2 text-xs text-slate-500">
                Drag on the timeline to scrub. Blue = walking, pink = talking, amber = gestures and expressions, violet = manual poses, sky = camera.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
