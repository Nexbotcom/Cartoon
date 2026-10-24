import { CharacterDef, ClipId, MouthParams, PartKey, Pose, RigData, RigParams, RigPart, SpriteKey, View } from "./types";

const D = Math.PI / 180, TAU = Math.PI * 2;

export interface SpriteState { x: number; face: number; view: View; clip: ClipId; pose: Pose; say?: string }
export interface Slice { url: string; w: number; h: number }

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });

// ---------------- runtime drawing ----------------
const cache = new Map<string, HTMLImageElement>();

function getImg(src: string): HTMLImageElement | null {
  let im = cache.get(src);
  if (!im) {
    im = new Image();
    im.onload = () => window.dispatchEvent(new Event("toon-sprite"));
    im.src = src;
    cache.set(src, im);
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}

function drawRig(c: CanvasRenderingContext2D, d: CharacterDef, st: SpriteState, t: number, footY: number, scale: number) {
  const sp = d.sprite;
  const rig = sp?.rig;
  if (!sp || !rig) return;
  const keys = Object.keys(rig.parts) as PartKey[];
  const im = {} as Record<PartKey, HTMLImageElement>;
  for (const k of keys) {
    const i = getImg(rig.parts[k].url);
    if (!i) return;           // still loading: next frame will draw it
    im[k] = i;
  }
  const p = st.pose;
  const walking = st.view === "side" || st.clip === "walk";
  const ak = walking ? 0.4 : 1;          // calmer arm swing while walking
  const swing = walking ? 0.15 : 1;
  const k = (d.height / sp.refH) * scale;

  // origin = joint, then draw the part so it sits at its rest position
  const part = (key: PartKey) => { const q = rig.parts[key]; c.drawImage(im[key], q.ox - q.jx, q.oy - q.jy, q.w, q.h); };
  const arm = (U: PartKey, L: PartKey, s: number, aU: number, aB: number) => {
    const u = rig.parts[U], l = rig.parts[L];
    c.save(); c.translate(u.jx, u.jy); c.rotate(s * aU * D); part(U);
    c.translate(l.jx - u.jx, l.jy - u.jy); c.rotate(s * aB * D); part(L);
    c.restore();
  };
  const leg = (U: PartKey, L: PartKey, s: number, aU: number, lift: number) => {
    const u = rig.parts[U], l = rig.parts[L];
    c.save(); c.translate(u.jx, u.jy); c.rotate(s * aU * D); c.scale(1, 1 - lift); part(U);
    c.translate(l.jx - u.jx, l.jy - u.jy); part(L);
    c.restore();
  };

  c.fillStyle = "rgba(0,0,0,0.16)";
  c.beginPath(); c.ellipse(st.x, footY, Math.max(30, rig.W * k * 0.35), 9 * scale, 0, 0, TAU); c.fill();

  c.save();
  c.translate(st.x, footY + p.bob * scale);
  c.scale(k, k);
  c.translate(-rig.W / 2, -rig.H);

  leg("legLU", "legLL", 1, (p.lLU - 3) * swing, Math.min(0.2, Math.max(0, p.lLB) * 0.0035));
  leg("legRU", "legRL", -1, (p.lRU - 3) * swing, Math.min(0.2, Math.max(0, p.lRB) * 0.0035));

  const tq = rig.parts.torso;
  c.save();
  c.translate(tq.jx, tq.jy);
  c.rotate((walking ? Math.sin(t * 7) * 1.5 : p.tilt * 0.3) * D);
  c.translate(-tq.jx, -tq.jy);
  c.drawImage(im.torso, tq.ox, tq.oy, tq.w, tq.h);
  arm("armLU", "armLL", 1, (p.aLU - 6) * ak, (p.aLB - 8) * ak);
  arm("armRU", "armRL", -1, (p.aRU - 6) * ak, (p.aRB - 8) * ak);

  const hq = rig.parts.head;
  c.save();
  c.translate(hq.jx, hq.jy);
  c.rotate((p.tilt * 0.8 + p.yaw * 0.12) * D);
  c.translate(p.yaw * hq.w * 0.003, 0);
  c.scale(Math.cos(p.yaw * D * 0.8), 1 - Math.abs(p.pitch) * 0.0012);
  c.drawImage(im.head, hq.ox - hq.jx, hq.oy - hq.jy, hq.w, hq.h);
  if (rig.mouth && p.mouth > 0.12) {
    const m = rig.mouth;
    c.fillStyle = "#4a1f2a";
    c.beginPath();
    c.ellipse(m.x - hq.jx, m.y - hq.jy, m.w / 2, Math.max(1.5, (m.w / 2) * p.mouth), 0, 0, TAU);
    c.fill();
  }
  c.restore();   // head
  c.restore();   // torso group
  c.restore();   // root
}

export function drawSprite(
  c: CanvasRenderingContext2D, d: CharacterDef, st: SpriteState, t: number, footY: number, scale: number
) {
  const sp = d.sprite;
  if (!sp) return;

  // cut-out rig: used for the front view, and for walking when "walk facing the camera" is on
  if (sp.rig && sp.views.front && st.view !== "back" && (st.view !== "side" || sp.walkFront !== false)) {
    drawRig(c, d, st, t, footY, scale);
    return;
  }

  const p = st.pose;
  let key: SpriteKey = "front", mirror = false;
  if (st.view === "side" && sp.views.side) { key = "side"; mirror = (st.face > 0) !== sp.sideRight; }
  else if (st.view === "back" && sp.views.back) key = "back";
  else if (st.view === "front" && Math.abs(p.yaw) > 14 && sp.views.threeq) { key = "threeq"; mirror = (p.yaw > 0) !== sp.threeqRight; }
  const src = sp.views[key] ?? sp.views.front;
  if (!src) return;
  const img = getImg(src);
  if (!img) return;

  const k = (d.height / sp.refH) * scale;
  const w = img.naturalWidth * k, h = img.naturalHeight * k;

  let rot = p.tilt * 0.5, sy = 1, dy = p.bob * scale + p.pitch * 0.4;
  if (st.view === "side") { rot += Math.sin(t * 7) * 2.5; sy += Math.sin(t * 14) * 0.015; }
  if (st.clip === "wave") rot += Math.sin(t * 10) * 3;
  if (st.clip === "shrug") sy -= 0.03;
  if (st.clip === "jump") sy += Math.max(0, -p.bob / 55) * 0.06;
  if (st.say) sy += Math.sin(t * 11) * 0.008;

  c.fillStyle = "rgba(0,0,0,0.16)";
  c.beginPath(); c.ellipse(st.x, footY, Math.max(30, w * 0.4), 9 * scale, 0, 0, TAU); c.fill();

  c.save();
  c.translate(st.x, footY + dy);
  c.rotate(rot * D);
  c.scale(mirror ? -1 : 1, sy);
  c.drawImage(img, -w / 2, -h, w, h);
  c.restore();
}

// ---------------- import: background removal, slicing, cropping ----------------
function floodRemove(img: ImageData, tol: number) {
  const { data, width: w, height: h } = img;
  let r = 0, g = 0, b = 0;
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
    const i = (y * w + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2];
  }
  r /= 4; g /= 4; b /= 4;
  const dist = (i: number) => Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b);

  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (!seen[p] && dist(p * 4) <= tol) { seen[p] = 1; stack.push(p); }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop() as number;
    data[p * 4 + 3] = 0;
    const x = p % w, y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  const alpha = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = data[p * 4 + 3];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    if (alpha[p] === 0) continue;
    if (alpha[p - 1] === 0 || alpha[p + 1] === 0 || alpha[p - w] === 0 || alpha[p + w] === 0) data[p * 4 + 3] = 170;
  }
}

