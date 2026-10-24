import { Action, Actor, ClipId, Pose, Scene, ThemeId, View } from "./types";
import { BASE, clips, drawActor } from "./draw";
import { drawSprite } from "./sprite";

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

  // manual pose blocks: full strength inside [t0, t1], 0.25s fade before and after
  for (const k of a.keys) {
    const w = sm(cl((t - (k.t0 - 0.25)) / 0.25, 0, 1)) * (1 - sm(cl((t - k.t1) / 0.25, 0, 1)));
    if (w <= 0) continue;
    for (const key of Object.keys(k.pose) as (keyof Pose)[]) {
      const v = k.pose[key];
      if (v !== undefined) pose[key] = lerp(pose[key], v, w);
    }
  }

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

const groundL = (color: string, stripe: string, planks = false): Layer => ({ speed: 1, tile: 200, draw: (c, i) => {
  c.fillStyle = color; c.fillRect(i * 200, GROUND, 201, 700);
  c.fillStyle = stripe;
  if (planks) { c.fillRect(i * 200, GROUND + 80, 201, 3); c.fillRect(i * 200, GROUND + 160, 201, 3); c.fillRect(i * 200 + rnd(i, 9) * 180, GROUND, 3, 80); }
  else c.fillRect(i * 200 + 20, GROUND + 90, 90, 8); } });

const fgL = (color: string): Layer => ({ speed: 1.6, tile: 500, draw: (c, i) => {
  c.fillStyle = color; c.beginPath();
  c.ellipse(i * 500 + rnd(i, 4) * 300, GROUND + 190, 90, 60, 0, 0, 7); c.fill(); } });

interface ThemeDef { sky: string[]; far: Layer | null; mid: Layer; ground: Layer; fg: Layer | null; sun?: { x: number; y: number; r: number; c: string }; stars?: boolean }

const THEMES: Record<ThemeId, ThemeDef> = {
  day:    { sky: ["#8fd0ff", "#eef8ff"], far: hillsL("#c9ddd0"), mid: cityL("#b3bfd3", "#e6ecf7"), ground: groundL("#9bc58a", "#86b277"), fg: fgL("#4d8a4f"), sun: { x: 1060, y: 110, r: 46, c: "#fff3b0" } },
  sunset: { sky: ["#2d1f5e", "#d9577a", "#ffb36b"], far: hillsL("#6b3f7a"), mid: cityL("#4a2f66", "#7a5588"), ground: groundL("#5a6b4a", "#4c5c3e"), fg: fgL("#2f3d2f"), sun: { x: 300, y: 400, r: 70, c: "#ffd29a" } },
  night:  { sky: ["#0b1030", "#1b2a5c"], far: hillsL("#1b2748"), mid: cityL("#202b4d", "#2d3a63", true), ground: groundL("#27413a", "#1f342f"), fg: fgL("#12261f"), sun: { x: 1000, y: 100, r: 38, c: "#f4f1d8" }, stars: true },
  park:   { sky: ["#9fdcff", "#f4fbff"], far: hillsL("#a8d5a2"), mid: treesL("#4f9a52", "#3f8a49"), ground: groundL("#8fd07a", "#7bbd68"), fg: fgL("#3f8a49"), sun: { x: 180, y: 110, r: 44, c: "#fff3b0" } },
  room:   { sky: ["#eadfce", "#d9ccb8"], far: null, mid: roomL, ground: groundL("#b98c5e", "#a67a50", true), fg: null },
};

export const THEME_LIST: { id: ThemeId; label: string; swatch: string }[] = [
  { id: "day", label: "Sunny", swatch: "linear-gradient(#8fd0ff,#9bc58a)" },
  { id: "sunset", label: "Sunset", swatch: "linear-gradient(#2d1f5e,#d9577a,#ffb36b)" },
  { id: "night", label: "Night", swatch: "linear-gradient(#0b1030,#27413a)" },
  { id: "park", label: "Park", swatch: "linear-gradient(#9fdcff,#8fd07a)" },
  { id: "room", label: "Room", swatch: "linear-gradient(#eadfce,#b98c5e)" },
];

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
    const order = [...s.actors].sort((a, b) => b.depth - a.depth);
    const states = order.map(a => ({ a, st: actorState(s, a, t) }));
    for (const { a, st } of states) {
      const fy = FOOT - a.depth * 70, sc = 1 - a.depth * 0.22;
      if (a.def.sprite) drawSprite(c, a.def, st, t, fy, sc);
      else drawActor(c, a.def, st.pose, st.expr, st.x, fy, sc,
        { view: st.view, face: st.face, seed: Math.floor(t * 8), prop: st.clip === "type" ? "laptop" : undefined });
    }
    if (opts.bubbles !== false) {
      for (const { a, st } of states) {
        if (st.say) drawBubble(c, st.say, st.x, FOOT - a.depth * 70 - a.def.height * (1 - a.depth * 0.22) * 1.02 - 10);
      }
    }
  });
  if (th.fg) layer(c, th.fg, cam);
}
