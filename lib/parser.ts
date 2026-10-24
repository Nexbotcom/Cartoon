import { Action, CamKey, CharacterDef, ClipId, Expr, Scene } from "./types";
import { GROUND, H, W } from "./engine";

const EXPR: [RegExp, Expr][] = [[/smil|happy|laugh|cheer/, "happy"], [/\bsad|cry|upset/, "sad"], [/angry|mad|furious/, "angry"], [/surpris|shock|gasp/, "surprised"]];
const CLIP: [RegExp, ClipId][] = [[/laptop|typing|\btype\b|work|computer/, "type"], [/walk|run|go |head |move/, "walk"], [/jump|hop/, "jump"], [/wave|waving/, "wave"]];

export function parsePrompt(text: string, def: CharacterDef): Scene {
  const segs = text.split(/\bthen\b|\bafter that\b|\bnext\b/i).map(s => s.trim()).filter(Boolean);
  let t = 0, x = W * 0.4;
  const start = x, actions: Action[] = [];
  const cam: CamKey[] = [{ t: 0, x: W / 2, y: H / 2, zoom: 1 }];

  for (const seg of segs) {
    const l = seg.toLowerCase();
    const say = seg.match(/"([^"]+)"/)?.[1] ?? seg.match(/\b(?:say|says|saying)\s+([^,.]+?)(?=\s+(?:while|and)\b|[,.]|$)/i)?.[1]?.trim();
    const explicit = l.match(/(\d+(?:\.\d+)?)\s*(?:s\b|sec)/)?.[1];
    const dur = explicit ? +explicit : say ? Math.max(2.5, say.split(/\s+/).length * 0.45 + 1.5) : 3;
    let clip = CLIP.find(([r]) => r.test(l))?.[1];
    if (!clip && (say || /talk|speak/.test(l))) clip = "talk";
    const expr = EXPR.find(([r]) => r.test(l))?.[1];
    let moveTo: number | undefined;
    if (clip === "walk") { moveTo = x + (/left|back/.test(l) ? -1 : 1) * 320; x = moveTo; }
    actions.push({ t0: t, t1: t + dur, clip, expr, say, moveTo });

    const last = cam[cam.length - 1];
    cam.push({ ...last, t });
    let next = { ...last, t: t + dur };
    if (/zoom in|close.?up/.test(l)) next = { ...next, zoom: 1.8, y: GROUND - 140, follow: true };
    if (/zoom out|wide/.test(l)) next = { ...next, zoom: 1, y: H / 2 };
    if (/pan left/.test(l)) next = { ...next, x: last.x - 350, follow: false };
    if (/pan right/.test(l)) next = { ...next, x: last.x + 350, follow: false };
    if (/follow|track/.test(l)) next = { ...next, follow: true };
    if (next.follow) next.x = x;
    cam.push(next);
    t += dur;
  }
  return { duration: t + 0.5, actors: [{ def, x: start, actions }], cam };
}
