import { Action, Actor, ClipId, Pose, PropKind, Scene, SceneProp, ThemeId, View } from "./types";
import { BASE, clips, drawActor } from "./draw";
import { FOOTPRINT, SOLID, drawProp } from "./props";
export const W = 1280, H = 720, GROUND = 560, FOOT = 600;
const sm = (u: number) => u * u * (3 - 2 * u);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (i: number, k: number) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5; return s - Math.floor(s); };

// speed profile of one move: eases in over fraction a, runs steadily, eases out over fraction b
export const shape = (u: number, a: number, b: number) => {
  if (a <= 0 && b <= 0) return u;
  const v = 1 / (1 - (a + b) / 2);
  if (a > 0 && u < a) return (v * u * u) / (2 * a);
  if (b > 0 && u > 1 - b) return 1 - (v * (1 - u) * (1 - u)) / (2 * b);
  return v * (u - a / 2);
};

type Mover = { x: number; depth: number; actions: Action[]; startHidden?: boolean };
export interface PosInfo { x: number; face: number; moving: boolean; depth: number; lift: number; trav: number }

export function posAt(a: Mover, t: number, props: SceneProp[] = []): PosInfo {
  let x = a.x, d = a.depth, lift = 0, face = 1, trav = 0;
  for (const m of a.actions) {
    if (m.ride !== undefined) {                       // riding inside a prop (a car): follow it
      if (t < m.t0) break;
      const pr = props[m.ride];
      if (!pr) continue;
      const pp = posAt(pr, Math.min(t, m.t1), props);
      x = pp.x; d = pp.depth; face = pp.face;
      if (t < m.t1) return { x, face, moving: pp.moving, depth: d, lift: 0, trav };
      continue;
    }
    if (m.moveTo === undefined) continue;
    if (t < m.t0) break;
    if (m.fromX !== undefined) x = m.fromX;
    if (m.fromDepth !== undefined) d = m.fromDepth;
    const u = t >= m.t1 ? 1 : (t - m.t0) / Math.max(0.01, m.t1 - m.t0);
    const e = m.lin ? u : m.ease ? shape(u, m.ease[0], m.ease[1]) : sm(u);
    if (m.moveTo !== x) face = m.moveTo > x ? 1 : -1;
    const nd = m.toDepth !== undefined ? lerp(d, m.toDepth, e) : d;
    const nl = m.lift !== undefined ? lerp(lift, m.lift, e) : lift;
    const len = Math.hypot((m.moveTo - x) / 150, ((m.toDepth ?? d) - d) * 8);
    if (u < 1) return { x: lerp(x, m.moveTo, e), face, moving: true, depth: nd, lift: nl, trav: trav + len * e };
    x = m.moveTo; d = nd; lift = nl; trav += len;
  }
  return { x, face, moving: false, depth: d, lift, trav };
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

// ---------- sitting, lying and getting up (same pacing as the reference: sit, then the chair slides in) ----------
const SEAT_T = 1.6, SLIDE_T = 1.1, LAY_T = 3.0, LAYUP_T = 2.4;
export const SLIDE_M = 0.45;
export interface Rest { act: Action; sw: number; slide: number; tw: number; pw: number; yw: number; lgw: number }
export function restAt(a: { actions: Action[] }, t: number, isChair: (seat?: number) => boolean = () => false): Rest | null {
  let last: Action | undefined, prev: Action | undefined;
  for (const q of a.actions) {
    if (q.t0 > t || q.posture === undefined) continue;
    prev = last; last = q;
  }
  if (!last) return null;
  const u = t - last.t0;
  let act: Action | undefined, seatW = 0, slideW = 0, layW = 0;
  if (last.posture === "sit") {
    act = last; seatW = cl(u / SEAT_T, 0, 1);
    if (isChair(last.seat)) slideW = cl((u - SEAT_T) / SLIDE_T, 0, 1);
  } else if (last.posture === "lie") {
    act = last; seatW = cl(u / SEAT_T, 0, 1); layW = cl((u - SEAT_T) / LAY_T, 0, 1);
  } else if (last.posture === "stand" && prev && prev.posture === "sit") {
    act = prev;
    const chair = isChair(prev.seat);
    slideW = chair ? 1 - cl(u / SLIDE_T, 0, 1) : 0;
    seatW = 1 - cl((u - (chair ? SLIDE_T : 0)) / SEAT_T, 0, 1);
  } else if (last.posture === "stand" && prev && prev.posture === "lie") {
    act = prev; layW = 1 - cl(u / LAYUP_T, 0, 1); seatW = 1 - cl((u - LAYUP_T) / SEAT_T, 0, 1);
  }
  if (!act) return null;
  if (last.posture === "stand" && seatW <= 0 && layW <= 0 && slideW <= 0) return null;
  const ez = (x: number) => sm(cl(x, 0, 1));
  return { act, sw: ez(seatW), slide: ez(slideW), tw: ez((layW - 0.1) / 0.9), pw: ez((layW - 0.15) / 0.8), yw: ez((layW - 0.25) / 0.6), lgw: ez(layW / 0.45) };
}
// how far down into a seat the body is (0 standing, 1 sitting); used by the 2D art and by held things
export function sitAt(a: { actions: Action[] }, t: number) {
  const r = restAt(a, t);
  return r ? r.sw * (1 - r.tw) : 0;
}

// props that can be switched on/off or opened/closed by the script; the value is the starting state
export const DEFAULT_POWER: Partial<Record<PropKind, boolean>> = { tv: true, lamp: true, fan: true, curtains: true, phone: true, candle: true };
export function powerAt(p: { actions: Action[] }, t: number, def: boolean) {
  let cur = def ? 1 : 0;
  for (const q of p.actions) {
    if (q.power === undefined || q.t0 > t) continue;
    cur = lerp(cur, q.power ? 1 : 0, sm(cl((t - q.t0) / 0.5, 0, 1)));
  }
  return cur;
}
// light low-pass on the pose so clips blend into each other instead of snapping
const smoothMem = new Map<string, { p: Pose; t: number; at: number }>();
const SMOOTH: (keyof Pose)[] = ["aLU", "aLB", "aRU", "aRB", "lLU", "lLB", "lRU", "lRB", "yaw", "pitch", "tilt", "lean", "bob", "sit", "lie"];
export function smoothPose(key: string, p: Pose, t: number): Pose {
  const now = performance.now(), prev = smoothMem.get(key);
  if (!prev || Math.abs(t - prev.t) > 0.3 || now - prev.at > 400) { smoothMem.set(key, { p: { ...p }, t, at: now }); return p; }
  const dt = Math.min(0.1, Math.max(0, (now - prev.at) / 1000));
  const k = 1 - Math.exp(-dt / 0.055);
  const q: Pose = { ...p };
  for (const f of SMOOTH) q[f] = prev.p[f] + (p[f] - prev.p[f]) * k;
  smoothMem.set(key, { p: q, t, at: now });
  return q;
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


// solid furniture cannot be walked through: anyone who ends up inside it is moved to the nearest edge
const BODY = 0.15;                                    // how close to a piece of furniture a character may stand (metres)
function pushOut(s: Scene, t: number, X0: number, Z0: number): [number, number] {
  let X = X0, Z = Z0;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const p of s.props) {
      const f = FOOTPRINT[p.kind] as [number, number] | undefined;
      if (!f || !SOLID.has(p.kind)) continue;
      if (p.holds.some(h => t >= h.t0 && t < h.t1) || !visibleAt(p, t)) continue;
      const r = ((p.rot ?? 0) * Math.PI) / 180, sw = Math.abs(Math.sin(r)) > 0.7;
      const hx = (sw ? f[1] : f[0]) * p.scale + BODY, hz = (sw ? f[0] : f[1]) * p.scale + BODY;
      const pp = posAt(p, t, s.props);
      const cx = (pp.x - 640) / 150, cz = -pp.depth * 8;
      const dx = X - cx, dz = Z - cz;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        if (hx - Math.abs(dx) < hz - Math.abs(dz)) X = cx + (dx < 0 ? -hx : hx);
        else Z = cz + (dz < 0 ? -hz : hz);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return [X, Z];
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
  const idleP: Pose = { ...BASE, ...clips.idle(t) };
  let pose: Pose = { ...idleP };
  // the walk cycle follows the distance covered, so feet do not slide; legs settle as the character slows
  const nominal = clip === "run" ? 2.0 : 0.87;
  const gaitT = moving ? pos.trav / nominal : t;
  if (gait) {
    const g = clips[gait](gaitT);
    const amp = moving ? cl(speed / (nominal * 0.7), 0, 1) : 1;
    for (const k of Object.keys(g) as (keyof Pose)[]) pose[k] = lerp(idleP[k], g[k] as number, amp);
  }
  if (clip !== "walk" && clip !== "run" && clip !== "idle") pose = { ...pose, ...clips[clip](clip === "kick" ? t - (curAct?.t0 ?? t) : t) };

  // sitting / lying: where the hips go, how high they are, how the legs bend (the 3D drawing uses these exact numbers)
  const R = moving ? null : restAt(a, t, i => i !== undefined && s.props[i]?.kind === "chair");
  const sit = R ? R.sw * (1 - R.tw) : 0;
  const lie = R ? R.tw : 0;
  const sc = a.def.height / 300;
  const hs = sc * 0.88;                               // hip height when standing, in metres
  let restX = pos.x, restD = pos.depth;
  let rest: { hipY: number; thigh: number; tw: number; yaw: number; sw: number; slideM: number; seatIdx?: number } | undefined;
  const seatRot = R?.act.rot ?? 0;
  if (R) {
    const A = R.act, lying = A.posture === "lie";
    restX = lerp(pos.x, A.sx ?? pos.x, R.sw); restD = lerp(pos.depth, A.sd ?? pos.depth, R.sw);
    let hy = lerp(hs, A.sh ?? hs, R.sw);
    if (lying && A.lx !== undefined) {
      restX = lerp(restX, A.lx, R.pw); restD = lerp(restD, A.ld ?? restD, R.pw);
      hy = lerp(hy, A.lh ?? hy, R.tw);
    }
    const sa = ((A.rot ?? 0) * Math.PI) / 180;
    const prop = A.seat !== undefined ? s.props[A.seat] : undefined;
    const slideM = R.slide * SLIDE_M * (prop?.scale ?? 1);
    if (slideM > 0) { restX += Math.sin(sa) * slideM * 150; restD -= (Math.cos(sa) * slideM) / 8; }
    const hl = hy / sc;                                // hip height in the character's own units
    const thigh = (hl < 0.88 ? Math.acos(cl((hl - 0.45) / 0.43, -1, 1)) : 0) * (1 - R.lgw);
    rest = { hipY: hy, thigh, tw: R.tw, yaw: sa + (Math.PI / 2) * R.yw, sw: R.sw, slideM, seatIdx: A.seat };
  }
  
    // falling down (forward or backward) and getting up again
  let fallLast: Action | undefined;
  for (const q of a.actions) if (q.t0 <= t && q.fall) fallLast = q;
  let fallW = 0;
  if (fallLast && !R && !moving) {
    const ezf = (x: number) => sm(cl(x, 0, 1));
    const u = t - fallLast.t0, dir = fallLast.fallDir ?? -1;
    fallW = fallLast.fall === "down" ? ezf(u / 0.6 - 0.35) : 1 - ezf(u / 1.3);
    if (fallW > 0.001) {
      const bounce = fallLast.fall === "down" ? 0.04 * sc * Math.exp(-Math.pow((u - 0.85) * 9, 2)) : 0;
      rest = { hipY: lerp(hs, 0.13 * sc, fallW) + bounce, thigh: 0, tw: -dir * fallW, yaw: 0, sw: 0, slideM: 0 };
      const fl = Math.sin(Math.PI * fallW);                  // arms flail while going over, then lie out to the sides
      pose.aLU = lerp(pose.aLU, 130 + 35 * Math.sin(t * 16), fl); pose.aRU = lerp(pose.aRU, 130 + 35 * Math.sin(t * 16 + 2), fl);
      pose.aLB = lerp(pose.aLB, 30, fl); pose.aRB = lerp(pose.aRB, 30, fl);
      pose.aLU = lerp(pose.aLU, 35, fallW * fallW); pose.aRU = lerp(pose.aRU, 35, fallW * fallW);
    }
  }
  if (lie > 0) pose.lie = lie;
  if (fallW > 0.001) pose.lie = Math.max(pose.lie, fallW);
  if (sit > 0) {
    pose.sit = sit;
    for (const k of ["lLU", "lRU", "lLB", "lRB"] as const) pose[k] = lerp(pose[k], 90, sit);
  }

  // carrying something: both arms hold it in front
  const holdP = ai >= 0 ? s.props.find(p => p.holds.some(h => h.by === ai && t >= h.t0 && t < h.t1)) : undefined;
  const holding = !!holdP;
  const oneHand = !!holdP && ["phone", "cup", "apple", "pizza", "flower", "candle", "umbrella", "suitcase", "key", "letter"].includes(holdP.kind);
  const sideNow = moving || clip === "walk" || clip === "run";
  if (holding && oneHand) {
    if (sideNow) { pose.aRU = 34; pose.aRB = 70; } else { pose.aRU = 30; pose.aRB = -70; }
  } else if (holding) {
    if (sideNow) { pose.aLU = 52; pose.aRU = 52; pose.aLB = 65; pose.aRB = 65; }
    else { pose.aLU = 32; pose.aRU = 32; pose.aLB = -55; pose.aRB = -55; }
  }

  // turn to face the person we are talking to, or the one who is talking to us
  let faceHeading: number | undefined, fdx = 0;
  const lookedRecently = !!lookA && (t - lookA.t0 < 3 || lookA.look === "camera");
  if (!moving && sit < 0.05 && lie < 0.05 && !lookedRecently) {
    let nearD = 1e9, talkD = 1e9, near: number[] | undefined, talker: number[] | undefined;
    for (let j = 0; j < s.actors.length; j++) {
      const o = s.actors[j];
      if (j === ai || !visibleAt(o, t) || o.actions.some(q => q.ride !== undefined && t >= q.t0 && t < q.t1)) continue;
      const po = posAt(o, t, s.props);
      const dx = (po.x - pos.x) / 150, dz = -(po.depth - pos.depth) * 8, dd = Math.hypot(dx, dz);
      if (dd > 3.5 || dd < 0.05) continue;
      if (dd < nearD) { nearD = dd; near = [dx, dz]; }
      if (dd < talkD && o.actions.some(q => !!q.say && t >= q.t0 - 0.2 && t < q.t1 + 0.8)) { talkD = dd; talker = [dx, dz]; }
    }
    const f = say ? near : talker;
    if (f) { faceHeading = Math.atan2(f[0], f[1]); fdx = f[0] * 150; }
  }
  const turnAct = act.find(q => q.turn !== undefined);
  
  if (turnAct && !moving) { faceHeading = (turnAct.turn as number) * Math.PI / 180; fdx = Math.sin(faceHeading) * 150; }
  if (!turnAct && !moving && !R) {                    // a "held" turn lasts until the character moves again
    const hold = lastOf(q => q.turn !== undefined && !!q.turnHold);
    if (hold && !a.actions.some(q => q.moveTo !== undefined && q.t0 > hold.t0 && q.t0 <= t)) {
      faceHeading = (hold.turn as number) * Math.PI / 180; fdx = Math.sin(faceHeading) * 150;
    }
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
  if (faceHeading !== undefined) face = fdx >= 0 ? 1 : -1;
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



    // handshake, drinking, eating, reading: how far the hand is raised (w) and the rhythm of the movement (beat)
  const ez2 = (x: number) => sm(cl(x, 0, 1));
  let hand: { kind: "shake" | "drink" | "eat" | "read" | "hug" | "five" | "clap" | "dance" | "knock"; w: number; beat: number } | undefined;
  const shakeA = act.find(q => q.shake);
  const useA = act.find(q => q.use);
  if (shakeA) {
    const u = (t - shakeA.t0) / Math.max(0.01, shakeA.t1 - shakeA.t0);
    const w = ez2(u / 0.15) * (1 - ez2((u - 0.85) / 0.15));
    hand = { kind: "shake", w, beat: Math.sin((t - shakeA.t0) * 9) * w };
    pose.aRU = lerp(pose.aRU, 70 + 6 * hand.beat, w); pose.aRB = lerp(pose.aRB, 25, w);
  } else if (useA && useA.use) {
    const u = (t - useA.t0) / Math.max(0.01, useA.t1 - useA.t0);
    if (useA.use === "drink") {
      const w = ez2(u / 0.22) * (1 - ez2((u - 0.78) / 0.22));
      const tilt = ez2((u - 0.3) / 0.12) * (1 - ez2((u - 0.62) / 0.12));
      hand = { kind: "drink", w, beat: tilt };
      pose.pitch -= 8 * tilt; pose.mouth = Math.max(pose.mouth, 0.3 * tilt);
    } else if (useA.use === "eat") {
      const f = (u * 3) % 1, w = Math.pow(Math.sin(Math.PI * f), 0.6) * ez2(u * 12) * ez2((1 - u) * 12);
      hand = { kind: "eat", w, beat: f };
      if (f > 0.55) pose.mouth = Math.max(pose.mouth, 0.6 * Math.abs(Math.sin(t * 13)));
    } else {
      const w = ez2(u / 0.2) * (1 - ez2((u - 0.85) / 0.15));
      hand = { kind: "read", w, beat: 0 };
      pose.pitch += 16 * w; pose.eyeY = Math.max(pose.eyeY, 0.8 * w);
    }
  }

    // body language that goes with the feeling (the face is drawn by the renderers)
  if (expr === "scared") { pose.tilt += Math.sin(t * 40) * 1.2; pose.bob += Math.sin(t * 37) * 1.5; pose.lean -= 4; pose.pitch += 3; pose.mouth = Math.max(pose.mouth, 0.3); }
  else if (expr === "laughing") { pose.lean += 4 * Math.sin(t * 9); pose.bob -= Math.abs(Math.sin(t * 9)) * 6; pose.pitch -= 8; pose.mouth = Math.max(pose.mouth, 0.75 + 0.25 * Math.sin(t * 14)); }
  else if (expr === "crying") { pose.pitch += 10; pose.lean += 6; pose.bob -= Math.abs(Math.sin(t * 6)) * 3; pose.mouth = Math.max(pose.mouth, 0.5 + 0.15 * Math.sin(t * 6)); }
  else if (expr === "sleepy") { pose.pitch += 12 + 6 * Math.sin(t * 0.8); pose.lean += 4; pose.tilt += 5 * Math.sin(t * 0.6); pose.mouth = Math.max(pose.mouth, 0.16 + 0.07 * Math.sin(t * 1.6)); }
  else if (expr === "confused") { pose.tilt += 12; pose.yaw += 8 * Math.sin(t * 1.2); }
  else if (expr === "shy") { pose.pitch += 10; pose.tilt += 6; pose.lean += 3; pose.eyeY = Math.max(pose.eyeY, 0.7); pose.eyeX -= 0.4; }

  // hug, high five, clap, dance

  const gestA = act.find(q => q.gesture);
  if (gestA && gestA.gesture && !hand) {
    const g = gestA.gesture, u = (t - gestA.t0) / Math.max(0.01, gestA.t1 - gestA.t0);
    const w = ez2(u / 0.15) * (1 - ez2((u - 0.85) / 0.15));
    if (g === "hug") {
      hand = { kind: "hug", w, beat: Math.sin((t - gestA.t0) * 3) * w };
      pose.aRU = lerp(pose.aRU, 70, w); pose.aLU = lerp(pose.aLU, 70, w); pose.aRB = lerp(pose.aRB, 30, w); pose.aLB = lerp(pose.aLB, 30, w);
      pose.yaw += 28 * w; pose.lean += 5 * w;
    } else if (g === "five") {
      hand = { kind: "five", w, beat: Math.exp(-Math.pow((u - 0.5) * 9, 2)) };
      pose.aRU = lerp(pose.aRU, 150, w); pose.aRB = lerp(pose.aRB, 10, w);
    } else if (g === "unlock") {
      hand = { kind: "knock", w, beat: 0.9 + 0.1 * Math.sin((t - gestA.t0) * 14) };               // the key held out, turning
      pose.aRU = lerp(pose.aRU, 80, w); pose.aRB = lerp(pose.aRB, 70, w);
    } else if (g === "knock") {
      const kk = (u * 3) % 1;
      hand = { kind: "knock", w, beat: Math.pow(Math.sin(Math.PI * Math.min(1, kk * 1.4)), 2) };     // three knocks
      pose.aRU = lerp(pose.aRU, 80, w); pose.aRB = lerp(pose.aRB, 70, w);
    } else if (g === "clap") {
      const beat = 0.5 + 0.5 * Math.sin((t - gestA.t0) * 11);
      hand = { kind: "clap", w, beat };
      pose.aLU = lerp(pose.aLU, 32, w); pose.aRU = lerp(pose.aRU, 32, w);
      pose.aLB = lerp(pose.aLB, -55 - 15 * beat, w); pose.aRB = lerp(pose.aRB, -55 - 15 * beat, w);
    } else {
      const ds = Math.sin(t * 6), dc = Math.cos(t * 6);
      hand = { kind: "dance", w, beat: ds };
      const D2: Partial<Pose> = { aLU: 100 + 50 * ds, aRU: 100 - 50 * ds, aLB: 40, aRB: 40, lLU: 6 * ds, lRU: -6 * ds, lLB: 18 * Math.max(0, ds), lRB: 18 * Math.max(0, -ds), bob: -Math.abs(dc) * 14, tilt: 6 * ds, lean: 3 };
      for (const key of Object.keys(D2) as (keyof Pose)[]) pose[key] = lerp(pose[key], D2[key] as number, w);
      pose.yaw += 12 * ds * w;
    }
  }
  const view: View = clip === "type" ? "front" : hand && (hand.kind === "shake" || hand.kind === "hug" || hand.kind === "five") ? "side" : sideNow ? (depthWalk ? (mz > 0 ? "front" : "back") : "side") : viewA ?? "front";
  // people who come in from, or leave toward, the camera fade in and out



  
  let alpha = 1;
  for (const q of a.actions) {
    if (q.enter && q.fromDepth !== undefined && q.fromDepth < 0 && t >= q.t0) alpha = Math.min(alpha, sm(cl((t - q.t0) / 0.5, 0, 1)));
    if (q.exit && (q.toDepth ?? 0) < 0 && t >= q.t0 && t < q.t1) alpha = Math.min(alpha, 1 - sm(cl((t - (q.t1 - 0.5)) / 0.5, 0, 1)));
  }

    // what appears above the head: speech (quiet or loud), a thought, or a ! / ? mark
  const spA = act.find(q => q.say), thA = act.find(q => q.think), mkA = act.find(q => q.mark);
  const bubble: string | undefined = say
    ? (spA?.voice === "whisper" ? "\u0001w" + say : spA?.voice === "shout" ? "\u0001s" + say : say)
    : thA ? "\u0001t" + thA.think
    : mkA ? "\u0001m" + mkA.mark + "|" + ((t - mkA.t0) / Math.max(0.01, mkA.t1 - mkA.t0)).toFixed(2)
    : undefined;
  let outX = restX, outD = restD;

  if (!R && !a.actions.some(q => q.ride !== undefined && t >= q.t0 && t < q.t1)) {
    const [X, Z] = pushOut(s, t, (restX - 640) / 150, -restD * 8);
    outX = 640 + X * 150; outD = -Z / 8;
  }
  return { x: outX, depth: outD, face, view, clip, expr, say, pose, lookEx, moving, holding, alpha, seatRot, heading, walking: sideNow, depthWalk, gaitT, oneHand,
    faceHeading, faceYaw: faceHeading !== undefined && !lookA ? cl(fdx / 8, -38, 38) : 0, rest,
    slide: 0, seatIdx: undefined as number | undefined, clipT: curAct ? t - curAct.t0 : 99, hand, bubble, holdKind: holdP?.kind };
}

// where a prop is right now (it follows whoever is carrying it)
export function propPlace(s: Scene, p: SceneProp, t: number) {
  const h = p.holds.find(q => t >= q.t0 && t < q.t1);
  const a = h ? s.actors[h.by] : undefined;
  if (h && a) {
    const pa = posAt(a, t, s.props);
    const sit = pa.moving ? 0 : sitAt(a, t);
    return {
      x: pa.x + (pa.moving ? pa.face * a.def.height * 0.2 : p.kind === "phone" ? a.def.height * 0.08 : 0), depth: pa.depth - 0.002,
      lift: a.def.height * (p.kind === "phone" ? (pa.moving ? 0.58 : 0.46) - sit * 0.2 : 0.4 - sit * 0.23), face: pa.face, moving: false, held: true, by: h.by,
      open: p.kind === "umbrella" ? powerAt(p, t, false) : 0, power: p.kind === "candle" ? powerAt(p, t, true) : 1,
    };
  }
  const pp = posAt(p, t, s.props);
  const pw = powerAt(p, t, DEFAULT_POWER[p.kind] ?? false);
  const opens = p.kind === "door" || p.kind === "window" || p.kind === "curtains" || p.kind === "umbrella";
  return {
    x: pp.x, depth: pp.depth, lift: p.actions.some(q => q.lift !== undefined && q.t0 <= t) ? pp.lift : (p.y ?? 0) * 150,
    face: pp.face, moving: pp.moving, held: false, by: -1,
    open: Math.max(openAt(p, t), opens ? pw : 0), power: pw,
  };
}

const entity = (s: Scene, i: number | undefined): Mover | undefined =>
  i === undefined ? undefined : i >= 1000 ? s.props[i - 1000] : s.actors[i];

// 1 = the lights are on, 0 = off (with a quick or slow fade, as the script says)
export function lightAt(s: Scene, t: number): number {
  const ks = s.lights;
  if (!ks || !ks.length) return 1;
  let from = 1, val = 1;
  for (const k of ks) {
    if (t < k.t) break;
    const to = k.on ? 1 : 0;
    val = lerp(from, to, sm(cl((t - k.t) / Math.max(0.01, k.ramp), 0, 1)));
    from = to;
  }
  return val;
}

export function camAt(s: Scene, t: number) {
  const k = s.cam; let i = 0;
  while (i < k.length - 1 && k[i + 1].t <= t) i++;
  const a = k[i], b = k[i + 1] ?? a;
  const u = b.t === a.t ? 1 : sm(cl((t - a.t) / (b.t - a.t), 0, 1));
  const fa = entity(s, a.follow), fb = entity(s, b.follow);
  const x = fb && fa === fb ? posAt(fb, t, s.props).x : lerp(a.x, fb ? posAt(fb, t, s.props).x : b.x, u);
  const aa = a.az ?? 0, ba = b.az ?? 0;
  let dAz = ((((ba - aa) % 360) + 540) % 360) - 180;
  if (dAz <= -179.99) dAz = 180;
  return {
    x, y: lerp(a.y, b.y, u), zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), u)),
    az: aa + dAz * u, el: lerp(a.el ?? 3, b.el ?? 3, u),
  };
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

const marketL: Layer = { speed: 0.5, tile: 340, draw: (c, i) => {
  const x = i * 340, cols = ["#d9534f", "#f0ad4e", "#5cb85c", "#5bc0de"], col = cols[((i % 4) + 4) % 4];
  c.fillStyle = "#8a6a4a"; c.fillRect(x + 20, GROUND - 120, 6, 120); c.fillRect(x + 290, GROUND - 120, 6, 120);
  for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? "#ffffff" : col; c.fillRect(x + 16 + k * 40, GROUND - 150, 40, 34); }
  c.fillStyle = "#c9a36a"; c.fillRect(x + 20, GROUND - 70, 276, 16);
  for (let k = 0; k < 6; k++) { c.fillStyle = cols[(k + i) % 4]; c.beginPath(); c.arc(x + 50 + k * 42, GROUND - 78, 10, 0, 7); c.fill(); } } };
