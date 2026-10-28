import { Action, Actor, ClipId, Pose, PropKind, Scene, SceneProp, ThemeId, View } from "./types";
import { BASE, clips, drawActor } from "./draw";
import { drawProp } from "./props";

export const W = 1280, H = 720, GROUND = 560, FOOT = 600;
const sm = (u: number) => u * u * (3 - 2 * u);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (i: number, k: number) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5; return s - Math.floor(s); };

type Mover = { x: number; depth: number; actions: Action[]; startHidden?: boolean };
export interface PosInfo { x: number; face: number; moving: boolean; depth: number; lift: number }

export function posAt(a: Mover, t: number, props: SceneProp[] = []): PosInfo {
  let x = a.x, d = a.depth, lift = 0, face = 1;
  for (const m of a.actions) {
    if (m.ride !== undefined) {                       // riding inside a prop (a car): follow it
      if (t < m.t0) break;
      const pr = props[m.ride];
      if (!pr) continue;
      const pp = posAt(pr, Math.min(t, m.t1), props);
      x = pp.x; d = pp.depth; face = pp.face;
      if (t < m.t1) return { x, face, moving: pp.moving, depth: d, lift: 0 };
      continue;
    }
    if (m.moveTo === undefined) continue;
    if (t < m.t0) break;
    if (m.fromX !== undefined) x = m.fromX;
    if (m.fromDepth !== undefined) d = m.fromDepth;
    const u = t >= m.t1 ? 1 : (t - m.t0) / Math.max(0.01, m.t1 - m.t0);
    const e = m.lin ? u : sm(u);
    if (m.moveTo !== x) face = m.moveTo > x ? 1 : -1;
    const nd = m.toDepth !== undefined ? lerp(d, m.toDepth, e) : d;
    const nl = m.lift !== undefined ? lerp(lift, m.lift, e) : lift;
    if (u < 1) return { x: lerp(x, m.moveTo, e), face, moving: true, depth: nd, lift: nl };
    x = m.moveTo; d = nd; lift = nl;
  }
  return { x, face, moving: false, depth: d, lift };
}

export function visibleAt(a: Mover, t: number) {
  for (const q of a.actions) if (q.ride !== undefined && t >= q.t0 && t < q.t1) return false;
  let v = !a.startHidden;
  for (const q of a.actions) {
    if (q.enter && t >= q.t0) v = true;
    if (q.exit && t >= q.t1) v = false;
  }
  return v;
}

export function openAt(p: { actions: Action[] }, t: number) {
  let o = 0;
  for (const q of p.actions) {
    if (!q.open) continue;
    o = Math.max(o, sm(cl((t - q.t0) / 0.35, 0, 1)) * (1 - sm(cl((t - (q.t1 - 0.35)) / 0.35, 0, 1))));
  }
  return o;
}

export function sitAt(a: { actions: Action[] }, t: number) {
  let last: Action | undefined, anySit = false;
  for (const q of a.actions) {
    if (q.t0 > t) continue;
    if (q.posture === "sit") anySit = true;
    if (q.posture !== undefined) last = q;
  }
  if (!last || !anySit) return 0;
  const u = sm(cl((t - last.t0) / 0.5, 0, 1));
  return last.posture === "sit" ? u : 1 - u;
}
// props that can be switched on/off or opened/closed by the script; the value is the starting state
export const DEFAULT_POWER: Partial<Record<PropKind, boolean>> = { tv: true, lamp: true, fan: true, curtains: true, phone: true };
export function powerAt(p: { actions: Action[] }, t: number, def: boolean) {
  let cur = def ? 1 : 0;
  for (const q of p.actions) {
    if (q.power === undefined || q.t0 > t) continue;
    cur = lerp(cur, q.power ? 1 : 0, sm(cl((t - q.t0) / 0.5, 0, 1)));
  }
  return cur;
}
export function lieAt(a: { actions: Action[] }, t: number) {
  let last: Action | undefined, any = false;
  for (const q of a.actions) {
    if (q.t0 > t) continue;
    if (q.posture === "lie") any = true;
    if (q.posture !== undefined) last = q;
  }
  if (!last || !any) return 0;
  const u = sm(cl((t - last.t0) / 0.7, 0, 1));
  return last.posture === "lie" ? u : 1 - u;
}

