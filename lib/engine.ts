import { Action, Actor, ClipId, Pose, Scene, View } from "./types";
import { BASE, clips, drawActor } from "./draw";

export const W = 1280, H = 720, GROUND = 560, FOOT = 600;
const sm = (u: number) => u * u * (3 - 2 * u);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (i: number, k: number) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5; return s - Math.floor(s); };

export function posAt(a: Actor, t: number) {
  let x = a.x, face = 1, moving = false;
  for (const m of a.actions) {
    if (m.moveTo === undefined) continue;
    if (t < m.t0) break;
    const u = t >= m.t1 ? 1 : (t - m.t0) / Math.max(0.01, m.t1 - m.t0);
    if (m.moveTo !== x) face = m.moveTo > x ? 1 : -1;
    if (u < 1) { x = lerp(x, m.moveTo, sm(u)); moving = true; break; }
    x = m.moveTo;
  }
  return { x, face, moving };
}

function lookVec(s: Scene, look: string, from: number, t: number) {
  const z = { yaw: 0, pitch: 0, ex: 0, ey: 0 };
  if (look === "camera") return z;
  if (look === "left") return { yaw: -35, pitch: 0, ex: -0.9, ey: 0 };
  if (look === "right") return { yaw: 35, pitch: 0, ex: 0.9, ey: 0 };
  if (look === "up") return { yaw: 0, pitch: -14, ex: 0, ey: -0.8 };
  if (look === "down") return { yaw: 0, pitch: 14, ex: 0, ey: 0.8 };
  const tg = s.actors.find(q => q.def.name.toLowerCase() === look.toLowerCase());
  if (!tg) return z;
  const dx = posAt(tg, t).x - from;
  return { yaw: cl(dx / 8, -38, 38), pitch: 0, ex: cl(dx / 120, -1, 1), ey: 0 };
}

export function actorState(s: Scene, a: Actor, t: number) {
  const pos = posAt(a, t);
  const done = a.actions.filter(q => q.t0 <= t);
  const act = a.actions.filter(q => t >= q.t0 && t < q.t1);
  const lastOf = (f: (q: Action) => boolean) => [...done].reverse().find(f);
  const expr = lastOf(q => !!q.expr)?.expr ?? "neutral";
  const lookA = lastOf(q => !!q.look);
  const viewA = lastOf(q => !!q.view)?.view;
  const say = act.find(q => q.say)?.say;
  const clip: ClipId = act.find(q => q.clip)?.clip ?? "idle";
  const moving = pos.moving;

  let pose: Pose = { ...BASE, ...clips.idle(t) };
  if (moving || clip === "walk") pose = { ...pose, ...clips.walk(t) };
  if (clip !== "walk" && clip !== "idle") pose = { ...pose, ...clips[clip](t) };

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

  const view: View = clip === "type" ? "front" : moving || clip === "walk" ? "side" : viewA ?? "front";
  return { x: pos.x, face, view, clip, expr, say, pose };
}

export function camAt(s: Scene, t: number) {
  const k = s.cam; let i = 0;
  while (i < k.length - 1 && k[i + 1].t <= t) i++;
  const a = k[i], b = k[i + 1] ?? a;
  const u = b.t === a.t ? 1 : sm(cl((t - a.t) / (b.t - a.t), 0, 1));
  const fa = a.follow !== undefined ? s.actors[a.follow] : undefined;
  const fb = b.follow !== undefined ? s.actors[b.follow] : undefined;
  const x = fb && fa === fb ? posAt(fb, t).x : lerp(a.x, fb ? posAt(fb, t).x : b.x, u);
  return { x, y: lerp(a.y, b.y, u), zoom: lerp(a.zoom, b.zoom, u) };
}

type Layer = { speed: number; tile: number; draw: (c: CanvasRenderingContext2D, i: number) => void };
const hills: Layer = { speed: 0.15, tile: 600, draw: (c, i) => {
  c.fillStyle = "#c9ddd0"; c.beginPath();
  c.ellipse(i * 600 + 300, GROUND, 380, 90 + rnd(i, 1) * 120, 0, Math.PI, 2 * Math.PI); c.fill(); } };
const city: Layer = { speed: 0.45, tile: 220, draw: (c, i) => {
  const w = 140 + rnd(i, 2) * 60, h = 120 + rnd(i, 3) * 200, x = i * 220 + 40;
  c.fillStyle = "#b3bfd3"; c.fillRect(x, GROUND - h, w, h);
  c.fillStyle = "#e6ecf7";
  for (let r = 0; r < h - 30; r += 36) for (let q = 14; q < w - 20; q += 34) c.fillRect(x + q, GROUND - h + 14 + r, 16, 20); } };
const ground: Layer = { speed: 1, tile: 200, draw: (c, i) => {
  c.fillStyle = "#9bc58a"; c.fillRect(i * 200, GROUND, 201, 700);
  c.fillStyle = "#86b277"; c.fillRect(i * 200 + 20, GROUND + 90, 90, 8); } };
const fg: Layer = { speed: 1.6, tile: 500, draw: (c, i) => {
  c.fillStyle = "#4d8a4f"; c.beginPath();
  c.ellipse(i * 500 + rnd(i, 4) * 300, GROUND + 190, 90, 60, 0, 0, 7); c.fill(); } };

function layer(c: CanvasRenderingContext2D, L: Layer, cam: { x: number; y: number; zoom: number }, body?: () => void) {
  c.save(); c.translate(W / 2, H / 2); c.scale(cam.zoom, cam.zoom); c.translate(-cam.x * L.speed, -cam.y);
  const half = W / (2 * cam.zoom), cx = cam.x * L.speed;
  for (let i = Math.floor((cx - half) / L.tile) - 1; i <= Math.ceil((cx + half) / L.tile) + 1; i++) L.draw(c, i);
  body?.(); c.restore();
}

function drawBubble(c: CanvasRenderingContext2D, text: string, x: number, y: number) {
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

export function renderFrame(c: CanvasRenderingContext2D, s: Scene, t: number, opts: { bubbles?: boolean } = {}) {
  const cam = camAt(s, t);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#8fd0ff"); g.addColorStop(1, "#eef8ff");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  layer(c, hills, cam); layer(c, city, cam);
  layer(c, ground, cam, () => {
    const order = [...s.actors].sort((a, b) => b.depth - a.depth);
    const states = order.map(a => ({ a, st: actorState(s, a, t) }));
    for (const { a, st } of states) {
      drawActor(c, a.def, st.pose, st.expr, st.x, FOOT - a.depth * 70, 1 - a.depth * 0.22,
        { view: st.view, face: st.face, seed: Math.floor(t * 8), prop: st.clip === "type" ? "laptop" : undefined });
    }
    if (opts.bubbles !== false) {
      for (const { a, st } of states) {
        if (st.say) drawBubble(c, st.say, st.x, FOOT - a.depth * 70 - a.def.height * (1 - a.depth * 0.22) * 1.02 - 10);
      }
    }
  });
  layer(c, fg, cam);
}