const beachL: Layer = { speed: 0.2, tile: 800, draw: (c, i) => {
  const x = i * 800;
  c.fillStyle = "#3aa7d9"; c.fillRect(x, GROUND - 150, 801, 150);
  c.fillStyle = "rgba(255,255,255,0.55)";
  for (let k = 0; k < 8; k++) c.fillRect(x + k * 100 + (k % 3) * 20, GROUND - 120 + (k % 4) * 26, 60, 3);
  c.fillStyle = "#cfe9f4"; c.fillRect(x, GROUND - 152, 801, 4); } };
const forestL: Layer = { speed: 0.35, tile: 150, draw: (c, i) => {
  const x = i * 150 + 40 + rnd(i, 5) * 60, h = 200 + rnd(i, 6) * 150;
  c.fillStyle = "#4a3422"; c.fillRect(x - 6, GROUND - 40, 12, 40);
  for (let k = 0; k < 4; k++) {
    c.fillStyle = k % 2 ? "#1f5a34" : "#2a6b3d"; c.beginPath();
    c.moveTo(x - 50 + k * 8, GROUND - 30 - k * h * 0.2); c.lineTo(x, GROUND - 30 - k * h * 0.2 - h * 0.35); c.lineTo(x + 50 - k * 8, GROUND - 30 - k * h * 0.2);
    c.closePath(); c.fill();
  } } };