function lookVec(s: Scene, look: string, from: number, t: number) {
  const z = { yaw: 0, pitch: 0, ex: 0, ey: 0 };
  if (look === "camera") return z;
  if (look === "left") return { yaw: -35, pitch: 0, ex: -0.9, ey: 0 };
  if (look === "right") return { yaw: 35, pitch: 0, ex: 0.9, ey: 0 };
  if (look === "up") return { yaw: 0, pitch: -14, ex: 0, ey: -0.8 };
  if (look === "down") return { yaw: 0, pitch: 14, ex: 0, ey: 0.8 };
  const lc = look.toLowerCase();
  const tg: Mover | undefined = s.actors.find(q => q.def.name.toLowerCase() === lc) ?? s.props.find(q => q.name.toLowerCase() === lc);
  if (!tg) return z;
  const dx = posAt(tg, t, s.props).x - from;
  return { yaw: cl(dx / 8, -38, 38), pitch: 0, ex: cl(dx / 120, -1, 1), ey: 0 };
}
// walking toward or away from the camera: feet lift in turn instead of swinging sideways
export function depthWalkPose(p: Pose, t: number, run: boolean, holding: boolean): Pose {
  const w = Math.sin(t * (run ? 11 : 7));
  const lift = (v: number) => Math.max(0, v) * (run ? 40 : 22);
  const q: Pose = { ...p, lLU: 3, lRU: 3, lLB: lift(w), lRB: lift(-w), lean: 0, bob: -Math.abs(w) * (run ? 8 : 4) };
  if (!holding) { q.aLU = 7 + w * 4; q.aRU = 7 - w * 4; q.aLB = 10; q.aRB = 10; }
  return q;
}

