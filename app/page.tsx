"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Builder from "@/components/Builder";
import FilmPanel from "@/components/FilmPanel";
import PosePanel from "@/components/PosePanel";
import Timeline from "@/components/Timeline";
import { H, THEME_LIST, W, renderFrame } from "@/lib/engine";
import { listChars } from "@/lib/library";
import { parseScript } from "@/lib/parser";
import { PRESETS } from "@/lib/presets";
import type { SceneFile } from "@/lib/projects";
import { PROP_LIST } from "@/lib/props";
import type { Renderer3D } from "@/lib/render3d";
import { CastMember, CharacterDef, Pose, PoseBlock, PropKind, PropMember, Scene, ThemeId } from "@/lib/types";
import { Line, VoiceError, audio, listVoices, playNow, prepareLines, resolveVoice, scheduleVoices, voiceKey } from "@/lib/voice";

const SAMPLE = `Sam: enter from the left, walk to the center and smile
& Mina: enter from the right, run to Sam and wave
Sam: say "You made it!" then run out of the scene to the left
Car: enter from the right and drive out of the scene to the left
Camera: follow Sam`;

type Tab = "script" | "stage" | "look" | "pose" | "timeline" | "film";
interface VoiceStatus { kind: "idle" | "working" | "waiting" | "error" | "quota"; msg: string; done: number; total: number }
const IDLE: VoiceStatus = { kind: "idle", msg: "", done: 0, total: 0 };

const SLOTS = [380, 900, 640, 200, 1080];
const panel = "rounded-2xl border border-white/10 bg-white/[0.03] p-3";
const lbl = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400";
const grad = { background: "linear-gradient(135deg,#8b5cf6,#ec4899)" };
const input = "rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm";

const INITIAL: CastMember[] = [
  { def: PRESETS[0], x: 380, depth: 0 },
  { def: PRESETS[1], x: 900, depth: 0 },
];
const INITIAL_PROPS: PropMember[] = [
  { id: "prop-car", kind: "car", name: "Car", x: 640, depth: 0.5, scale: 1, color: "#d94f4f", flip: false },
];

