import { CharacterDef, ClipId, Expr, Pose } from "./types";
const S = Math.sin, D = Math.PI / 180;

export const BASE: Pose = { armL: 5, armR: -5, legL: 0, legR: 0, head: 0, bob: 0, mouth: 0 };

// angle 0 = hanging down, + = forward, 180 = straight up
export const clips: Record<ClipId, (t: number) => Partial<Pose>> = {
  idle: t => ({ bob: S(t * 2) * 1.5, armL: 6 + S(t * 2) * 2, armR: -6 - S(t * 2) * 2 }),
  walk: t => ({ legL: S(t * 7) * 28, legR: -S(t * 7) * 28, armL: -S(t * 7) * 25, armR: S(t * 7) * 25, bob: -Math.abs(S(t * 7)) * 4 }),
  wave: t => ({ armR: 150 + S(t * 10) * 18, head: S(t * 3) * 3 }),
  talk: t => ({ armL: 20 + S(t * 3) * 8, armR: -20 - S(t * 3.4) * 8, head: S(t * 3) * 3 }),
  type: t => ({ armL: 55 + S(t * 14) * 5, armR: 60 + S(t * 14 + 1.5) * 5, head: 6 }),
  jump: t => ({ bob: -Math.abs(S(t * 5)) * 45, armL: -160, armR: 160, legL: 12, legR: -12 }),
};

const STYLES = {
  stick:  { line: "#111", w: 4,   fill: false, mono: false, headK: 0.13,  legW: 0,     armW: 0,     torsoW: 0 },
  flat:   { line: "",     w: 0,   fill: true,  mono: false, headK: 0.12,  legW: 0.07,  armW: 0.05,  torsoW: 0.18 },
  anime:  { line: "#3a3340", w: 1.6, fill: true, mono: false, headK: 0.095, legW: 0.055, armW: 0.04, torsoW: 0.14 },
  sketch: { line: "#111", w: 2.5, fill: true,  mono: true,  headK: 0.12,  legW: 0.06,  armW: 0.045, torsoW: 0.16 },
} as const;