export function actorState(s: Scene, a: Actor, t: number) {
  const ai = s.actors.indexOf(a);
  const pos = posAt(a, t, s.props);
  const done = a.actions.filter(q => q.t0 <= t);
  const act = a.actions.filter(q => t >= q.t0 && t < q.t1);
  const lastOf = (f: (q: Action) => boolean) => [...done].reverse().find(f);
  const expr = lastOf(q => !!q.expr)?.expr ?? "neutral";
  const lookA = lastOf(q => !!q.look);
  const viewA = lastOf(q => !!q.view)?.view;
  const say = act.find(q => q.say)?.say;
  const curAct = act.find(q => q.clip);
  const clip: ClipId = curAct?.clip ?? "idle";
    const moving = pos.moving;

  // which way is the character travelling? (X right, Z toward the camera, metres per second)
  const eps = 0.05, ta = Math.max(0, t - eps), tb = t + eps;
  const pa0 = posAt(a, ta, s.props), pb0 = posAt(a, tb, s.props);
  const mx = (pb0.x - pa0.x) / (tb - ta) / 150, mz = (-(pb0.depth - pa0.depth) * 8) / (tb - ta);
  const speed = Math.hypot(mx, mz);
  const heading = speed > 1e-4 ? Math.atan2(mx, mz) : pos.face >= 0 ? Math.PI / 2 : -Math.PI / 2;
  const depthWalk = moving && speed > 1e-4 && Math.abs(mz) > Math.abs(mx) * 1.1;

  const gait: ClipId | null = clip === "run" ? "run" : moving || clip === "walk" ? "walk" : null;
  let pose: Pose = { ...BASE, ...clips.idle(t) };
  if (gait) pose = { ...pose, ...clips[gait](t) };
  if (clip !== "walk" && clip !== "run" && clip !== "idle") pose = { ...pose, ...clips[clip](clip === "kick" ? t - (curAct?.t0 ?? t) : t) };

  // sitting
  const sit = moving ? 0 : sitAt(a, t);
  const lie = moving ? 0 : lieAt(a, t);
  const seatRot = a.actions.filter(q => q.t0 <= t && q.posture === "sit").pop()?.rot ?? 0;
  if (lie > 0) pose.lie = lie;
  if (sit > 0) {
    pose.sit = sit;
    for (const k of ["lLU", "lRU", "lLB", "lRB"] as const) pose[k] = lerp(pose[k], 90, sit);
  }

  // carrying something: both arms hold it in front
  const holding = ai >= 0 && s.props.some(p => p.holds.some(h => h.by === ai && t >= h.t0 && t < h.t1));
  const sideNow = moving || clip === "walk" || clip === "run";
  if (holding) {
    if (sideNow) { pose.aLU = 52; pose.aRU = 52; pose.aLB = 65; pose.aRB = 65; }
    else { pose.aLU = 32; pose.aRU = 32; pose.aLB = -55; pose.aRB = -55; }
  }

  let yaw = pose.yaw, pitch = pose.pitch, ex = 0, ey = 0, face = pos.face;
  if (lookA) {
    const cur = lookVec(s, lookA.look as string, pos.x, t);
    const idx = done.indexOf(lookA);
    const prevA = done.slice(0, idx).reverse().find(q => !!q.look);
    const prev = prevA ? lookVec(s, prevA.look as string, pos.x, lookA.t0) : { yaw: 0, pitch: 0, ex: 0, ey: 0 };
    const w = sm(cl((t - lookA.t0) / 0.4, 0, 1));
    yaw += lerp(prev.yaw, cur.yaw, w); pitch += lerp(prev.pitch, cur.pitch, w);
    ex = lerp(prev.ex, cur.ex, w); ey = lerp(prev.ey, cur.ey, w);
    if (!moving && cur.ex !== 0 && cur.ey === 0) face = cur.ex > 0 ? 1 : -1;
  }
  const lookEx = ex;
  for (const q of act) {
    const u = (t - q.t0) / Math.max(0.01, q.t1 - q.t0), env = Math.sin(Math.PI * cl(u, 0, 1));
    if (q.nod) pitch += Math.sin(t * 8) * 9 * env;
    if (q.shake) yaw += Math.sin(t * 9) * 20 * env;
  }
  const seedN = [...a.def.name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 7;
  if (say) { pitch += Math.sin(t * 4.1) * 2.5; pose.tilt += Math.sin(t * 2.7) * 1.5; yaw += Math.sin(t * 1.7) * 3; }
  ex += Math.sin(t * 0.9 + seedN) * 0.15;

  const ph = (t + seedN * 0.7) % 3.6;
  pose.yaw = yaw; pose.pitch = pitch; pose.eyeX = ex; pose.eyeY = ey;
  pose.blink = ph < 0.16 ? Math.sin((ph / 0.16) * Math.PI) : 0;
  pose.mouth = say ? Math.abs(Math.sin(t * 11)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 3.1))) : 0;

  for (const k of a.keys) {
    const w = sm(cl((t - (k.t0 - 0.25)) / 0.25, 0, 1)) * (1 - sm(cl((t - k.t1) / 0.25, 0, 1)));
    if (w <= 0) continue;
    for (const key of Object.keys(k.pose) as (keyof Pose)[]) {
      const v = k.pose[key];
      if (v !== undefined) pose[key] = lerp(pose[key], v, w);
    }
  }

  const view: View = clip === "type" ? "front" : sideNow ? (depthWalk ? (mz > 0 ? "front" : "back") : "side") : viewA ?? "front";
    // people who come in from, or leave toward, the camera fade in and out
  let alpha = 1;
  for (const q of a.actions) {
    if (q.enter && q.fromDepth !== undefined && q.fromDepth < 0 && t >= q.t0) alpha = Math.min(alpha, sm(cl((t - q.t0) / 0.5, 0, 1)));
    if (q.exit && (q.toDepth ?? 0) < 0 && t >= q.t0 && t < q.t1) alpha = Math.min(alpha, 1 - sm(cl((t - (q.t1 - 0.5)) / 0.5, 0, 1)));
  }
  return { x: pos.x, depth: pos.depth, face, view, clip, expr, say, pose, lookEx, moving, holding, alpha, seatRot, heading, walking: sideNow, depthWalk };
}

// where a prop is right now (it follows whoever is carrying it)
export function propPlace(s: Scene, p: SceneProp, t: number) {
  const h = p.holds.find(q => t >= q.t0 && t < q.t1);
  const a = h ? s.actors[h.by] : undefined;
  if (h && a) {
    const pa = posAt(a, t, s.props);
    const sit = pa.moving ? 0 : sitAt(a, t);
    return {
      x: pa.x + (pa.moving ? pa.face * a.def.height * 0.2 : 0), depth: pa.depth - 0.002,
      lift: a.def.height * (0.4 - sit * 0.23), face: pa.face, moving: false, held: true, by: h.by, open: 0, power: 1,
    };
  }
  const pp = posAt(p, t, s.props);
  const pw = powerAt(p, t, DEFAULT_POWER[p.kind] ?? false);
  const opens = p.kind === "door" || p.kind === "window" || p.kind === "curtains";
  return {
    x: pp.x, depth: pp.depth, lift: p.actions.some(q => q.lift !== undefined && q.t0 <= t) ? pp.lift : (p.y ?? 0) * 150,
    face: pp.face, moving: pp.moving, held: false, by: -1,
    open: Math.max(openAt(p, t), opens ? pw : 0), power: pw,
  };
}

