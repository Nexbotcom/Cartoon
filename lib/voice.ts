import { del, get, set } from "idb-keyval";
import { CharacterDef, Scene } from "./types";

export class VoiceError extends Error {
  kind: "quota" | "other";
  constructor(kind: "quota" | "other", message: string) {
    super(message);
    this.kind = kind;
    this.name = "VoiceError";
  }
}

export interface Line { key: string; text: string; voice: string }
export const voiceKey = (voice: string, text: string) => `${voice}\u0001${text}`;

export async function listVoices(): Promise<{ voices: string[]; error?: string }> {
  try {
    const r = await fetch("/api/voices");
    const j = (await r.json()) as { voices?: string[]; error?: string };
    return { voices: Array.isArray(j.voices) ? j.voices : [], error: j.error };
  } catch {
    return { voices: [], error: "Could not reach /api/voices." };
  }
}

// the voice a character speaks with: its own choice, else the voice named like it
export function resolveVoice(def: CharacterDef, voices: string[]): string {
  if (def.voice) return def.voice;
  const base = def.name.replace(/\s+\d+$/, "").trim();
  if (!voices.length) return base;
  const hit = voices.find(v => v.toLowerCase() === base.toLowerCase());
  if (hit) return hit;
  const pick = (re: RegExp) => voices.find(v => re.test(v));
  if (def.height < 235) return pick(/child|kid/i) ?? voices[0];
  if (def.hairStyle === "long" || def.hairStyle === "bun" || def.build < 0.95) return pick(/cartoon a|bright|woman|girl|female/i) ?? voices[0];
  return pick(/^man$|\bman\b|male|narrator/i) ?? voices[0];
}

// ---------- audio graph: every clip goes through one master gain, to the speakers and to the recording ----------
let ac: AudioContext | null = null;
let master: GainNode | null = null;
let dest: MediaStreamAudioDestinationNode | null = null;

export function audio() {
  if (!ac) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ac = new AC();
    master = ac.createGain();
    dest = ac.createMediaStreamDestination();
    master.connect(ac.destination);
    master.connect(dest);
  }
  if (ac.state === "suspended") void ac.resume();
  return { ac: ac as AudioContext, master: master as GainNode, dest: dest as MediaStreamAudioDestinationNode };
}

const buffers = new Map<string, AudioBuffer>();
const durCache: Record<string, number> = {};

// ---------- fetching with GPU-busy retries ----------
const QUOTA_STOP = /exceeded[^.]*quota|quota[^.]*exceeded|daily[^.]*quota|quota[^.]*daily/i;
const RETRY = /gpu|queue|quota|busy|overload|capacity|try again/i;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    const onAbort = () => { clearTimeout(id); reject(new DOMException("Cancelled", "AbortError")); };
    const id = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });

async function fetchAudio(text: string, voice: string, signal: AbortSignal, onWait: (attempt: number) => void): Promise<ArrayBuffer> {
  for (let attempt = 1; attempt <= 30; attempt++) {
    const r = await fetch("/api/tts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }), signal,
    });
    if (r.ok) return r.arrayBuffer();
    let msg = r.statusText || "Voice request failed.";
    try { const j = (await r.json()) as { error?: string }; if (j.error) msg = j.error; } catch { /* not JSON */ }
    if (QUOTA_STOP.test(msg)) throw new VoiceError("quota", msg);
    if (RETRY.test(msg)) { onWait(attempt); await sleep(4000, signal); continue; }
    throw new VoiceError("other", msg);
  }
  throw new VoiceError("other", "The GPU stayed busy for 30 attempts. Try again in a few minutes.");
}

// generates (or loads from the cache) every line, one at a time; returns the length of each line in seconds
export async function prepareLines(lines: Line[], cb: {
  signal: AbortSignal;
  onProgress: (done: number, total: number) => void;
  onWait: (attempt: number, done: number, total: number) => void;
}): Promise<Record<string, number>> {
  const { ac: ctx } = audio();
  const total = lines.length;
  let done = 0;
  cb.onProgress(0, total);
  for (const ln of lines) {
    if (cb.signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (!buffers.has(ln.key)) {
      let bytes = await get<ArrayBuffer>("tts:" + ln.key);
      if (!bytes) {
        bytes = await fetchAudio(ln.text, ln.voice, cb.signal, a => cb.onWait(a, done, total));
        await set("tts:" + ln.key, bytes);
      }
      try {
        buffers.set(ln.key, await ctx.decodeAudioData(bytes.slice(0)));
      } catch {
        await del("tts:" + ln.key);
        throw new VoiceError("other", "A saved voice clip was damaged and has been cleared. Press Play again.");
      }
    }
    durCache[ln.key] = (buffers.get(ln.key) as AudioBuffer).duration;
    done++;
    cb.onProgress(done, total);
  }
  return { ...durCache };
}

// plays every spoken line at the moment it happens; returns a function that stops them all
export function scheduleVoices(sc: Scene, voiceOf: (actorIndex: number) => string, lead: number): () => void {
  const { ac: ctx, master: out } = audio();
  const start = ctx.currentTime + lead;
  const nodes: AudioBufferSourceNode[] = [];
  sc.actors.forEach((a, i) => {
    const v = voiceOf(i);
    for (const q of a.actions) {
      if (!q.say) continue;
      const buf = buffers.get(voiceKey(v, q.say));
      if (!buf) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(out);
      src.start(start + q.t0);
      nodes.push(src);
    }
  });
  return () => { for (const n of nodes) { try { n.stop(); } catch { /* already finished */ } } };
}

export function playNow(key: string) {
  const { ac: ctx, master: out } = audio();
  const buf = buffers.get(key);
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(out);
  src.start();
}