export function sliceSheet(img: HTMLImageElement, cols: number, tol: number, removeBg: boolean): Slice[] {
  const W0 = img.naturalWidth, H0 = img.naturalHeight, sw = Math.max(1, Math.floor(W0 / cols));
  const crops: HTMLCanvasElement[] = [];

  for (let i = 0; i < cols; i++) {
    const cv = document.createElement("canvas");
    cv.width = sw; cv.height = H0;
    const cx = cv.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
    cx.drawImage(img, i * sw, 0, sw, H0, 0, 0, sw, H0);
    const data = cx.getImageData(0, 0, sw, H0);
    if (removeBg) floodRemove(data, tol);
    cx.putImageData(data, 0, 0);

    let x0 = sw, y0 = H0, x1 = -1, y1 = -1;
    for (let y = 0; y < H0; y++) for (let x = 0; x < sw; x++) {
      if (data.data[(y * sw + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    const out = document.createElement("canvas");
    if (x1 < 0) { out.width = 2; out.height = 2; crops.push(out); continue; }
    const pad = 3;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(sw - 1, x1 + pad); y1 = Math.min(H0 - 1, y1 + pad);
    out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    (out.getContext("2d") as CanvasRenderingContext2D).drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    crops.push(out);
  }

  const maxH = Math.max(...crops.map(cv => cv.height));
  const k = Math.min(1, 900 / maxH);
  return crops.map(cv => {
    const o = document.createElement("canvas");
    o.width = Math.max(1, Math.round(cv.width * k)); o.height = Math.max(1, Math.round(cv.height * k));
    const ox = o.getContext("2d") as CanvasRenderingContext2D;
    ox.imageSmoothingQuality = "high";
    ox.drawImage(cv, 0, 0, o.width, o.height);
    return { url: o.toDataURL("image/png"), w: o.width, h: o.height };
  });
}

// ---------------- cut-out rig: guess the cut lines from the silhouette ----------------
export async function autoRig(url: string): Promise<{ rig: RigParams; mouth: MouthParams }> {
  const im = await loadImage(url);
  const w = im.naturalWidth, h = im.naturalHeight;
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const cx = cv.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  cx.drawImage(im, 0, 0);
  const a = cx.getImageData(0, 0, w, h).data;

  const runs = (y: number): [number, number][] => {
    const out: [number, number][] = [];
    let s = -1;
    for (let x = 0; x < w; x++) {
      const on = a[(y * w + x) * 4 + 3] > 40;
      if (on && s < 0) s = x;
      if (!on && s >= 0) { if (x - s > 2) out.push([s, x - 1]); s = -1; }
    }
    if (s >= 0) out.push([s, w - 1]);
    return out;
  };
  const extent = (y: number) => { const r = runs(y); return r.length ? r[r.length - 1][1] - r[0][0] : 0; };

  // neck = narrowest row in the upper part of the figure
  let neckPx = h * 0.16, best = 1e9;
  for (let y = Math.floor(h * 0.08); y < h * 0.26; y++) {
    const e = extent(y);
    if (e > 0 && e < best) { best = e; neckPx = y; }
  }

  // crotch = first row where a gap opens near the middle (the space between the legs)
  let hipPx = h * 0.5, midX = w / 2;
  outer: for (let y = Math.floor(h * 0.42); y < h * 0.72; y++) {
    const r = runs(y);
    for (let i = 0; i < r.length - 1; i++) {
      const gm = (r[i][1] + r[i + 1][0]) / 2;
      if (gm > w * 0.35 && gm < w * 0.65 && r[i + 1][0] - r[i][1] > 3) {
        const r2 = runs(Math.min(h - 1, y + 12));
        if (r2.some((q, j) => j < r2.length - 1 && Math.abs((q[1] + r2[j + 1][0]) / 2 - gm) < w * 0.06)) {
          hipPx = y - h * 0.025; midX = gm; break outer;
        }
      }
    }
  }

  // arms = outer runs on a mid-torso row (when the arms hang apart from the body)
  const rowMid = Math.floor(neckPx + (hipPx - neckPx) * 0.4);
  const r = runs(rowMid);
  let lc: number, rc: number;
  if (r.length >= 3) { lc = (r[0][1] + r[1][0]) / 2; rc = (r[r.length - 2][1] + r[r.length - 1][0]) / 2; }
  else if (r.length >= 1) { const x0 = r[0][0], x1 = r[r.length - 1][1]; lc = x0 + (x1 - x0) * 0.2; rc = x1 - (x1 - x0) * 0.2; }
  else { lc = w * 0.3; rc = w * 0.7; }

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const hipY = clamp(hipPx / h, 0.35, 0.65), neckY = clamp(neckPx / h, 0.05, 0.3);
  const shoulderY = neckY + 0.035, armEndY = Math.min(0.75, hipY + 0.05);

  const hr = runs(Math.floor(neckPx * 0.55));
  const he: [number, number] = hr.length ? [hr[0][0], hr[hr.length - 1][1]] : [w * 0.3, w * 0.7];

  return {
    rig: { neckY, shoulderY, elbowY: (shoulderY + armEndY) / 2, armEndY, hipY, kneeY: hipY + (1 - hipY) * 0.5, lc: lc / w, rc: rc / w, cx: midX / w },
    mouth: { x: (he[0] + he[1]) / 2 / w, y: (neckPx * 0.8) / h, w: ((he[1] - he[0]) * 0.2) / w },
  };
}

// ---------------- cut-out rig: cut the front picture into parts ----------------
export async function buildRig(url: string, p: RigParams, mouth: MouthParams): Promise<RigData> {
  const im = await loadImage(url);
  const W = im.naturalWidth, H = im.naturalHeight;
  const src = document.createElement("canvas"); src.width = W; src.height = H;
  const sx = src.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  sx.drawImage(im, 0, 0);
  const data = sx.getImageData(0, 0, W, H).data;

  const OV = 0.012;   // overlap so no gaps open at the joints
  const { lc, rc } = p;
  const rules: Record<PartKey, (nx: number, ny: number) => boolean> = {
    head: (nx, ny) => ny < p.neckY + OV,
    torso: (nx, ny) => ny >= p.neckY && ny < p.hipY + OV && ((nx >= lc && nx < rc) || ny < p.shoulderY || ny >= p.armEndY),
    armLU: (nx, ny) => nx < lc && ny >= p.shoulderY && ny < Math.min(p.elbowY + OV, p.armEndY),
    armLL: (nx, ny) => nx < lc && ny >= p.elbowY && ny < p.armEndY,
    armRU: (nx, ny) => nx >= rc && ny >= p.shoulderY && ny < Math.min(p.elbowY + OV, p.armEndY),
    armRL: (nx, ny) => nx >= rc && ny >= p.elbowY && ny < p.armEndY,
    legLU: (nx, ny) => ny >= p.hipY && ny < p.kneeY + OV && nx < p.cx && !(nx < lc && ny < p.armEndY),
    legLL: (nx, ny) => ny >= p.kneeY && nx < p.cx && !(nx < lc && ny < p.armEndY),
    legRU: (nx, ny) => ny >= p.hipY && ny < p.kneeY + OV && nx >= p.cx && !(nx >= rc && ny < p.armEndY),
    legRL: (nx, ny) => ny >= p.kneeY && nx >= p.cx && !(nx >= rc && ny < p.armEndY),
  };

  const parts = {} as Record<PartKey, RigPart>;
  for (const key of Object.keys(rules) as PartKey[]) {
    const f = rules[key];
    const out = new ImageData(W, H);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      const ny = y / H;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (data[i + 3] === 0 || !f(x / W, ny)) continue;
        out.data[i] = data[i]; out.data[i + 1] = data[i + 1]; out.data[i + 2] = data[i + 2]; out.data[i + 3] = data[i + 3];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const full = document.createElement("canvas"); full.width = W; full.height = H;
    (full.getContext("2d") as CanvasRenderingContext2D).putImageData(out, 0, 0);
    const crop = document.createElement("canvas"); crop.width = bw; crop.height = bh;
    (crop.getContext("2d") as CanvasRenderingContext2D).drawImage(full, x0, y0, bw, bh, 0, 0, bw, bh);

    // joint position (in the original picture's pixels)
    let jx = x0 + bw / 2, jy = y0 + 0.01 * H;
    if (key === "head") jy = p.neckY * H;
    else if (key === "torso") { jx = p.cx * W; jy = p.hipY * H; }
    else if (key === "armLL" || key === "armRL") jy = p.elbowY * H;
    else if (key === "legLL" || key === "legRL") jy = p.kneeY * H;
    parts[key] = { url: crop.toDataURL("image/png"), ox: x0, oy: y0, w: bw, h: bh, jx, jy };
  }

  return { W, H, parts, mouth: { x: mouth.x * W, y: mouth.y * H, w: mouth.w * W } };
}