const entity = (s: Scene, i: number | undefined): Mover | undefined =>
  i === undefined ? undefined : i >= 1000 ? s.props[i - 1000] : s.actors[i];

export function camAt(s: Scene, t: number) {
  const k = s.cam; let i = 0;
  while (i < k.length - 1 && k[i + 1].t <= t) i++;
  const a = k[i], b = k[i + 1] ?? a;
  const u = b.t === a.t ? 1 : sm(cl((t - a.t) / (b.t - a.t), 0, 1));
  const fa = entity(s, a.follow), fb = entity(s, b.follow);
  const x = fb && fa === fb ? posAt(fb, t, s.props).x : lerp(a.x, fb ? posAt(fb, t, s.props).x : b.x, u);
  return { x, y: lerp(a.y, b.y, u), zoom: lerp(a.zoom, b.zoom, u) };
}

// ---------------- backgrounds ----------------
type Layer = { speed: number; tile: number; draw: (c: CanvasRenderingContext2D, i: number) => void };

const hillsL = (color: string): Layer => ({ speed: 0.15, tile: 600, draw: (c, i) => {
  c.fillStyle = color; c.beginPath();
  c.ellipse(i * 600 + 300, GROUND, 380, 90 + rnd(i, 1) * 120, 0, Math.PI, 2 * Math.PI); c.fill(); } });

const cityL = (body: string, win: string, lit = false): Layer => ({ speed: 0.45, tile: 220, draw: (c, i) => {
  const w = 140 + rnd(i, 2) * 60, h = 120 + rnd(i, 3) * 200, x = i * 220 + 40;
  c.fillStyle = body; c.fillRect(x, GROUND - h, w, h);
  for (let r = 0; r < h - 30; r += 36) for (let q = 14; q < w - 20; q += 34) {
    c.fillStyle = lit && rnd(i * 13 + r, q) > 0.55 ? "#ffd86b" : win;
    c.fillRect(x + q, GROUND - h + 14 + r, 16, 20);
  } } });

const treesL = (a: string, b: string): Layer => ({ speed: 0.45, tile: 200, draw: (c, i) => {
  const x = i * 200 + 100 + rnd(i, 5) * 60, h = 140 + rnd(i, 6) * 120;
  c.fillStyle = "#6b4a2f"; c.fillRect(x - 8, GROUND - h * 0.45, 16, h * 0.45);
  c.fillStyle = rnd(i, 7) > 0.5 ? a : b;
  c.beginPath(); c.arc(x, GROUND - h * 0.6, h * 0.42, 0, 7); c.fill();
  c.beginPath(); c.arc(x - h * 0.25, GROUND - h * 0.45, h * 0.28, 0, 7); c.fill();
  c.beginPath(); c.arc(x + h * 0.25, GROUND - h * 0.45, h * 0.28, 0, 7); c.fill(); } });

const roomL: Layer = { speed: 0.6, tile: 420, draw: (c, i) => {
  const x = i * 420;
  if (((i % 2) + 2) % 2 === 0) {
    c.fillStyle = "#fff"; c.fillRect(x + 110, GROUND - 330, 200, 230);
    c.fillStyle = "#bfe3ff"; c.fillRect(x + 120, GROUND - 320, 85, 210); c.fillRect(x + 215, GROUND - 320, 85, 210);
  } else {
    c.fillStyle = "#7a5c3e"; c.fillRect(x + 140, GROUND - 300, 140, 110);
    c.fillStyle = "#f3d9a8"; c.fillRect(x + 150, GROUND - 290, 120, 90);
    c.fillStyle = "#c9855a"; c.beginPath(); c.arc(x + 210, GROUND - 245, 26, 0, 7); c.fill();
  }
  c.fillStyle = "#cfc2ae"; c.fillRect(x, GROUND - 14, 421, 14); } };