export function drawActor(
  c: CanvasRenderingContext2D, d: CharacterDef, p: Pose, expr: Expr,
  x: number, gy: number, face: number, seed: number, prop?: "laptop"
) {
  const st = STYLES[d.style], H = d.height;
  const legLen = H * 0.4, torso = H * 0.3, armLen = H * 0.28, hr = H * st.headK;
  const hipY = -legLen, neckY = hipY - torso, shY = neckY + torso * 0.1;
  const ink = st.line || "#222";
  const col = (k: string) => (st.mono ? "#fff" : k);
  const wob = d.style === "sketch" ? 1.4 : 0;
  const B = d.build ?? 1;
  const j = (n: number) => (wob ? Math.sin(seed * 13.1 + n * 7.7) * wob : 0);

  c.save();
  c.translate(x, gy + p.bob);
  c.scale(face, 1);
  c.lineCap = "round"; c.lineJoin = "round";

  const limb = (x0: number, y0: number, a: number, len: number, w: number, color: string, n: number) => {
    const ex = x0 + Math.sin(a * D) * len + j(n), ey = y0 + Math.cos(a * D) * len + j(n + 1);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(ex, ey);
    if (!st.fill) { c.strokeStyle = ink; c.lineWidth = st.w; c.stroke(); return [ex, ey]; }
    if (st.line) { c.strokeStyle = st.line; c.lineWidth = w + st.w * 2; c.stroke(); }
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(ex, ey);
    c.strokeStyle = col(color); c.lineWidth = w; c.stroke();
    return [ex, ey];
  };
  const blob = (bx: number, by: number, rx: number, ry: number, color: string) => {
    c.beginPath(); c.ellipse(bx, by, rx, ry, 0, 0, 7);
    if (st.fill) { c.fillStyle = col(color); c.fill(); }
    if (st.line || !st.fill) { c.strokeStyle = ink; c.lineWidth = st.w || 3; c.stroke(); }
  };
  const leg = (a: number, n: number) => {
  const bare = d.outfit !== "pants";
  const [ex, ey] = limb(0, hipY, a, legLen, H * st.legW * B, bare ? d.skin : d.bottom, n);
  if (d.outfit === "shorts") limb(0, hipY, a, legLen * 0.4, H * st.legW * B * 1.1, d.bottom, n + 20);
  blob(ex + hr * 0.4, ey, hr * 0.6, hr * 0.28, d.shoes);
};
  const arm = (a: number, n: number) => {
    const [ex, ey] = limb(0, shY, a, armLen, H * st.armW, d.top, n);
    blob(ex, ey, hr * 0.28, hr * 0.28, d.skin);
  };

  arm(p.armL, 1);              // back arm
  leg(p.legL, 3);              // back leg
  limb(0, hipY, 180, torso, H * st.torsoW, d.top, 5);
  leg(p.legR, 7);              // front leg

  // head
  c.save(); c.translate(0, neckY); c.rotate(p.head * D);
  const hy = -hr * 0.9;
  if (d.hairStyle === "long" && d.style !== "stick") blob(-hr * 0.2, hy + hr * 0.3, hr * 1.1, hr * 1.3, st.mono ? "#bbb" : d.hair);
  blob(0, hy, hr, hr * 1.05, d.skin);
  if (d.style !== "stick" && d.hairStyle !== "none") {
    c.beginPath(); c.arc(0, hy, hr * 1.06, Math.PI * 1.03, Math.PI * 1.97); c.closePath();
    c.fillStyle = st.mono ? "#bbb" : d.hair; c.fill();
    if (st.line) { c.strokeStyle = st.line; c.lineWidth = st.w; c.stroke(); }
    if (d.hairStyle === "bun") blob(0, hy - hr * 1.15, hr * 0.38, hr * 0.38, st.mono ? "#bbb" : d.hair);
  }
  // face
  const fx = hr * 0.15, ey = hy - hr * 0.05, my = hy + hr * 0.5;
  c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = Math.max(2, hr * 0.06);
  for (const s of [-1, 1]) {
    const ex = fx + s * hr * 0.4;
    if (expr === "happy") { c.beginPath(); c.arc(ex, ey + hr * 0.08, hr * 0.13, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    else { c.beginPath(); c.arc(ex, ey, hr * (expr === "surprised" ? 0.15 : 0.09), 0, 7); c.fill(); }
    if (expr === "angry" || expr === "sad") {
      const outer = expr === "angry" ? -0.3 : -0.14, inner = expr === "angry" ? -0.14 : -0.3;
      c.beginPath(); c.moveTo(ex + s * hr * 0.16, ey + hr * outer); c.lineTo(ex - s * hr * 0.16, ey + hr * inner); c.stroke();
    }
  }
  c.beginPath();
  if (p.mouth > 0.15 || expr === "surprised") { c.ellipse(fx, my, hr * 0.17, hr * (0.05 + p.mouth * 0.2 + (expr === "surprised" ? 0.1 : 0)), 0, 0, 7); c.fill(); }
  else if (expr === "happy") c.arc(fx, my - hr * 0.1, hr * 0.24, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (expr === "sad") c.arc(fx, my + hr * 0.2, hr * 0.2, 1.15 * Math.PI, 1.85 * Math.PI);
  else { c.moveTo(fx - hr * 0.15, my); c.lineTo(fx + hr * 0.15, my); }
  if (!(p.mouth > 0.15)) c.stroke();
  c.restore();

  if (prop === "laptop") {
    const ty = hipY - H * 0.08;
    c.strokeStyle = "#555"; c.lineWidth = 5;
    c.beginPath(); c.moveTo(H * 0.2, ty); c.lineTo(H * 0.55, ty); c.moveTo(H * 0.38, ty); c.lineTo(H * 0.38, gy - p.bob); c.stroke();
    c.strokeStyle = "#222"; c.lineWidth = 6;
    c.beginPath(); c.moveTo(H * 0.25, ty - 3); c.lineTo(H * 0.42, ty - 3); c.lineTo(H * 0.5, ty - H * 0.18); c.stroke();
  }
  arm(p.armR, 9);              // front arm
  c.restore();
    }