const kitchenL: Layer = { speed: 0.6, tile: 440, draw: (c, i) => {
  const x = i * 440;
  c.fillStyle = "#e6dcc8";
  for (let r = 0; r < 4; r++) for (let q = 0; q < 11; q++) c.fillRect(x + q * 40 + 1, GROUND - 250 + r * 40 + 1, 38, 38);
  c.fillStyle = "#8a6a4a"; c.fillRect(x + 20, GROUND - 330, 190, 80);
  c.fillStyle = "#c9a36a"; c.fillRect(x + 26, GROUND - 324, 86, 68); c.fillRect(x + 118, GROUND - 324, 86, 68);
  c.fillStyle = "#cfe3ee"; c.fillRect(x + 270, GROUND - 320, 120, 100); c.fillStyle = "#ffffff"; c.fillRect(x + 326, GROUND - 320, 4, 100);
  c.fillStyle = "#cfc2ae"; c.fillRect(x, GROUND - 14, 441, 14); } };
const churchL: Layer = { speed: 0.55, tile: 380, draw: (c, i) => {
  const x = i * 380;
  c.fillStyle = "#d9d2c4"; c.fillRect(x, GROUND - 420, 381, 420);
  c.fillStyle = "#b9ae98"; for (let k = 0; k < 2; k++) c.fillRect(x + 20 + k * 340, GROUND - 420, 14, 420);
  c.fillStyle = "#6b9ed8"; c.beginPath(); c.moveTo(x + 120, GROUND - 120); c.lineTo(x + 120, GROUND - 300); c.arc(x + 190, GROUND - 300, 70, Math.PI, 0); c.lineTo(x + 260, GROUND - 120); c.closePath(); c.fill();
  c.strokeStyle = "#f0d28a"; c.lineWidth = 6; c.beginPath(); c.moveTo(x + 190, GROUND - 120); c.lineTo(x + 190, GROUND - 370); c.moveTo(x + 120, GROUND - 240); c.lineTo(x + 260, GROUND - 240); c.stroke();
  c.fillStyle = "#cfc2ae"; c.fillRect(x, GROUND - 14, 381, 14); } };