const crowdCols = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#e9c46a", "#f1faee", "#8338ec", "#ff7aa2"];
const standsL: Layer = { speed: 0.3, tile: 320, draw: (c, i) => {
  const x0 = i * 320;
  c.fillStyle = "#6f7586"; c.fillRect(x0, GROUND - 200, 321, 200);
  c.fillStyle = "#5a6072";
  for (let r = 0; r < 6; r++) c.fillRect(x0, GROUND - 190 + r * 31, 321, 4);
  for (let r = 0; r < 6; r++) for (let k = 0; k < 19; k++) {
    const cx = x0 + 10 + k * 16.5 + (r % 2) * 7, cy = GROUND - 176 + r * 31;
    c.fillStyle = crowdCols[Math.floor(rnd(i * 31 + r, k) * crowdCols.length)];
    c.fillRect(cx - 5, cy + 2, 10, 11);
    c.fillStyle = rnd(i * 17 + r, k + 3) > 0.5 ? "#f2c9a0" : "#8a5a3a";
    c.beginPath(); c.arc(cx, cy - 2, 5, 0, 7); c.fill();
  }
  c.fillStyle = "#4a4f5e"; c.fillRect(x0, GROUND - 206, 321, 8); } };
const boardsL: Layer = { speed: 0.8, tile: 200, draw: (c, i) => {
  const cs = ["#2f6fdc", "#e63946", "#f4a261", "#2a9d8f"];
  c.fillStyle = cs[((i % 4) + 4) % 4]; c.fillRect(i * 200, GROUND - 44, 201, 36);
  c.fillStyle = "rgba(255,255,255,0.85)"; c.fillRect(i * 200 + 20, GROUND - 30, 90, 8); } };
const pitchGround: Layer = { speed: 1, tile: 200, draw: (c, i) => {
  c.fillStyle = ((i % 2) + 2) % 2 === 0 ? "#3f9a4a" : "#47a652"; c.fillRect(i * 200, GROUND, 201, 700);
  c.fillStyle = "rgba(255,255,255,0.85)"; c.fillRect(i * 200, GROUND + 150, 201, 5); } };

const schoolL: Layer = { speed: 0.5, tile: 760, draw: (c, i) => {
  const x = i * 760;
  c.fillStyle = "#d9a15f"; c.fillRect(x + 20, GROUND - 270, 720, 270);
  c.fillStyle = "#9b4d3a"; c.fillRect(x + 4, GROUND - 304, 752, 36);
  c.fillStyle = "#f4f1ea";
  for (let r = 0; r < 2; r++) for (let q = 0; q < 7; q++) { if (q === 3) continue; c.fillRect(x + 50 + q * 98, GROUND - 235 + r * 100, 58, 70); }
  c.fillStyle = "#7a5c3e"; c.fillRect(x + 340, GROUND - 110, 90, 110);
  c.fillStyle = "#2f4f6f"; c.fillRect(x + 300, GROUND - 262, 170, 34);
  c.fillStyle = "#ffffff"; c.font = "700 22px system-ui, sans-serif"; c.textAlign = "center";
  c.fillText("SCHOOL", x + 385, GROUND - 238);
  c.fillStyle = "#6e5238"; c.fillRect(x + 640, GROUND - 400, 6, 130);
  c.fillStyle = "#e63946"; c.fillRect(x + 646, GROUND - 400, 46, 28); } };

const hospitalL: Layer = { speed: 0.5, tile: 820, draw: (c, i) => {
  const x = i * 820;
  c.fillStyle = "#eef3f8"; c.fillRect(x + 30, GROUND - 330, 760, 330);
  c.fillStyle = "#cfd8e3"; c.fillRect(x + 30, GROUND - 342, 760, 14);
  c.fillStyle = "#9ec9e8";
  for (let r = 0; r < 3; r++) for (let q = 0; q < 8; q++) { if (q >= 3 && q <= 4 && r === 2) continue; c.fillRect(x + 60 + q * 90, GROUND - 300 + r * 85, 54, 56); }
  c.fillStyle = "#6c8aa8"; c.fillRect(x + 330, GROUND - 120, 160, 120);
  c.fillStyle = "#cfe7f7"; c.fillRect(x + 340, GROUND - 110, 66, 110); c.fillRect(x + 414, GROUND - 110, 66, 110);
  c.fillStyle = "#ffffff"; c.fillRect(x + 360, GROUND - 450, 100, 108);
  c.fillStyle = "#d62839"; c.fillRect(x + 395, GROUND - 440, 30, 88); c.fillRect(x + 366, GROUND - 411, 88, 30); } };

