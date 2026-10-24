import { Action, Actor, CamKey, CastMember, ClipId, Expr, Scene, View } from "./types";
import { FOOT, H, W } from "./engine";

const EXPR: [RegExp, Expr][] = [
  [/smil|happy|laugh|cheer|excited|grin/, "happy"],
  [/\bsad|cry|upset|disappoint/, "sad"],
  [/angry|\bmad\b|furious|annoyed/, "angry"],
  [/surpris|shock|gasp|amaz/, "surprised"],
  [/neutral|calm/, "neutral"],
];
const CLIPS: [RegExp, ClipId][] = [
  [/laptop|typing|\btype\b|computer/, "type"],
  [/jump|\bhop|leap/, "jump"],
  [/\bwav(e|es|ing)\b/, "wave"],
  [/point/, "point"],
  [/shrug/, "shrug"],
];
const WALK = /\bwalk|\brun|\bgo(es)?\b|approach|\bmoves?\b|\bsteps?\b|\bcomes? (over|closer|here)|\bheads? (to|over|toward)/;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const findNames = (l: string, actors: Actor[], skip: number) =>
  actors.map((a, i) => ({ i, n: a.def.name.toLowerCase() }))
    .filter(q => q.i !== skip && new RegExp("\\b" + esc(q.n) + "\\b").test(l))
    .map(q => q.i);

