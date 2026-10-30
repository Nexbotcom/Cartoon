import { Action, Actor, CamKey, CastMember, ClipId, Expr, Hold, PropKind, PropMember, Scene, SceneProp, Shot3D, View } from "./types";
import { FOOT, H, W } from "./engine";
import { FOOTPRINT, FRONT_KINDS, SEATS, SOLID, SURFACE } from "./props";

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
const WALK = /\bwalk|\brun|\bsprint|\bdash|\bjog|\bgo(es)?\b|approach|\bmoves?\b|\bsteps?\b|\bcomes? (over|closer|here|in)|\bheads? (to|over|toward|out)|\bleave|\bexit/;
const RUN = /\brun|\bsprint|\bdash|\bjog|\bhurr|\brush|\bflee/;
const EXIT = /(walk|run|go|head|step|leave|move|drive|exit|sprint|dash)\w*\s+(out|off|away)\b|\bexits?\b|\bexiting\b|\bleaves?\b|\bleaving\b|out of (the )?(scene|frame|room|shot|stage)|off (the )?(screen|scene|stage|frame)/;
const ENTER = /\benters?\b|\bentering\b|\bcomes? in\b|\b(walks?|runs?|drives?) in\b|\bappears?\b|\barrives?\b|from (the )?(left|right)/;
const ENTER_SIDE = /(?:enter\w*|comes? in|arrives?|appears?|from)\s+(?:the\s+)?(?:from\s+)?(?:the\s+)?(left|right)/;
const EXIT_SIDE = /(?:exit\w*|leave\w*|out|off|away)\b[^,.]*?\b(left|right)/;

const HOLDABLE: string[] = ["box", "cake", "bag", "ball", "phone"];
const KICK = /\b(kick|kicks|kicking|shoot|shoots|shooting|strike|strikes|boot|boots)\b/;
const SIT = /\b(sit|sits|sitting|seated)\b|\btakes? a seat\b/;
const STAND = /\b(stands?|standing|gets? up|rises?)\b/;
const LIE = /\b(lie|lies|lying|lay|lays|sleep|sleeps|sleeping|nap|naps)\b/;
const PICK = /\b(pick|picks|grab|grabs|take|takes|lift|lifts|carry|carries|bring|brings|hold|holds)\b/;
const GIVE = /\b(give|gives|hand|hands|pass|passes|offer|offers|deliver|delivers)\b/;
const PUT = /\b(put|puts|place|places|set|sets|drop|drops|lay|lays)\b/;
const OUT_CAR = /\b(get|gets|getting|step|steps|climb|climbs|come|comes|hop|hops|jump|jumps)\s+out\b|\bout of\b|\bexits?\b|\bleaves?\b|\bdisembark/;
const NEAR_ONLY = /\b(in front|next to|beside|near|behind|toward|towards)\b/;
const EVERY = /^(everyone|everybody|all|the class|class|group)$/;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const edge = (left: boolean) => (left ? -260 : W + 260);
const sayTime = (s?: string) => (s ? Math.max(2, s.split(/\s+/).length * 0.42 + 1.0) : 0);
const boarding = (l: string, carName: string) =>
  /\b(get|gets|getting|climb|climbs|hop|hops|step|steps|jump|jumps|go|goes)\s+(in|into|inside|on|onto|aboard)\b/.test(l) ||
  /\b(board|boards|boarding|drive|drives|driving|ride|rides|riding)\b/.test(l) ||
  new RegExp("\\benters?\\s+(the\\s+|a\\s+|his\\s+|her\\s+)?" + esc(carName.toLowerCase()) + "\\b").test(l);

// split a line into steps on "then" / ";" but never inside quoted dialogue
const splitSegs = (body: string) => {
  const quotes: string[] = [];
  const masked = body.replace(/"[^"]*"/g, q => { quotes.push(q); return `\u0000${quotes.length - 1}\u0000`; });
  return masked
    .split(/\bthen\b|\bafter that\b|;/i)
    .map(s => s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => quotes[+i]).trim())
    .filter(Boolean);
};

// the indexes of the names found in a line, in the order they are mentioned.
// "Sofa 2" wins over "Sofa" when both fit the same words.
const matchIdx = (l: string, names: string[], skip = -1): number[] => {
  const hits: { i: number; s: number; e: number }[] = [];
  names.forEach((n, i) => {
    if (i === skip || !n.trim()) return;
    const re = new RegExp("\\b" + esc(n.trim().toLowerCase()) + "\\b", "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(l)) !== null) hits.push({ i, s: m.index, e: m.index + m[0].length });
  });
  const kept = hits.filter(h => !hits.some(o => o !== h && o.s <= h.s && o.e >= h.e && o.e - o.s > h.e - h.s));
  kept.sort((a, b) => a.s - b.s);
  return Array.from(new Set(kept.map(h => h.i)));
};

interface Rect { minX: number; maxX: number; minZ: number; maxZ: number }
interface P { X: number; Z: number }
interface Leg { x: number; d: number; dur: number }
const RAD = 0.3;
const dist = (a: P, b: P) => Math.hypot(a.X - b.X, a.Z - b.Z);
const inRect = (r: Rect, X: number, Z: number) => X > r.minX && X < r.maxX && Z > r.minZ && Z < r.maxZ;
const segHits = (a: P, b: P, r: Rect) => {
  const L = dist(a, b);
  if (L < 0.7) return false;
  const n = Math.ceil(L / 0.12), skip = 0.3 / L;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    if (u < skip || u > 1 - skip) continue;
    if (inRect(r, a.X + (b.X - a.X) * u, a.Z + (b.Z - a.Z) * u)) return true;
  }
  return false;
};

