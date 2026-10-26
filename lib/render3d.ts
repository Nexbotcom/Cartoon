import * as THREE from "three";
import { CharacterDef, PropKind, Scene, ThemeId } from "./types";
import { FOOT, H, W, actorState, camAt, drawBubble, posAt, propPlace, visibleAt } from "./engine";

const D = Math.PI / 180, TAU = Math.PI * 2;
const UNIT = 150;                                   // 2D pixels per 3D metre
const toX = (px: number) => (px - 640) / UNIT;
const toZ = (depth: number) => -depth * 8;
const sm = (u: number) => u * u * (3 - 2 * u);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (i: number, k: number) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5; return s - Math.floor(s); };
const dk = (h: string, f: number) => {
  if (h[0] !== "#" || h.length < 7) return h;
  const n = parseInt(h.slice(1, 7), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
};

export interface Renderer3D {
  render(c: CanvasRenderingContext2D, s: Scene, t: number, o: { theme: ThemeId; bubbles: boolean }): void;
  dispose(): void;
}

interface EnvCfg {
  sky: string[]; ground: string; hemi: [string, string, number];
  sun?: { dir: [number, number, number]; color: string; intensity: number; disc: string; size: number };
  stars?: boolean; bld?: [string, string]; road?: boolean; trees?: boolean; room?: boolean; lit?: boolean;
  place?: "pitch" | "school" | "hospital";
}
const DAYSUN = { dir: [0.5, 0.35, -0.8] as [number, number, number], color: "#fff6df", intensity: 2.2, disc: "#fff3b0", size: 5 };
const ENV: Record<ThemeId, EnvCfg> = {
  day:      { sky: ["#8fd0ff", "#eef8ff"], ground: "#9bc58a", hemi: ["#cfe9ff", "#8a9a7a", 1.3], sun: DAYSUN, bld: ["#b3bfd3", "#e6ecf7"], road: true },
  sunset:   { sky: ["#2d1f5e", "#d9577a", "#ffb36b"], ground: "#5a6b4a", hemi: ["#ffb08a", "#4a3a5a", 0.9], sun: { dir: [-0.6, 0.12, -0.8], color: "#ffb27a", intensity: 1.6, disc: "#ffd29a", size: 8 }, bld: ["#4a2f66", "#7a5588"], road: true },
  night:    { sky: ["#0b1030", "#1b2a5c"], ground: "#27413a", hemi: ["#4a5a9a", "#1a2438", 0.8], sun: { dir: [0.4, 0.45, -0.8], color: "#9fb4ff", intensity: 0.9, disc: "#f4f1d8", size: 3.5 }, stars: true, bld: ["#202b4d", "#ffd86b"], road: true, lit: true },
  park:     { sky: ["#9fdcff", "#f4fbff"], ground: "#8fd07a", hemi: ["#cfe9ff", "#7a9a6a", 1.3], sun: { dir: [-0.45, 0.4, -0.8], color: "#fff6df", intensity: 2.2, disc: "#fff3b0", size: 5 }, trees: true },
  room:     { sky: ["#eadfce", "#d9ccb8"], ground: "#b98c5e", hemi: ["#fff2e0", "#8a6a4a", 1.5], room: true },
  pitch:    { sky: ["#7ec8ff", "#eaf6ff"], ground: "#3f9a4a", hemi: ["#cfe9ff", "#7a9a6a", 1.3], sun: DAYSUN, place: "pitch" },
  school:   { sky: ["#8fd0ff", "#eef8ff"], ground: "#8e949c", hemi: ["#cfe9ff", "#8a9a7a", 1.3], sun: DAYSUN, place: "school" },
  hospital: { sky: ["#a9d8ff", "#f4fbff"], ground: "#9bc58a", hemi: ["#cfe9ff", "#8a9a7a", 1.3], sun: DAYSUN, place: "hospital" },
};

interface Rig {
  sig: string; root: THREE.Group; body: THREE.Group; torso: THREE.Group; neck: THREE.Group;
  armL: THREE.Group; elL: THREE.Group; armR: THREE.Group; elR: THREE.Group;
  legL: THREE.Group; knL: THREE.Group; legR: THREE.Group; knR: THREE.Group;
  eyes: { g: THREE.Group; pup: THREE.Group }[]; brows: THREE.Mesh[];
  mFlat: THREE.Mesh; mSmile: THREE.Mesh; mFrown: THREE.Mesh; mOpen: THREE.Mesh;
  laptop: THREE.Group; angle: number; init: boolean; s: number;
}
interface RiderHead { g: THREE.Group; skin: THREE.Mesh; hair: THREE.Mesh }

export function createRenderer3D(): Renderer3D {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene3 = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 300);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -14; sun.shadow.camera.right = 14; sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0005;
  const roomLight = new THREE.PointLight(0xfff0d0, 0, 18, 2);
  roomLight.position.set(0, 4, -3);
  scene3.add(hemi, sun, sun.target, roomLight);

  // ---------- materials ----------
  const gm = new THREE.DataTexture(new Uint8Array([60, 140, 255]), 3, 1, THREE.RedFormat);
  gm.minFilter = THREE.NearestFilter; gm.magFilter = THREE.NearestFilter; gm.needsUpdate = true;
  const matCache = new Map<string, THREE.MeshToonMaterial>();
  const toon = (col: string) => {
    let m = matCache.get(col);
    if (!m) { m = new THREE.MeshToonMaterial({ color: new THREE.Color(col), gradientMap: gm }); matCache.set(col, m); }
    return m;
  };
  const glow = (col: string, k = 0.9) => {
    const key = `glow|${col}|${k}`;
    let m = matCache.get(key);
    if (!m) { m = new THREE.MeshToonMaterial({ color: new THREE.Color(col), gradientMap: gm, emissive: new THREE.Color(col), emissiveIntensity: k }); matCache.set(key, m); }
    return m;
  };
  const glassMat = new THREE.MeshToonMaterial({ color: new THREE.Color("#cfe9ff"), gradientMap: gm, transparent: true, opacity: 0.4 });

  // ---------- shape helpers ----------
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
  const disposeObj = (o: THREE.Object3D) => {
    o.traverse(ch => { const m = ch as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
  };

  // ---------- characters ----------
  const buildCharacter = (def: CharacterDef): Rig => {
    const b = def.build ?? 1;
    const skin = def.skin, top = def.top, bot = def.bottom;
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const hipY = 0.88;

    const mkLeg = (sgn: number) => {
      const lg = new THREE.Group(); lg.position.set(sgn * 0.1 * b, hipY, 0); body.add(lg);
      const bare = def.outfit !== "pants";
      limb(lg, 0.072 * b, 0.44, def.outfit === "skirt" ? skin : bot);
      const kn = new THREE.Group(); kn.position.y = -0.44; lg.add(kn);
      limb(kn, 0.055 * b, 0.4, bare ? skin : bot);
      bx(kn, 0.11 * b, 0.08, 0.25, def.shoes, 0, -0.41, 0.045);
      return { lg, kn };
    };
    const L = mkLeg(-1), R = mkLeg(1);

    const torso = new THREE.Group(); torso.position.y = hipY; body.add(torso);
    mesh(torso, new THREE.CapsuleGeometry(0.15, 0.25, 4, 14), toon(top), 0, 0.28, 0).scale.set(1.35 * b, 1, 0.75);
    sph(torso, 0.15, bot, 0, 0.02, 0, 1.3 * b, 0.75, 0.82);
    if (def.outfit === "skirt") {
      const sk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19 * b, 0.34 * b, 0.34, 24, 1, true),
        new THREE.MeshToonMaterial({ color: new THREE.Color(bot), gradientMap: gm, side: THREE.DoubleSide }));
      sk.position.y = -0.1; sk.castShadow = true; torso.add(sk);
    }

    const mkArm = (sgn: number) => {
      const sh = new THREE.Group(); sh.position.set(sgn * (0.205 * b + 0.045), 0.5, 0); torso.add(sh);
      sph(sh, 0.058, top, 0, 0, 0);
      limb(sh, 0.045 * b, 0.29, skin);
      const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
      limb(el, 0.04 * b, 0.27, skin);
      sph(el, 0.052, skin, 0, -0.29, 0);
      if (def.sleeve === "long") { limb(sh, 0.054 * b, 0.29, top); limb(el, 0.047 * b, 0.2, top); }
      else limb(sh, 0.058 * b, 0.17, top);
      return { sh, el };
    };
    const AL = mkArm(-1), AR = mkArm(1);

    const neck = new THREE.Group(); neck.position.y = 0.56; torso.add(neck);
    cyl(neck, 0.045, 0.05, 0.1, skin, 0, 0.02, 0);
    const head = new THREE.Group(); head.position.y = 0.14; neck.add(head);
    sph(head, 0.115, skin, 0, 0, 0, 1, 1.1, 1);
    sph(head, 0.028, skin, -0.113, -0.005, 0, 0.6, 1, 1);
    sph(head, 0.028, skin, 0.113, -0.005, 0, 0.6, 1, 1);

    if (def.hairStyle !== "none") {
      const hm = toon(def.hair);
      const cap = mesh(head, new THREE.SphereGeometry(0.122, 28, 18, 0, TAU, 0, 1.1), hm, 0, 0.012, -0.004);
      const back = mesh(head, new THREE.SphereGeometry(0.123, 28, 18, Math.PI, Math.PI, 0, def.hairStyle === "long" ? 2.5 : 1.95), hm, 0, 0, -0.004);
      cap.scale.y = 1.1; back.scale.y = 1.1;
      if (def.hairStyle === "spiky") {
        const cg = new THREE.ConeGeometry(0.04, 0.11, 6);
        for (let k = 0; k < 7; k++) {
          const th = k === 0 ? 0 : 0.75, ph = ((k - 1) / 6) * TAU;
          const dir = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)).normalize();
          const cn = mesh(head, cg, hm, dir.x * 0.125, dir.y * 0.138 + 0.01, dir.z * 0.125);
          cn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        }
      }
      if (def.hairStyle === "bun") sph(head, 0.058, def.hair, 0, 0.14, -0.05);
      if (def.hairStyle === "long") mesh(head, new THREE.CapsuleGeometry(0.09, 0.2, 4, 10), hm, 0, -0.12, -0.075).scale.set(1.3, 1, 0.6);
    }

    const eyes = [-1, 1].map(s => {
      const g = new THREE.Group(); g.position.set(s * 0.043, 0.018, 0.1); head.add(g);
      sph(g, 0.027, "#ffffff", 0, 0, 0, 1, 1.1, 0.5);
      const pup = new THREE.Group(); g.add(pup);
      sph(pup, 0.017, def.eye ?? "#3b2a1e", 0, 0, 0.008, 1, 1, 0.5);
      sph(pup, 0.009, "#14101c", 0, 0, 0.014, 1, 1, 0.5);
      return { g, pup };
    });
    const browCol = def.hairStyle === "none" ? "#3a2a20" : dk(def.hair, 0.8);
    const brows = [-1, 1].map(s => bx(head, 0.045, 0.009, 0.008, browCol, s * 0.043, 0.052, 0.104));
    sph(head, 0.018, dk(skin, 0.9), 0, -0.018, 0.113, 1, 0.9, 1);

    const mFlat = mesh(head, new THREE.BoxGeometry(0.05, 0.006, 0.006), toon("#5a2a2a"), 0, -0.052, 0.107);
    const mSmile = mesh(head, new THREE.TorusGeometry(0.028, 0.0045, 6, 18, Math.PI), toon("#5a2a2a"), 0, -0.034, 0.107);
    mSmile.rotation.z = Math.PI;
    const mFrown = mesh(head, new THREE.TorusGeometry(0.026, 0.0045, 6, 18, Math.PI), toon("#5a2a2a"), 0, -0.078, 0.107);
    const mOpen = sph(head, 0.022, "#5a1f2a", 0, -0.058, 0.1, 1, 0.5, 0.5);

    const laptop = new THREE.Group(); laptop.visible = false; root.add(laptop);
    bx(laptop, 1.0, 0.05, 0.6, "#8a6a4a", 0, 0.72, 0.55);
    for (const [lx, lz] of [[-0.45, 0.3], [0.45, 0.3], [-0.45, 0.8], [0.45, 0.8]]) bx(laptop, 0.05, 0.72, 0.05, "#6e5238", lx, 0.36, lz);
    bx(laptop, 0.46, 0.02, 0.32, "#c9ccd3", 0, 0.755, 0.55);
    bx(laptop, 0.46, 0.3, 0.016, "#2b2f3a", 0, 0.9, 0.42).rotation.x = -0.18;

    return {
      sig: "", root, body, torso, neck,
      armL: AL.sh, elL: AL.el, armR: AR.sh, elR: AR.el,
      legL: L.lg, knL: L.kn, legR: R.lg, knR: R.kn,
      eyes, brows, mFlat, mSmile, mFrown, mOpen, laptop,
      angle: 0, init: false, s: def.height / 300,
    };
  };

  // ---------- props (metres; front faces +Z, car faces +X) ----------
  const buildProp = (kind: PropKind, color: string): THREE.Group => {
    const g = new THREE.Group();
    const d1 = dk(color, 0.78), d2 = dk(color, 0.62);
    switch (kind) {
      case "sofa":
        bx(g, 1.9, 0.32, 0.85, d1, 0, 0.24, 0); bx(g, 1.9, 0.62, 0.22, d1, 0, 0.7, -0.32);
        bx(g, 0.22, 0.55, 0.85, d1, -0.84, 0.46, 0); bx(g, 0.22, 0.55, 0.85, d1, 0.84, 0.46, 0);
        bx(g, 0.8, 0.14, 0.62, color, -0.4, 0.45, 0.08); bx(g, 0.8, 0.14, 0.62, color, 0.4, 0.45, 0.08);
        break;
      case "chair":
        bx(g, 0.55, 0.07, 0.55, color, 0, 0.48, 0); bx(g, 0.55, 0.62, 0.07, d1, 0, 0.85, -0.24);
        for (const [sx, sz] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) bx(g, 0.06, 0.48, 0.06, d2, sx, 0.24, sz);
        break;
      case "table":
        bx(g, 1.4, 0.07, 0.8, color, 0, 0.45, 0);
        for (const [sx, sz] of [[-0.62, -0.33], [0.62, -0.33], [-0.62, 0.33], [0.62, 0.33]]) bx(g, 0.07, 0.45, 0.07, d2, sx, 0.22, sz);
        cyl(g, 0.05, 0.04, 0.09, "#f4f1ea", -0.3, 0.52, 0.1);
        break;
      case "desk":
        bx(g, 1.7, 0.06, 0.8, color, 0, 0.76, 0);
        bx(g, 0.07, 0.76, 0.8, d1, -0.8, 0.38, 0); bx(g, 0.07, 0.76, 0.8, d1, 0.8, 0.38, 0);
        bx(g, 0.5, 0.5, 0.74, d1, 0.5, 0.45, 0);
        bx(g, 0.5, 0.02, 0.34, "#c9ccd3", -0.3, 0.8, 0.05);
        bx(g, 0.5, 0.32, 0.02, "#2b2f3a", -0.3, 0.97, -0.1).rotation.x = -0.15;
        break;
      case "bookshelf": {
        const cols = ["#e07b45", "#5b8a3c", "#4b6aa8", "#c0405a", "#f2c94c"];
        bx(g, 0.06, 2.1, 0.35, color, -0.52, 1.05, 0); bx(g, 0.06, 2.1, 0.35, color, 0.52, 1.05, 0);
        bx(g, 1.1, 2.1, 0.04, d2, 0, 1.05, -0.15);
        for (let r = 0; r < 4; r++) {
          const y0 = 0.05 + r * 0.5;
          bx(g, 1.0, 0.05, 0.33, color, 0, y0, 0);
          let x = -0.46, k = 0;
          while (x < 0.42) {
            const bw = 0.05 + ((r * 5 + k * 3) % 5) * 0.012, bh = 0.26 + ((r * 3 + k * 5) % 6) * 0.03;
            bx(g, bw, bh, 0.22, cols[(r * 7 + k) % 5], x + bw / 2, y0 + 0.025 + bh / 2, 0);
            x += bw + 0.01; k++;
          }
        }
        bx(g, 1.0, 0.05, 0.33, color, 0, 2.05, 0);
        break;
      }
      case "lamp":
        cyl(g, 0.2, 0.22, 0.04, "#3a3f4b", 0, 0.02, 0); cyl(g, 0.02, 0.02, 1.6, "#3a3f4b", 0, 0.85, 0);
        mesh(g, new THREE.CylinderGeometry(0.14, 0.24, 0.3, 18), glow(color, 0.7), 0, 1.75, 0);
        break;
      case "plant":
        cyl(g, 0.16, 0.12, 0.3, "#c9855a", 0, 0.15, 0);
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * TAU;
          const leaf = sph(g, 1, k % 2 ? color : d1, Math.cos(a) * 0.1, 0.6, Math.sin(a) * 0.1, 0.09, 0.3, 0.09);
          leaf.rotation.z = -Math.cos(a) * 0.5; leaf.rotation.x = Math.sin(a) * 0.5;
        }
        break;
      case "tv":
        bx(g, 1.5, 0.5, 0.5, "#8a6a4a", 0, 0.25, 0); bx(g, 1.5, 0.9, 0.08, color, 0, 0.98, 0);
        bx(g, 1.38, 0.78, 0.02, "#3a6ea5", 0, 0.98, 0.05, true);
        break;
      case "door": {
        bx(g, 1.0, 2.2, 0.1, d2, 0, 1.1, 0);
        bx(g, 0.84, 2.1, 0.02, "#241d2b", 0, 1.05, -0.03);
        const pivot = new THREE.Group(); pivot.position.set(-0.42, 0, 0.03); g.add(pivot);
        bx(pivot, 0.84, 2.1, 0.08, color, 0.42, 1.05, 0);
        bx(pivot, 0.6, 0.8, 0.02, d1, 0.42, 1.5, 0.05); bx(pivot, 0.6, 0.8, 0.02, d1, 0.42, 0.6, 0.05);
        sph(pivot, 0.04, "#f2c94c", 0.74, 1.05, 0.07);
        g.userData.panel = pivot;
        break;
      }
      case "bed":
        bx(g, 2.1, 0.3, 1.5, "#8a6a4a", 0, 0.25, 0); bx(g, 2.0, 0.25, 1.4, "#f4f1ea", 0, 0.52, 0);
        bx(g, 1.4, 0.1, 1.46, color, 0.3, 0.66, 0);
        bx(g, 0.5, 0.12, 0.4, "#ffffff", -0.7, 0.7, 0.35); bx(g, 0.5, 0.12, 0.4, "#ffffff", -0.7, 0.7, -0.35);
        bx(g, 0.1, 1.0, 1.6, "#8a6a4a", -1.05, 0.7, 0);
        break;
      case "tree":
        cyl(g, 0.18, 0.24, 1.4, "#6b4a2f", 0, 0.7, 0);
        sph(g, 1.0, d1, 0, 2.3, 0); sph(g, 0.8, color, -0.6, 2.0, 0.2); sph(g, 0.8, color, 0.6, 2.0, -0.1); sph(g, 0.9, color, 0, 2.6, 0);
        break;
      case "bench":
        bx(g, 1.5, 0.06, 0.45, color, 0, 0.42, 0);
        bx(g, 1.5, 0.12, 0.05, color, 0, 0.72, -0.2); bx(g, 1.5, 0.12, 0.05, color, 0, 0.9, -0.2);
        bx(g, 0.06, 0.42, 0.4, d2, -0.65, 0.21, 0); bx(g, 0.06, 0.42, 0.4, d2, 0.65, 0.21, 0);
        break;
      case "streetlight":
        cyl(g, 0.05, 0.07, 3.4, color, 0, 1.7, 0); cyl(g, 0.12, 0.14, 0.15, color, 0, 0.07, 0);
        bx(g, 0.7, 0.06, 0.06, color, 0.3, 3.4, 0); bx(g, 0.4, 0.1, 0.2, color, 0.6, 3.35, 0);
        bx(g, 0.3, 0.04, 0.14, "#fff3b0", 0.6, 3.28, 0, true);
        break;
      case "car": {
        bx(g, 2.1, 0.45, 1.0, color, 0, 0.5, 0);
        bx(g, 1.1, 0.06, 0.92, color, -0.15, 1.17, 0);
        for (const sx of [-0.65, 0.35]) for (const sz of [-0.43, 0.43]) bx(g, 0.06, 0.42, 0.06, color, sx, 0.93, sz);
        mesh(g, new THREE.BoxGeometry(1.0, 0.34, 0.9), glassMat, -0.15, 0.95, 0);
        bx(g, 0.9, 0.1, 0.8, "#3a3f4b", -0.15, 0.62, 0); bx(g, 0.1, 0.3, 0.7, "#3a3f4b", -0.5, 0.82, 0);
        bx(g, 0.05, 0.12, 0.2, "#ffe9a8", 1.06, 0.55, 0.3, true); bx(g, 0.05, 0.12, 0.2, "#ffe9a8", 1.06, 0.55, -0.3, true);
        bx(g, 0.05, 0.1, 0.2, "#e45b5b", -1.06, 0.55, 0.3, true); bx(g, 0.05, 0.1, 0.2, "#e45b5b", -1.06, 0.55, -0.3, true);
        bx(g, 0.08, 0.14, 1.04, d1, 1.08, 0.35, 0); bx(g, 0.08, 0.14, 1.04, d1, -1.08, 0.35, 0);
        const wheels: THREE.Group[] = [];
        for (const sx of [-0.7, 0.7]) for (const sz of [-0.5, 0.5]) {
          const pv = new THREE.Group(); pv.position.set(sx, 0.27, sz); g.add(pv);
          mesh(pv, new THREE.CylinderGeometry(0.27, 0.27, 0.18, 18), toon("#22252d")).rotation.x = Math.PI / 2;
          mesh(pv, new THREE.CylinderGeometry(0.13, 0.13, 0.2, 14), toon("#c9ccd3")).rotation.x = Math.PI / 2;
          bx(pv, 0.46, 0.05, 0.2, "#22252d", 0, 0, 0);
          wheels.push(pv);
        }
        g.userData.wheels = wheels;
        const riders: RiderHead[] = [];
        for (const [hx, hz] of [[0.2, 0.25], [-0.3, 0.25]]) {
          const hg = new THREE.Group(); hg.position.set(hx, 1.0, hz); hg.visible = false; g.add(hg);
          const skinM = sph(hg, 0.11, "#f2c9a0", 0, 0, 0);
          const hairM = mesh(hg, new THREE.SphereGeometry(0.118, 14, 10, 0, TAU, 0, 1.7), toon("#2b2118"), 0, 0.012, -0.004);
          riders.push({ g: hg, skin: skinM, hair: hairM });
        }
        g.userData.riders = riders;
        break;
      }
      case "box":
        bx(g, 0.34, 0.3, 0.34, color, 0, 0.15, 0); bx(g, 0.07, 0.31, 0.35, "#f2c94c", 0, 0.15, 0); bx(g, 0.35, 0.07, 0.35, "#f2c94c", 0, 0.18, 0);
        sph(g, 0.045, "#f2c94c", -0.05, 0.34, 0, 1.4, 0.8, 1); sph(g, 0.045, "#f2c94c", 0.05, 0.34, 0, 1.4, 0.8, 1);
        break;
      case "cake":
        cyl(g, 0.3, 0.3, 0.03, "#eef0f4", 0, 0.015, 0); cyl(g, 0.22, 0.22, 0.16, "#f3d9a8", 0, 0.11, 0); cyl(g, 0.22, 0.22, 0.08, color, 0, 0.23, 0);
        for (const a of [0, 2.1, 4.2]) {
          cyl(g, 0.012, 0.012, 0.1, "#ffffff", Math.cos(a) * 0.11, 0.32, Math.sin(a) * 0.11);
          sph(g, 0.02, "#ffb703", Math.cos(a) * 0.11, 0.39, Math.sin(a) * 0.11, 1, 1.5, 1);
        }
        break;
      case "bag":
        bx(g, 0.3, 0.36, 0.16, color, 0, 0.18, 0);
        mesh(g, new THREE.TorusGeometry(0.08, 0.012, 6, 14, Math.PI), toon(d2), 0, 0.36, 0);
        break;
      case "ball":
        sph(g, 0.16, "#ffffff", 0, 0.16, 0);
        for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) sph(g, 0.05, "#22252d", dx * 0.155, 0.16 + dy * 0.155, dz * 0.155);
        break;
      case "goal": {
        cyl(g, 0.05, 0.05, 1.5, color, -1.2, 0.75, 0); cyl(g, 0.05, 0.05, 1.5, color, 1.2, 0.75, 0);
        mesh(g, new THREE.CylinderGeometry(0.05, 0.05, 2.45, 12), toon(color), 0, 1.5, 0).rotation.z = Math.PI / 2;
        const net = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 });
        const back = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5, 17, 10), net); back.position.set(0, 0.75, -0.9); g.add(back);
        for (const sx of [-1.2, 1.2]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.5, 6, 10), net); sd.rotation.y = Math.PI / 2; sd.position.set(sx, 0.75, -0.45); g.add(sd); }
        break;
      }
      case "board":
        bx(g, 0.06, 0.9, 0.06, "#6e5238", -0.95, 0.45, 0); bx(g, 0.06, 0.9, 0.06, "#6e5238", 0.95, 0.45, 0);
        bx(g, 2.2, 1.2, 0.06, color, 0, 1.5, 0); bx(g, 2.04, 1.04, 0.02, "#2f4f45", 0, 1.5, 0.03);
        bx(g, 2.2, 0.04, 0.1, color, 0, 0.88, 0.05);
        bx(g, 1.0, 0.02, 0.01, "#ffffff", -0.3, 1.65, 0.045); bx(g, 0.7, 0.02, 0.01, "#ffffff", -0.45, 1.5, 0.045); bx(g, 0.9, 0.02, 0.01, "#ffffff", -0.35, 1.35, 0.045);
        break;
    }
    return g;
  };

  // ---------- environment ----------
  const skyTex = (stops: string[]) => {
    const cv = document.createElement("canvas"); cv.width = 4; cv.height = 256;
    const x = cv.getContext("2d") as CanvasRenderingContext2D;
    const gr = x.createLinearGradient(0, 0, 0, 256), n = stops.length;
    stops.forEach((col, i) => gr.addColorStop((i / (n - 1)) * 0.5, col));
    gr.addColorStop(0.5, stops[n - 1]); gr.addColorStop(1, stops[n - 1]);
    x.fillStyle = gr; x.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const winTexture = (wall: string, win: string, lit: boolean) => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const x = cv.getContext("2d") as CanvasRenderingContext2D;
    x.fillStyle = wall; x.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) {
      x.fillStyle = lit && (r * 3 + q * 5) % 3 !== 0 ? "#ffd86b" : win;
      x.fillRect(8 + q * 28, 8 + r * 28, 18, 18);
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  const labelTex = (text: string, bg: string) => {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 64;
    const x = cv.getContext("2d") as CanvasRenderingContext2D;
    x.fillStyle = bg; x.fillRect(0, 0, 256, 64);
    x.fillStyle = "#ffffff"; x.font = "700 36px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(text, 128, 34);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const facade = (g: THREE.Group, w: number, h: number, d: number, x: number, z: number, wall: string, win: string, rx: number, ry: number) => {
    const tex = winTexture(wall, win, false);
    tex.repeat.set(rx, ry);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshToonMaterial({ map: tex, gradientMap: gm }));
    m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
    return m;
  };

  const buildPlace = (g: THREE.Group, place: "pitch" | "school" | "hospital") => {
    if (place === "pitch") {
      for (let i = -16; i < 16; i++) {
        const st = new THREE.Mesh(new THREE.PlaneGeometry(8, 60), toon(i % 2 ? "#3f9a4a" : "#47a652"));
        st.rotation.x = -Math.PI / 2; st.position.set(i * 8 + 4, 0.005, -6); st.receiveShadow = true; g.add(st);
      }
      bx(g, 130, 0.01, 0.12, "#ffffff", 0, 0.02, -12);
      bx(g, 0.12, 0.01, 16, "#ffffff", 0, 0.02, -4);
      const ring = mesh(g, new THREE.TorusGeometry(3, 0.05, 6, 40), toon("#ffffff"), 0, 0.02, -4);
      ring.rotation.x = Math.PI / 2;
      const palette = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#e9c46a", "#f1faee", "#8338ec", "#ff7aa2"].map(c => new THREE.Color(c));
      const skins = ["#f2c9a0", "#8a5a3a", "#d9a066"].map(c => new THREE.Color(c));
      for (let k = 0; k < 5; k++) bx(g, 90, (k + 1) * 0.9, 2.0, "#6f7586", 0, (k + 1) * 0.45, -15 - k * 2);
      const n = 5 * 70;
      const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.55, 0.35), new THREE.MeshToonMaterial({ gradientMap: gm }), n);
      const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshToonMaterial({ gradientMap: gm }), n);
      const m4 = new THREE.Matrix4();
      let idx = 0;
      for (let k = 0; k < 5; k++) for (let j = 0; j < 70; j++, idx++) {
        const x = -43 + j * 1.25 + (k % 2) * 0.6, y = (k + 1) * 0.9, z = -15 - k * 2 + 0.3;
        m4.makeTranslation(x, y + 0.3, z); bodies.setMatrixAt(idx, m4);
        bodies.setColorAt(idx, palette[Math.floor(rnd(idx, 1) * palette.length)]);
        m4.makeTranslation(x, y + 0.75, z); heads.setMatrixAt(idx, m4);
        heads.setColorAt(idx, skins[Math.floor(rnd(idx, 2) * skins.length)]);
      }
      bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
      if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
      if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
      g.add(bodies, heads);
      const boards = ["#2f6fdc", "#e63946", "#f4a261", "#2a9d8f"];
      for (let i = 0; i < 22; i++) bx(g, 4, 0.9, 0.1, boards[i % 4], -42 + i * 4, 0.45, -13);
      for (const sx of [-30, 30]) { cyl(g, 0.15, 0.2, 14, "#3a3f4b", sx, 7, -22); bx(g, 3, 0.8, 0.3, "#fff3b0", sx, 14.2, -21.8, true); }
    } else if (place === "school") {
      facade(g, 26, 8, 6, 0, -16, "#d9a15f", "#f4f1ea", 8, 3);
      bx(g, 27, 0.8, 7, "#9b4d3a", 0, 8.4, -16);
      bx(g, 4, 3, 1, "#7a5c3e", 0, 1.5, -12.8);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: labelTex("SCHOOL", "#2f4f6f") }));
      sign.position.set(0, 6.4, -12.95); g.add(sign);
      cyl(g, 0.05, 0.05, 7, "#6e5238", 9, 3.5, -12.5); bx(g, 1.2, 0.8, 0.05, "#e63946", 9.6, 6.6, -12.5);
      for (const sx of [-18, 18]) {
        const tg = new THREE.Group();
        cyl(tg, 0.14, 0.2, 1.2, "#6b4a2f", 0, 0.6, 0); sph(tg, 0.9, "#4f9a52", 0, 1.9, 0);
        tg.position.set(sx, 0, -13); g.add(tg);
      }
    } else {
      facade(g, 30, 10, 7, 0, -17, "#eef3f8", "#9ec9e8", 10, 3);
      bx(g, 31, 0.5, 7.5, "#cfd8e3", 0, 10.2, -17);
      bx(g, 6, 0.3, 3, "#6c8aa8", 0, 3.2, -12.5);
      bx(g, 0.2, 3, 0.2, "#6c8aa8", -2.8, 1.6, -11.2); bx(g, 0.2, 3, 0.2, "#6c8aa8", 2.8, 1.6, -11.2);
      bx(g, 3.6, 2.6, 0.1, "#cfe7f7", 0, 1.3, -13.6);
      bx(g, 3.4, 3.4, 0.4, "#ffffff", 0, 12.2, -17);
      bx(g, 0.9, 3, 0.45, "#d62839", 0, 12.2, -16.75); bx(g, 3, 0.9, 0.45, "#d62839", 0, 12.2, -16.75);
      const path = new THREE.Mesh(new THREE.PlaneGeometry(60, 3), toon("#c9ced6"));
      path.rotation.x = -Math.PI / 2; path.position.set(0, 0.012, -8.5); path.receiveShadow = true; g.add(path);
      for (const sx of [-12, 12]) { const tg = new THREE.Group(); cyl(tg, 0.14, 0.2, 1.2, "#6b4a2f", 0, 0.6, 0); sph(tg, 0.9, "#4f9a52", 0, 1.9, 0); tg.position.set(sx, 0, -10); g.add(tg); }
    }
  };

  let envGroup: THREE.Group | null = null;
  let envTheme: ThemeId | null = null;
  let sky: THREE.Mesh | null = null;

  const buildEnv = (theme: ThemeId) => {
    if (envGroup) { scene3.remove(envGroup); disposeObj(envGroup); }
    const cfg = ENV[theme];
    const g = new THREE.Group(); envGroup = g; scene3.add(g);

    if (!sky) {
      sky = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false }));
      scene3.add(sky);
    }
    const skyMat = sky.material as THREE.MeshBasicMaterial;
    if (skyMat.map) skyMat.map.dispose();
    skyMat.map = skyTex(cfg.sky); skyMat.needsUpdate = true;
    scene3.fog = new THREE.Fog(new THREE.Color(cfg.sky[cfg.sky.length - 1]), cfg.room ? 60 : 45, cfg.room ? 120 : 110);

    hemi.color.set(cfg.hemi[0]); hemi.groundColor.set(cfg.hemi[1]); hemi.intensity = cfg.hemi[2];
    if (cfg.sun) {
      const dir = new THREE.Vector3(cfg.sun.dir[0], cfg.sun.dir[1], cfg.sun.dir[2]).normalize();
      sun.color.set(cfg.sun.color); sun.intensity = cfg.sun.intensity;
      sun.position.copy(dir.clone().multiplyScalar(30)); sun.target.position.set(0, 0, -2);
      const disc = new THREE.Mesh(new THREE.SphereGeometry(cfg.sun.size, 16, 12), new THREE.MeshBasicMaterial({ color: cfg.sun.disc, fog: false }));
      disc.position.copy(dir.clone().multiplyScalar(100)); g.add(disc);
    } else {
      sun.color.set("#ffffff"); sun.intensity = 0.5; sun.position.set(2, 8, 6); sun.target.position.set(0, 0, -2);
    }
    roomLight.intensity = cfg.room ? 45 : 0;

    if (cfg.stars) {
      const pts: number[] = [];
      for (let i = 0; i < 260; i++) {
        const u = rnd(i, 1) * TAU, v = 0.15 + rnd(i, 2) * 0.85, r = 110, q = Math.sqrt(1 - v * v);
        pts.push(Math.cos(u) * q * r, v * r, Math.sin(u) * q * r);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));
    }

    if (!cfg.room) {
      const gr = new THREE.Mesh(new THREE.CircleGeometry(130, 48), toon(cfg.ground));
      gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true; g.add(gr);

      if (cfg.place) buildPlace(g, cfg.place);

      if (cfg.road) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(260, 3.6), toon("#4a4f5a"));
        road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, -4); road.receiveShadow = true; g.add(road);
        for (const zz of [-6.6, -1.4]) {
          const sw = new THREE.Mesh(new THREE.PlaneGeometry(260, 1.2), toon("#c9c4b8"));
          sw.rotation.x = -Math.PI / 2; sw.position.set(0, 0.015, zz); sw.receiveShadow = true; g.add(sw);
        }
        for (let i = -40; i < 40; i++) bx(g, 1.4, 0.01, 0.12, "#f2e6a0", i * 3.2, 0.02, -4);
      }

      if (cfg.bld) {
        const texA = winTexture(cfg.bld[0], cfg.bld[1], false), texB = winTexture(cfg.bld[0], cfg.bld[1], !!cfg.lit);
        for (let i = 0; i < 28; i++) {
          const w = 3 + rnd(i, 1) * 3, h = 5 + rnd(i, 2) * 11, d = 3 + rnd(i, 3) * 3;
          const x = -52 + i * 3.8 + rnd(i, 4) * 1.5, z = -17 - (i % 3) * 6 - rnd(i, 5) * 3;
          const tex = (cfg.lit && rnd(i, 6) > 0.25 ? texB : texA).clone();
          tex.needsUpdate = true; tex.repeat.set(Math.round(w * 1.1), Math.round(h * 0.9));
          const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: gm });
          if (cfg.lit) { mat.emissive = new THREE.Color("#ffffff"); mat.emissiveMap = tex; mat.emissiveIntensity = 0.55; }
          const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
        }
      }

      if (cfg.trees) {
        for (let i = 0; i < 40; i++) {
          const x = -45 + rnd(i, 1) * 90, z = -12 - rnd(i, 2) * 28, s = 0.8 + rnd(i, 3) * 0.9;
          const tg = new THREE.Group();
          cyl(tg, 0.14, 0.2, 1.2, "#6b4a2f", 0, 0.6, 0);
          sph(tg, 0.9, rnd(i, 4) > 0.5 ? "#4f9a52" : "#3f8a49", 0, 1.9, 0);
          sph(tg, 0.7, "#5aa85d", 0.4, 1.6, 0.2);
          tg.position.set(x, 0, z); tg.scale.setScalar(s); g.add(tg);
        }
      }
    } else {
      const wall = "#eadfce";
      bx(g, 18, 0.2, 16, cfg.ground, 0, -0.1, -2);
      for (let i = -10; i <= 10; i++) bx(g, 0.02, 0.01, 16, dk(cfg.ground, 0.8), i * 0.85, 0.005, -2);
      bx(g, 18, 5, 0.2, wall, 0, 2.5, -10);
      bx(g, 0.2, 5, 16, dk(wall, 0.95), -9, 2.5, -2);
      bx(g, 0.2, 5, 16, dk(wall, 0.95), 9, 2.5, -2);
      bx(g, 18, 0.18, 0.12, "#cfc2ae", 0, 0.09, -9.85);
      bx(g, 2.6, 1.8, 0.1, "#ffffff", -3, 2.6, -9.85);
      bx(g, 2.4, 1.6, 0.05, "#bfe3ff", -3, 2.6, -9.8, true);
      bx(g, 1.2, 0.9, 0.08, "#7a5c3e", 3.5, 2.8, -9.88); bx(g, 1.05, 0.75, 0.05, "#f3d9a8", 3.5, 2.8, -9.84);
      bx(g, 1.4, 0.9, 0.08, "#7a5c3e", 6, 2.7, -9.88); bx(g, 1.25, 0.75, 0.05, "#c9855a", 6, 2.7, -9.84);
    }
  };

  // ---------- keep 3D objects in sync with the scene ----------
  const rigs: (Rig | null)[] = [];
  const sigOf = (d: CharacterDef) => [d.skin, d.hair, d.eye, d.top, d.bottom, d.shoes, d.hairStyle, d.outfit, d.sleeve, d.build, d.height].join("|");
  const syncRigs = (s: Scene) => {
    s.actors.forEach((a, i) => {
      const sig = sigOf(a.def), cur = rigs[i];
      if (!cur || cur.sig !== sig) {
        if (cur) { scene3.remove(cur.root); disposeObj(cur.root); }
        const r = buildCharacter(a.def);
        r.sig = sig; r.root.scale.setScalar(a.def.height / 300);
        scene3.add(r.root); rigs[i] = r;
      }
    });
    for (let i = s.actors.length; i < rigs.length; i++) { const r = rigs[i]; if (r) { scene3.remove(r.root); disposeObj(r.root); } }
    rigs.length = s.actors.length;
  };

  const propObjs: ({ sig: string; g: THREE.Group } | null)[] = [];
  const syncProps = (s: Scene) => {
    s.props.forEach((p, i) => {
      const sig = p.kind + "|" + p.color, cur = propObjs[i];
      if (!cur || cur.sig !== sig) {
        if (cur) { scene3.remove(cur.g); disposeObj(cur.g); }
        const g = buildProp(p.kind, p.color);
        scene3.add(g); propObjs[i] = { sig, g };
      }
    });
    for (let i = s.props.length; i < propObjs.length; i++) { const o = propObjs[i]; if (o) { scene3.remove(o.g); disposeObj(o.g); } }
    propObjs.length = s.props.length;
  };

  // ---------- posing ----------
  const poseRig = (rig: Rig, st: ReturnType<typeof actorState>, jump: boolean, dt: number) => {
    const p = st.pose, clip = st.clip, side = st.view === "side";
    rig.root.position.set(toX(st.x), 0, toZ(st.depth));

    let target = 0;
    if (side) target = st.face > 0 ? Math.PI / 2 : -Math.PI / 2;
    else if (st.view === "back") target = Math.PI;
    else target = cl(st.lookEx * 0.55, -0.55, 0.55);
    if (!rig.init || jump) { rig.angle = target; rig.init = true; }
    else {
      const dA = Math.atan2(Math.sin(target - rig.angle), Math.cos(target - rig.angle));
      rig.angle += dA * (1 - Math.exp(-dt * 12));
    }
    rig.root.rotation.y = rig.angle;
    rig.body.position.y = -p.bob * 0.0058 - p.sit * 0.4;
    rig.torso.rotation.x = p.lean * D;

    const setArm = (sh: THREE.Group, el: THREE.Group, aU: number, aB: number, sgn: number) => {
      sh.rotation.set(0, 0, 0); el.rotation.set(0, 0, 0);
      if (st.holding) { sh.rotation.set(-0.8, 0, sgn * 0.12); el.rotation.x = -1.15; return; }
      if (clip === "type") { sh.rotation.x = -0.55; sh.rotation.z = sgn * 0.12; el.rotation.x = -1.45; return; }
      if (clip === "point" && sgn > 0) { sh.rotation.x = -1.55; sh.rotation.z = 0.15; return; }
      if (side) { sh.rotation.x = -aU * D; sh.rotation.z = sgn * 0.08; el.rotation.x = -aB * D; }
      else {
        sh.rotation.z = sgn * aU * D;
        if (clip === "wave") el.rotation.z = sgn * aB * D; else el.rotation.x = -aB * D;
      }
    };
    setArm(rig.armL, rig.elL, p.aLU, p.aLB, -1);
    setArm(rig.armR, rig.elR, p.aRU, p.aRB, 1);

    const setLeg = (lg: THREE.Group, kn: THREE.Group, aU: number, aB: number, sgn: number) => {
      lg.rotation.set(0, 0, 0); kn.rotation.set(0, 0, 0);
      if (p.sit > 0.02 && !st.moving) { lg.rotation.x = -p.sit * Math.PI / 2; kn.rotation.x = p.sit * Math.PI / 2; return; }
      if (clip === "jump") { lg.rotation.x = -0.5; kn.rotation.x = 1.0; return; }
      if (side) { lg.rotation.x = -aU * D; kn.rotation.x = aB * D; }
      else { lg.rotation.z = sgn * aU * D * 0.5; kn.rotation.x = Math.max(0, aB) * D; }
    };
    setLeg(rig.legL, rig.knL, p.lLU, p.lLB, -1);
    setLeg(rig.legR, rig.knR, p.lRU, p.lRB, 1);

    const bodyYaw = side || st.view === "back" ? 0 : cl(st.lookEx * 0.55, -0.55, 0.55);
    rig.neck.rotation.set(cl(p.pitch, -35, 35) * D, cl(p.yaw * D - bodyYaw * 0.7, -1.0, 1.0), p.tilt * D);

    const open = Math.max(p.mouth, st.expr === "surprised" ? 0.5 : 0);
    const talking = open > 0.12;
    rig.mOpen.visible = talking;
    rig.mOpen.scale.set(1.3, 0.3 + open * 1.2, 0.4);
    rig.mSmile.visible = !talking && st.expr === "happy";
    rig.mFrown.visible = !talking && (st.expr === "sad" || st.expr === "angry");
    rig.mFlat.visible = !talking && !rig.mSmile.visible && !rig.mFrown.visible;
    rig.brows.forEach((b, k) => {
      const s = k === 0 ? -1 : 1;
      b.rotation.z = st.expr === "angry" ? s * 0.35 : st.expr === "sad" ? -s * 0.35 : 0;
      b.position.y = st.expr === "surprised" ? 0.066 : st.expr === "sad" ? 0.056 : st.expr === "happy" ? 0.058 : 0.052;
    });
    rig.eyes.forEach(e => {
      e.g.scale.y = st.expr === "happy" ? 0.18 : Math.max(0.08, 1 - p.blink);
      e.pup.position.set(p.eyeX * 0.009, -p.eyeY * 0.007, 0);
    });
    rig.laptop.visible = clip === "type";
  };

  // ---------- camera (normal shot follows the 2D camera; orbit only when a shot asks for it) ----------
  const placeCamera = (s: Scene, t: number) => {
    const c2 = camAt(s, t);
    const tx = toX(c2.x), ty = cl((FOOT - c2.y) / 200, 0.5, 2.2);
    const dist = 7.2 / c2.zoom;
    let az = 0, rise = 0, ox = tx, oy = ty, oz = 0;
    for (const sh of s.shots) {
      const u = cl((t - sh.t0) / Math.max(0.01, sh.t1 - sh.t0), 0, 1);
      az += sh.deg * D * sm(u);
      if (t >= sh.t0 && t <= sh.t1) {
        rise += Math.sin(Math.PI * u) * 0.35;
        if (sh.target !== undefined) {
          const ent = sh.target >= 1000 ? s.props[sh.target - 1000] : s.actors[sh.target];
          if (ent) {
            const pe = posAt(ent, t, s.props);
            const w = sm(cl((t - sh.t0) / 0.8, 0, 1)) * (1 - sm(cl((t - (sh.t1 - 0.8)) / 0.8, 0, 1)));
            ox = lerp(tx, toX(pe.x), w);
            oz = lerp(0, toZ(pe.depth), w);
            oy = lerp(ty, 1.15, w);
          }
        }
      }
    }
    camera.position.set(ox + Math.sin(az) * dist, oy + 0.55 + rise, oz + Math.cos(az) * dist);
    camera.lookAt(ox, oy, oz);
    camera.updateMatrixWorld();
  };

  // ---------- frame ----------
  let lastNow = performance.now(), lastT = 0;
  const render = (c: CanvasRenderingContext2D, s: Scene, t: number, o: { theme: ThemeId; bubbles: boolean }) => {
    if (envTheme !== o.theme) { buildEnv(o.theme); envTheme = o.theme; }
    syncRigs(s); syncProps(s);

    const now = performance.now();
    let dt = (now - lastNow) / 1000; lastNow = now;
    const jump = Math.abs(t - lastT) > 0.25 || dt > 0.25;
    lastT = t; dt = cl(dt, 0, 0.1);

    const talkers: { x: number; y: number; z: number; say: string }[] = [];
    const sits: number[] = [];
    s.actors.forEach((a, i) => {
      const rig = rigs[i];
      if (!rig) return;
      const vis = visibleAt(a, t);
      rig.root.visible = vis;
      if (!vis) return;
      const st = actorState(s, a, t);
      poseRig(rig, st, jump, dt);
      sits[i] = st.pose.sit;
      if (st.say) talkers.push({ x: toX(st.x), y: 1.86 * rig.s, z: toZ(st.depth), say: st.say });
    });

    s.props.forEach((p, i) => {
      const po = propObjs[i];
      if (!po) return;
      const vis = visibleAt(p, t);
      po.g.visible = vis;
      if (!vis) return;
      const pl = propPlace(s, p, t);
      const holder = pl.held ? rigs[pl.by] : undefined;
      if (pl.held && holder) {
        po.g.position.set(
          holder.root.position.x + Math.sin(holder.angle) * 0.32 * holder.s,
          (0.85 - (sits[pl.by] ?? 0) * 0.4) * holder.s,
          holder.root.position.z + Math.cos(holder.angle) * 0.32 * holder.s);
        po.g.rotation.y = holder.angle;
      } else {
        po.g.position.set(toX(pl.x), pl.lift / UNIT, toZ(pl.depth));
        const dir = (p.flip ? -1 : 1) * (p.kind === "car" ? pl.face : 1);
        po.g.rotation.y = p.kind === "car" ? (dir > 0 ? 0 : Math.PI) : p.flip ? Math.PI : 0;
      }
      po.g.scale.setScalar(p.scale);

      const wheels = po.g.userData.wheels as THREE.Group[] | undefined;
      if (wheels) {
        const dir = (p.flip ? -1 : 1) * pl.face;
        for (const w of wheels) w.rotation.z = -(toX(pl.x) * dir) / 0.27;
      }
      const panel = po.g.userData.panel as THREE.Group | undefined;
      if (panel) panel.rotation.y = pl.open * 1.45;
      const riders = po.g.userData.riders as RiderHead[] | undefined;
      if (riders) {
        const inside = s.actors.filter(a => a.actions.some(q => q.ride === i && t >= q.t0 && t < q.t1));
        riders.forEach((r, k) => {
          const a = inside[k];
          r.g.visible = !!a;
          if (a) { r.skin.material = toon(a.def.skin); r.hair.material = toon(a.def.hair); }
        });
      }
    });

    placeCamera(s, t);
    if (sky) sky.position.copy(camera.position);
    renderer.render(scene3, camera);
    c.drawImage(canvas, 0, 0, W, H);

    if (o.bubbles) {
      for (const q of talkers) {
        const v = new THREE.Vector3(q.x, q.y, q.z).project(camera);
        if (v.z > -1 && v.z < 1) drawBubble(c, q.say, (v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H);
      }
    }
  };

  return {
    render,
    dispose() { disposeObj(scene3); renderer.dispose(); },
  };
}