const officeL: Layer = { speed: 0.6, tile: 460, draw: (c, i) => {
  const x = i * 460;
  c.fillStyle = "#bfe3ff"; c.fillRect(x + 30, GROUND - 330, 400, 220);
  c.fillStyle = "#8aa0b8"; for (let k = 0; k < 6; k++) c.fillRect(x + 50 + k * 60, GROUND - 190 - (k % 3) * 14, 36, 80 + (k % 3) * 14);
  c.fillStyle = "#a9c9e6"; for (let k = 1; k < 4; k++) c.fillRect(x + 30 + k * 100 - 3, GROUND - 330, 6, 220);
  c.fillStyle = "#cfd6de"; c.fillRect(x, GROUND - 14, 461, 14); } };
const graveL: Layer = { speed: 0.5, tile: 200, draw: (c, i) => {
  const x = i * 200 + 40 + rnd(i, 3) * 60, h = 50 + rnd(i, 4) * 50;
  c.fillStyle = "#7d828c"; c.fillRect(x, GROUND - h, 40, h); c.beginPath(); c.arc(x + 20, GROUND - h, 20, Math.PI, 0); c.fill();
  c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(x + 12, GROUND - h + 10, 16, 4); c.fillRect(x + 18, GROUND - h + 4, 4, 22); } };