export function parseScript(raw: string, cast: CastMember[]): Scene {
  const text = raw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const actors: Actor[] = cast.map(m => ({ def: m.def, x: m.x, depth: m.depth, actions: [] }));
  const px = actors.map(a => a.x);
  const cam: CamKey[] = [{ t: 0, x: W / 2, y: H / 2, zoom: 1 }];
  let beatEnd = 0, prevStart = 0, maxT = 0;

  const actorSeg = (who: number, seg: string, t0: number): number => {
    const me = actors[who];
    const quoted = seg.match(/"([^"]+)"/)?.[1];
    const say = quoted ?? seg.match(/\b(?:says?|saying)\s+(.+?)(?=\s+(?:while|and|as|with)\b|[,.;]|$)/i)?.[1]?.trim();
    const l = seg.replace(/"[^"]*"/g, " ").toLowerCase();
    const explicit = l.match(/(\d+(?:\.\d+)?)\s*(?:s\b|sec)/)?.[1];
    const base = explicit ? +explicit : 0;
    const expr = EXPR.find(([r]) => r.test(l))?.[1];
    const others = findNames(l, actors, who);

    let look: string | undefined;
    const lm = l.match(/\b(?:look|looks|looking|glance|glances|stare|stares|turn|turns|turning|face|faces|facing)\s+(?:at|to|toward|towards)?\s*(?:the\s+)?([a-z]+)/);
    if (lm && !/^(around|away|back|his|her)$/.test(lm[1])) {
      const w = lm[1];
      if (/^(camera|audience|us|viewer|viewers)$/.test(w)) look = "camera";
      else if (/^(left|right|up|down)$/.test(w)) look = w;
      else if (others.length) look = actors[others[0]].def.name;
    }
    if (!look && others.length && (say || /\b(talk|speak|tell|ask|greet|wave|point|smile|laugh)/.test(l))) look = actors[others[0]].def.name;

    let view: View | undefined;
    if (/turn(s|ing)? around|back to (the )?camera|facing away|faces? away/.test(l)) view = "back";
    else if (/(face|faces|facing|turn(s)? to) (the )?camera|front view/.test(l)) view = "front";
    else if (/profile|sideways|side view/.test(l)) view = "side";

    const nod = /\bnod/.test(l), shake = /shake\w* (his |her |their )?head|disagree/.test(l);
    const walk = WALK.test(l);
    const other = CLIPS.find(([r]) => r.test(l))?.[1];
    const parallelWalk = /\bwhile\b|\bas (he|she|they|it)\b|\bwalking\b/.test(l);
    const talkWord = !!say || /talk|speak|chat|explain|tell/.test(l);
    const gesture: ClipId | undefined = other ?? (talkWord ? "talk" : undefined);
    const sayDur = say ? Math.max(2, say.split(/\s+/).length * 0.42 + 1.0) : 0;

    if (walk) {
      const cur = px[who], tgt = others[0];
      let tx: number;
      if (tgt !== undefined && /\b(to|toward|towards|near|beside|next to|approach\w*|over)\b/.test(l)) tx = px[tgt] + (cur < px[tgt] ? -150 : 150);
      else if (/cent(er|re)|middle/.test(l)) tx = W / 2;
      else if (/(left|right) side|far (left|right)/.test(l)) tx = /left/.test(l) ? 260 : 1020;
      else if (/\bleft\b|\bback(ward)?s?\b/.test(l)) tx = cur - 300;
      else if (/\bright\b|forward/.test(l)) tx = cur + 300;
      else tx = tgt !== undefined ? px[tgt] + (cur < px[tgt] ? -150 : 150) : cur + 300;
      tx = cl(tx, 60, W - 60);
      const walkDur = cl(Math.abs(tx - cur) / 130, 0.6, 7);
      px[who] = tx;
      if (gesture && !parallelWalk) {
        me.actions.push({ t0, t1: t0 + walkDur, clip: "walk", moveTo: tx, expr, look, view });
        const gd = base || Math.max(sayDur, gesture === "talk" ? 2.5 : 2.2, nod || shake ? 1.3 : 0);
        me.actions.push({ t0: t0 + walkDur, t1: t0 + walkDur + gd, clip: gesture, say, nod, shake });
        return t0 + walkDur + gd;
      }
      const dur = Math.max(walkDur, base, sayDur);
      me.actions.push({ t0, t1: t0 + dur, clip: parallelWalk && other ? other : "walk", moveTo: tx, say, expr, look, view, nod, shake });
      return t0 + dur;
    }
    const dur = base || Math.max(sayDur, other ? 2.4 : 0, nod || shake ? 1.3 : 0, 1.5);
    me.actions.push({ t0, t1: t0 + dur, clip: gesture, say, expr, look, view, nod, shake });
    return t0 + dur;
  };

  const camSeg = (seg: string, t0: number): number => {
    const l = seg.toLowerCase();
    const explicit = l.match(/(\d+(?:\.\d+)?)\s*(?:s\b|sec)/)?.[1];
    const dur = explicit ? +explicit : 2;
    const last = cam[cam.length - 1];
    cam.push({ ...last, t: t0 });
    const tg = findNames(l, actors, -1)[0];
    let next: CamKey = { ...last, t: t0 + dur };
    const closeUp = /close.?up|tight/.test(l);
    if (/zoom in|push in|close.?up|tight|closer/.test(l)) {
      const idx = tg ?? last.follow;
      const hgt = idx !== undefined ? actors[idx].def.height : 300;
      next = { ...next, zoom: closeUp ? 2.1 : 1.6, y: FOOT - hgt * (closeUp ? 0.8 : 0.55), follow: idx, x: idx !== undefined ? px[idx] : last.x };
    } else if (/zoom out|wide|establish|pull back/.test(l)) {
      next = { ...next, zoom: 1, y: H / 2, x: W / 2, follow: undefined };
    } else if (/pan left/.test(l)) next = { ...next, x: last.x - 350, follow: undefined };
    else if (/pan right/.test(l)) next = { ...next, x: last.x + 350, follow: undefined };
    else if (/stop follow|static|lock/.test(l)) next = { ...next, follow: undefined };
    else if (/follow|track/.test(l) && tg !== undefined) next = { ...next, follow: tg, x: px[tg] };
    cam.push(next);
    return t0 + dur;
  };

  for (const rawLine of text.split(/\n+/)) {
    let line = rawLine.trim();
    if (!line) continue;
    let parallel = false;
    if (/^[&+]/.test(line)) { parallel = true; line = line.replace(/^[&+]\s*/, ""); }
    const m = line.match(/^([^:"]{1,30}):\s*(.*)$/);
    let who = -1, isCam = false, body = line;
    if (m) {
      const nm = m[1].trim().toLowerCase();
      if (nm === "camera" || nm === "cam") { isCam = true; body = m[2]; }
      else {
        const i = actors.findIndex(a => a.def.name.toLowerCase() === nm);
        if (i >= 0) { who = i; body = m[2]; }
      }
    }
    if (!isCam && who < 0) { if (!actors.length) continue; who = 0; }
    if (/\b(meanwhile|at the same time|simultaneously)\b/i.test(body)) parallel = true;

    const start = parallel || isCam ? prevStart : beatEnd;
    if (!parallel && !isCam) prevStart = start;
    let tl = start;
    for (const seg of body.split(/\bthen\b|\bafter that\b|;/i).map(s => s.trim()).filter(Boolean)) {
      tl = isCam ? camSeg(seg, tl) : actorSeg(who, seg, tl);
    }
    maxT = Math.max(maxT, tl);
    if (!isCam) beatEnd = Math.max(beatEnd, tl);
  }

  cam.sort((a, b) => a.t - b.t);
  return { duration: Math.max(maxT, beatEnd) + 0.6, actors, cam };
}
