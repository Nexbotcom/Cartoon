"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Builder from "@/components/Builder";
import { H, W, renderFrame } from "@/lib/engine";
import { parsePrompt } from "@/lib/parser";
import { PRESETS } from "@/lib/presets";
import { CharacterDef } from "@/lib/types";

const EXAMPLES = [
  'Walk right and wave, then say "Hello everyone" while smiling and zoom in',
  "Work on a laptop and smile for 4 seconds, then zoom out",
  'Say "I can not believe it" while surprised, then jump',
  "Walk left while angry, then follow and pan right",
];

export default function Studio() {
  const cv = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  const [def, setDef] = useState<CharacterDef>(PRESETS[0]);
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [time, setTime] = useState(0);
  const [recording, setRecording] = useState(false);

  const scene = useMemo(() => parsePrompt(prompt, def), [prompt, def]);
  const ctx = () => cv.current!.getContext("2d")!;
  const stop = () => cancelAnimationFrame(raf.current);

  // redraw the first frame whenever the scene changes
  useEffect(() => {
    stop();
    setTime(0);
    renderFrame(ctx(), scene, 0);
    return stop;
  }, [scene]);

  const play = (onDone?: () => void) => {
    stop();
    const c = ctx();
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - t0) / 1000, scene.duration);
      renderFrame(c, scene, t);
      setTime(t);
      if (t < scene.duration) raf.current = requestAnimationFrame(tick);
      else onDone?.();
    };
    raf.current = requestAnimationFrame(tick);
  };

  const scrub = (t: number) => {
    stop();
    setTime(t);
    renderFrame(ctx(), scene, t);
  };

  const exportVideo = () => {
    const mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find(m =>
      MediaRecorder.isTypeSupported(m)
    );
    if (!mime) { alert("This browser cannot record video. Try Chrome."); return; }
    const rec = new MediaRecorder(cv.current!.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(chunks, { type: mime }));
      a.download = `scene.${mime.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      setRecording(false);
    };
    setRecording(true);
    rec.start();
    play(() => rec.stop());
  };

  return (
    <main className="mx-auto max-w-3xl space-y-3 p-3">
      <div className="sticky top-0 z-10 space-y-2 bg-white pb-2">
        <canvas ref={cv} width={W} height={H} className="w-full rounded-xl bg-black" />
        <input
          type="range" min={0} max={scene.duration} step={0.01} value={time}
          onChange={e => scrub(+e.target.value)} className="w-full"
        />
        <div className="flex items-center gap-2">
          <button onClick={() => play()} disabled={recording} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Play</button>
          <button onClick={stop} className="rounded-lg border px-4 py-2">Stop</button>
          <button onClick={exportVideo} disabled={recording} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">
            {recording ? "Recording..." : "Export video"}
          </button>
          <span className="ml-auto text-sm text-gray-500">{time.toFixed(1)}s / {scene.duration.toFixed(1)}s</span>
        </div>
      </div>

      <section className="space-y-2 rounded-xl border p-3">
        <p className="text-sm font-medium">Action prompt</p>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} className="w-full rounded-lg border p-2" />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => setPrompt(ex)} className="rounded-lg border px-2 py-1 text-xs">{ex}</button>
          ))}
        </div>
      </section>

      <Builder def={def} setDef={setDef} />
    </main>
  );
}