const roofL: Layer = { speed: 0.4, tile: 260, draw: (c, i) => {
  const x = i * 260, w = 110 + rnd(i, 2) * 90, h = 160 + rnd(i, 3) * 220;
  c.fillStyle = "#6a7388"; c.fillRect(x + 20, GROUND - h, w, h);
  c.fillStyle = "#e8d77a";
  for (let r = 0; r < h - 30; r += 38) for (let q = 12; q < w - 20; q += 30) if (rnd(i * 7 + r, q) > 0.5) c.fillRect(x + 20 + q, GROUND - h + 12 + r, 12, 16); } };

interface ThemeDef { sky: string[]; far: Layer | null; mid: Layer; ground: Layer; fg: Layer | null; sun?: { x: number; y: number; r: number; c: string }; stars?: boolean }

const THEMES: Record<ThemeId, ThemeDef> = {
  street:    { sky: ["#8fd0ff", "#eef8ff"], far: hillsL("#c9ddd0"), mid: cityL("#c8a27a", "#fff3c9"), ground: groundL("#6f7379", "#c9c9c9"), fg: null, sun: { x: 1060, y: 110, r: 46, c: "#fff3b0" } },
  market:    { sky: ["#9fd8ff", "#fdf3dc"], far: hillsL("#d6c9a8"), mid: marketL, ground: groundL("#c9b48a", "#b59f74"), fg: null, sun: { x: 1060, y: 110, r: 46, c: "#fff3b0" } },
  forest:    { sky: ["#a8d8c0", "#e6f4e6"], far: hillsL("#4a7a5a"), mid: forestL, ground: groundL("#3e7a3a", "#35692f"), fg: fgL("#2a5a2a") },
  beach:     { sky: ["#7fd0ff", "#f4fbff"], far: null, mid: beachL, ground: groundL("#e8d8a4", "#d9c68c"), fg: null, sun: { x: 1060, y: 110, r: 50, c: "#fff3b0" } },
  kitchen:   { sky: ["#f2e9d6", "#e6dcc6"], far: null, mid: kitchenL, ground: groundL("#e9e1d0", "#cfc4aa"), fg: null },
  church:    { sky: ["#d8d2c6", "#bdb6a6"], far: null, mid: churchL, ground: groundL("#8f8a80", "#7d786f"), fg: null },
  office:    { sky: ["#dfe8f2", "#eef3f8"], far: null, mid: officeL, ground: groundL("#7f8ea3", "#6f7e92"), fg: null },
  graveyard: { sky: ["#14162e", "#2b2a4d"], far: hillsL("#1d2230"), mid: graveL, ground: groundL("#2a3a2a", "#223022"), fg: fgL("#141c14"), sun: { x: 900, y: 110, r: 36, c: "#f4f1d8" }, stars: true },
  rooftop:   { sky: ["#9ad0ff", "#e8f4ff"], far: null, mid: roofL, ground: groundL("#6c7078", "#5d6168"), fg: null, sun: { x: 1060, y: 110, r: 46, c: "#fff3b0" } },
  
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
  { id: "street", label: "Street", swatch: "linear-gradient(#8fd0ff,#6f7379)" },
  { id: "market", label: "Market", swatch: "linear-gradient(#9fd8ff,#c9b48a)" },
  { id: "forest", label: "Forest", swatch: "linear-gradient(#a8d8c0,#3e7a3a)" },
  { id: "beach", label: "Beach", swatch: "linear-gradient(#7fd0ff,#3aa7d9,#e8d8a4)" },
  { id: "kitchen", label: "Kitchen", swatch: "linear-gradient(#f2e9d6,#e9e1d0)" },
  { id: "church", label: "Church", swatch: "linear-gradient(#d8d2c6,#8f8a80)" },
  { id: "office", label: "Office", swatch: "linear-gradient(#dfe8f2,#7f8ea3)" },
  { id: "graveyard", label: "Graveyard", swatch: "linear-gradient(#14162e,#2a3a2a)" },
  { id: "rooftop", label: "Rooftop", swatch: "linear-gradient(#9ad0ff,#6c7078)" },

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
  if (text.charCodeAt(0) !== 1) { drawBubbleSay(c, text, x, y); return; }   // plain speech
  const kind = text[1], body = text.slice(2);
  c.save();
  if (kind === "m") {                                        // a "!" or "?" that pops up over the head
    const [sym, us] = body.split("|"), u = Math.min(1, Math.max(0, +us || 0));
    const pop = u < 0.2 ? 0.4 + 3 * u : 1 + 0.12 * Math.sin(u * 14) * (1 - u);
    c.translate(x, y - 34 - 10 * Math.sin(Math.min(1, u * 4) * Math.PI));
    c.textAlign = "center"; c.textBaseline = "middle";
    c.font = `800 ${Math.round(70 * pop)}px system-ui, sans-serif`;
    c.lineJoin = "round"; c.lineWidth = 10; c.strokeStyle = "#1a1a2e";
    c.strokeText(sym, 0, 0);
    c.fillStyle = sym.includes("!") ? "#ffd23f" : "#4db3ff"; c.fillText(sym, 0, 0);
    c.restore(); return;
  }
  const shout = kind === "s", whisper = kind === "w", think = kind === "t";
  const fs = shout ? 34 : whisper ? 19 : 24;
  c.font = `${think ? "italic " : ""}${shout ? 800 : 600} ${fs}px system-ui, sans-serif`;
  c.textAlign = "center"; c.textBaseline = "middle";
  const words = (shout ? body.toUpperCase() : body).split(/\s+/);
  const maxW = shout ? 380 : 320, lines: string[] = []; let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (c.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  const lh = fs * 1.25, bw = Math.max(...lines.map(l => c.measureText(l).width)) + 36, bh = lines.length * lh + 22;
  const bx = x - bw / 2, by = y - 22 - bh;
  c.lineJoin = "round"; c.strokeStyle = "#1a1a2e";
  let ink = "#1a1a2e";
  if (shout) {                                               // a jagged burst
    const cx = x, cy = by + bh / 2, rx = bw / 2 + 20, ry = bh / 2 + 16, n = 18;
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2, k = i % 2 ? 1 : 1.22;
      const px = cx + Math.cos(a) * rx * k, py = cy + Math.sin(a) * ry * k;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath(); c.fillStyle = "#fff3b0"; c.lineWidth = 4; c.fill(); c.stroke();
    ink = "#9b1c1c";
  } else if (think) {                                        // a cloud, with little bubbles leading down to the head
    c.fillStyle = "#ffffff"; c.lineWidth = 3;
    const r = 13, nx = Math.max(3, Math.round(bw / 26)), ny = Math.max(2, Math.round(bh / 26));
    const pts: [number, number][] = [];
    for (let i = 0; i <= nx; i++) pts.push([bx + (bw * i) / nx, by], [bx + (bw * i) / nx, by + bh]);
    for (let j = 1; j < ny; j++) pts.push([bx, by + (bh * j) / ny], [bx + bw, by + (bh * j) / ny]);
    for (const [px, py] of pts) { c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill(); c.stroke(); }
    c.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    for (const [tx, ty, tr] of [[x + 8, y - 17, 7], [x + 4, y - 9, 5], [x, y - 3, 3.5]] as const) { c.beginPath(); c.arc(tx, ty, tr, 0, Math.PI * 2); c.fill(); c.stroke(); }
  } else {                                                   // a quiet bubble: dashed and light
    const rr = 16;
    c.fillStyle = "rgba(255,255,255,0.92)"; c.lineWidth = 2.5;
    if (whisper) c.setLineDash([6, 5]);
    c.beginPath(); c.moveTo(bx + rr, by);
    c.arcTo(bx + bw, by, bx + bw, by + bh, rr); c.arcTo(bx + bw, by + bh, bx, by + bh, rr);
    c.arcTo(bx, by + bh, bx, by, rr); c.arcTo(bx, by, bx + bw, by, rr); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 8, by + bh); c.lineTo(x, y - 4); c.lineTo(x + 8, by + bh); c.stroke();
    c.setLineDash([]);
    ink = "#5a5f73";
  }
  c.fillStyle = ink;
  lines.forEach((l, k) => c.fillText(l, x, by + 11 + lh * (k + 0.5)));
  c.restore();
}

