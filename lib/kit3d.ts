import * as THREE from "three";

export const TAU = Math.PI * 2, D = Math.PI / 180;
export const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const sm = (u: number) => u * u * (3 - 2 * u);
export const rnd = (i: number, k: number) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5; return s - Math.floor(s); };
export const dk = (h: string, f: number) => {
  if (h[0] !== "#" || h.length < 7) return h;
  const n = parseInt(h.slice(1, 7), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
};

export interface AnimIn { t: number; dt: number; alive: boolean; power: number; open: number }

export function makeKit() {
  const gm = new THREE.DataTexture(new Uint8Array([60, 140, 255]), 3, 1, THREE.RedFormat);
  gm.minFilter = THREE.NearestFilter; gm.magFilter = THREE.NearestFilter; gm.needsUpdate = true;
  const cache = new Map<string, THREE.MeshToonMaterial>();
  const toon = (col: string) => {
    let m = cache.get(col);
    if (!m) { m = new THREE.MeshToonMaterial({ color: new THREE.Color(col), gradientMap: gm }); cache.set(col, m); }
    return m;
  };
  const glow = (col: string, k = 0.9) => {
    const key = `g|${col}|${k}`;
    let m = cache.get(key);
    if (!m) { m = new THREE.MeshToonMaterial({ color: new THREE.Color(col), gradientMap: gm, emissive: new THREE.Color(col), emissiveIntensity: k }); cache.set(key, m); }
    return m;
  };
  const mesh = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const bx = (g: THREE.Object3D, w: number, h: number, d: number, col: string, x: number, y: number, z: number, lit = false) =>
    mesh(g, new THREE.BoxGeometry(w, h, d), lit ? glow(col) : toon(col), x, y, z);
  const cyl = (g: THREE.Object3D, rt: number, rb: number, h: number, col: string, x: number, y: number, z: number) =>
    mesh(g, new THREE.CylinderGeometry(rt, rb, h, 18), toon(col), x, y, z);
  const sph = (g: THREE.Object3D, r: number, col: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const m = mesh(g, new THREE.SphereGeometry(r, 20, 14), toon(col), x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };
  const limb = (g: THREE.Object3D, r: number, len: number, col: string) =>
    mesh(g, new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 4, 10), toon(col), 0, -len / 2, 0);
  const dispose = (o: THREE.Object3D) => {
    o.traverse(ch => { const m = ch as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
  };
  const tex = (w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat?: [number, number]) => {
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    draw(cv.getContext("2d") as CanvasRenderingContext2D);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    return t;
  };
  return { gm, toon, glow, mesh, bx, cyl, sph, limb, dispose, tex };
}
export type Kit = ReturnType<typeof makeKit>;
