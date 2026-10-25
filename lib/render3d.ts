import * as THREE from "three";
import { CharacterDef, PropKind, Scene, ThemeId } from "./types";
import { FOOT, H, W, actorState, camAt, drawBubble, posAt, visibleAt } from "./engine";
import { CharRig, createCharFactory } from "./char3d";

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
}
const ENV: Record<ThemeId, EnvCfg> = {
  day:    { sky: ["#8fd0ff", "#eef8ff"], ground: "#9bc58a", hemi: ["#cfe9ff", "#8a9a7a", 1.3], sun: { dir: [0.5, 0.35, -0.8], color: "#fff6df", intensity: 2.2, disc: "#fff3b0", size: 5 }, bld: ["#b3bfd3", "#e6ecf7"], road: true },
  sunset: { sky: ["#2d1f5e", "#d9577a", "#ffb36b"], ground: "#5a6b4a", hemi: ["#ffb08a", "#4a3a5a", 0.9], sun: { dir: [-0.6, 0.12, -0.8], color: "#ffb27a", intensity: 1.6, disc: "#ffd29a", size: 8 }, bld: ["#4a2f66", "#7a5588"], road: true },
  night:  { sky: ["#0b1030", "#1b2a5c"], ground: "#27413a", hemi: ["#4a5a9a", "#1a2438", 0.8], sun: { dir: [0.4, 0.45, -0.8], color: "#9fb4ff", intensity: 0.9, disc: "#f4f1d8", size: 3.5 }, stars: true, bld: ["#202b4d", "#ffd86b"], road: true, lit: true },
  park:   { sky: ["#9fdcff", "#f4fbff"], ground: "#8fd07a", hemi: ["#cfe9ff", "#7a9a6a", 1.3], sun: { dir: [-0.45, 0.4, -0.8], color: "#fff6df", intensity: 2.2, disc: "#fff3b0", size: 5 }, trees: true },
  room:   { sky: ["#eadfce", "#d9ccb8"], ground: "#b98c5e", hemi: ["#fff2e0", "#8a6a4a", 1.5], room: true },
};

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
  const rim = new THREE.DirectionalLight(0xaaccff, 0.5);
  rim.position.set(-6, 5, -8);
  const roomLight = new THREE.PointLight(0xfff0d0, 0, 18, 2);
  roomLight.position.set(0, 4, -3);
  scene3.add(hemi, sun, sun.target, rim, roomLight);

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
  const charF = createCharFactory(gm);

  // ---------- shape helpers (props and environment) ----------
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
  const disposeObj = (o: THREE.Object3D) => {
    o.traverse(ch => { const m = ch as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
  };

  // ---------- props (metres; front faces +Z, car faces +X) ----------
  const buildProp = (kind: PropKind, color: string): THREE.Group => {
    const g = new THREE.Group();
    const d1 = dk(color, 0.78), d2 = dk(color, 0.62);
    switch (kind) {
      case "sofa":
        bx(g, 1.9, 0.4, 0.85, d1, 0, 0.3, 0); bx(g, 1.9, 0.62, 0.22, d1, 0, 0.75, -0.32);
        bx(g, 0.22, 0.55, 0.85, d1, -0.84, 0.5, 0); bx(g, 0.22, 0.55, 0.85, d1, 0.84, 0.5, 0);
        bx(g, 0.8, 0.16, 0.62, color, -0.4, 0.58, 0.08); bx(g, 0.8, 0.16, 0.62, color, 0.4, 0.58, 0.08);
        break;
      case "chair":
        bx(g, 0.55, 0.07, 0.55, color, 0, 0.5, 0); bx(g, 0.55, 0.62, 0.07, d1, 0, 0.85, -0.24);
        for (const [sx, sz] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) bx(g, 0.06, 0.5, 0.06, d2, sx, 0.25, sz);
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
      case "door":
        bx(g, 1.0, 2.2, 0.1, d2, 0, 1.1, 0); bx(g, 0.84, 2.1, 0.08, color, 0, 1.05, 0.03);
        bx(g, 0.6, 0.8, 0.02, d1, 0, 1.5, 0.08); bx(g, 0.6, 0.8, 0.02, d1, 0, 0.6, 0.08);
        sph(g, 0.04, "#f2c94c", 0.3, 1.05, 0.11);
        break;
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
        bx(g, 1.5, 0.06, 0.45, color, 0, 0.45, 0);
        bx(g, 1.5, 0.12, 0.05, color, 0, 0.72, -0.2); bx(g, 1.5, 0.12, 0.05, color, 0, 0.9, -0.2);
        bx(g, 0.06, 0.45, 0.4, d2, -0.65, 0.22, 0); bx(g, 0.06, 0.45, 0.4, d2, 0.65, 0.22, 0);
        break;
      case "streetlight":
        cyl(g, 0.05, 0.07, 3.4, color, 0, 1.7, 0); cyl(g, 0.12, 0.14, 0.15, color, 0, 0.07, 0);
        bx(g, 0.7, 0.06, 0.06, color, 0.3, 3.4, 0); bx(g, 0.4, 0.1, 0.2, color, 0.6, 3.35, 0);
        bx(g, 0.3, 0.04, 0.14, "#fff3b0", 0.6, 3.28, 0, true);
        break;
      case "car": {
        bx(g, 2.1, 0.45, 1.0, color, 0, 0.5, 0); bx(g, 1.1, 0.42, 0.9, color, -0.15, 0.92, 0);
        bx(g, 1.0, 0.3, 0.94, "#cfe9ff", -0.15, 0.95, 0);
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
        break;
      }
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
    rim.intensity = cfg.room ? 0.2 : 0.5;

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
  const rigs: (CharRig | null)[] = [];
  const sigOf = (d: CharacterDef) => [d.skin, d.hair, d.eye, d.top, d.bottom, d.shoes, d.hairStyle, d.outfit, d.sleeve, d.build, d.height].join("|");
  const syncRigs = (s: Scene) => {
    s.actors.forEach((a, i) => {
      const sig = sigOf(a.def), cur = rigs[i];
      if (!cur || cur.sig !== sig) {
        if (cur) { scene3.remove(cur.root); disposeObj(cur.root); }
        const r = charF.build(a.def);
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
            const w = sm(cl((t - sh.t0) / 0.8, 0, 1)) * (1 - sm(cl((t - (sh.t1 - 0.8)) / 0.8, 0, 1)));
            ox = lerp(tx, toX(posAt(ent, t).x), w);
            oz = lerp(0, toZ(ent.depth), w);
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
    s.actors.forEach((a, i) => {
      const rig = rigs[i];
      if (!rig) return;
      const vis = visibleAt(a, t);
      rig.root.visible = vis;
      if (!vis) return;
      const st = actorState(s, a, t);
      charF.pose(rig, st, toX(st.x), toZ(a.depth), jump, dt, t);
      if (st.say) talkers.push({ x: toX(st.x), y: 1.86 * rig.s, z: toZ(a.depth), say: st.say });
    });

    s.props.forEach((p, i) => {
      const po = propObjs[i];
      if (!po) return;
      const vis = visibleAt(p, t);
      po.g.visible = vis;
      if (!vis) return;
      const ps = posAt(p, t);
      po.g.position.set(toX(ps.x), 0, toZ(p.depth));
      po.g.scale.setScalar(p.scale);
      const dir = (p.flip ? -1 : 1) * (p.kind === "car" ? ps.face : 1);
      po.g.rotation.y = p.kind === "car" ? (dir > 0 ? 0 : Math.PI) : p.flip ? Math.PI : 0;
      const wheels = po.g.userData.wheels as THREE.Group[] | undefined;
      if (wheels) for (const w of wheels) w.rotation.z = -(toX(ps.x) * dir) / 0.27;
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