const groundL = (color: string, stripe: string, planks = false): Layer => ({ speed: 1, tile: 200, draw: (c, i) => {
  c.fillStyle = color; c.fillRect(i * 200, GROUND, 201, 700);
  c.fillStyle = stripe;
  if (planks) { c.fillRect(i * 200, GROUND + 80, 201, 3); c.fillRect(i * 200, GROUND + 160, 201, 3); c.fillRect(i * 200 + rnd(i, 9) * 180, GROUND, 3, 80); }
  else c.fillRect(i * 200 + 20, GROUND + 90, 90, 8); } });

const fgL = (color: string): Layer => ({ speed: 1.6, tile: 500, draw: (c, i) => {
  c.fillStyle = color; c.beginPath();
  c.ellipse(i * 500 + rnd(i, 4) * 300, GROUND + 190, 90, 60, 0, 0, 7); c.fill(); } });

const classL: Layer = { speed: 0.6, tile: 520, draw: (c, i) => {
  const x = i * 520;
  c.fillStyle = "#2f4f45"; c.fillRect(x + 90, GROUND - 330, 340, 190);
  c.fillStyle = "#8a6a4a"; c.fillRect(x + 84, GROUND - 336, 352, 8); c.fillRect(x + 84, GROUND - 142, 352, 8);
  c.fillStyle = "rgba(255,255,255,0.85)"; c.font = "700 26px system-ui, sans-serif"; c.textAlign = "center";
  c.fillText("ABC  123", x + 260, GROUND - 240);
  c.fillStyle = "#cfc2ae"; c.fillRect(x, GROUND - 14, 521, 14); } };
const wardL: Layer = { speed: 0.6, tile: 460, draw: (c, i) => {
  const x = i * 460;
  c.fillStyle = "#ffffff"; c.fillRect(x + 120, GROUND - 330, 210, 230);
  c.fillStyle = "#bfe3ff"; c.fillRect(x + 130, GROUND - 320, 90, 210); c.fillRect(x + 230, GROUND - 320, 90, 210);
  c.fillStyle = "#d62839"; c.fillRect(x + 390, GROUND - 300, 14, 44); c.fillRect(x + 375, GROUND - 285, 44, 14);
  c.fillStyle = "#c9d6df"; c.fillRect(x, GROUND - 14, 461, 14); } };

interface ThemeDef { sky: string[]; far: Layer | null; mid: Layer; ground: Layer; fg: Layer | null; sun?: { x: number; y: number; r: number; c: string }; stars?: boolean }

const THEMES: Record<ThemeId, ThemeDef> = {
  day:      { sky: ["#8fd0ff", "#eef8ff"], far: hillsL("#c9ddd0"), mid: cityL("#b3bfd3", "#e6ecf7"), ground: groundL("#9bc58a", "#86b277"), fg: fgL("#4d8a4f"), sun: { x: 1060, y: 110, r: 46, c: "#fff3b0" } },
  sunset:   { sky: ["#2d1f5e", "#d9577a", "#ffb36b"], far: hillsL("#6b3f7a"), mid: cityL("#4a2f66", "#7a5588"), ground: groundL("#5a6b4a", "#4c5c3e"), fg: fgL("#2f3d2f"), sun: { x: 300, y: 400, r: 70, c: "#ffd29a" } },
  night:    { sky: ["#0b1030", "#1b2a5c"], far: hillsL("#1b2748"), mid: cityL("#202b4d", "#2d3a63", true), ground: groundL("#27413a", "#1f342f"), fg: fgL("#12261f"), sun: { x: 1000, y: 100, r: 38, c: "#f4f1d8" }, stars: true },
  park:     { sky: ["#9fdcff", "#f4fbff"], far: hillsL("#a8d5a2"), mid: treesL("#4f9a52", "#3f8a49"), ground: groundL("#8fd07a", "#7bbd68"), fg: fgL("#3f8a49"), sun: { x: 180, y: 110, r: 44, c: "#fff3b0" } },
  room:     { sky: ["#eadfce", "#d9ccb8"], far: null, mid: roomL, ground: groundL("#b98c5e", "#a67a50", true), fg: null },
  pitch:    { sky: ["#7ec8ff", "#eaf6ff"], far: standsL, mid: boardsL, ground: pitchGround, fg: null, sun: { x: 1100, y: 100, r: 40, c: "#fff3b0" } },
  school:   { sky: ["#8fd0ff", "#eef8ff"], far: hillsL("#c9ddd0"), mid: schoolL, ground: groundL("#8e949c", "#7b818a"), fg: fgL("#4d8a4f"), sun: { x: 1120, y: 100, r: 42, c: "#fff3b0" } },
  hospital: { sky: ["#a9d8ff", "#f4fbff"], far: hillsL("#d3e4d8"), mid: hospitalL, ground: groundL("#c9ced6", "#b4bac4"), fg: fgL("#5aa85d"), sun: { x: 1100, y: 100, r: 40, c: "#fff3b0" } },
  bedroom:   { sky: ["#d9e3f0", "#c7d3e6"], far: null, mid: roomL, ground: groundL("#c9a37a", "#b48f66", true), fg: null },
  house:     { sky: ["#f1e6d3", "#e6d6bd"], far: null, mid: roomL, ground: groundL("#b98c5e", "#a67a50", true), fg: null },
  classroom: { sky: ["#f1ecd9", "#e3dcc2"], far: null, mid: classL, ground: groundL("#c9b99a", "#b8a886", true), fg: null },
  ward:      { sky: ["#eaf3f8", "#d9e8f0"], far: null, mid: wardL, ground: groundL("#d7dde3", "#c4ccd4"), fg: null },
};