function drawBubbleSay(c: CanvasRenderingContext2D, text: string, x: number, y: number) {
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
  // a vertical Short (taller than wide) shows the middle part of the world, drawn bigger
  const cw = c.canvas.width, ch = c.canvas.height;
  const k = ch > cw ? cw / 480 : cw / W;
  c.save(); c.translate(cw / 2, ch / 2); c.scale(k, k); c.translate(-W / 2, -H / 2);
  const th = THEMES[opts.theme ?? "day"];
  const g = c.createLinearGradient(0, 0, 0, H);
  th.sky.forEach((col, i) => g.addColorStop(i / (th.sky.length - 1), col));
  c.fillStyle = th.sky[0]; c.fillRect(-W, -H, 3 * W, 2 * H);
  c.fillStyle = g; c.fillRect(-W, 0, 3 * W, H);
  if (th.stars) {
    c.fillStyle = "#fff";
    for (let n = 0; n < 70; n++) { const r = 1 + rnd(n, 3) * 1.6; c.globalAlpha = 0.5 + rnd(n, 4) * 0.5; c.fillRect(rnd(n, 1) * W, rnd(n, 2) * H * 0.6, r, r); }
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
    s.actors.forEach((a, ai) => {
      if (!visibleAt(a, t)) {
        // someone talking from inside a car still gets a speech bubble above the car
        const st0 = actorState(s, a, t);
        if (st0.say && a.actions.some(q => q.ride !== undefined && t >= q.t0 && t < q.t1)) talkers.push({ x: st0.x, y: FOOT - st0.depth * 70 - 200, say: st0.say });
        return;
      }
      const st = actorState(s, a, t);
      const fy = FOOT - st.depth * 70, sc = 1 - st.depth * 0.22;
      const base = st.depthWalk ? depthWalkPose(st.pose, st.gaitT, st.clip === "run", st.holding) : st.pose;
      const pose = smoothPose("2d" + ai, { ...base, yaw: base.yaw + st.faceYaw }, t);
      items.push({ depth: st.depth, order: 1, draw: () => withAlpha(c, st.alpha, () => drawActor(c, a.def, pose, st.expr, st.x, fy, sc,
        { view: st.view, face: st.face, seed: Math.floor(t * 8), prop: st.clip === "type" ? "laptop" : undefined })) });
      if (st.bubble) talkers.push({ x: st.x, y: fy - a.def.height * sc * 1.02 - 10, say: st.bubble });
    });
    items.sort((a, b) => b.depth - a.depth || a.order - b.order);
    for (const it of items) it.draw();
    if (opts.bubbles !== false) for (const q of talkers) drawBubble(c, q.say, q.x, q.y);
  });
  if (th.fg) layer(c, th.fg, cam);
  const lv = lightAt(s, t);
  if (lv < 0.995) { c.fillStyle = `rgba(6,10,32,${(0.72 * (1 - lv)).toFixed(3)})`; c.fillRect(-W, -H, 3 * W, 3 * H); }
  c.restore();
}
