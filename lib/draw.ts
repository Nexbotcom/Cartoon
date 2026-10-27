import { CharacterDef, ClipId, Expr, Pose, StyleId, View } from "./types";

const S = Math.sin, C = Math.cos, D = Math.PI / 180, TAU = Math.PI * 2;
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dk = (h: string, f: number) => {
  if (h[0] !== "#" || h.length < 7) return h;
  const n = parseInt(h.slice(1, 7), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
};

export const BASE: Pose = {
  aLU: 6, aLB: 8, aRU: 6, aRB: 8, lLU: 3, lLB: 0, lRU: 3, lRB: 0,
  yaw: 0, pitch: 0, tilt: 0, lean: 0, bob: 0, mouth: 0, blink: 0, eyeX: 0, eyeY: 0, sit: 0, lie: 0,
};

// Angles: 0 = hanging down, positive = outward (front view) or forward (side view).
export const clips: Record<ClipId, (t: number) => Partial<Pose>> = {
  idle: t => ({ bob: S(t * 2) * 1.2, aLU: 7 + S(t * 2) * 2, aRU: 7 - S(t * 2) * 2, tilt: S(t * 1.3) * 1.5 }),
  walk: t => {
    const w = S(t * 7), v = -w;
    return {
      lLU: w * 26, lRU: v * 26, lLB: Math.max(0, -w) * 45, lRB: Math.max(0, -v) * 45,
      aLU: v * 24, aRU: w * 24, aLB: 14 + Math.max(0, v) * 18, aRB: 14 + Math.max(0, w) * 18,
      bob: -Math.abs(S(t * 7)) * 5, lean: 4,
    };
  },
  run: t => {
    const w = S(t * 11), v = -w;
    return {
      lLU: w * 48, lRU: v * 48, lLB: Math.max(0, -w) * 85, lRB: Math.max(0, -v) * 85,
      aLU: v * 55, aRU: w * 55, aLB: 70 + Math.max(0, v) * 25, aRB: 70 + Math.max(0, w) * 25,
      bob: -Math.abs(S(t * 11)) * 12, lean: 14, tilt: S(t * 5.5) * 1.5,
    };
  },
  wave: t => ({ aRU: 140 + S(t * 3) * 6, aRB: 20 + S(t * 11) * 22, yaw: S(t * 1.5) * 6, tilt: 3 }),
  talk: t => ({ aLU: 16 + S(t * 3) * 10, aLB: 35 + S(t * 2.1) * 12, aRU: 20 + S(t * 2.6 + 1) * 12, aRB: 40 + S(t * 3.3) * 15, tilt: S(t * 2) * 2 }),
  type: t => ({ aLU: 18, aLB: -70 + S(t * 14) * 5, aRU: 18, aRB: -70 + S(t * 14 + 1.5) * 5, pitch: 12, bob: S(t * 2) * 0.8 }),
  jump: t => ({ bob: -Math.abs(S(t * 5)) * 55, aLU: 150, aRU: 150, aLB: 10, aRB: 10, lLB: 28, lRB: 28, lLU: 8, lRU: 8 }),
  point: t => ({ aRU: 95 + S(t * 2) * 2, aRB: 0, tilt: -2, aLU: 8 }),
  shrug: t => ({ aLU: 38 + S(t * 3) * 3, aLB: 70, aRU: 38 + S(t * 3) * 3, aRB: 70, tilt: 5, pitch: -4, bob: S(t * 3) }),
};

export interface DrawOpts { view: View; face: number; seed: number; prop?: "laptop" }

interface Look {
  ol: string; ow: number; mono: boolean; stick: boolean; shade: boolean;
  headK: number; legK: number; torsoK: number; shoulderK: number; limbK: number;
  eyeKind: "dot" | "flat" | "anime"; wob: number;
}
const LOOKS: Record<StyleId, Look> = {
  stick:  { ol: "#111",    ow: 0,   mono: false, stick: true,  shade: false, headK: 0.075, legK: 0.47, torsoK: 0.28, shoulderK: 0.2,  limbK: 0.07,  eyeKind: "dot",   wob: 0 },
  flat:   { ol: "",        ow: 0,   mono: false, stick: false, shade: true,  headK: 0.075, legK: 0.46, torsoK: 0.3,  shoulderK: 0.22, limbK: 0.07,  eyeKind: "flat",  wob: 0 },
  anime:  { ol: "#3a3340", ow: 1.6, mono: false, stick: false, shade: true,  headK: 0.062, legK: 0.5,  torsoK: 0.28, shoulderK: 0.17, limbK: 0.052, eyeKind: "anime", wob: 0 },
  sketch: { ol: "#1b1b1b", ow: 2.4, mono: true,  stick: false, shade: false, headK: 0.07,  legK: 0.47, torsoK: 0.3,  shoulderK: 0.2,  limbK: 0.06,  eyeKind: "dot",   wob: 1.3 },
};

export function drawActor(
  c: CanvasRenderingContext2D, d: CharacterDef, p: Pose, expr: Expr,
  x: number, footY: number, scale: number, o: DrawOpts
) {
  const L = LOOKS[d.style];
  const H = d.height, B = d.build ?? 1;
  const hr = H * L.headK, Lg = H * L.legK, tor = H * L.torsoK;
  const limb = H * L.limbK * B, sw = H * L.shoulderK * B, hw = sw * 0.42;
  const UA = H * 0.17, FA = H * 0.16;
  const eyeC = d.eye ?? "#3b2a1e", slv = d.sleeve ?? "short";
  const col = (k: string) => (L.mono ? "#fff" : k);
  const skinC = col(d.skin), hairC = L.mono ? "#d4d4d4" : d.hair;
  const ink = L.ol || "#2a2230";
  const front = o.view !== "side";
  const mir = o.view === "side" ? o.face : 1;
  const j = (n: number) => (L.wob ? Math.sin(o.seed * 13.1 + n * 7.7) * L.wob : 0);
  const v2 = (side: number, a: number): [number, number] =>
    front ? [side * S(a * D), C(a * D)] : [S(a * D), C(a * D)];

  const hipY = -Lg, lean = p.lean * D;
  const neck: [number, number] = [S(lean) * tor, hipY - C(lean) * tor];
  const shY = neck[1] + tor * 0.1;

  c.save();
  c.translate(x, footY);
  c.scale(scale * mir, scale);
  c.fillStyle = "rgba(0,0,0,0.16)";
  c.beginPath(); c.ellipse(0, 0, H * 0.2, H * 0.03, 0, 0, TAU); c.fill();
  c.translate(0, p.bob + p.sit * Lg * 0.5);
  if (p.lie > 0) {
    c.translate(0, p.lie * H * 0.08);
    c.translate(0, hipY); c.rotate((-Math.PI / 2) * p.lie); c.translate(0, -hipY);
  }

  
  c.lineCap = "round"; c.lineJoin = "round";

  // ---------- drawing helpers ----------
  const paint = (path: () => void, fill: string, round = 0, shadeW = 0) => {
    if (L.stick) return;
    if (L.ol) { path(); c.lineWidth = L.ow * 2 + round; c.strokeStyle = L.ol; c.stroke(); }
    path(); c.fillStyle = fill; c.fill();
    if (round) { c.lineWidth = round; c.strokeStyle = fill; c.stroke(); }
    if (L.shade && shadeW > 0) {
      c.save(); path(); c.clip();
      c.fillStyle = "rgba(25,20,60,0.16)"; c.fillRect(-4000, -4000, 8000, 8000);
      c.translate(-shadeW, 0); path(); c.fillStyle = fill; c.fill();
      c.restore();
    }
  };
  const taper = (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) => () => {
    const a = Math.atan2(y1 - y0, x1 - x0);
    c.beginPath();
    c.arc(x0, y0, r0, a + Math.PI / 2, a + Math.PI * 1.5);
    c.arc(x1, y1, r1, a - Math.PI / 2, a + Math.PI / 2);
    c.closePath();
  };
  const circ = (cx: number, cy: number, r: number) => () => { c.beginPath(); c.arc(cx, cy, r, 0, TAU); };
  const ell = (cx: number, cy: number, rx: number, ry: number) => () => { c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); };
  const bone = (x0: number, y0: number, x1: number, y1: number) => {
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
    c.strokeStyle = ink; c.lineWidth = 4; c.stroke();
  };
  const seg = (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, fill: string, n: number) => {
    if (L.stick) { bone(x0, y0, x1, y1); return; }
    paint(taper(x0 + j(n), y0 + j(n + 1), r0, x1 + j(n + 2), y1 + j(n + 3), r1), col(fill), 0, Math.min(r0, r1) * 0.45);
  };

  // ---------- limbs ----------
  const leg = (side: number, aU: number, aB: number, far: boolean) => {
    const k = far ? 0.8 : 1;
    const lc = dk(d.outfit === "pants" ? d.bottom : d.skin, k);
    const rT = limb * 0.64, rA = limb * 0.42;
    const hx0 = front && !L.stick ? side * hw * 0.5 : 0;
    if (front) {
      const sk = 1 - p.sit;
      const [dx, dy] = v2(side, aU * sk);
      const fx = hx0 + dx * Lg * 0.98, fy = hipY + dy * Lg * 0.98 * (1 - 0.5 * p.sit) - aB * sk * H * 0.004;
      seg(hx0, hipY, rT, fx, fy, rA, lc, 9);
      if (d.outfit === "shorts") seg(hx0, hipY, rT * 1.08, hx0 + (fx - hx0) * 0.42, hipY + (fy - hipY) * 0.42, rT * 0.98, dk(d.bottom, k), 11);
      paint(ell(fx + side * hr * 0.1, fy + H * 0.006, hr * 0.58, hr * 0.27), col(dk(d.shoes, k)), 0, hr * 0.1);
    } else {
      const [d1x, d1y] = v2(0, aU), [d2x, d2y] = v2(0, aU - aB);
      const kx = d1x * Lg * 0.5, ky = hipY + d1y * Lg * 0.5;
      const ax = kx + d2x * Lg * 0.5, ay = ky + d2y * Lg * 0.5;
      seg(0, hipY, rT, kx, ky, rT * 0.8, lc, 9);
      seg(kx, ky, rT * 0.8, ax, ay, rA, lc, 11);
      if (d.outfit === "shorts") seg(0, hipY, rT * 1.08, kx * 0.84, hipY + (ky - hipY) * 0.84, rT * 0.88, dk(d.bottom, k), 13);
      paint(ell(ax + hr * 0.3, ay + hr * 0.08, hr * 0.7, hr * 0.27), col(dk(d.shoes, k)), 0, hr * 0.1);
    }
  };

  const arm = (side: number, aU: number, aB: number, far: boolean) => {
    const k = far ? 0.8 : 1;
    const sk = dk(d.skin, k), top = dk(d.top, k);
    const sx = front && !L.stick ? neck[0] + side * sw * 0.44 : neck[0];
    const sy = shY + tor * 0.04;
    const [dx1, dy1] = v2(side, aU), [dx2, dy2] = v2(side, aU + aB);
    const ex = sx + dx1 * UA, ey = sy + dy1 * UA, wx = ex + dx2 * FA, wy = ey + dy2 * FA;
    seg(sx, sy, limb * 0.5, ex, ey, limb * 0.44, sk, 1);
    seg(ex, ey, limb * 0.44, wx, wy, limb * 0.36, sk, 3);
    if (slv === "long") {
      seg(sx, sy, limb * 0.54, ex, ey, limb * 0.5, top, 5);
      seg(ex, ey, limb * 0.5, wx - dx2 * FA * 0.12, wy - dy2 * FA * 0.12, limb * 0.42, top, 7);
    } else {
      seg(sx, sy, limb * 0.56, sx + (ex - sx) * 0.62, sy + (ey - sy) * 0.62, limb * 0.52, top, 5);
    }
    paint(circ(wx + dx2 * limb * 0.2, wy + dy2 * limb * 0.2, limb * 0.42), col(sk), 0, limb * 0.12);
  };

  // ---------- body shapes ----------
  const torsoFront = () => {
    const nx = neck[0], mx = nx * 0.5, ww = L.eyeKind === "anime" ? hw * 0.8 : hw * 0.98;
    c.beginPath();
    c.moveTo(nx - sw * 0.5, shY); c.lineTo(nx + sw * 0.5, shY);
    c.lineTo(mx + ww, hipY - tor * 0.5); c.lineTo(hw * 1.08, hipY);
    c.lineTo(-hw * 1.08, hipY); c.lineTo(mx - ww, hipY - tor * 0.5);
    c.closePath();
  };
  const td = sw * 0.62;
  const belt = hipY - tor * 0.1;
  const bottomShape = () => {
    c.beginPath();
    if (d.outfit === "skirt") {
      const w = front ? hw * 1.05 : td * 0.5, f = front ? hw * 1.95 : td * 1.2;
      c.moveTo(-w, belt); c.lineTo(w, belt); c.lineTo(f, hipY + Lg * 0.42); c.lineTo(-f, hipY + Lg * 0.42);
    } else if (front) {
      c.moveTo(-hw * 1.08, belt); c.lineTo(hw * 1.08, belt); c.lineTo(hw * 1.0, hipY + Lg * 0.14); c.lineTo(-hw * 1.0, hipY + Lg * 0.14);
    } else {
      c.moveTo(-td * 0.48, belt); c.lineTo(td * 0.48, belt); c.lineTo(td * 0.46, hipY + Lg * 0.1); c.lineTo(-td * 0.46, hipY + Lg * 0.1);
    }
    c.closePath();
  };
  const drawTorso = () => {
    if (L.stick) { bone(0, hipY, neck[0], neck[1]); return; }
    if (front) paint(torsoFront, col(d.top), H * 0.03, sw * 0.1);
    else paint(taper(0, hipY, td * 0.46, neck[0], shY, td * 0.5), col(d.top), 0, td * 0.12);
    paint(bottomShape, col(d.bottom), H * 0.012, hw * 0.2);
  };

  const drawLaptop = () => {
    const ty = -H * 0.4;
    paint(() => { c.beginPath(); c.rect(-H * 0.3, ty, H * 0.6, H * 0.025); }, col("#8a6a4a"), 0, 0);
    c.fillStyle = col("#7a5c3e");
    c.fillRect(-H * 0.27, ty, H * 0.02, -ty); c.fillRect(H * 0.25, ty, H * 0.02, -ty);
    paint(() => { c.beginPath(); c.rect(-H * 0.17, ty - H * 0.22, H * 0.34, H * 0.21); }, col("#c9ccd3"), 0, 0);
    paint(circ(0, ty - H * 0.115, H * 0.018), col("#9a9ea8"), 0, 0);
  };

  // ---------- head ----------
  const headPath = () => {
    c.beginPath(); c.moveTo(-hr, -hr * 0.1);
    c.bezierCurveTo(-hr, -hr * 1.25, hr, -hr * 1.25, hr, -hr * 0.1);
    c.bezierCurveTo(hr, hr * 0.75, hr * 0.45, hr * 1.05, 0, hr * 1.05);
    c.bezierCurveTo(-hr * 0.45, hr * 1.05, -hr, hr * 0.75, -hr, -hr * 0.1);
    c.closePath();
  };
  const sideHeadPath = () => {
    c.beginPath(); c.moveTo(-hr * 0.95, -hr * 0.1);
    c.bezierCurveTo(-hr * 0.95, -hr * 1.25, hr * 0.95, -hr * 1.25, hr * 0.98, -hr * 0.2);
    c.lineTo(hr * 1.0, hr * 0.05);
    c.quadraticCurveTo(hr * 1.28, hr * 0.25, hr * 1.0, hr * 0.38);
    c.quadraticCurveTo(hr * 1.02, hr * 0.6, hr * 0.92, hr * 0.72);
    c.bezierCurveTo(hr * 0.8, hr * 1.05, hr * 0.1, hr * 1.1, -hr * 0.35, hr * 0.95);
    c.bezierCurveTo(-hr * 0.8, hr * 0.8, -hr * 0.95, hr * 0.5, -hr * 0.95, -hr * 0.1);
    c.closePath();
  };
  const cap = () => {
    c.beginPath(); c.moveTo(-hr * 1.04, hr * 0.05);
    c.bezierCurveTo(-hr * 1.25, -hr * 1.5, hr * 1.25, -hr * 1.5, hr * 1.04, hr * 0.05);
    c.quadraticCurveTo(hr * 0.95, -hr * 0.35, hr * 0.5, -hr * 0.52);
    c.quadraticCurveTo(0, -hr * 0.35, -hr * 0.45, -hr * 0.55);
    c.quadraticCurveTo(-hr * 0.95, -hr * 0.4, -hr * 1.04, hr * 0.05);
    c.closePath();
  };
  const sideHair = () => {
    c.beginPath(); c.moveTo(hr * 0.92, -hr * 0.3);
    c.bezierCurveTo(hr * 0.8, -hr * 1.5, -hr * 1.2, -hr * 1.5, -hr * 1.08, hr * 0.2);
    c.lineTo(-hr * 0.6, hr * 0.1);
    c.quadraticCurveTo(-hr * 0.1, -hr * 0.7, hr * 0.92, -hr * 0.3);
    c.closePath();
  };
  const longBack = () => {
    c.beginPath(); c.moveTo(-hr * 1.12, -hr * 0.3);
    c.bezierCurveTo(-hr * 1.55, hr * 1.2, -hr * 1.35, hr * 2.3, -hr * 0.7, hr * 2.2);
    c.lineTo(hr * 0.7, hr * 2.2);
    c.bezierCurveTo(hr * 1.35, hr * 2.3, hr * 1.55, hr * 1.2, hr * 1.12, -hr * 0.3);
    c.closePath();
  };
  const longBackSide = () => {
    c.beginPath(); c.moveTo(-hr * 0.4, -hr * 1.0);
    c.bezierCurveTo(-hr * 1.7, -hr * 0.6, -hr * 1.5, hr * 2.3, -hr * 0.7, hr * 2.1);
    c.lineTo(-hr * 0.3, hr * 0.9);
    c.closePath();
  };
  const spikes = () => {
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = Math.PI * (1.08 + k * 0.17);
      c.lineTo(Math.cos(a) * hr * 1.02, -hr * 0.05 + Math.sin(a) * hr * 1.0);
      c.lineTo(Math.cos(a + 0.12) * hr * 1.5, -hr * 0.05 + Math.sin(a + 0.12) * hr * 1.55);
    }
    c.closePath();
  };
  const topExtras = (bunX: number, bunY: number) => {
    if (d.hairStyle === "bun") paint(circ(bunX, bunY, hr * 0.42), hairC, 0, hr * 0.1);
    if (d.hairStyle === "spiky") paint(spikes, hairC, 0, hr * 0.1);
  };

  const eye = (ex: number, ey: number, ws: number, bias: number) => {
    const open = 1 - cl(p.blink, 0, 1);
    const sur = expr === "surprised" ? 1.25 : 1;
    const ix = cl(p.eyeX + bias, -1, 1), iy = cl(p.eyeY, -1, 1);
    if (L.eyeKind === "dot") {
      c.fillStyle = ink; c.beginPath();
      c.ellipse(ex + ix * hr * 0.05, ey + iy * hr * 0.04, hr * 0.075 * sur * ws, Math.max(0.012 * hr, hr * 0.085 * sur * open), 0, 0, TAU);
      c.fill(); return;
    }
    const anime = L.eyeKind === "anime";
    const rx = hr * (anime ? 0.2 : 0.17) * sur * ws;
    const ry = hr * (anime ? 0.27 : 0.19) * sur * Math.max(0.08, open);
    if (expr === "happy") {
      c.beginPath(); c.arc(ex, ey + hr * 0.07, rx * 0.9, Math.PI * 1.1, Math.PI * 1.9);
      c.strokeStyle = ink; c.lineWidth = hr * 0.07; c.stroke(); return;
    }
    const ep = () => { c.beginPath(); c.ellipse(ex, ey, rx, ry, 0, 0, TAU); };
    ep(); c.fillStyle = "#fff"; c.fill();
    c.save(); ep(); c.clip();
    const ir = Math.min(rx * 0.85, hr * (anime ? 0.2 : 0.14));
    const icx = ex + ix * (rx - ir) * 0.9, icy = ey + iy * Math.max(0, ry - ir * 0.6) * 0.8;
    c.beginPath(); c.arc(icx, icy, ir, 0, TAU); c.fillStyle = eyeC; c.fill();
    c.beginPath(); c.arc(icx, icy, ir * 0.5, 0, TAU); c.fillStyle = "#14101c"; c.fill();
    c.beginPath(); c.arc(icx - ir * 0.3, icy - ir * 0.35, ir * 0.28, 0, TAU); c.fillStyle = "#fff"; c.fill();
    c.restore();
    ep(); c.strokeStyle = ink; c.lineWidth = hr * (anime ? 0.05 : 0.035); c.stroke();
    if (anime) {
      c.beginPath(); c.ellipse(ex, ey, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
      c.lineWidth = hr * 0.09; c.stroke();
    }
  };

  const brow = (ex: number, s: number) => {
    const oy = expr === "angry" ? -0.08 : expr === "sad" ? 0.06 : expr === "surprised" ? -0.2 : expr === "happy" ? -0.06 : 0;
    const iy = expr === "angry" ? 0.1 : expr === "sad" ? -0.14 : expr === "surprised" ? -0.2 : expr === "happy" ? -0.06 : 0;
    const by = -hr * 0.28;
    c.beginPath(); c.moveTo(ex + s * hr * 0.2, by + oy * hr); c.lineTo(ex - s * hr * 0.2, by + iy * hr);
    c.strokeStyle = L.mono || L.stick ? ink : dk(d.hair, 0.75);
    c.lineWidth = hr * (L.eyeKind === "anime" ? 0.05 : 0.075); c.stroke();
  };

  const mouth = (mx: number, my: number, ms: number) => {
    const open = Math.max(p.mouth, expr === "surprised" ? 0.5 : 0);
    const w1 = hr * ms;
    c.strokeStyle = ink; c.lineWidth = hr * 0.06;
    if (open > 0.1) {
      const mw = w1 * 0.24, mh = hr * (0.05 + 0.24 * open);
      const mp = () => {
        c.beginPath(); c.moveTo(mx - mw, my);
        c.quadraticCurveTo(mx, my + mh * 2.2, mx + mw, my);
        c.quadraticCurveTo(mx, my - mh * 0.3, mx - mw, my);
        c.closePath();
      };
      c.save(); mp(); c.clip();
      c.fillStyle = "#4a1f2a"; c.fillRect(mx - mw, my - hr, mw * 2, hr * 2);
      c.fillStyle = "#e8788a"; c.beginPath(); c.ellipse(mx, my + mh * 1.5, mw * 0.6, mh * 0.7, 0, 0, TAU); c.fill();
      if (open > 0.3) { c.fillStyle = "#fff"; c.fillRect(mx - mw, my - 1, mw * 2, hr * 0.08); }
      c.restore(); mp(); c.stroke(); return;
    }
    c.beginPath();
    if (expr === "happy") c.arc(mx, my - hr * 0.1, w1 * 0.28, Math.PI * 0.12, Math.PI * 0.88);
    else if (expr === "sad") c.arc(mx, my + hr * 0.22, w1 * 0.22, Math.PI * 1.15, Math.PI * 1.85);
    else if (expr === "angry") { c.moveTo(mx - w1 * 0.2, my + hr * 0.04); c.quadraticCurveTo(mx, my - hr * 0.06, mx + w1 * 0.2, my + hr * 0.04); }
    else { c.moveTo(mx - w1 * 0.15, my); c.quadraticCurveTo(mx, my + hr * 0.05, mx + w1 * 0.15, my); }
    c.stroke();
  };

  const stickHead = () => {
    c.beginPath(); c.arc(0, 0, hr * 1.05, 0, TAU);
    c.fillStyle = "#fff"; c.fill(); c.strokeStyle = ink; c.lineWidth = 4; c.stroke();
  };

  const headFront = () => {
    const sc = C(p.yaw * D), fx = S(p.yaw * D) * hr * 0.5, py = p.pitch * hr * 0.012;
    const hairOn = !L.stick && d.hairStyle !== "none";
    if (hairOn && d.hairStyle === "long") paint(longBack, hairC, 0, hr * 0.1);
    if (L.stick) stickHead();
    else {
      paint(circ(-hr * 0.98, hr * 0.1, hr * 0.2), skinC, 0, 0);
      paint(circ(hr * 0.98, hr * 0.1, hr * 0.2), skinC, 0, 0);
      paint(headPath, skinC, 0, hr * 0.16);
    }
    c.save(); c.translate(fx, py);
    if (!L.stick && !L.mono) {
      c.fillStyle = "rgba(255,110,120,0.22)";
      for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * hr * 0.62 * sc, hr * 0.36, hr * 0.17, hr * 0.1, 0, 0, TAU); c.fill(); }
    }
    const ex = hr * 0.42 * sc;
    eye(-ex, hr * 0.05, 1, 0); eye(ex, hr * 0.05, 1, 0);
    brow(-ex, -1); brow(ex, 1);
    if (!L.stick) {
      c.strokeStyle = L.mono ? ink : dk(d.skin, 0.7); c.lineWidth = hr * 0.05; c.beginPath();
      if (L.eyeKind === "dot") { c.moveTo(hr * 0.02, hr * 0.12); c.lineTo(-hr * 0.05, hr * 0.32); c.lineTo(hr * 0.07, hr * 0.32); }
      else c.arc(S(p.yaw * D) * hr * 0.15, hr * 0.3, hr * (L.eyeKind === "anime" ? 0.045 : 0.07), Math.PI * 0.15, Math.PI * 0.85);
      c.stroke();
    }
    mouth(0, hr * 0.55, 1);
    c.restore();
    if (hairOn) {
      c.save(); c.translate(fx * 0.25, 0);
      topExtras(0, -hr * 1.4);
      paint(cap, hairC, 0, hr * 0.12);
      c.restore();
    }
  };

  const headBack = () => {
    if (L.stick) { stickHead(); return; }
    const hairOn = d.hairStyle !== "none";
    if (hairOn && d.hairStyle === "long") paint(longBack, hairC, 0, hr * 0.1);
    paint(circ(-hr * 0.98, hr * 0.1, hr * 0.2), skinC, 0, 0);
    paint(circ(hr * 0.98, hr * 0.1, hr * 0.2), skinC, 0, 0);
    paint(headPath, hairOn ? hairC : skinC, 0, hr * 0.16);
    if (hairOn) topExtras(0, -hr * 1.4);
  };

  const headSide = () => {
    if (L.stick) {
      stickHead();
      c.fillStyle = ink; c.beginPath(); c.arc(hr * 0.5, -hr * 0.05, hr * 0.08, 0, TAU); c.fill();
      return;
    }
    const hairOn = d.hairStyle !== "none";
    if (hairOn && d.hairStyle === "long") paint(longBackSide, hairC, 0, hr * 0.1);
    paint(sideHeadPath, skinC, 0, hr * 0.14);
    paint(ell(-hr * 0.18, hr * 0.15, hr * 0.2, hr * 0.26), skinC, 0, 0);
    eye(hr * 0.52, hr * 0.02, 0.7, 0.6);
    brow(hr * 0.52, 1);
    mouth(hr * 0.78, hr * 0.58, 0.55);
    if (hairOn) { topExtras(-hr * 0.55, -hr * 1.25); paint(sideHair, hairC, 0, hr * 0.12); }
  };

  // ---------- draw order ----------
  if (front) {
    leg(-1, p.lLU, p.lLB, false); leg(1, p.lRU, p.lRB, false);
    drawTorso();
    arm(-1, p.aLU, p.aLB, false); arm(1, p.aRU, p.aRB, false);
    if (o.prop === "laptop") drawLaptop();
  } else {
    arm(-1, p.aLU, p.aLB, true); leg(-1, p.lLU, p.lLB, true);
    drawTorso();
    leg(1, p.lRU, p.lRB, false); arm(1, p.aRU, p.aRB, false);
  }

  seg(neck[0], shY + tor * 0.02, hr * 0.3, neck[0], neck[1] - hr * 0.35, hr * 0.27, d.skin, 15);
  c.save();
  c.translate(neck[0], neck[1] - hr * 0.2);
  c.rotate(p.tilt * D);
  c.translate(0, -hr * 0.85);
  if (o.view === "front") headFront(); else if (o.view === "back") headBack(); else headSide();
  c.restore();

  c.restore();
}