export const THEME_LIST: { id: ThemeId; label: string; swatch: string }[] = [
  { id: "day", label: "Sunny", swatch: "linear-gradient(#8fd0ff,#9bc58a)" },
  { id: "sunset", label: "Sunset", swatch: "linear-gradient(#2d1f5e,#d9577a,#ffb36b)" },
  { id: "night", label: "Night", swatch: "linear-gradient(#0b1030,#27413a)" },
  { id: "park", label: "Park", swatch: "linear-gradient(#9fdcff,#8fd07a)" },
  { id: "room", label: "Room", swatch: "linear-gradient(#eadfce,#b98c5e)" },
  { id: "pitch", label: "Pitch", swatch: "linear-gradient(#7ec8ff,#3f9a4a)" },
  { id: "school", label: "School", swatch: "linear-gradient(#8fd0ff,#d9a15f)" },
  { id: "hospital", label: "Hospital", swatch: "linear-gradient(#a9d8ff,#eef3f8)" },
  { id: "bedroom", label: "Bedroom", swatch: "linear-gradient(#d9e3f0,#c9a37a)" },
  { id: "house", label: "Big house", swatch: "linear-gradient(#f1e6d3,#b98c5e)" },
  { id: "classroom", label: "Classroom", swatch: "linear-gradient(#f1ecd9,#2f4f45)" },
  { id: "ward", label: "Ward", swatch: "linear-gradient(#eaf3f8,#d7dde3)" },
];

function layer(c: CanvasRenderingContext2D, L: Layer, cam: { x: number; y: number; zoom: number }, body?: () => void) {
  c.save(); c.translate(W / 2, H / 2); c.scale(cam.zoom, cam.zoom); c.translate(-cam.x * L.speed, -cam.y);
  const half = W / (2 * cam.zoom), cx = cam.x * L.speed;
  for (let i = Math.floor((cx - half) / L.tile) - 1; i <= Math.ceil((cx + half) / L.tile) + 1; i++) L.draw(c, i);
  body?.(); c.restore();
}

