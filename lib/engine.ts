import { Actor, Scene } from "./types";
import { BASE, clips, drawActor } from "./draw";

export const W = 1280, H = 720, GROUND = 560;
const sm = (u: number) => u * u * (3 - 2 * u);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const rnd = (i: number, k: number) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5; return s - Math.floor(s); };

export function actorState(a: Actor, t: number) {
  let x = a.x, face = 1;
  for (const m of a.actions.filter(q => q.moveTo !== undefined)) {
    if (t < m.t0) break;
    const u = t >= m.t1 ? 1 : (t - m.t0) / (m.t1 - m.t0);
    face = m.moveTo! >= x ? 1 : -1;
    if (u < 1) { x = lerp(x, m.moveTo!, sm(u)); break; }
    x = m.moveTo!;
  }
  const act = a.actions.filter(q => t >= q.t0 && t < q.t1);
  const clip = act.find(q => q.clip)?.clip ?? "idle";
  const expr = [...a.actions].reverse().find(q => q.expr && q.t0 <= t)?.expr ?? "neutral";
  const say = act.find(q => q.say)?.say;
  const pose = { ...BASE, ...clips.idle(t), ...clips[clip](t) };
  if (say) pose.mouth = Math.abs(Math.sin(t * 12));
  return { x, face, clip, expr, pose };
}

export function camAt(s: Scene, t: number) {
  const k = s.cam; let i = 0;
  while (i < k.length - 1 && k[i + 1].t <= t) i++;
  const a = k[i], b = k[i + 1] ?? a;
  const u = b.t === a.t ? 1 : sm(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
  const tx = b.follow ? actorState(s.actors[0], t).x : b.x;
  return { x: lerp(a.x, tx, u), y: lerp(a.y, b.y, u), zoom: lerp(a.zoom, b.zoom, u) };
}

type Layer = { speed: number; tile: number; draw: (c: CanvasRenderingContext2D, i: number) => void };
const hills: Layer = { speed: 0.15, tile: 600, draw: (c, i) => {
  c.fillStyle = "#cfe3d4"; c.beginPath();
  c.ellipse(i * 600 + 300, GROUND, 380, 90 + rnd(i, 1) * 120, 0, Math.PI, 2 * Math.PI); c.fill(); } };
const city: Layer = { speed: 0.45, tile: 220, draw: (c, i) => {
  const w = 140 + rnd(i, 2) * 60, h = 120 + rnd(i, 3) * 200, x = i * 220 + 40;
  c.fillStyle = "#b9c4d6"; c.fillRect(x, GROUND - h, w, h);
  c.fillStyle = "#e9eef7";
  for (let r = 0; r < h - 30; r += 36) for (let q = 14; q < w - 20; q += 34) c.fillRect(x + q, GROUND - h + 14 + r, 16, 20); } };
const ground: Layer = { speed: 1, tile: 200, draw: (c, i) => {
  c.fillStyle = "#8fbf7f"; c.fillRect(i * 200, GROUND, 201, 600);
  c.fillStyle = "#79a86b"; c.fillRect(i * 200 + 20, GROUND + 60, 90, 8); } };
const fg: Layer = { speed: 1.6, tile: 500, draw: (c, i) => {
  c.fillStyle = "#4d8a4f"; c.beginPath();
  c.ellipse(i * 500 + rnd(i, 4) * 300, GROUND + 150, 90, 60, 0, 0, 7); c.fill(); } };

function layer(c: CanvasRenderingContext2D, L: Layer, cam: { x: number; y: number; zoom: number }, body?: () => void) {
  c.save(); c.translate(W / 2, H / 2); c.scale(cam.zoom, cam.zoom); c.translate(-cam.x * L.speed, -cam.y);
  const half = W / (2 * cam.zoom), cx = cam.x * L.speed;
  for (let i = Math.floor((cx - half) / L.tile) - 1; i <= Math.ceil((cx + half) / L.tile) + 1; i++) L.draw(c, i);
  body?.(); c.restore();
}

export function renderFrame(c: CanvasRenderingContext2D, s: Scene, t: number) {
  const cam = camAt(s, t);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#9ed6ff"); g.addColorStop(1, "#eaf6ff");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  layer(c, hills, cam); layer(c, city, cam);
  layer(c, ground, cam, () => {
    for (const a of s.actors) {
      const st = actorState(a, t);
      drawActor(c, a.def, st.pose, st.expr, st.x, GROUND + 40, st.face, Math.floor(t * 8), st.clip === "type" ? "laptop" : undefined);
    }
  });
  layer(c, fg, cam);
}