export default function Studio() {
  const cv = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  const timeRef = useRef(0);
  const r3 = useRef<Renderer3D | null>(null);
  const playingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const stopAudioRef = useRef<() => void>(() => {});

  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [r3ready, setR3ready] = useState(false);
  const [note3, setNote3] = useState("");
  const [cast, setCast] = useState<CastMember[]>(INITIAL);
  const [props, setProps] = useState<PropMember[]>(INITIAL_PROPS);
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

  const [voices, setVoices] = useState<string[]>([]);
  const [voiceNote, setVoiceNote] = useState("");
  const [muteVoices, setMuteVoices] = useState(false);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [vs, setVs] = useState<VoiceStatus>(IDLE);

  const setT = (t: number) => { timeRef.current = t; setTime(t); };

  const castLive = useMemo(() => {
    if (tab !== "pose" || draftT0 === null || !cast[sel] || Object.keys(draft).length === 0) return cast;
    return cast.map((c, i) =>
      i === sel ? { ...c, keys: [...(c.keys ?? []), { t0: draftT0, t1: draftT0 + draftDur, pose: draft }] } : c);
  }, [cast, tab, sel, draft, draftT0, draftDur]);

  // known voice lengths make bubbles last as long as the audio
  const durOf = useMemo(() => (who: number, text: string): number | undefined => {
    const d = castLive[who]?.def;
    return d ? durations[voiceKey(resolveVoice(d, voices), text)] : undefined;
  }, [castLive, durations, voices]);

  const scene = useMemo(
    () => parseScript(script, castLive, props, muteVoices ? undefined : durOf),
    [script, castLive, props, durOf, muteVoices]);

  const ctx = () => cv.current!.getContext("2d")!;
  const stop = () => {
    cancelAnimationFrame(raf.current);
    stopAudioRef.current();
    stopAudioRef.current = () => {};
    playingRef.current = false;
  };

  const paint = (c: CanvasRenderingContext2D, sc: Scene, t: number) => {
    if (mode === "3d" && r3.current) r3.current.render(c, sc, t, { theme, bubbles });
    else renderFrame(c, sc, t, { bubbles, theme });
  };

  // load the 3D code only when 3D is switched on
  useEffect(() => {
    if (mode !== "3d" || r3.current) return;
    let dead = false;
    import("@/lib/render3d")
      .then(m => {
        if (dead) return;
        r3.current = m.createRenderer3D();
        setR3ready(true); setNote3("");
      })
      .catch(() => {
        if (dead) return;
        setNote3("3D could not start on this device or browser (it needs WebGL). Staying in 2D.");
        setMode("2d");
      });
    return () => { dead = true; };
  }, [mode]);
  useEffect(() => () => { stop(); r3.current?.dispose(); }, []);

  // repaint when something changes (never while a playback is running)
  useEffect(() => {
    if (playingRef.current) return;
    const t = Math.min(timeRef.current, scene.duration);
    setT(t);
    paint(ctx(), scene, t);
  }, [scene, bubbles, theme, mode, r3ready]);
  useEffect(() => { listChars().then(setLib); }, [tab]);
  useEffect(() => { setDraft({}); setDraftT0(null); }, [sel]);
  useEffect(() => { listVoices().then(r => { setVoices(r.voices); setVoiceNote(r.error ?? ""); }); }, []);

  // ---------- voices ----------
  const mkDurOf = (durs: Record<string, number>, cs: CastMember[]) => (who: number, text: string): number | undefined => {
    const d = cs[who]?.def;
    return d ? durs[voiceKey(resolveVoice(d, voices), text)] : undefined;
  };
  const collectLines = (sc: Scene): Line[] => {
    const map = new Map<string, Line>();
    sc.actors.forEach(a => {
      const v = resolveVoice(a.def, voices);
      for (const q of a.actions) if (q.say) map.set(voiceKey(v, q.say), { key: voiceKey(v, q.say), text: q.say, voice: v });
    });
    return Array.from(map.values());
  };
  const voiceCbs = (ctl: AbortController) => ({
    signal: ctl.signal,
    onProgress: (done: number, total: number) => setVs({ kind: "working", msg: "", done, total }),
    onWait: (attempt: number, done: number, total: number) =>
      setVs({ kind: "waiting", msg: `Waiting for a free GPU... attempt ${attempt}`, done, total }),
  });
  const voiceFailed = (e: unknown, ctl: AbortController, total: number) => {
    if (ctl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) { setVs({ ...IDLE, msg: "Voice generation cancelled." }); return; }
    if (e instanceof VoiceError && e.kind === "quota") { setVs({ kind: "quota", msg: e.message, done: 0, total }); return; }
    setVs({ kind: "error", msg: e instanceof Error ? e.message : String(e), done: 0, total });
  };
  const cancelVoices = () => abortRef.current?.abort();

  const ensureVoices = async (): Promise<Record<string, number> | null> => {
    const lines = collectLines(scene);
    if (lines.length === 0) return durations;
    const ctl = new AbortController();
    abortRef.current = ctl;
    setVs({ kind: "working", msg: "", done: 0, total: lines.length });
    try {
      const d = await prepareLines(lines, voiceCbs(ctl));
      setDurations(prev => ({ ...prev, ...d }));
      setVs(IDLE);
      return { ...durations, ...d };
    } catch (e) {
      voiceFailed(e, ctl, lines.length);
      return null;
    }
  };

  // makes the voices, then returns the scene with timings that match the audio
  const prepare = async (): Promise<Scene | null> => {
    audio();                       // create / resume the audio engine inside the click
    if (muteVoices) return scene;
    const d = await ensureVoices();
    if (!d) return null;
    return parseScript(script, castLive, props, mkDurOf(d, castLive));
  };

  const testVoice = async (d: CharacterDef) => {
    audio();
    const voice = resolveVoice(d, voices);
    const text = `Hello, I am ${d.name.replace(/\s+\d+$/, "")}.`;
    const key = voiceKey(voice, text);
    const ctl = new AbortController();
    abortRef.current = ctl;
    setVs({ kind: "working", msg: "", done: 0, total: 1 });
    try {
      await prepareLines([{ key, text, voice }], voiceCbs(ctl));
      setVs(IDLE);
      playNow(key);
    } catch (e) { voiceFailed(e, ctl, 1); }
  };

  // ---------- playback and export ----------
  const runPlayback = (sc: Scene, onDone?: () => void) => {
    stop();
    playingRef.current = true;
    const c = ctx();
    const lead = 0.15;                                  // small lead-in so picture and sound start together
    const t0 = performance.now() + lead * 1000;
    if (!muteVoices) stopAudioRef.current = scheduleVoices(sc, i => resolveVoice(sc.actors[i].def, voices), lead);
    const tick = (now: number) => {
      const t = Math.min(Math.max(0, (now - t0) / 1000), sc.duration);
      paint(c, sc, t);
      setT(t);
      if (t < sc.duration) raf.current = requestAnimationFrame(tick);
      else { playingRef.current = false; onDone?.(); }
    };
    raf.current = requestAnimationFrame(tick);
  };

  const startPlay = async () => {
    const sc = await prepare();
    if (sc) runPlayback(sc);
  };
  const scrub = (t: number) => { stop(); setT(t); paint(ctx(), scene, t); };

  const exportVideo = async () => {
    const sc = await prepare();
    if (!sc) return;
    const withAudio = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const videoOnly = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"];
    const mime = (muteVoices ? videoOnly : withAudio).find(m => MediaRecorder.isTypeSupported(m));
    if (!mime) { alert("This browser cannot record video. Try Chrome."); return; }

    // the picture track from the canvas plus the voice track from the audio engine
    const tracks: MediaStreamTrack[] = [...cv.current!.captureStream(30).getVideoTracks()];
    if (!muteVoices) tracks.push(...audio().dest.stream.getAudioTracks());
    const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 128_000 });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(chunks, { type: mime }));
      a.download = `scene.${mime.includes("mp4") ? "mp4" : "webm"}`; a.click();
      setRecording(false);
    };
    setRecording(true);
    rec.start();
    runPlayback(sc, () => setTimeout(() => rec.stop(), 500));   // short tail so the last word is not cut
  };

  const askAI = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/direct", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: script, names: [...cast.map(c => c.def.name), ...props.map(p => p.name)] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "AI request failed");
      setScript(j.script);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const uniqueName = (base: string) => {
    const used = [...cast.map(c => c.def.name), ...props.map(p => p.name)].map(s => s.toLowerCase());
    let name = base, n = 2;
    while (used.includes(name.toLowerCase())) name = `${base} ${n++}`;
    return name;
  };

  const patch = (i: number, p: Partial<CastMember>) => setCast(cs => cs.map((c, k) => (k === i ? { ...c, ...p } : c)));
  const remove = (i: number) => { setCast(cs => cs.filter((_, k) => k !== i)); setSel(0); };
  const addActor = (src: CharacterDef) => {
    setCast([...cast, { def: { ...src, id: crypto.randomUUID(), name: uniqueName(src.name) }, x: SLOTS[cast.length % SLOTS.length], depth: 0 }]);
    setSel(cast.length);
  };
  const addLine = (who: string) => setScript(s => `${s.trimEnd()}\n${who}: `);
  const loadScene = (sf: SceneFile) => {
    stop();
    setCast(sf.cast); setProps(sf.props); setTheme(sf.theme); setScript(sf.script);
    setSel(0); setT(0);
  };
  const snapshot = (): SceneFile => ({ name: "", theme, cast, props, script });
  const addOrbit = () => {
    const who = cast[sel]?.def.name ?? cast[0]?.def.name ?? "";
    setScript(s => `${s.trimEnd()}\nCamera: orbit around ${who} for 5 seconds`);
  };

  const patchProp = (i: number, p: Partial<PropMember>) => setProps(ps => ps.map((q, k) => (k === i ? { ...q, ...p } : q)));
  const removeProp = (i: number) => setProps(ps => ps.filter((_, k) => k !== i));
  const addProp = (kind: PropKind) => {
    const info = PROP_LIST.find(q => q.kind === kind);
    if (!info) return;
    setProps(ps => [...ps, {
      id: crypto.randomUUID(), kind, name: uniqueName(info.label), x: SLOTS[ps.length % SLOTS.length],
      depth: info.depth, scale: 1, color: info.color, flip: false,
    }]);
  };

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
  const modeBtn = (m: "2d" | "3d", label: string) => (
    <button key={m} onClick={() => setMode(m)}
      className={`px-4 py-1.5 font-medium ${mode === m ? "text-white" : "text-slate-400"}`}
      style={mode === m ? grad : undefined}>{label}</button>
  );

  const working = vs.kind === "working" || vs.kind === "waiting";

  return (
    <div className="min-h-screen bg-[#0b0d14] text-slate-100">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="h-8 w-8 rounded-xl" style={grad} />
        <h1 className="text-lg font-semibold tracking-tight">ToonStage <span className="hidden font-normal text-slate-400 sm:inline">director&apos;s studio</span></h1>
        <div className="ml-auto flex overflow-hidden rounded-xl border border-white/10 text-sm">
          {modeBtn("2d", "2D")}{modeBtn("3d", "3D")}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 p-3 lg:grid-cols-[1.4fr_1fr]">
        <section className="sticky top-0 z-20 -mx-3 space-y-2 bg-[#0b0d14]/95 px-3 pb-2 pt-1 backdrop-blur lg:top-3 lg:mx-0 lg:self-start lg:px-0">
          <div className="overflow-hidden rounded-2xl ring-1 ring-white/10" style={{ boxShadow: "0 20px 60px rgba(139,92,246,0.18)" }}>
            <canvas ref={cv} width={W} height={H} className="block w-full bg-black" />
          </div>
          {mode === "3d" && !r3ready && <p className="text-xs text-slate-400">Loading 3D...</p>}
          {note3 && <p className="text-xs text-amber-400">{note3}</p>}
          <input type="range" min={0} max={scene.duration} step={0.01} value={time}
            onChange={e => scrub(+e.target.value)} className="w-full accent-violet-500" />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => void startPlay()} disabled={recording || working} style={grad}
              className="rounded-xl px-5 py-2 font-medium text-white disabled:opacity-50">▶ Play</button>
            <button onClick={() => { cancelVoices(); stop(); }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">■ Stop</button>
            <button onClick={() => void exportVideo()} disabled={recording || working}
              className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-black disabled:opacity-50">
              {recording ? "Recording..." : "⬇ Export video"}
            </button>
            <label className="ml-auto flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={bubbles} onChange={e => setBubbles(e.target.checked)} className="accent-violet-500" />
              Speech bubbles
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={muteVoices} onChange={e => setMuteVoices(e.target.checked)} className="accent-violet-500" />
              Mute voices
            </label>
            <span className="text-sm tabular-nums text-slate-500">{time.toFixed(1)}s / {scene.duration.toFixed(1)}s</span>
          </div>

          {(vs.kind !== "idle" || vs.msg) && (
            <div className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm ${
              vs.kind === "error" || vs.kind === "quota"
                ? "border-red-400/40 bg-red-500/10 text-red-200"
                : "border-violet-400/30 bg-violet-500/10 text-slate-200"}`}>
              <div className="min-w-0 flex-1">
                {vs.kind === "working" && <p>Generating voices {Math.min(vs.done + 1, vs.total)}/{vs.total}</p>}
                {vs.kind === "waiting" && <p>{vs.msg} (line {Math.min(vs.done + 1, vs.total)}/{vs.total})</p>}
                {vs.kind === "quota" && <p>The daily voice quota is used up, so voice generation stopped. Try again later, or switch on Mute voices. <span className="opacity-80">{vs.msg}</span></p>}
                {vs.kind === "error" && <p>Voice problem: {vs.msg}</p>}
                {vs.kind === "idle" && <p className="text-slate-400">{vs.msg}</p>}
              </div>
              {working
                ? <button onClick={cancelVoices} className="rounded-lg border border-white/20 px-3 py-1 text-xs hover:bg-white/10">Cancel</button>
                : <button onClick={() => setVs(IDLE)} className="rounded-lg border border-white/20 px-3 py-1 text-xs hover:bg-white/10">Dismiss</button>}
            </div>
          )}
        </section>

        <section className="min-w-0 space-y-3">
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {tabBtn("script", "🎬 Script")}{tabBtn("stage", "🎭 Stage")}{tabBtn("look", "🎨 Character")}
            {tabBtn("pose", "🕺 Pose")}{tabBtn("timeline", "⏱ Timeline")}{tabBtn("film", "🎞 Film")}
          </div>

          {tab === "script" && (
            <div className="space-y-3">
              <div className={panel}>
                <p className={lbl}>Director&apos;s script</p>
                <textarea value={script} onChange={e => setScript(e.target.value)} rows={10} spellCheck={false}
                  className="w-full rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-sm outline-none focus:border-violet-400" />
                <div className="mt-2 flex flex-wrap gap-2">
                  {cast.map((c, i) => (
                    <button key={i} onClick={() => addLine(c.def.name)}
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs hover:bg-white/10">+ {c.def.name}</button>
                  ))}
                  {props.map((p, i) => (
                    <button key={p.id + i} onClick={() => addLine(p.name)}
                      className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-xs hover:bg-sky-500/20">+ {p.name}</button>
                  ))}
                  <button onClick={() => addLine("Camera")} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs hover:bg-white/10">+ Camera</button>
                  <button onClick={addOrbit} className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-2.5 py-1 text-xs hover:bg-fuchsia-500/20">+ 360° shot</button>
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
                <p>Chain actions with <span className="text-slate-200">then</span>. Start a line with <span className="text-slate-200">&amp;</span> to run it at the same time as the line above. <span className="text-slate-200">wait 3 seconds</span> adds a pause.</p>
                <p>Moves: walk or <span className="text-slate-200">run</span> to a name, left, right, center · <span className="text-slate-200">enter from the left</span> · <span className="text-slate-200">walk out of the scene</span> · wave, point, shrug, jump, type on a laptop · look at a name, nod, shake head, turn around · smile, sad, angry, surprised</p>
                <p>Props are directed like actors: <span className="text-slate-200">Car: enter from the left and stop next to Sam</span>. Prop and camera lines run alongside the line above.</p>
                <p>Camera: <span className="text-slate-200">Camera: zoom in on Sam</span>, close-up, pan left or right, follow a name or prop, zoom out</p>
                <p>Sitting: <span className="text-slate-200">Mina: sit on the Sofa and say &quot;Hi&quot;</span>, <span className="text-slate-200">stand up</span>. Things: <span className="text-slate-200">Sam: pick up the Box and give it to Mina</span>, <span className="text-slate-200">put the Box on the Table</span>.</p>
                <p>Doors and cars: <span className="text-slate-200">Sam: enter through the Door and walk to Mina</span>, <span className="text-slate-200">Sam: get in the Car and drive off to the right</span>, <span className="text-slate-200">get out of the Car</span>.</p>
                <p>360° camera (3D mode only, only when you write it): <span className="text-slate-200">Camera: orbit around Sam for 5 seconds</span>, <span className="text-slate-200">Camera: wait 3 seconds then orbit around Sam for 5 seconds</span>. Add <span className="text-slate-200">left</span> to spin the other way.</p>
                <p>Voices: every quoted line is spoken by the voice named like the character. Change a voice in the Character tab. Speech bubbles last as long as the audio.</p>
              </div>
            </div>
          )}

          {tab === "stage" && (
            <div className="space-y-3">
              <div className={panel}>
                <p className={lbl}>Background</p>
                <div className="grid grid-cols-4 gap-2">
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
                          <span className="ml-2 text-xs font-normal text-slate-400">{c.def.style}</span></button>
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
                <p className={`${lbl} mt-3`}>Add an actor</p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map(p => (
                    <button key={p.id} onClick={() => addActor(p)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">+ {p.name}</button>
                  ))}
                  {lib.map(ch => (
                    <button key={ch.id} onClick={() => addActor(ch)} className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-sm hover:bg-violet-500/20">+ {ch.name}</button>
                  ))}
                </div>
              </div>

              <div className={panel}>
                <p className={lbl}>Props ({props.length})</p>
                <div className="space-y-2">
                  {props.map((p, i) => (
                    <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-2">
                      <div className="flex items-center gap-2">
                        <input value={p.name} onChange={e => patchProp(i, { name: e.target.value })} className={`min-w-0 flex-1 ${input}`} />
                        <input type="color" value={p.color} onChange={e => patchProp(i, { color: e.target.value })} className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent" />
                        <label className="flex items-center gap-1 text-xs text-slate-400">
                          <input type="checkbox" checked={p.flip} onChange={e => patchProp(i, { flip: e.target.checked })} className="accent-violet-500" />flip
                        </label>
                        <button onClick={() => removeProp(i)} className="px-2 text-red-400">✕</button>
                      </div>
                      <label className="mt-2 block text-xs text-slate-400">Position
                        <input type="range" min={-200} max={W + 200} value={p.x} onChange={e => patchProp(i, { x: +e.target.value })} className="w-full accent-violet-500" />
                      </label>
                      <label className="block text-xs text-slate-400">Depth (front to back)
                        <input type="range" min={0} max={1} step={0.05} value={p.depth} onChange={e => patchProp(i, { depth: +e.target.value })} className="w-full accent-violet-500" />
                      </label>
                      <label className="block text-xs text-slate-400">Size
                        <input type="range" min={0.5} max={2} step={0.05} value={p.scale} onChange={e => patchProp(i, { scale: +e.target.value })} className="w-full accent-violet-500" />
                      </label>
                    </div>
                  ))}
                  {props.length === 0 && <p className="text-sm text-slate-500">No props yet.</p>}
                </div>
                <p className={`${lbl} mt-3`}>Add a prop</p>
                <div className="flex flex-wrap gap-2">
                  {PROP_LIST.map(k => (
                    <button key={k.kind} onClick={() => addProp(k.kind)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">+ {k.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "look" && (cast[sel]
            ? (<>
                {actorChips}
                <Builder def={cast[sel].def} setDef={d => patch(sel, { def: d })}
                  voices={voices} voiceNote={voiceNote} onTestVoice={testVoice} />
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

          {tab === "film" && <FilmPanel current={snapshot} onLoad={loadScene} />}

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
                Drag on the timeline to scrub. Blue = walking and running, pink = talking, amber = gestures and expressions, violet = manual poses, sky = camera.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