export function drawBubble(c: CanvasRenderingContext2D, text: string, x: number, y: number) {
  c.save();
  c.font = "600 24px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
  const maxW = 320, lines: string[] = []; let cur = "";
  for (const w of text.split(/\s+/)) {
    const test = cur ? cur + " " + w : w;
    if (c.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  const lh = 30, bw = Math.max(...lines.map(l => c.measureText(l).width)) + 36, bh = lines.length * lh + 22;
  const bx = x - bw / 2, by = y - 18 - bh, r = 16;
  c.fillStyle = "#fff"; c.strokeStyle = "#1a1a2e"; c.lineWidth = 3; c.lineJoin = "round";
  c.beginPath(); c.moveTo(bx + r, by);
  c.arcTo(bx + bw, by, bx + bw, by + bh, r); c.arcTo(bx + bw, by + bh, bx, by + bh, r);
  c.arcTo(bx, by + bh, bx, by, r); c.arcTo(bx, by, bx + bw, by, r); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(x - 10, by + bh - 1); c.lineTo(x, y); c.lineTo(x + 10, by + bh - 1); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(x - 10, by + bh); c.lineTo(x, y); c.lineTo(x + 10, by + bh); c.stroke();
  c.fillStyle = "#fff"; c.fillRect(x - 9, by + bh - 2, 18, 4);
  c.fillStyle = "#1a1a2e";
  lines.forEach((l, k) => c.fillText(l, x, by + 11 + lh * (k + 0.5)));
  c.restore();
}
const withAlpha = (c: CanvasRenderingContext2D, a: number, f: () => void) => {
  if (a >= 0.999) { f(); return; }
  c.save(); c.globalAlpha = a; f(); c.restore();
};

export function renderFrame(c: CanvasRenderingContext2D, s: Scene, t: number, opts: { bubbles?: boolean; theme?: ThemeId } = {}) {
  const cam = camAt(s, t);
  const th = THEMES[opts.theme ?? "day"];
  const g = c.createLinearGradient(0, 0, 0, H);
  th.sky.forEach((col, i) => g.addColorStop(i / (th.sky.length - 1), col));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (th.stars) {
    c.fillStyle = "#fff";
    for (let k = 0; k < 70; k++) { const r = 1 + rnd(k, 3) * 1.6; c.globalAlpha = 0.5 + rnd(k, 4) * 0.5; c.fillRect(rnd(k, 1) * W, rnd(k, 2) * H * 0.6, r, r); }
    c.globalAlpha = 1;
  }
  if (th.sun) {
    c.fillStyle = th.sun.c; c.globalAlpha = 0.25; c.beginPath(); c.arc(th.sun.x, th.sun.y, th.sun.r * 1.7, 0, 7); c.fill();
    c.globalAlpha = 1; c.beginPath(); c.arc(th.sun.x, th.sun.y, th.sun.r, 0, 7); c.fill();
  }
  if (th.far) layer(c, th.far, cam);
  layer(c, th.mid, cam);
  layer(c, th.ground, cam, () => {
    const items: { depth: number; order: number; draw: () => void }[] = [];
    const talkers: { x: number; y: number; say: string }[] = [];

    s.props.forEach((p, pi) => {
      if (!visibleAt(p, t)) return;
      const pl = propPlace(s, p, t);
      const pers = 1 - pl.depth * 0.22, sc = pers * p.scale;
      const mirror = (p.flip ? -1 : 1) * (p.kind === "car" ? pl.face : 1);
      const riders = s.actors
        .filter(a => a.actions.some(q => q.ride === pi && t >= q.t0 && t < q.t1))
        .map(a => ({ skin: a.def.skin, hair: a.def.hair }));
      items.push({ depth: pl.depth, order: 0, draw: () =>
        drawProp(c, p.kind, p.color, pl.x, FOOT - pl.depth * 70 - pl.lift * pers, sc, mirror, pl.x / 28, { open: pl.open, riders, power: pl.power, t }) });
    });
    for (const a of s.actors) {
        if (!visibleAt(a, t)) {
        // someone talking from inside a car still gets a speech bubble above the car
        const st0 = actorState(s, a, t);
        if (st0.say && a.actions.some(q => q.ride !== undefined && t >= q.t0 && t < q.t1)) talkers.push({ x: st0.x, y: FOOT - st0.depth * 70 - 200, say: st0.say });
        continue;
            }
      const st = actorState(s, a, t);
      const fy = FOOT - st.depth * 70, sc = 1 - st.depth * 0.22;
      items.push({ depth: st.depth, order: 1, draw: () => withAlpha(c, st.alpha, () => drawActor(c, a.def, st.depthWalk ? depthWalkPose(st.pose, t, st.clip === "run", st.holding) : st.pose, st.expr, st.x, fy, sc,                                                                                          
                                                                                                 
        { view: st.view, face: st.face, seed: Math.floor(t * 8), prop: st.clip === "type" ? "laptop" : undefined })) });
      
      if (st.say) talkers.push({ x: st.x, y: fy - a.def.height * sc * 1.02 - 10, say: st.say });
    }
    items.sort((a, b) => b.depth - a.depth || a.order - b.order);
    for (const it of items) it.draw();
    if (opts.bubbles !== false) for (const q of talkers) drawBubble(c, q.say, q.x, q.y);
  });
  if (th.fg) layer(c, th.fg, cam);
}