export function parseScript(
  raw: string, cast: CastMember[], propList: PropMember[] = [],
  durOf?: (who: number, text: string) => number | undefined
): Scene {
  const text = raw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const actors: Actor[] = cast.map(m => ({ def: m.def, x: m.x, depth: m.depth, actions: [], keys: m.keys ?? [] }));
  const props: SceneProp[] = propList.map(p => ({ ...p, actions: [], holds: [] }));
  const px = actors.map(a => a.x), pxp = props.map(p => p.x);
  const pdepth = actors.map(a => a.depth), pdepthP = props.map(p => p.depth);
  const posOf = (i: number) => (i >= 1000 ? pxp[i - 1000] : px[i]);
  const cam: CamKey[] = [{ t: 0, x: W / 2, y: H / 2, zoom: 1 }];
  const shots: Shot3D[] = [];
  const warnings: string[] = [];
  const warn = (m: string) => { if (!warnings.includes(m)) warnings.push(m); };
  const notes: string[] = [];
  
  const seatedOn: (number | undefined)[] = actors.map(() => undefined);
  const seatSlot: number[] = actors.map(() => -1);
  const seatOcc: Record<number, (number | undefined)[]> = {};
  const lyingOn: boolean[] = actors.map(() => false);
  const lyingBed: number[] = actors.map(() => -1);
  const holdingOf: ({ pi: number; hold: Hold } | undefined)[] = actors.map(() => undefined);
  const rideOpen: (Action | undefined)[] = actors.map(() => undefined);
  const rideCar: number[] = actors.map(() => -1);
  let beatEnd = 0, prevStart = 0, maxT = 0;

  const findNames = (l: string, skip: number) => matchIdx(l, actors.map(a => a.def.name), skip);
  const findProps = (l: string) => matchIdx(l, props.map(p => p.name));

  // ---------- floor space: where props are, where people may stand, how to walk around them ----------
  const rot = (pi: number) => ((props[pi].rot ?? 0) * Math.PI) / 180;
  const swapped = (pi: number) => Math.abs(Math.sin(rot(pi))) > 0.7;
  const half = (pi: number): [number, number] | null => {
    const f = FOOTPRINT[props[pi].kind];
    if (!f) return null;
    const s = props[pi].scale;
    return swapped(pi) ? [f[1] * s, f[0] * s] : [f[0] * s, f[1] * s];
  };
  const rectOf = (pi: number): Rect | null => {
    if (!SOLID.has(props[pi].kind)) return null;
    const h = half(pi);
    if (!h) return null;
    const cx = (pxp[pi] - 640) / 150, cz = -pdepthP[pi] * 8;
    return { minX: cx - h[0] - RAD, maxX: cx + h[0] + RAD, minZ: cz - h[1] - RAD, maxZ: cz + h[1] + RAD };
  };










  
const standAt = (pi: number, fromX: number): { x: number; d: number } => {
  const h = half(pi);
  const k = props[pi].kind;
  const dir = fromX < pxp[pi] ? -1 : 1;

  if (FRONT_KINDS.has(k)) {
    const f0: [number, number] = FOOTPRINT[k] ?? [0.5, 0.1];
    const off = f0[1] * props[pi].scale + 0.6;
    const r0 = rot(pi);
    const cxm = (pxp[pi] - 640) / 150;
    const czm = -pdepthP[pi] * 8;

    return {
      x: Math.round(640 + (cxm + Math.sin(r0) * off) * 150),
      d: cl(-(czm + Math.cos(r0) * off) / 8, -0.9, 1.4)
    };
  }

  const halfWidth = h === null ? 0.15 : h[0];

  return {
    x: pxp[pi] + dir * (halfWidth * 150 + 52),
    d: pdepthP[pi]
  };
};












  
  const route = (x0: number, d0: number, x1: number, d1: number, ignore: number[]): { x: number; d: number }[] => {
    const A: P = { X: (x0 - 640) / 150, Z: -d0 * 8 }, B: P = { X: (x1 - 640) / 150, Z: -d1 * 8 };
    const bx0 = Math.min(A.X, B.X) - 3, bx1 = Math.max(A.X, B.X) + 3, bz0 = Math.min(A.Z, B.Z) - 3, bz1 = Math.max(A.Z, B.Z) + 3;
    const rects: Rect[] = [];
    props.forEach((_, i) => {
      if (ignore.includes(i)) return;
      const r = rectOf(i);
      if (r && r.maxX > bx0 && r.minX < bx1 && r.maxZ > bz0 && r.minZ < bz1) rects.push(r);
    });
    const blocked = (p: P, q: P) => rects.some(r => segHits(p, q, r));
    if (!blocked(A, B)) return [];
    const corners: P[] = [];
    for (const r of rects) for (const X of [r.minX - 0.05, r.maxX + 0.05]) for (const Z of [r.minZ - 0.05, r.maxZ + 0.05]) {
      if (!rects.some(o => inRect(o, X, Z))) corners.push({ X, Z });
    }
    corners.sort((p, q) => dist(A, p) + dist(p, B) - dist(A, q) - dist(q, B));
    const near = corners.slice(0, 24);
    const len = (pts: P[]) => pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1], p) : 0), 0);
    let best: P[] | null = null, bl = 1e9;
    for (const c of near) if (!blocked(A, c) && !blocked(c, B)) { const L = len([A, c, B]); if (L < bl) { bl = L; best = [c]; } }
    if (!best) {
      for (const c1 of near) for (const c2 of near) {
        if (c1 === c2 || blocked(A, c1) || blocked(c1, c2) || blocked(c2, B)) continue;
        const L = len([A, c1, c2, B]);
        if (L < bl) { bl = L; best = [c1, c2]; }
      }
    }
    return (best ?? []).map(p => ({ x: Math.round(640 + p.X * 150), d: cl(-p.Z / 8, -0.9, 1.4) }));
  };
  // where a character steps to after getting up from a seat or a bed
  const stepOut = (pi: number): { x: number; d: number } => {
    const h = half(pi) ?? [0.4, 0.4];
    const r = rot(pi);
    const cx = (pxp[pi] - 640) / 150, cz = -pdepthP[pi] * 8;
    const cands: [number, number][] = [[0, h[1] + 0.4], [h[0] + 0.4, 0], [-(h[0] + 0.4), 0], [0, -(h[1] + 0.4)]];
    const rects = props.map((_, j) => (j === pi ? null : rectOf(j)));
    let first: { x: number; d: number } | null = null;
    for (const [lx, lz] of cands) {
      const X = cx + lx * Math.cos(r) + lz * Math.sin(r), Z = cz - lx * Math.sin(r) + lz * Math.cos(r);
      const pt = { x: Math.round(640 + X * 150), d: cl(-Z / 8, -0.9, 1.4) };
      if (!first) first = pt;
      if (!rects.some(q => q && inRect(q, X, Z))) return pt;
    }
    return first as { x: number; d: number };
  };

  // ---------- seats ----------
  const freeSlot = (pi: number) => {
    const slots = SEATS[props[pi].kind] as number[];
    const occ = seatOcc[pi] ?? [];
    for (let s = 0; s < slots.length; s++) if (occ[s] === undefined) return s;
    return -1;
  };
  const seatPoint = (pi: number, slot: number) => {
    const ox = (SEATS[props[pi].kind] as number[])[slot] * props[pi].scale, r = rot(pi);
    return { x: Math.round(pxp[pi] + ox * Math.cos(r)), d: pdepthP[pi] + (ox * Math.sin(r)) / 150 / 8 };
  };

  // ---------- small building blocks ----------
  const leaveSeat = (who: number, t: number): number => {
    const bi = lyingBed[who];
    if (lyingOn[who]) {
      lyingOn[who] = false; lyingBed[who] = -1;
      actors[who].actions.push({ t0: t, t1: t + 0.8, posture: "stand" });
      if (bi >= 0) {
        const o = stepOut(bi);
        actors[who].actions.push({ t0: t + 0.5, t1: t + 1.1, clip: "walk", moveTo: o.x, toDepth: o.d });
        px[who] = o.x; pdepth[who] = o.d;
        return t + 1.1;
      }
      return t + 0.8;
    }
    const pi = seatedOn[who];
    if (pi === undefined) return t;
    actors[who].actions.push({ t0: t, t1: t + 0.7, posture: "stand" });
    const occ = seatOcc[pi];
    if (occ && seatSlot[who] >= 0) occ[seatSlot[who]] = undefined;
    seatedOn[who] = undefined; seatSlot[who] = -1;
    const o = stepOut(pi);
    actors[who].actions.push({ t0: t + 0.35, t1: t + 0.9, clip: "walk", moveTo: o.x, toDepth: o.d });
    px[who] = o.x; pdepth[who] = o.d;
    return t + 0.9;
  };
  const planLegs = (who: number, tx: number, td: number, run: boolean, ignore: number[]): Leg[] => {
    const pts = [...route(px[who], pdepth[who], tx, td, ignore), { x: tx, d: td }];
    const legs: Leg[] = [];
    let cx = px[who], cd = pdepth[who];
    for (const p of pts) {
      const m = Math.hypot((p.x - cx) / 150, (p.d - cd) * 8);
      if (m > 0.05) legs.push({ x: p.x, d: p.d, dur: m });
      cx = p.x; cd = p.d;
    }
    const total = legs.reduce((s, g) => s + g.dur, 0);
    const speed = (run ? 300 : 130) * Math.max(1, Math.sqrt(total / 6));
    legs.forEach(g => { g.dur = cl((g.dur * 150) / speed, 0.4, 600); });
    return legs;
  };
  const pushLegs = (who: number, t0: number, legs: Leg[], run: boolean, stretch = 1): number => {
    let t = t0;
    for (const [gi, g] of legs.entries()) {
      const dur = g.dur * stretch;
      actors[who].actions.push({ t0: t, t1: t + dur, clip: run ? "run" : "walk", moveTo: g.x, toDepth: g.d, ease: [gi === 0 ? Math.min(0.5, Math.max(0.08, 0.5 / Math.max(0.5, dur))) : 0, gi === legs.length - 1 ? Math.min(0.5, Math.max(0.08, 0.5 / Math.max(0.5, dur))) : 0] });
      t += dur;
    }
    return t;
  };
  const walkTo = (who: number, tx: number, td: number, t0: number, run = false, ignore: number[] = []): number => {
    const t = leaveSeat(who, t0);
    const end = pushLegs(who, t, planLegs(who, tx, td, run, ignore), run);
    px[who] = tx; pdepth[who] = td;
    return end;
  };
  const placeProp = (pi: number, x: number, d: number, lift: number, t: number) => {
    props[pi].actions.push({ t0: t, t1: t, moveTo: x, toDepth: d, lift });
    pxp[pi] = x; pdepthP[pi] = d;
  };
  const pickUp = (who: number, pi: number, t0: number): number => {
    const sp = standAt(pi, px[who]);
    const t = walkTo(who, sp.x, sp.d, t0, false, [pi]);
    const hold: Hold = { t0: t + 0.5, t1: 1e9, by: who };
    props[pi].holds.push(hold);
    holdingOf[who] = { pi, hold };
    return t + 0.8;
  };
  const release = (who: number, t: number, x: number, d: number, lift: number) => {
    const h = holdingOf[who];
    if (!h) return;
    h.hold.t1 = t;
    placeProp(h.pi, x, d, lift, t);
    holdingOf[who] = undefined;
  };
  const rideIn = (who: number, ci: number, t0: number): number => {
    const sp = standAt(ci, px[who]);
    const t = walkTo(who, sp.x, sp.d, t0, false, [ci]);
    const ride: Action = { t0: t, t1: 1e9, ride: ci };
    actors[who].actions.push(ride);
    rideOpen[who] = ride; rideCar[who] = ci;
    px[who] = pxp[ci];
    return t + 0.3;
  };
  const rideOut = (who: number, t: number): number => {
    const r = rideOpen[who];
    if (!r) return t;
    r.t1 = t; rideOpen[who] = undefined;
    const ci = rideCar[who], h = half(ci);
    px[who] = pxp[ci] + ((h ? h[0] : 1) * 150 + 52); pdepth[who] = pdepthP[ci];
    return t + 0.2;
  };

  // ---------- one step of an actor's line ----------
  const actorSeg = (who: number, seg: string, t0: number): number => {
    const me = actors[who];
    const quoted = seg.match(/"([^"]+)"/)?.[1];
    let say = quoted ?? seg.match(/\b(?:says?|saying)\s+(.+?)(?=\s+(?:while|and|as|with)\b|[,.;]|$)/i)?.[1]?.trim();
    const l = seg.replace(/"[^"]*"/g, " ").toLowerCase();
    const explicit = l.match(/(\d+(?:\.\d+)?)\s*(?:s\b|sec)/)?.[1];
    const base = explicit ? +explicit : 0;
    const expr = EXPR.find(([r]) => r.test(l))?.[1];
    const others = findNames(l, who);
    const propHits = findProps(l);
    const holdable = propHits.find(i => HOLDABLE.includes(props[i].kind));
    const carHit = propHits.find(i => props[i].kind === "car");
    const doorHit = propHits.find(i => props[i].kind === "door");
    const run = RUN.test(l);
    const sayLen = (s?: string) => {
      if (!s) return 0;
      const d = durOf?.(who, s);
      return d !== undefined ? d + 0.3 : sayTime(s);
    };
    const sayKnown = !!say && durOf?.(who, say) !== undefined;

    let look: string | undefined;
    const lm = l.match(/\b(?:look|looks|looking|glance|glances|stare|stares|turn|turns|turning|face|faces|facing)\s+(?:at|to|toward|towards)?\s*(?:the\s+)?([a-z]+)/);
    if (lm && !/^(around|away|back|his|her)$/.test(lm[1])) {
      const w = lm[1];
      if (/^(camera|audience|us|viewer|viewers)$/.test(w)) look = "camera";
      else if (/^(left|right|up|down)$/.test(w)) look = w;
      else if (others.length) look = actors[others[0]].def.name;
      else if (propHits.length) look = props[propHits[0]].name;
    }
    if (!look && others.length && (say || /\b(talk|speak|tell|ask|greet|wave|point|smile|laugh)/.test(l))) look = actors[others[0]].def.name;

    let view: View | undefined;
    if (/turn(s|ing)? around|back to (the )?camera|facing away|faces? away/.test(l)) view = "back";
    else if (/(face|faces|facing|turn(s)? to) (the )?camera|front view/.test(l)) view = "front";
    else if (/profile|sideways|side view/.test(l)) view = "side";

    const nod = /\bnod/.test(l), shake = /shake\w* (his |her |their )?head|disagree/.test(l);

    let t = t0, moveDone = false;

    // ----- cars: get in, drive off, get out -----
    if (rideOpen[who] && OUT_CAR.test(l)) {
      t = rideOut(who, t);
    } else if (carHit !== undefined && !rideOpen[who] && !NEAR_ONLY.test(l) && !OUT_CAR.test(l) && boarding(l, props[carHit].name)) {
      t = rideIn(who, carHit, t);
      if (/\b(drive|drives|driving|off|away)\b/.test(l)) {
        const xs = l.match(EXIT_SIDE)?.[1];
        const left = xs ? xs === "left" : /\bleft\b/.test(l) ? true : /\bright\b/.test(l) ? false : pxp[carHit] > W / 2;
        const tx = edge(left);
        const dur = Math.max(0.8, Math.abs(tx - pxp[carHit]) / 360);
        props[carHit].actions.push({ t0: t, t1: t + dur, moveTo: tx, exit: true });
        pxp[carHit] = tx; px[who] = tx;
        t += dur;
      }
      moveDone = true;
    }

    // ----- doors: come in through, go out through -----
    if (!moveDone && doorHit !== undefined) {
      const dx = pxp[doorHit], dd = pdepthP[doorHit];
      const leaving = /\b(leave|leaves|leaving|exit|exits|exiting|go out|goes out|walk out|walks out|run out|runs out|step out|steps out|out through|out of)\b/.test(l);
      const entering = !leaving && (ENTER.test(l) || /\b(come|comes|walk|walks|run|runs|step|steps|go|goes)\s+(in|into|through)\b|\bthrough\b/.test(l));
      if (leaving) {
        t = leaveSeat(who, t);
        if (say) {
          const gd = Math.max(sayLen(say), sayKnown ? 0.8 : 2.4);
          me.actions.push({ t0: t, t1: t + gd, clip: "talk", say, expr, look, view });
          t += gd; say = undefined;
        }
        const dur = cl(Math.abs(dx - px[who]) / (run ? 300 : 130), 0.6, 20);
        props[doorHit].actions.push({ t0: t + Math.max(0, dur - 0.5), t1: t + dur + 1.0, open: true });
        me.actions.push({ t0: t, t1: t + dur, clip: run ? "run" : "walk", moveTo: dx, toDepth: dd, exit: true });
        px[who] = dx; pdepth[who] = dd;
        t += dur; moveDone = true;
      } else if (entering) {
        t = leaveSeat(who, t);
        const tgt = others[0];
        let tx: number, td = me.depth;
        if (tgt !== undefined && /\b(to|toward|towards|near|beside|next to|approach\w*|over)\b/.test(l)) { tx = px[tgt] + (dx < px[tgt] ? -150 : 150); td = pdepth[tgt]; }
        else if (/cent(er|re)|middle/.test(l)) tx = W / 2;
        else tx = me.x;
        tx = cl(tx, -6000, W + 6000);
        const dur = cl(Math.abs(tx - dx) / (run ? 300 : 130), 0.8, 20);
        if (me.actions.length === 0) me.startHidden = true;
        props[doorHit].actions.push({ t0: t, t1: t + 0.35 + 1.4, open: true });
        me.actions.push({ t0: t + 0.35, t1: t + 0.35 + dur, clip: run ? "run" : "walk", moveTo: tx, fromX: dx, fromDepth: dd, toDepth: td, enter: true, expr, look, view });
        px[who] = tx; pdepth[who] = td;
        t += 0.35 + dur; moveDone = true;
      }
    }

    // ----- sit, lie down and stand -----
    if (!moveDone && !rideOpen[who]) {
      if (STAND.test(l) && (seatedOn[who] !== undefined || lyingOn[who])) {
        t = leaveSeat(who, t);
      } else if (LIE.test(l) && !lyingOn[who]) {
        let bi: number | undefined = propHits.find(i => props[i].kind === "bed");
        if (bi === undefined) {
          let best = 1e9;
          for (let i = 0; i < props.length; i++) {
            if (props[i].kind !== "bed") continue;
            const dd = Math.abs(pxp[i] - px[who]);
            if (dd < best) { best = dd; bi = i; }
          }
        }
        if (bi !== undefined) {
          t = leaveSeat(who, t);
          t = walkTo(who, pxp[bi], pdepthP[bi] - 0.002, t, false, [bi]);
          me.actions.push({ t0: t, t1: t + 0.9, posture: "lie", rot: props[bi].rot ?? 0 }); notes.push(`${me.def.name} lies on ${props[bi].name} (from ${t.toFixed(1)}s)`);
          lyingOn[who] = true; lyingBed[who] = bi; t += 0.9; moveDone = true;
        } else warn(`${me.def.name} cannot lie down: there is no Bed on stage.`);
      } else if (SIT.test(l)) {
        const seatWord = l.match(/\b(chairs?|sofas?|couch(?:es)?|benche?s?|seats?)\b/)?.[1];
        const kindWanted: PropKind | null = !seatWord ? null : /chair/.test(seatWord) ? "chair" : /sofa|couch/.test(seatWord) ? "sofa" : /bench/.test(seatWord) ? "bench" : null;
        let pi: number | undefined = propHits.find(i => SEATS[props[i].kind] !== undefined);
        const nearest = (kind: PropKind | null): number | undefined => {
          let best: number | undefined, bd = 1e9;
          for (let i = 0; i < props.length; i++) {
            if (!SEATS[props[i].kind] || (kind && props[i].kind !== kind) || freeSlot(i) < 0) continue;
            const dd = Math.abs(pxp[i] - px[who]) + Math.abs(pdepthP[i] - pdepth[who]) * 600;
            if (dd < bd) { bd = dd; best = i; }
          }
          return best;
        };
        if (pi !== undefined && seatedOn[who] === pi) {
          // already sitting there
        } else {
          if (pi !== undefined && freeSlot(pi) < 0) {
            const alt = nearest(props[pi].kind);
            warn(`${me.def.name} cannot sit on ${props[pi].name}: it is already taken.${alt !== undefined ? ` ${props[alt].name} was used instead.` : " There is no free seat of that kind."}`);
            pi = alt;
          } else if (pi === undefined) {
            pi = nearest(kindWanted);
            if (pi === undefined) warn(`${me.def.name} cannot sit: there is no free ${kindWanted ?? "chair, sofa or bench"} on stage.`);
          }
          if (pi !== undefined) {
            t = leaveSeat(who, t);
            const slot = freeSlot(pi);
            const sp = seatPoint(pi, slot);
            t = walkTo(who, sp.x, sp.d, t, run, [pi]);
            me.actions.push({ t0: t, t1: t + 0.6, posture: "sit", rot: props[pi].rot ?? 0 });
            (seatOcc[pi] ??= [])[slot] = who;
            seatedOn[who] = pi; seatSlot[who] = slot;
            t += 0.6; moveDone = true;
          }
        }
      }
    }

    // ----- pick up, carry, put down, give -----
    if (!moveDone) {
      const hn = holdingOf[who];
      if (GIVE.test(l) && others.length && (hn || holdable !== undefined)) {
        let cur = hn;
        if (!cur && holdable !== undefined) { t = pickUp(who, holdable, t); cur = holdingOf[who]; }
        if (cur) {
          const tg = others[0];
          t = walkTo(who, px[tg] + (px[who] < px[tg] ? -90 : 90), pdepth[tg], t);
          cur.hold.t1 = t + 0.4;
          const h2: Hold = { t0: t + 0.4, t1: 1e9, by: tg };
          props[cur.pi].holds.push(h2);
          holdingOf[who] = undefined; holdingOf[tg] = { pi: cur.pi, hold: h2 };
          t += 0.8; moveDone = true;
        }
      } else if (hn && PUT.test(l)) {
        const surf = propHits.find(i => SURFACE[props[i].kind] !== undefined && i !== hn.pi);
        if (surf !== undefined) {
          const sp = standAt(surf, px[who]);
          t = walkTo(who, sp.x, sp.d, t, false, [surf]);
          release(who, t + 0.4, pxp[surf], pdepthP[surf] - 0.002, SURFACE[props[surf].kind] as number);
        } else {
          release(who, t + 0.4, px[who] + 50, pdepth[who] - 0.002, 0);
        }
        t += 0.8; moveDone = true;
      } else if (holdable !== undefined && !hn && PICK.test(l)) {
        t = pickUp(who, holdable, t);
      }
    }

        // ----- kick the ball -----
    if (!moveDone && KICK.test(l)) {
      let bi: number | undefined = propHits.find(i => props[i].kind === "ball");
      if (bi === undefined) {
        let best = 1e9;
        for (let i = 0; i < props.length; i++) {
          if (props[i].kind !== "ball") continue;
          const dd = Math.abs(pxp[i] - px[who]);
          if (dd < best) { best = dd; bi = i; }
        }
      }
      if (bi === undefined) warn(`${me.def.name} cannot kick: there is no Ball on stage.`);
      else if (holdingOf[who]?.pi === bi) warn(`${me.def.name} is holding the Ball. Put it down first.`);
      else {
        const goal = propHits.find(i => props[i].kind === "goal");
        const tgtA = others[0];
        const b0x = pxp[bi], b0d = pdepthP[bi];
        let tX: number, tD: number, endLift = 0;
        if (goal !== undefined) {
          const gr = rot(goal), gXm = (pxp[goal] - 640) / 150, gZm = -pdepthP[goal] * 8;
          tX = Math.round(640 + (gXm - Math.sin(gr) * 0.7) * 150); tD = -(gZm - Math.cos(gr) * 0.7) / 8; endLift = 0.55 * 150;
        } else if (tgtA !== undefined) { tX = px[tgtA] + (b0x < px[tgtA] ? -45 : 45); tD = pdepth[tgtA]; }
        else { tX = b0x + (/\bleft\b/.test(l) ? -1 : 1) * 480; tD = b0d; }
        const dxm = (tX - b0x) / 150, dzm = -(tD - b0d) * 8, len = Math.max(0.3, Math.hypot(dxm, dzm));
        const nx = dxm / len, nz = dzm / len;
        const zb = -b0d * 8;
        const sx = Math.round(b0x - nx * 0.8 * 150), sd = -(zb - nz * 0.8) / 8;
        t = walkTo(who, sx, sd, t, run, goal !== undefined ? [bi, goal] : [bi]);
        const ex = Math.round(sx + nx * 0.35 * 150), ed = -((zb - nz * 0.8) + nz * 0.35) / 8;
        me.actions.push({
          t0: t, t1: t + 0.85, clip: "kick", moveTo: ex, toDepth: ed,
          look: goal !== undefined ? props[goal].name : tgtA !== undefined ? actors[tgtA].def.name : undefined,
        });
        px[who] = ex; pdepth[who] = ed;
        const tk = t + 0.45, flight = cl(len / 10, 0.45, 3.2);
        const apex = goal !== undefined ? Math.min(1.1, len * 0.045) : Math.min(2.2, len * 0.1);
        const N = 7;
        for (let i = 0; i < N; i++) {
          const u1 = (i + 1) / N;
          props[bi].actions.push({
            t0: tk + (flight * i) / N, t1: tk + (flight * (i + 1)) / N, lin: true,
            moveTo: Math.round(b0x + (tX - b0x) * u1), toDepth: b0d + (tD - b0d) * u1,
            lift: 4 * apex * u1 * (1 - u1) * 150 + endLift * u1,
          });
        }
        let fx = tX, fd = tD;
        if (goal !== undefined) {
          fx = tX + Math.round(nx * 12); fd = tD - (nz * 0.1) / 8;
          props[bi].actions.push({ t0: tk + flight, t1: tk + flight + 0.35, lin: true, moveTo: fx, toDepth: fd, lift: 0 });
        }
        pxp[bi] = fx; pdepthP[bi] = fd;
        maxT = Math.max(maxT, tk + flight + 0.4);
        t += 0.85; moveDone = true;
      }
    }

    // ----- ordinary actions -----
    const exit = !moveDone && EXIT.test(l), enter = !moveDone && ENTER.test(l);
    const carryWalk = !moveDone && /\b(carry|carries|bring|brings|take|takes)\b/.test(l) && others.length > 0 && !GIVE.test(l);
    const walk = !moveDone && (WALK.test(l) || exit || enter || carryWalk);
    const other = CLIPS.find(([r]) => r.test(l))?.[1];
    const parallelWalk = /\bwhile\b|\bas (he|she|they|it)\b|\bwalking\b|\brunning\b/.test(l);
    const talkWord = !!say || /talk|speak|chat|explain|tell/.test(l);
    const gesture: ClipId | undefined = other ?? (talkWord ? "talk" : undefined);
    const sayDur = sayLen(say);
    const something = walk || !!say || !!other || nod || shake || !!expr || !!look || !!view;
    if (!something && t !== t0) return t;

    if (walk) {
      t = leaveSeat(who, t);
      const cur = px[who], tgt = others[0];
      const propTgt = propHits.find(i => i !== holdable && i !== holdingOf[who]?.pi);
      const dirLeft = /\bleft\b/.test(l), dirRight = /\bright\b/.test(l);
      const eSide = l.match(ENTER_SIDE)?.[1], xSide = l.match(EXIT_SIDE)?.[1];
      let tx: number, fromX: number | undefined, wd = me.depth, usedProp: number | undefined;
      if (exit) {
        const exitLeft = xSide ? xSide === "left" : enter && eSide ? eSide !== "left" : dirLeft ? true : dirRight ? false : cur < W / 2;
        tx = edge(exitLeft);
        if (enter) fromX = edge(eSide ? eSide === "left" : !exitLeft);
      } else {
        if (tgt !== undefined && /\b(to|toward|towards|near|beside|next to|approach\w*|over)\b/.test(l)) { tx = px[tgt] + (cur < px[tgt] ? -150 : 150); wd = pdepth[tgt]; }
        else if (propTgt !== undefined && /\b(to|toward|towards|near|beside|next to|at|by|over)\b/.test(l)) {
          usedProp = propTgt;
          const sp = standAt(propTgt, cur);
          tx = sp.x; wd = sp.d;
        }
        else if (/cent(er|re)|middle/.test(l)) tx = W / 2;
        else if (/(left|right) side|far (left|right)/.test(l)) tx = /left/.test(l) ? 260 : 1020;
        else if (enter) tx = me.x;
        else if (/\bleft\b|\bback(ward)?s?\b/.test(l)) tx = cur - 300;
        else if (/\bright\b|forward/.test(l)) tx = cur + 300;
        else tx = tgt !== undefined ? px[tgt] + (cur < px[tgt] ? -150 : 150) : cur + 300;
        tx = cl(tx, -6000, W + 6000);
        if (enter) fromX = edge(eSide ? eSide === "left" : dirLeft ? true : dirRight ? false : tx < W / 2);
      }
      const frontIn = enter && /\bfrom (the )?(front|camera|audience|viewer)\b/.test(l);
      const frontOut = exit && /\b(to|toward|towards|through|into|out) (the )?(front|camera|audience|viewer)\b/.test(l);
      let fromD: number | undefined;
      if (frontIn) { fromX = tx; fromD = -1.4; }
      if (frontOut) { tx = cur; wd = -1.4; }
      if (enter && me.actions.length === 0) me.startHidden = true;
      const gait: ClipId = run ? "run" : "walk";

      if (!enter && !exit) {
        // an ordinary walk: routed around furniture
        const legs = planLegs(who, tx, wd, run, usedProp !== undefined ? [usedProp] : []);
        const total = legs.reduce((s, g) => s + g.dur, 0);
        if (gesture && !parallelWalk) {
          if (expr || look || view) me.actions.push({ t0: t, t1: t + Math.max(total, 0.5), expr, look, view });
          t = pushLegs(who, t, legs, run);
          px[who] = tx; pdepth[who] = wd;
          const gd = base || Math.max(sayDur, gesture === "talk" ? (sayKnown ? 0.8 : 2.5) : (sayKnown ? 1.6 : 2.2), nod || shake ? 1.3 : 0);
          me.actions.push({ t0: t, t1: t + gd, clip: gesture, say, nod, shake });
          return t + gd;
        }
        const durAll = Math.max(total, base, sayDur);
        const f = total > 0 && durAll > total ? durAll / total : 1;
        if (say || expr || look || view || nod || shake || (parallelWalk && other)) {
          me.actions.push({ t0: t, t1: t + durAll, clip: parallelWalk && other ? other : undefined, say, expr, look, view, nod, shake });
        }
        const end = pushLegs(who, t, legs, run, f);
        px[who] = tx; pdepth[who] = wd;
        return Math.max(end, t + durAll);
      }

      // coming in from, or going out of, the picture
      const walkDur = frontIn || frontOut ? 2.2 : cl(Math.abs(tx - (fromX ?? cur)) / (run ? 300 : 130), 0.6, 20);
      px[who] = tx; pdepth[who] = wd;
      const mv = { moveTo: tx, fromX, fromDepth: fromD, toDepth: wd, enter: enter || undefined, exit: exit || undefined };
      if (gesture && !parallelWalk) {
        const gd = base || Math.max(sayDur, gesture === "talk" ? (sayKnown ? 0.8 : 2.5) : (sayKnown ? 1.6 : 2.2), nod || shake ? 1.3 : 0);
        if (exit && !enter) {
          me.actions.push({ t0: t, t1: t + gd, clip: gesture, say, expr, look, view, nod, shake });
          me.actions.push({ t0: t + gd, t1: t + gd + walkDur, clip: gait, ...mv });
        } else {
          me.actions.push({ t0: t, t1: t + walkDur, clip: gait, expr, look, view, ...mv });
          me.actions.push({ t0: t + walkDur, t1: t + walkDur + gd, clip: gesture, say, nod, shake });
        }
        return t + walkDur + gd;
      }
      const dur = Math.max(walkDur, base, sayDur);
      me.actions.push({ t0: t, t1: t + dur, clip: parallelWalk && other ? other : gait, say, expr, look, view, nod, shake, ...mv });
      return t + dur;
    }

    const dur = base || Math.max(sayDur, other ? (sayKnown ? 1.6 : 2.4) : 0, nod || shake ? 1.3 : 0, sayKnown ? 0.6 : 1.5);
    me.actions.push({ t0: t, t1: t + dur, clip: gesture, say, expr, look, view, nod, shake });
    return t + dur;
  };

  // ---------- one step of a prop's line ----------
  const propSeg = (pi: number, seg: string, t0: number): number => {
    const pr = props[pi];
    const l = seg.toLowerCase();
    const cur = pxp[pi];
    const pOn = /\b(turn|switch)\w*\s+on\b|\bturns?\s+on\b|\b(open|opens|opening)\b/.test(l);
    const pOff = /\b(turn|switch)\w*\s+off\b|\bturns?\s+off\b|\b(close|closes|closing|shut|shuts)\b/.test(l);
    if ((pOn || pOff) && !ENTER.test(l) && !EXIT.test(l)) {
      pr.actions.push({ t0, t1: t0 + 0.6, power: pOn && !pOff });
      return t0 + 0.6;
    }
    const exit = EXIT.test(l), enter = ENTER.test(l);
    const dirLeft = /\bleft\b/.test(l), dirRight = /\bright\b/.test(l);
    const eSide = l.match(ENTER_SIDE)?.[1], xSide = l.match(EXIT_SIDE)?.[1];
    const others = findNames(l, -1);
    const speed = pr.kind === "car" ? 360 : 130;
    let tx: number, fromX: number | undefined;
    if (exit) {
      const exitLeft = xSide ? xSide === "left" : enter && eSide ? eSide !== "left" : dirLeft ? true : dirRight ? false : cur < W / 2;
      tx = edge(exitLeft);
      if (enter) fromX = edge(eSide ? eSide === "left" : !exitLeft);
    } else {
      if (others.length && /\b(to|toward|towards|near|beside|next to|stop\w*|over)\b/.test(l)) tx = px[others[0]] + (cur < px[others[0]] ? -280 : 280);
      else if (/cent(er|re)|middle/.test(l)) tx = W / 2;
      else if (enter) tx = pr.x;
      else if (dirLeft) tx = cur - 500;
      else if (dirRight) tx = cur + 500;
      else return t0;
      if (enter) fromX = edge(eSide ? eSide === "left" : dirLeft ? true : dirRight ? false : tx < W / 2);
    }
    if (enter && pr.actions.length === 0) pr.startHidden = true;
    const dur = Math.max(0.8, Math.abs(tx - (fromX ?? cur)) / speed);
    pr.actions.push({ t0, t1: t0 + dur, moveTo: tx, fromX, enter: enter || undefined, exit: exit || undefined });
    pxp[pi] = tx;
    return t0 + dur;
  };

  // ---------- one step of a camera line ----------
    const camSeg = (seg: string, t0: number): number => {
    const l = seg.toLowerCase();
    const explicit = l.match(/(\d+(?:\.\d+)?)\s*(?:s\b|sec)/)?.[1];
    const slow = /\b(slow|slowly|gentle|gently)\b/.test(l);
    const fast = /\b(fast|quick|quickly|rapid)\b/.test(l);
    const snap = /\b(instant|instantly|cut|snap)\b/.test(l);
    const tg = findNames(l, -1)[0], tp = findProps(l)[0];
    const named = tg ?? (tp !== undefined ? 1000 + tp : undefined);
    const last = cam[cam.length - 1];

    // steady orbit: 15 degrees per second unless you say otherwise
    if (/\b(360|orbit\w*|spin\w*|revolv\w*|rotate\w* around|circl\w* around)\b/.test(l)) {
      const dps = l.match(/(\d+(?:\.\d+)?)\s*(?:°|degrees?|deg)\s*(?:per|a|\/)\s*(?:s\b|sec)/)?.[1];
      const dm = l.match(/(\d+(?:\.\d+)?)\s*(?:°|degrees?|deg)\b/)?.[1];
      const sp = l.match(/\bspeed\s*(?:of\s*)?(\d+(?:\.\d+)?)/)?.[1];
      const rate = dps ? +dps : 15 * (sp ? +sp : 1) * (slow ? 0.5 : fast ? 2.5 : 1);
      let deg = dm && !dps ? +dm : /half/.test(l) ? 180 : 360;
      let dur: number;
      if (explicit) { dur = +explicit; if (dps) deg = rate * dur; } else dur = Math.max(1, deg / rate);
      cam.push({ ...last, t: t0 });
      shots.push({ t0, t1: t0 + dur, deg: /counter|anti|\bleft\b/.test(l) ? -deg : deg, target: named });
      cam.push({ ...last, t: t0 + dur });
      return t0 + dur;
    }

    // camera angle
    const reset = /\b(back to normal|reset|normal view|default view)\b/.test(l);
    let ang: { az: number; el: number } | null = null;
    if (reset) ang = { az: 0, el: 3 };
    else if (/front.?right|right.?front/.test(l)) ang = { az: 45, el: 8 };
    else if (/front.?left|left.?front/.test(l)) ang = { az: -45, el: 8 };
    else if (/back.?right|right.?back|behind.?right/.test(l)) ang = { az: 135, el: 8 };
    else if (/back.?left|left.?back|behind.?left/.test(l)) ang = { az: -135, el: 8 };
    else if (/\b(top|above|overhead|bird\w*|aerial|top.?down)\b/.test(l)) ang = { az: 0, el: 82 };
    else if (/\bhigh angle\b/.test(l)) ang = { az: last.az ?? 0, el: 35 };
    else if (/\blow angle\b/.test(l)) ang = { az: last.az ?? 0, el: -8 };
    else if (/\bfrom (the )?right\b|\bright side\b/.test(l)) ang = { az: 90, el: 6 };
    else if (/\bfrom (the )?left\b|\bleft side\b/.test(l)) ang = { az: -90, el: 6 };
    else if (/\bfrom (the )?(behind|back|rear)\b|\bbehind\b/.test(l)) ang = { az: 180, el: 6 };
    else if (/\bfrom (the )?front\b|\bfront view\b/.test(l)) ang = { az: 0, el: 3 };

    // zoom by a factor, up to 10x: "zoom on Sam 5x"
    const zx = l.match(/(\d+(?:\.\d+)?)\s*(?:x\b|×|times)/)?.[1];
    const zoomWord = /\b(zoom|close.?up|push in|closer)\b/.test(l);
    if (!ang && !(zx && zoomWord)) return camSegOld(seg, t0);

    const ramp = snap ? 0.1 : slow ? 4 : fast ? 0.8 : 1.6;
    let over: Partial<CamKey> = {};
    if (reset || (/\b(zoom out|pull back|wide)\b/.test(l) && !zx)) over = { zoom: 1, y: H / 2, x: W / 2, follow: undefined };
    if (zx && zoomWord) {
      const z = cl(+zx, 1.05, 10);
      const idx = named ?? last.follow ?? (actors.length ? 0 : undefined);
      const hgt = idx === undefined ? 300 : idx >= 1000 ? 170 : actors[idx].def.height;
      const k = 0.55 + 0.38 * cl((z - 2) / 4, 0, 1);   // aim higher (at the face) the closer we get
      over = { zoom: z, y: FOOT - hgt * k, follow: idx, x: idx !== undefined ? posOf(idx) : last.x };
    }
    const goal: CamKey = { ...last, ...over, ...(ang ? { az: ang.az, el: ang.el } : {}) };
    cam.push({ ...last, t: t0 });
    cam.push({ ...goal, t: t0 + ramp });
    if (explicit) {                                     // "for 3 seconds": hold, then go back
      const hold = +explicit;
      cam.push({ ...goal, t: t0 + ramp + hold });
      cam.push({ ...last, t: t0 + 2 * ramp + hold });
      return t0 + 2 * ramp + hold;
    }
    return t0 + ramp;                                   // otherwise it stays until the next camera line
  };
  const camSegOld = (seg: string, t0: number): number => {
    


    
    const l = seg.toLowerCase();
    const explicit = l.match(/(\d+(?:\.\d+)?)\s*(?:s\b|sec)/)?.[1];
    const orbit = /\b(360|orbit\w*|spin\w*|revolv\w*|rotate\w* around|circl\w* around)\b/.test(l);
    const dur = explicit ? +explicit : orbit ? 5 : 2;
    const last = cam[cam.length - 1];
    cam.push({ ...last, t: t0 });
    const tg = findNames(l, -1)[0], tp = findProps(l)[0];
    const named = tg ?? (tp !== undefined ? 1000 + tp : undefined);
    const pm = l.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/);
    if (pm && /zoom|close/.test(l) && named !== undefined) {
      const pct = cl(+pm[1], 5, 100) / 100;
      const hgt = named >= 1000 ? 170 : actors[named].def.height;
      const zoomed: CamKey = { ...last, zoom: 1 + pct * 1.1, y: FOOT - hgt * (0.55 + 0.25 * pct), follow: named, x: posOf(named) };
      const total = explicit ? +explicit : 3, ramp = Math.min(0.6, total / 3);
      cam.push({ ...zoomed, t: t0 + ramp });
      if (/\b(stay|hold|keep)\b/.test(l)) return t0 + ramp;
      cam.push({ ...zoomed, t: t0 + total - ramp });
      cam.push({ ...last, t: t0 + total });
      return t0 + total;
    }
    if (orbit) {
      const dm = l.match(/(\d+)\s*(?:°|deg)/);
      const deg = dm ? +dm[1] : /half/.test(l) ? 180 : 360;
      shots.push({ t0, t1: t0 + dur, deg: /counter|anti|\bleft\b/.test(l) ? -deg : deg, target: named });
      cam.push({ ...last, t: t0 + dur });
      return t0 + dur;
    }
    let next: CamKey = { ...last, t: t0 + dur };
    const closeUp = /close.?up|tight/.test(l);
    if (/zoom in|push in|close.?up|tight|closer/.test(l)) {
      const idx = named ?? last.follow;
      const hgt = idx === undefined ? 300 : idx >= 1000 ? 170 : actors[idx].def.height;
      next = { ...next, zoom: closeUp ? 2.1 : 1.6, y: FOOT - hgt * (closeUp ? 0.8 : 0.55), follow: idx, x: idx !== undefined ? posOf(idx) : last.x };
    } else if (/zoom out|wide|establish|pull back/.test(l)) {
      next = { ...next, zoom: 1, y: H / 2, x: W / 2, follow: undefined };
    } else if (/pan left/.test(l)) next = { ...next, x: last.x - 350, follow: undefined };
    else if (/pan right/.test(l)) next = { ...next, x: last.x + 350, follow: undefined };
    else if (/stop follow|static|lock/.test(l)) next = { ...next, follow: undefined };
    else if (/follow|track/.test(l) && named !== undefined) next = { ...next, follow: named, x: posOf(named) };
    cam.push(next);
    return t0 + dur;
  };

  for (const rawLine of text.split(/\n+/)) {
    let line = rawLine.trim();
    if (!line) continue;
    let parallel = false;
    if (/^[&+]/.test(line)) { parallel = true; line = line.replace(/^[&+]\s*/, ""); }
    const m = line.match(/^([^:"]{1,30}):\s*(.*)$/);
    let who = -1, pwho = -1, isCam = false, everyone = false, body = line;
    if (m) {
      const nm = m[1].trim().toLowerCase();
      if (nm === "camera" || nm === "cam") { isCam = true; body = m[2]; }
      else if (EVERY.test(nm) && !actors.some(a => a.def.name.toLowerCase() === nm)) { everyone = true; body = m[2]; }
      else {
        const i = actors.findIndex(a => a.def.name.toLowerCase() === nm);
        if (i >= 0) { who = i; body = m[2]; }
        else {
          const pi = props.findIndex(p => p.name.toLowerCase() === nm);
          if (pi >= 0) { pwho = pi; body = m[2]; }
        }
      }
    }
    if (!isCam && !everyone && who < 0 && pwho < 0) { if (!actors.length) continue; who = 0; }
    if (/\b(meanwhile|at the same time|simultaneously)\b/i.test(body.replace(/"[^"]*"/g, " "))) parallel = true;

    const free = isCam || pwho >= 0;   // camera and prop lines run alongside the previous line
    const start = parallel || free ? prevStart : beatEnd;
    if (!parallel && !free) prevStart = start;
    const segs = splitSegs(body);
    const run = (idx: number) => {
      let tl = start;
      for (const seg of segs) {
        const wm = seg.match(/^(?:wait|pause|hold)\D*(\d+(?:\.\d+)?)/i);
        if (wm) { tl += +wm[1]; continue; }
        tl = isCam ? camSeg(seg, tl) : pwho >= 0 ? propSeg(pwho, seg, tl) : actorSeg(idx, seg, tl);
      }
      return tl;
    };
    let tl = start;
    if (everyone) { for (let i = 0; i < actors.length; i++) tl = Math.max(tl, run(i)); }
    else tl = run(who);
    maxT = Math.max(maxT, tl);
    if (!free) beatEnd = Math.max(beatEnd, tl);
  }

  for (const a of actors) for (const k of a.keys) maxT = Math.max(maxT, k.t1);
  const total = Math.max(maxT, beatEnd) + 0.6;
  rideOpen.forEach(r => { if (r) r.t1 = total; });   // anyone still in a car stays there to the end
  cam.sort((a, b) => a.t - b.t);
  return { duration: total, actors, props, cam, shots, warnings, notes };
}
