"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { H, W, renderFrame } from "@/lib/engine";
import { parsePrompt } from "@/lib/parser";
import { CharacterDef, StyleId } from "@/lib/types";

const DEF: CharacterDef = { id: "c1", name: "Sam", style: "flat", skin: "#f2c9a0", hair: "#2b2118",
  top: "#e07b45", bottom: "#6aa38a", shoes: "#c9825b", hairStyle: "short", height: 300 };
const STYLES: StyleId[] = ["stick", "flat", "anime", "sketch"];

export default function Studio() {
  const cv = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  const [def, setDef] = useState(DEF);
  const [prompt, setPrompt] = useState('Walk right and wave, then say "Hello everyone" while smiling and zoom in');
  const scene = useMemo(() => parsePrompt(prompt, def), [prompt, def]);

  useEffect(() => { renderFrame(cv.current!.getContext("2d")!, scene, 0); }, [scene]);

  const play = (onDone?: () => void) => {
    cancelAnimationFrame(raf.current);
    const c = cv.current!.getContext("2d")!, t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      renderFrame(c, scene, Math.min(t, scene.duration));
      if (t < scene.duration) raf.current = requestAnimationFrame(tick); else onDone?.();
    };
    raf.current = requestAnimationFrame(tick);
  };

  const exportVideo = () => {
    const canvas = cv.current!;
    const mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find(m => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(chunks, { type: mime }));
      a.download = `scene.${mime?.includes("mp4") ? "mp4" : "webm"}`; a.click();
    };
    rec.start(); play(() => rec.stop());
  };

  return (
    <main className="mx-auto max-w-3xl space-y-3 p-4">
      <canvas ref={cv} width={W} height={H} className="w-full rounded-xl bg-black" />
      <div className="flex flex-wrap gap-2">
        {STYLES.map(s => (
          <button key={s} onClick={() => setDef({ ...def, style: s })}
            className={`rounded-lg border px-3 py-1 ${def.style === s ? "bg-black text-white" : ""}`}>{s}</button>
        ))}
        <input type="color" value={def.top} onChange={e => setDef({ ...def, top: e.target.value })} />
        <input type="color" value={def.bottom} onChange={e => setDef({ ...def, bottom: e.target.value })} />
      </div>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} className="w-full rounded-lg border p-2" />
      <div className="flex gap-2">
        <button onClick={() => play()} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Play</button>
        <button onClick={exportVideo} className="rounded-lg bg-emerald-600 px-4 py-2 text-white">Export video</button>
      </div>
    </main>
  );
}
