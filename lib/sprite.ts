import { CharacterDef, ClipId, Pose, SpriteKey, View } from "./types";

const D = Math.PI / 180;

export interface SpriteState { x: number; face: number; view: View; clip: ClipId; pose: Pose; say?: string }
export interface Slice { url: string; w: number; h: number }

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

export function drawSprite(
  c: CanvasRenderingContext2D, d: CharacterDef, st: SpriteState, t: number, footY: number, scale: number
) {
  const sp = d.sprite;
  if (!sp) return;
  const p = st.pose;

  // pick the view (and whether to mirror it)
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

  // whole-body motion on top of the still picture
  let rot = p.tilt * 0.5, sy = 1, dy = p.bob * scale + p.pitch * 0.4;
  if (st.view === "side") { rot += Math.sin(t * 7) * 2.5; sy += Math.sin(t * 14) * 0.015; }
  if (st.clip === "wave") rot += Math.sin(t * 10) * 3;
  if (st.clip === "shrug") sy -= 0.03;
  if (st.clip === "jump") sy += Math.max(0, -p.bob / 55) * 0.06;
  if (st.say) sy += Math.sin(t * 11) * 0.008;

  c.fillStyle = "rgba(0,0,0,0.16)";
  c.beginPath(); c.ellipse(st.x, footY, Math.max(30, w * 0.4), 9 * scale, 0, 0, Math.PI * 2); c.fill();

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
  // background colour = average of the four corners
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

  // soften the edge: opaque pixels touching a removed pixel become semi-transparent
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

  // one shared scale so all views stay the same size relative to each other
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
